"""Residents-only check-first model: which areas stay dark longest in an outage event?

Same target, rows, split and history baseline as train_dark.py (v2). The difference: every input
that residents of the Hollow do not have is removed (weather, weather forecasts, grid-operator data
from EIA-930). See RESULTS_RESIDENTS.md for each kept input and its Hollow equivalent.

Selection uses TRAIN and DEV only:
  - objective: log1p(hours), the v2 DEV choice (not re-chosen here);
  - configuration and rounds: within-event Spearman on TRAIN year folds (as in train_dark.py);
  - feature set: within-event Spearman on DEV.
FINAL TEST is not scored here. final_test_residents.py scores it once.

Writes: artifacts/dark_residents.txt, artifacts/dark_residents_frozen.parquet,
        out/dark_residents_results.json
Run: uv run python train_dark_residents.py
"""
from __future__ import annotations

import json
import time

import lightgbm as lgb
import numpy as np
import pandas as pd

import common as C
import train_dark as D

OBJ = "log1p"

# Inputs residents have (event-level and area-level). Shares are new: the reports as a share of the
# area's homes, so the trees do not have to learn the ratio.
CALENDAR = ["month", "hod"]
REGION_HISTORY = ["ba_past_events", "ba_past_mean_hours", "ba_hours_since_last"]
AREA = ["customers", "pop", "svi", "svi_t1", "svi_t2", "svi_t3", "svi_t4", "utilities"]
AREA_HISTORY = ["past_events", "past_dark_mean", "past_dark_max", "past_dark_share"]
REPORTS = ["out_prev1h", "out_max_prev6h"]
SHARES = ["out_prev1h_share", "out_max_prev6h_share"]
BASE_SET = CALENDAR + REGION_HISTORY + AREA + AREA_HISTORY + REPORTS

# Candidate feature sets, compared on DEV. "region_id" adds one 0/1 column per training region.
SETS = {
    "residents": dict(feats=BASE_SET, region_id=True),             # v2 minus every ev_* column
    "residents_shares": dict(feats=BASE_SET + SHARES, region_id=True),
    "residents_shares_no_region_id": dict(feats=BASE_SET + SHARES, region_id=False),
}


def prepare() -> tuple[pd.DataFrame, dict]:
    df = D.build_table()
    cust = df.target_customers.where(df.target_customers > 0)
    df["out_prev1h_share"] = df.out_prev1h / cust
    df["out_max_prev6h_share"] = df.out_max_prev6h / cust
    y = df.dark_hours.values
    stops = C.to_h(df.stop)
    st = df.start_h.values
    ok = np.isfinite(y)
    masks = {"tr": (stops < C.TRAIN_END_H) & ok,
             "dev": (st >= C.TRAIN_END_H) & (st < C.DEV_END_H) & ok,
             "te": (st >= C.DEV_END_H) & (st < C.TEST_END_H) & ok,
             "stops": stops, "year": df.start.dt.year.values}
    names = sorted(df.loc[masks["tr"], "ba"].unique())          # region vocabulary from TRAIN only
    df = df.assign(**{f"ba_is_{n}": (df.ba == n).astype(int) for n in names})
    masks["region_cols"] = [f"ba_is_{n}" for n in names]
    return df, masks


def fit(X, y, rows, feats, cfg, rounds):
    return lgb.train({**D.BASE, **cfg}, lgb.Dataset(X[rows], np.log1p(y[rows]), feature_name=feats), rounds)


def block(df, mask, p) -> dict | None:
    d = df[mask].assign(pred=p[mask])
    if not len(d):
        return None
    wm, wn = D.within_event_spearman(d, "pred")
    wb, _ = D.within_event_spearman(d, "baseline")
    tk, tn, tc = D.topk_overlap(d, "pred")
    tb, _, _ = D.topk_overlap(d, "baseline")
    return {"countyEvents": int(len(d)), "events": int(d.event_id.nunique()),
            "maeHours": float(np.abs(d.pred - d.dark_hours).mean()),
            "baselineMaeHours": float(np.abs(d.baseline - d.dark_hours).mean()),
            "zeroMaeHours": float(d.dark_hours.abs().mean()),
            "withinEventSpearman": wm, "baselineWithinEventSpearman": wb, "withinEventSpearmanEvents": wn,
            "top10Overlap": tk, "baselineTop10Overlap": tb, "top10Events": tn, "top10Chance": tc}


