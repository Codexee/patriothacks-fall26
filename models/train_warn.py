"""Before model v2: will an outage event start in this balancing area within 48 h?

Fits warn_grid, warn_full and warn_fcst and the three rule baselines on TRAIN (< 2021), with every
hyperparameter and alert threshold chosen on TRAIN. Scores TRAIN (out-of-fold) and DEV (2021-2022).
It does not score events in the FINAL TEST years; final_test.py does that once.

Writes: artifacts/<model>.txt, artifacts/warn_scores.parquet (raw scores, every row),
        artifacts/ba_hour_pred.parquet, artifacts/warn_threshold.json (published by publish.py),
        out/warn_results.json, out/warn_frozen.json, out/warn_events_dev.csv
Run: uv run python train_warn.py
"""
from __future__ import annotations

import json
import time

import numpy as np
import pandas as pd

import common as C
import warn_lib as W

# Design chosen on DEV with dev_variants.py (see out/dev_variants.json and RESULTS.md).
DESIGN = {"trail": True, "monotone": True}          # variant E in dev_variants.py
CFGS = [dict(num_leaves=nl, min_child_samples=mcs, scale_pos_weight=spw)
        for nl, mcs, spw in [(7, 2000, 1.0), (15, 500, 1.0), (15, 5000, 10.0), (31, 1000, 1.0)]]
COLS = {"warn_grid": "p_grid", "warn_full": "p_full", "warn_fcst": "p_fcst"}


def strip(b: dict) -> dict:
    b = dict(b)
    b.pop("event_leads", None)
    return b


def main() -> None:
    t0 = time.time()
    C.ART.mkdir(exist_ok=True); C.OUT.mkdir(exist_ok=True)
    d = W.Data()
    df = d.df
    res = {"periods": {"train": ["2015-07-01", C.TRAIN_END], "dev": [C.TRAIN_END, C.DEV_END], "test": [C.DEV_END, C.TEST_END]},
           "design": DESIGN, "valYears": d.val_years, "trainRows": int(d.tr.sum()), "devRows": int(d.dev.sum()),
           "trainPosShare": float(d.y[d.tr].mean()), "devPosShare": float(d.y[d.dev].mean()),
           "trainEvents": len(d.p_train.all_events), "devEvents": len(d.ev_dev), "named": d.named, "models": {}}
    scores, frozen, leads = {}, {"design": DESIGN, "methods": {}}, {}
    oofs = {}
    for name in C.VARIANTS:
        model, feats, best, cv, oof, p = W.fit(d, name, DESIGN, CFGS, log=lambda s: print(s, flush=True))
        model.save_model(str(C.ART / f"{name}.txt"))
        thr = d.threshold(oof, p[d.p_train.rows])
        gain = model.feature_importance("gain")
        imp = sorted(zip(feats, (gain / gain.sum()).tolist()), key=lambda kv: -kv[1])
        dev = d.evaluate(d.p_dev, p[d.p_dev.rows], thr)
        leads[name] = dev["event_leads"]
        res["models"][name] = {"kind": "lightgbm", "features": feats, "config": {k: best[k] for k in (*CFGS[0], "rounds")},
                               "cvAp": best["ap"], "cv": cv, "threshold": thr,
                               "importance": [{"feature": f, "gain": float(g)} for f, g in imp[:10]],
                               "trainFalseRate": d.p_train.false_alarm_rate(p[d.p_train.rows], thr, d.train_starts),
                               "train_oof": strip(d.evaluate(d.p_oof, oof, thr, d.train_starts)), "dev": strip(dev)}
        if name == "warn_fcst":
            res["models"][name]["label"] = C.FCST_LABEL
        scores[name], oofs[name] = p, oof
        frozen["methods"][name] = {"threshold": thr, "features": feats}
        r = res["models"][name]
        print(f"{name}: {r['config']} thr {thr:.4f} | OOF w12 {r['train_oof']['warned12h']} fa {r['train_oof']['falseAlarmsPerBaYear']:.2f} "
              f"| DEV w12 {r['dev']['warned12h']}/{r['dev']['testEvents']} fa {r['dev']['falseAlarmsPerBaYear']:.2f} "
              f"ap {r['dev']['aucPr']:.4f}  [{time.time()-t0:.0f}s]", flush=True)
    for name, (s, desc, cfg, thr) in W.rules(d).items():
        dev = d.evaluate(d.p_dev, s[d.p_dev.rows], thr)
        leads[name] = dev["event_leads"]
        res["models"][name] = {"kind": "rule", "rule": desc, "config": cfg, "threshold": thr,
                               "trainFalseRate": d.p_train.false_alarm_rate(s[d.p_train.rows], thr, d.train_starts),
                               "train_oof": strip(d.evaluate(d.p_oof, s[d.oof_rows], thr, d.train_starts)), "dev": strip(dev)}
        scores[name] = s
        frozen["methods"][name] = {"threshold": thr, "config": cfg}
        r = res["models"][name]["dev"]
        print(f"{name}: DEV w12 {r['warned12h']} fa {r['falseAlarmsPerBaYear']:.2f}", flush=True)

    # DEV per-event table and the named events (first alert time and lead for every method).
    rows = d.ev_dev[["event_id", "ba", "start", "stop", "hours_above", "peak_frac", "peak_customers_out", "cust_hours", "group"]].copy()
    for name in scores:
        rows[f"lead_{name}"] = rows.event_id.map(leads[name])
    rows.to_csv(C.OUT / "warn_events_dev.csv", index=False)
    named = []
    for eid in d.named:
        r = rows[rows.event_id == eid].iloc[0]
        e = {"event_id": eid, "ba": r.ba, "start": str(r.start), "peakCustomersOut": float(r.peak_customers_out),
             "group": r.group, "methods": {}}
        for name in scores:
            l = leads[name].get(eid)
            e["methods"][name] = {"leadHours": l, "firstAlert": None if l is None else str(r.start - pd.Timedelta(hours=l))}
        named.append(e)
    res["namedEvents"] = named

    # Raw scores for final_test.py, and the shared outputs (out-of-fold values on TRAIN where they exist).
    sc = pd.DataFrame({"ba": df.ba.values, "hour": df.hour.values})
    for n, s in scores.items():
        sc[n] = s
    sc.to_parquet(C.ART / "warn_scores.parquet", index=False)
    out = pd.DataFrame({"ba": df.ba.values, "hour": df.hour.values})
    end_h = C.data_end_h()
    for name, col in COLS.items():
        p = scores[name].copy()
        p[d.oof_rows] = oofs[name]
        p[(df.h.values <= end_h) & ~df.scored.values] = np.nan
        out[col] = p
    out.to_parquet(C.ART / "ba_hour_pred.parquet", index=False)
    (C.ART / "warn_threshold.json").write_text(json.dumps({col: frozen["methods"][n]["threshold"] for n, col in COLS.items()}))
    (C.OUT / "warn_frozen.json").write_text(json.dumps(frozen, indent=1))
    (C.OUT / "warn_results.json").write_text(json.dumps(res, indent=1, default=str))
    print(f"done in {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
