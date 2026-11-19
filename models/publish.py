"""Check key coverage and recompute test results from the files before sharing them."""
import errno
import json
import math
import os
import shutil
from tempfile import TemporaryDirectory

import duckdb

import common as C


def main():
    db = duckdb.connect()
    for name, path in {
        "risk": C.ART / "ba_hour_pred.parquet",
        "features": C.SHARED / "ba_hour_features.parquet",
        "pred": C.ART / "county_event_pred.parquet",
        "counties": C.ART / "county_event.parquet",
        "events": C.DATA_OUT / "events.parquet",
    }.items():
        db.read_parquet(str(path)).create_view(name)
    threshold = json.loads((C.ART / "warn_threshold.json").read_text())
    metrics = json.loads((C.APP_MODELS / "metrics.json").read_text())
    warn = json.loads((C.OUT / "warn_results.json").read_text())
    assert set(threshold) == {"p_grid", "p_full"}
    assert db.table("risk").columns == ["ba", "hour", "p_grid", "p_full"]
    assert db.table("pred").columns == ["event_id", "fips", "pred_dark_hours"]
    for left, right, key in [("features", "risk", "ba, hour"), ("counties", "pred", "event_id, fips")]:
        missing, extra, duplicate = db.execute(f"""
            SELECT (SELECT count(*) FROM {left} ANTI JOIN {right} USING ({key})),
                   (SELECT count(*) FROM {right} ANTI JOIN {left} USING ({key})),
                   (SELECT count(*) - count(DISTINCT ({key})) FROM {right})""").fetchone()
        assert (missing, extra, duplicate) == (0, 0, 0), (right, missing, extra, duplicate)
    assert db.execute("""SELECT count(*) FROM features JOIN risk USING (ba,hour)
                         WHERE in_event AND (p_full IS NOT NULL OR p_grid IS NOT NULL)
                            OR p_full NOT BETWEEN 0 AND 1 OR p_grid NOT BETWEEN 0 AND 1""").fetchone()[0] == 0
    assert db.execute("""SELECT count(*) FROM pred WHERE NOT regexp_full_match(fips,'[0-9]{5}')
                         OR pred_dark_hours IS NULL OR NOT isfinite(pred_dark_hours) OR pred_dark_hours < 0""").fetchone()[0] == 0
    for name, col in (("warn_full", "p_full"), ("warn_grid", "p_grid")):
        # Consuming programs recreate alerts from the shared scores and thresholds.
        model = json.loads((C.APP_MODELS / f"{name}.json").read_text())
        assert model["threshold"] == threshold[col] == warn["models"][name]["threshold"]
        events, hits = db.execute(f"""
            SELECT count(*), count(lead_hours) FILTER (WHERE lead_hours >= 12) FROM (
                SELECT e.event_id, date_diff('hour', min(r.hour), e.start) AS lead_hours
                FROM events e LEFT JOIN risk r ON e.ba=r.ba AND r.{col} >= ?
                 AND r.hour >= e.start - INTERVAL 72 HOUR AND r.hour < e.start AND r.hour >= ?::TIMESTAMP
                WHERE e.start >= ?::TIMESTAMP GROUP BY e.event_id, e.start)""",
            [threshold[col], C.SPLIT, C.SPLIT]).fetchone()
        assert (events, hits) == (metrics["models"][name]["testEvents"], metrics["models"][name]["warned12h"])
    n, mae = db.execute("""SELECT count(dark_hours), avg(abs(dark_hours - pred_dark_hours))
                           FROM counties JOIN pred USING (event_id, fips) WHERE start >= ?::TIMESTAMP""", [C.SPLIT]).fetchone()
    assert n == metrics["dark"]["testCountyEvents"] and math.isclose(mae, metrics["dark"]["maeHours"])
    if C.SPLIT == "2021-01-01":
        library = json.loads((C.DATA_OUT / "events.json").read_text())
        assert set(range(2015, 2025)).issubset(library["years"]), "The final split requires the full event library"
        assert metrics["testYears"] == [2021, max(library["years"])]
        assert library["count"] == events + warn["trainEvents"]
    for name in ("warn_grid", "warn_full", "dark"):
        path = C.APP_MODELS / f"{name}.json"
        model = json.loads(path.read_text())
        assert path.stat().st_size < 3_000_000 and len(model["parity"]) == 200 and len(model["trees"]) > 0
        assert model["name"] == name and all(len(r["x"]) == len(model["features"]) for r in model["parity"])
        assert not any(f.startswith("fx_") for f in model["features"])
    assert all(max(v["trainFalseRate"], v["train_oof"]["falseAlarmsPerBaYear"]) <= C.FA_LIMIT
               for v in warn["models"].values())

    # Stage each replacement in the owned directory. Renaming it switches the
    # shared filename atomically on the team's local volume.
    with TemporaryDirectory(dir=C.ART) as tmp:
        for filename in ("ba_hour_pred.parquet", "county_event_pred.parquet", "warn_threshold.json"):
            source, target = C.ART / filename, C.SHARED / filename
            staged = shutil.copy2(source, tmp)
            try:
                os.replace(staged, target)
            except OSError as e:
                if e.errno != errno.EXDEV:
                    raise
                shutil.copyfile(staged, target)
    print(f"Verified and published three shared files for {events} test events and {n:,} observed test county-events.")


if __name__ == "__main__":
    main()
