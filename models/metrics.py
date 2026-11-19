"""Write app/public/models/metrics.json (Metrics in app/src/contracts.ts, plus the optional v2 keys
"dev", "importance" and "split").

"models" and "dark" hold FINAL TEST (2023-2024) numbers. "dev" holds the same shape for DEV (2021-2022).
Run: uv run python metrics.py   (after final_test.py)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import common as C

ORDER = ["warn_grid", "warn_full", "warn_fcst", "rule_forecast_error", "rule_hand", "rule_record"]
KEYS = ("testEvents", "warned12h", "recall12h", "medianLeadHours", "falseAlarmsPerBaYear", "aucPr")


GROUP_KEYS = ("testEvents", "warned6h", "warned12h", "warned24h", "recall12h", "peopleRecall12h", "medianLeadHours")
SEASON_KEY = {"winter": "winter", "summer": "summer", "other": "other_months"}   # key names the evidence page uses
GROUP_LABEL = {"demand_record": "Demand-record events (fc12_vs_month_record >= 1.0 in the 24 h before the start)",
               "other": "Other (storm-like) events", "winter": "Winter (Dec to Feb)", "summer": "Summer (Jun to Aug)",
               "other_months": "Other months"}


def model_block(b):
    """Metrics fields plus the optional ones the evidence page reads."""
    return {**{k: b[k] for k in KEYS}, "warned6h": b["warned6h"], "warned24h": b["warned24h"],
            "peopleRecall12h": b["peopleRecall12h"], "customerHoursRecall12h": b["custHoursRecall12h"]}


def split_blocks(blocks: dict, part: str, keymap: dict | None = None, fa: bool = False) -> dict:
    """{group: {label, models: {method: {...}}}} from per-method blocks that hold `part`."""
    names = next(iter(blocks.values()))[part].keys()
    out = {}
    for g in names:
        key = (keymap or {}).get(g, g)
        keys = GROUP_KEYS + (("falseAlarmsPerBaYear", "aucPr") if fa else ())
        out[key] = {"label": GROUP_LABEL.get(key, key),
                    "models": {n: {k: b[part][g].get(k) for k in keys} for n, b in blocks.items()}}
    return out


def dark_block(b):
    return None if not b else {"testCountyEvents": b["countyEvents"], "maeHours": b["maeHours"],
                               "baselineMaeHours": b["baselineMaeHours"], "spearman": b["spearman"],
                               "events": b["events"], "withinEventSpearman": b["withinEventSpearman"],
                               "baselineWithinEventSpearman": b["baselineWithinEventSpearman"],
                               "historySpearman": b["baselineWithinEventSpearman"],
                               "top10Overlap": b["top10Overlap"], "top10History": b["baselineTop10Overlap"],
                               "top10Chance": b["top10Chance"], "eventsScored": b["top10Events"]}


def main() -> None:
    w = json.loads((C.OUT / "warn_results.json").read_text())
    f = json.loads((C.OUT / "warn_final.json").read_text())
    d = json.loads((C.OUT / "dark_results.json").read_text())
    df_ = json.loads((C.OUT / "dark_final.json").read_text())
    eq = d["equity"]
    m = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
         "trainYears": [2015, 2020], "testYears": [2023, 2024],
         "models": {n: model_block(f["models"][n]["test"]) for n in ORDER},
         "dark": dark_block(df_),
         "equity": [{k: q[k] for k in ("quartile", "meanDarkHours", "lo", "hi")} for q in eq["quartiles"]],
         "dev": {"trainYears": [2015, 2020], "testYears": [2021, 2022],
                 "models": {n: model_block(w["models"][n]["dev"]) for n in ORDER},
                 "dark": dark_block(d["dev"]),
                 "groups": split_blocks({n: w["models"][n]["dev"] for n in ORDER}, "groups"),
                 "seasons": split_blocks({n: w["models"][n]["dev"] for n in ORDER}, "seasons", SEASON_KEY, fa=True)},
         "importance": {**{n: w["models"][n]["importance"] for n in ("warn_grid", "warn_full", "warn_fcst")},
                        "dark": d["importance"]},
         "split": {"train": ["2015-07-01", "2020-12-31"], "dev": ["2021-01-01", "2022-12-31"], "test": ["2023-01-01", "2024-12-31"]},
         "labels": {"warn_fcst": C.FCST_LABEL},
         "groups": split_blocks({n: f["models"][n]["test"] for n in ORDER}, "groups"),
         "seasons": split_blocks({n: f["models"][n]["test"] for n in ORDER}, "seasons", SEASON_KEY, fa=True)}
    mt_path = C.OUT / "matched.json"
    if mt_path.exists():
        mt = json.loads(mt_path.read_text())
        m["curves"] = mt["curves"]
        m["curvesPeriods"] = mt["curvesPeriods"]
        m["matched"] = {"label": mt["label"], "periods": mt["periods"], "final": mt["final"], "real2024": mt["real2024"]}
    rf_path = C.OUT / "real_forecast.json"
    if rf_path.exists():
        rf = json.loads(rf_path.read_text())
        m["realForecast"] = {
            "period": rf["period"], "eventsWindowFrom": rf["eventsWindowFrom"], "events": rf["events"],
            "leadRule": rf["leadRule"], "source": rf["source"],
            "label": "warn_fcst with real archived weather forecasts (2024)", "testYears": [2024, 2024],
            "note": "One more look at 2024 with frozen v2 models and thresholds; nothing refitted or retuned.",
            "models": {n: {k: v[k] for k in ("testEvents", "warned6h", "warned12h", "warned24h", "recall12h", "peopleRecall12h",
                                              "medianLeadHours", "falseAlarmsPerBaYear", "aucPr")}
                       | {"customerHoursRecall12h": v["custHoursRecall12h"]} for n, v in rf["models"].items()},
            "survives": rf["survives"]}
    C.APP_MODELS.mkdir(parents=True, exist_ok=True)
    (C.APP_MODELS / "metrics.json").write_text(json.dumps(m, indent=1))
    print("metrics.json written")


if __name__ == "__main__":
    main()
