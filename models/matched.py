"""Compare methods at equal false-alarm rates, and the recall / false-alarm curves.

Operating points read from the test period, shown to compare methods at equal false-alarm rates;
the frozen threshold result is the pre-registered one. Nothing here changes a frozen threshold.

For a target rate f, the threshold is found by scanning candidate thresholds from the highest down
and keeping the last one whose false alarms per BA-year are <= f (the same scan as the v2 threshold
choice). Periods: FINAL TEST 2023-2024 (warn_fcst with observed weather, warn_full, warn_grid) and
the 2024 real-forecast window (warn_fcst with real archived forecasts).

Writes: out/matched.json
Run: uv run python matched.py   (after final_test.py and real_forecast.py)
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

import common as C
import warn_lib as W

RULES = ["rule_forecast_error", "rule_hand", "rule_record"]
CURVE_FA = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30]
LABEL = ("operating points read from the test period, shown to compare methods at equal false-alarm rates; "
         "the frozen threshold result above is the pre-registered one")


def point(b: dict, thr: float) -> dict:
    return {"threshold": float(thr), "falsePerBaYear": b["falseAlarmsPerBaYear"], "warned12h": b["warned12h"],
            "recall12h": b["recall12h"], "peopleRecall12h": b["peopleRecall12h"], "medianLeadHours": b["medianLeadHours"],
            "testEvents": b["testEvents"]}


def sweep(d: W.Data, panel: C.Panel, s: np.ndarray) -> list[dict]:
    """Points for candidate thresholds, highest first."""
    f = s[np.isfinite(s)]
    qs = 1.0 - np.logspace(-5, np.log10(0.6), 260)
    cands = np.unique(np.quantile(f, qs))[::-1]
    out = []
    for t in cands:
        b = panel.summary(s, float(t), d.all_starts)
        out.append(point(b, t))
    return out


def at_rate(table: list[dict], target: float) -> dict | None:
    best = None
    for p in table:                                   # highest threshold first
        if p["falsePerBaYear"] > target:
            break
        best = p
    return best


def curve(table: list[dict]) -> list[dict]:
    pts, seen = [], set()
    for f in CURVE_FA:
        p = at_rate(table, f)
        if p and p["threshold"] not in seen:
            seen.add(p["threshold"])
            pts.append({k: p[k] for k in ("falsePerBaYear", "recall12h", "peopleRecall12h", "medianLeadHours", "threshold")})
    return pts


def main() -> None:
    d = W.Data()
    frozen = json.loads((C.OUT / "warn_frozen.json").read_text())["methods"]
    fin = json.loads((C.OUT / "warn_final.json").read_text())["models"]
    rf = json.loads((C.OUT / "real_forecast.json").read_text())["models"]
    sc = pd.read_parquet(C.ART / "warn_scores.parquet")
    assert (sc.ba.values == d.df.ba.values).all() and (sc.hour.values == d.df.hour.values).all()
    res = {"label": LABEL, "periods": {"final": [C.DEV_END, C.TEST_END]}, "final": {}, "real2024": {}, "curves": {}}

    # FINAL TEST.
    p = d.test_panel()
    tables = {n: sweep(d, p, sc[n].values[p.rows].astype(float)) for n in ("warn_fcst", "warn_full", "warn_grid")}
    rule_pts = {r: point(fin[r]["test"], frozen[r]["threshold"]) for r in RULES}
    targets = {r: rule_pts[r]["falsePerBaYear"] for r in RULES} | {"fixed_6": 6.0}
    for n in ("warn_fcst", "warn_full", "warn_grid"):
        res["final"][n] = {k: at_rate(tables[n], v) for k, v in targets.items()}
    res["final"]["rules"] = rule_pts
    for n, t in tables.items():
        res["curves"][n] = curve(t)
    for r in RULES:
        res["curves"][r] = [{k: rule_pts[r][k] for k in ("falsePerBaYear", "recall12h", "peopleRecall12h", "medianLeadHours", "threshold")}]

    # 2024 real-forecast window.
    z = np.load(C.ART / "real_forecast_scores.npz")
    rows, real, p0, p1 = z["rows"], z["real"], int(z["p0"]), int(z["p1"])
    ev = d.ev[(d.ev.start_h >= p0 + C.LOOKBACK_H) & (d.ev.start_h < p1)]
    p2 = C.Panel(d.df, rows, ev)
    res["periods"]["real2024"] = [str(C.from_h(p0)), str(C.from_h(p1 - 1))]
    t_real = sweep(d, p2, real)
    t_obs = sweep(d, p2, sc.warn_fcst.values[rows].astype(float))
    rule24 = {r: {"threshold": frozen[r]["threshold"], "falsePerBaYear": rf[r]["falseAlarmsPerBaYear"], "warned12h": rf[r]["warned12h"],
                  "recall12h": rf[r]["recall12h"], "peopleRecall12h": rf[r]["peopleRecall12h"],
                  "medianLeadHours": rf[r]["medianLeadHours"], "testEvents": rf[r]["testEvents"]} for r in RULES}
    t24 = {r: rule24[r]["falsePerBaYear"] for r in RULES} | {"fixed_6": 6.0}
    res["real2024"]["warn_fcst_real"] = {k: at_rate(t_real, v) for k, v in t24.items()}
    res["real2024"]["warn_fcst_observed"] = {k: at_rate(t_obs, v) for k, v in t24.items()}
    res["real2024"]["rules"] = rule24
    res["curves"]["warn_fcst_real2024"] = curve(t_real)
    res["curvesPeriods"] = {"warn_fcst": "final", "warn_full": "final", "warn_grid": "final", "warn_fcst_real2024": "real2024",
                            **{r: "final (frozen threshold, single point)" for r in RULES}}
    for per in ("final", "real2024"):
        for n, pts in res[per].items():
            if n == "rules":
                continue
            print(per, n, {k: (None if v is None else (round(v["falsePerBaYear"], 2), v["warned12h"], round(v["peopleRecall12h"] or 0, 3)))
                           for k, v in pts.items()})
        print(per, "rules", {r: (round(v["falsePerBaYear"], 2), v["warned12h"], round(v["peopleRecall12h"] or 0, 3)) for r, v in res[per]["rules"].items()})
    (C.OUT / "matched.json").write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
