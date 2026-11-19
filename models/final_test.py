"""FINAL TEST (2023-2024), run once with the frozen models and thresholds from train_warn.py and
train_dark.py. Nothing is fitted or tuned here. Each run is appended to out/final_test_runs.log.

Writes: out/warn_final.json, out/warn_events_final.csv, out/dark_final.json
Run: uv run python final_test.py
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from scipy.stats import spearmanr

import common as C
import train_dark as D
import warn_lib as W


def dark_final() -> dict:
    f = pd.read_parquet(C.ART / "dark_frozen.parquet")
    d = f[f.is_test].copy()
    wm, wn = D.within_event_spearman(d, "pred")
    wb, _ = D.within_event_spearman(d, "baseline")
    tk, tn, tc = D.topk_overlap(d, "pred")
    tb, _, _ = D.topk_overlap(d, "baseline")
    return {"countyEvents": int(len(d)), "events": int(d.event_id.nunique()), "meanDarkHours": float(d.dark_hours.mean()),
            "maeHours": float(np.abs(d.pred - d.dark_hours).mean()),
            "baselineMaeHours": float(np.abs(d.baseline - d.dark_hours).mean()),
            "zeroMaeHours": float(d.dark_hours.abs().mean()),
            "rmseHours": float(np.sqrt(((d.pred - d.dark_hours) ** 2).mean())),
            "baselineRmseHours": float(np.sqrt(((d.baseline - d.dark_hours) ** 2).mean())),
            "spearman": float(spearmanr(d.dark_hours, d.pred).statistic),
            "baselineSpearman": float(spearmanr(d.dark_hours, d.baseline).statistic),
            "withinEventSpearman": wm, "baselineWithinEventSpearman": wb, "withinEventSpearmanEvents": wn,
            "top10Overlap": tk, "baselineTop10Overlap": tb, "top10Events": tn, "top10Chance": tc}


def main() -> None:
    frozen_txt = (C.OUT / "warn_frozen.json").read_text()
    frozen = json.loads(frozen_txt)
    d = W.Data()
    sc = pd.read_parquet(C.ART / "warn_scores.parquet")
    assert len(sc) == len(d.df) and (sc.ba.values == d.df.ba.values).all() and (sc.hour.values == d.df.hour.values).all()
    p = d.test_panel()
    res = {"period": [C.DEV_END, C.TEST_END], "testRows": int(d.test.sum()), "testPosShare": float(d.y[d.test].mean()),
           "testEvents": len(p.all_events), "models": {}}
    rows = p.all_events[["event_id", "ba", "start", "stop", "hours_above", "peak_frac", "peak_customers_out", "cust_hours", "group"]].copy()
    for name, m in frozen["methods"].items():
        s = sc[name].values.astype(float)
        b = d.evaluate(p, s[p.rows], m["threshold"])
        rows[f"lead_{name}"] = rows.event_id.map(b.pop("event_leads"))
        res["models"][name] = {"threshold": m["threshold"], "test": b}
        print(f"{name}: TEST w12 {b['warned12h']}/{b['testEvents']} fa {b['falseAlarmsPerBaYear']:.2f} ap {b['aucPr']:.4f} "
              f"people {b['peopleRecall12h']:.3f}", flush=True)
    rows.to_csv(C.OUT / "warn_events_final.csv", index=False)
    dk = dark_final()
    (C.OUT / "dark_final.json").write_text(json.dumps(dk, indent=1))
    print(f"dark: TEST mae {dk['maeHours']:.2f} (base {dk['baselineMaeHours']:.2f}) wSpearman {dk['withinEventSpearman']:.3f} "
          f"(base {dk['baselineWithinEventSpearman']:.3f}) top10 {dk['top10Overlap']:.3f} (base {dk['baselineTop10Overlap']:.3f})", flush=True)
    res["ranAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    res["frozenSha256"] = hashlib.sha256(frozen_txt.encode()).hexdigest()[:16]
    (C.OUT / "warn_final.json").write_text(json.dumps(res, indent=1))
    with open(C.OUT / "final_test_runs.log", "a") as f:
        f.write(f"{res['ranAt']} frozen {res['frozenSha256']}\n")


if __name__ == "__main__":
    main()