def main() -> None:
    t0 = time.time()
    C.ART.mkdir(exist_ok=True); C.OUT.mkdir(exist_ok=True)
    df, m = prepare()
    y = df.dark_hours.values
    tr, dev, te, stops, year = m["tr"], m["dev"], m["te"], m["stops"], m["year"]
    val_years = list(range(int(year.min()) + 2, C.from_h(C.TRAIN_END_H).year))
    print(f"county-events {len(df):,}; train {tr.sum():,} dev {dev.sum():,} test {te.sum():,} [{time.time()-t0:.0f}s]", flush=True)

    study, fitted = {}, {}
    for name, spec in SETS.items():
        feats = spec["feats"] + (m["region_cols"] if spec["region_id"] else [])
        X = df[feats].to_numpy(dtype=float, na_value=np.nan)
        cv = []
        for cfg in D.CONFIGS:
            oof = {r: np.full(len(df), np.nan) for r in D.ROUNDS}
            for vy in val_years:
                a = np.flatnonzero(tr & (stops < C.to_h([f"{vy}-01-01"])[0]))
                b = np.flatnonzero(tr & (year == vy))
                if not len(b):
                    continue
                mdl = fit(X, y, a, feats, cfg, max(D.ROUNDS))
                for r in D.ROUNDS:
                    oof[r][b] = D.to_hours(mdl.predict(X[b], num_iteration=r, raw_score=True), OBJ)
            for r in D.ROUNDS:
                mm = ~np.isnan(oof[r])
                ws, _ = D.within_event_spearman(df[mm].assign(pred=oof[r][mm]), "pred")
                cv.append({**cfg, "rounds": r, "withinEventSpearman": ws})
        best = max(cv, key=lambda c: c["withinEventSpearman"] or -1)
        cfg = {k: best[k] for k in ("num_leaves", "min_child_samples")}
        mdl = fit(X, y, np.flatnonzero(tr), feats, cfg, best["rounds"])
        pred = D.to_hours(mdl.predict(X, raw_score=True), OBJ)
        fitted[name] = (mdl, pred, feats)
        study[name] = {"features": feats, "config": {**cfg, "rounds": best["rounds"]},
                       "cvWithinEventSpearman": best["withinEventSpearman"], "cv": cv, "dev": block(df, dev, pred)}
        dv = study[name]["dev"]
        print(f"{name}: {study[name]['config']} cv {best['withinEventSpearman']:.3f} | DEV wSpearman "
              f"{dv['withinEventSpearman']:.3f} (hist {dv['baselineWithinEventSpearman']:.3f}) top10 {dv['top10Overlap']:.3f} "
              f"(hist {dv['baselineTop10Overlap']:.3f}, chance {dv['top10Chance']:.3f}) mae {dv['maeHours']:.2f} "
              f"(hist {dv['baselineMaeHours']:.2f}) [{time.time()-t0:.0f}s]", flush=True)

    chosen = max(study, key=lambda k: study[k]["dev"]["withinEventSpearman"])
    mdl, pred, feats = fitted[chosen]
    mdl.save_model(str(C.ART / "dark_residents.txt"))
    gain = mdl.feature_importance("gain")
    imp = sorted(zip(feats, (gain / gain.sum()).tolist()), key=lambda kv: -kv[1])
    res = {"periods": {"train": "event stop < " + C.TRAIN_END, "dev": [C.TRAIN_END, C.DEV_END], "test": [C.DEV_END, C.TEST_END]},
           "objective": OBJ, "rule": "config and rounds by within-event Spearman on TRAIN year folds; feature set by DEV within-event Spearman",
           "valYears": val_years, "chosen": chosen, "features": feats, "config": study[chosen]["config"],
           "importance": [{"feature": f, "share": float(g)} for f, g in imp],
           "sets": {k: {kk: vv for kk, vv in v.items() if kk != "cv"} for k, v in study.items()},
           "dev": study[chosen]["dev"]}
    (C.OUT / "dark_residents_results.json").write_text(json.dumps(res, indent=1))
    # Frozen predictions. final_test_residents.py scores the test rows once.
    df[["event_id", "ba", "fips", "start", "start_h", "dark_hours", "baseline", "target_customers"]].assign(
        pred=pred, is_dev=dev, is_test=te).to_parquet(C.ART / "dark_residents_frozen.parquet", index=False)
    print(f"chosen {chosen} {study[chosen]['config']}; top gain {[(f, round(s, 3)) for f, s in imp[:6]]} [{time.time()-t0:.0f}s]")


if __name__ == "__main__":
    main()
