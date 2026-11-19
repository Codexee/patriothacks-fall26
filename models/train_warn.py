"""Before model: will an outage event start in this balancing area within 48 h?

Trains warn_grid, warn_full and warn_full_fx (the last one is only for the report), two rule
baselines, picks every setting and threshold on the training years, then scores the test years.

Writes: artifacts/<variant>.txt (boosters), out/warn_results.json, out/warn_events.csv,
        BDA_SHARED/ba_hour_pred.parquet, BDA_SHARED/warn_threshold.json
Run: uv run python train_warn.py
"""
from __future__ import annotations

import itertools
import json
import time

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score

import common as C

BASE = dict(objective="binary", learning_rate=0.05, feature_fraction=0.8, bagging_fraction=0.5,
            bagging_freq=1, lambda_l2=10.0, max_bin=63, seed=C.SEED, deterministic=True,
            force_row_wise=True, verbose=-1, num_threads=12)
# Small grid. Trees and leaves are capped so each exported file stays under 3 MB.
CONFIGS = [dict(num_leaves=nl, min_child_samples=mcs, scale_pos_weight=spw)
           for (nl, mcs), spw in itertools.product([(7, 2000), (15, 500), (15, 5000)], [1.0, 10.0])]
ROUNDS = [100, 200, 300]


def ap(y, s):
    ok = ~np.isnan(s)
    return float(average_precision_score(y[ok], s[ok])) if y[ok].any() else None


def main() -> None:
    t0 = time.time()
    C.ART.mkdir(exist_ok=True)
    C.OUT.mkdir(exist_ok=True)
    df = C.load_features()
    ev = C.load_events()
    end_h = C.data_end_h()
    all_starts = {b: g.start_h.values for b, g in ev.groupby("ba")}
    split_year = C.from_h(C.SPLIT_H).year
    first_year = int(df.hour.dt.year.min())
    val_years = list(range(first_year + 2, split_year))          # time-ordered folds
    year = df.hour.dt.year.values
    scored = df.scored.values
    y = df.y48.values
    tr = scored & (df.h.values < C.SPLIT_H)
    te = scored & (df.h.values >= C.SPLIT_H)
    mism = int(((df.y48_table.values != y) | (df.in_event_table.values != df.in_event.values))[df.mapped.values].sum())
    print(f"rows {len(df):,}  train {tr.sum():,} (pos {y[tr].mean():.3%})  test {te.sum():,} (pos {y[te].mean():.3%})"
          f"  label rows that differ from the table {mism:,}  folds {val_years}", flush=True)

    ev_test = ev[(ev.start_h >= C.SPLIT_H) & (ev.start_h <= end_h)]
    oof_rows = np.flatnonzero(tr & np.isin(year, val_years))
    ev_oof = ev[(ev.start_h < C.SPLIT_H) & np.isin(ev.start.dt.year, val_years)]
    p_oof = C.Panel(df, oof_rows, ev_oof)
    p_test = C.Panel(df, np.flatnonzero(te), ev_test)

    results = {"split": C.SPLIT, "dataEnd": str(C.from_h(end_h)), "valYears": val_years,
               "trainRows": int(tr.sum()), "testRows": int(te.sum()),
               "trainPosShare": float(y[tr].mean()), "testPosShare": float(y[te].mean()) if te.any() else None,
               "labelRowsDifferFromTable": mism, "trainEventsOof": len(ev_oof), "models": {}}
    preds, oofs, thresholds = {}, {}, {}

    for name, feats in C.VARIANTS.items():
        X = df[feats].values
        # Cross-validation: train on the years before each validation year.
        cv = []
        for cfg in CONFIGS:
            oof = {r: np.full(len(df), np.nan) for r in ROUNDS}
            aps = {r: [] for r in ROUNDS}
            for vy in val_years:
                a = np.flatnonzero(tr & (year < vy))
                b = np.flatnonzero(tr & (year == vy))
                m = lgb.train({**BASE, **cfg}, lgb.Dataset(X[a], y[a].astype(int), feature_name=feats), max(ROUNDS))
                for r in ROUNDS:
                    oof[r][b] = m.predict(X[b], num_iteration=r)
                    aps[r].append(ap(y[b], oof[r][b]))
            for r in ROUNDS:
                cv.append({**cfg, "rounds": r, "ap_by_fold": aps[r], "ap": float(np.mean(aps[r])), "_oof": oof[r]})
            print(f"  {name} {cfg} " + " ".join(f"{r}:{np.mean(aps[r]):.4f}" for r in ROUNDS) + f"  [{time.time()-t0:.0f}s]", flush=True)
        best = max(cv, key=lambda c: c["ap"])
        cfg = {k: best[k] for k in ("num_leaves", "min_child_samples", "scale_pos_weight")}
        oof = best["_oof"]
        thr = C.pick_threshold(p_oof, oof[oof_rows], all_starts)
        a = np.flatnonzero(tr)
        model = lgb.train({**BASE, **cfg}, lgb.Dataset(X[a], y[a].astype(int), feature_name=feats), best["rounds"])
        model.save_model(str(C.ART / f"{name}.txt"))
        p = model.predict(X)
        preds[name], oofs[name], thresholds[name] = p, oof, thr
        imp = dict(sorted(zip(feats, (model.feature_importance("gain") / model.feature_importance("gain").sum()).round(4).tolist()),
                          key=lambda kv: -kv[1]))
        results["models"][name] = {
            "kind": "lightgbm", "features": feats, "config": {**cfg, "rounds": best["rounds"]},
            "cv": [{k: v for k, v in c.items() if k != "_oof"} for c in cv],
            "threshold": thr, "gainShare": imp,
            "train_oof": {**p_oof.summary(oof[oof_rows], thr, all_starts), "aucPr": ap(y[oof_rows], oof[oof_rows])},
            "test": {**p_test.summary(p[p_test.rows], thr, all_starts), "aucPr": ap(y[p_test.rows], p[p_test.rows])}}
        t = results["models"][name]
        print(f"{name}: cfg {t['config']} thr {thr:.4f} | OOF fa {t['train_oof']['falseAlarmsPerBaYear']:.2f} "
              f"recall12 {t['train_oof']['recall12h']:.3f} | TEST events {t['test']['testEvents']} warned12 {t['test']['warned12h']} "
              f"fa {t['test']['falseAlarmsPerBaYear']:.2f} ap {t['test']['aucPr']}", flush=True)

    # Baselines. Their settings are tuned on the same training years the model thresholds use.
    fc = df.fc_err.values
    hand_parts = (np.nan_to_num(np.clip(df.fc_err_max_24h.values, -1, 1), nan=0.0) / 0.1,
                  np.nan_to_num(df.demand_vs_30d_peak.values, nan=0.0),
                  np.nan_to_num(np.abs(df.temp_anom_30d.values), nan=0.0) / 10.0)
    best_hand = None
    for wd, wt in itertools.product([0.0, 0.5, 1.0, 2.0, 4.0], [0.0, 0.5, 1.0, 2.0, 4.0]):
        s = hand_parts[0] + wd * hand_parts[1] + wt * hand_parts[2]
        thr = C.pick_threshold(p_oof, s[oof_rows], all_starts)
        w12 = p_oof.summary(s[oof_rows], thr, all_starts)["warned12h"]
        if best_hand is None or w12 > best_hand[0]:
            best_hand = (w12, wd, wt, thr, s)
    _, wd, wt, hthr, hand = best_hand
    rules = {"rule_forecast_error": (fc, "alert when (demand - forecast) / forecast >= threshold", {}),
             "rule_hand": (hand, "alert when fc_err_max_24h/0.1 + wd*demand_vs_30d_peak + wt*|temp_anom_30d|/10 >= threshold",
                           {"wd": wd, "wt": wt})}
    for name, (s, desc, cfg) in rules.items():
        thr = C.pick_threshold(p_oof, s[oof_rows], all_starts)
        preds[name], thresholds[name] = s, thr
        results["models"][name] = {
            "kind": "rule", "rule": desc, "config": cfg, "threshold": thr,
            "train_oof": {**p_oof.summary(s[oof_rows], thr, all_starts), "aucPr": ap(y[oof_rows], s[oof_rows])},
            "test": {**p_test.summary(s[p_test.rows], thr, all_starts), "aucPr": ap(y[p_test.rows], s[p_test.rows])}}
        t = results["models"][name]
        print(f"{name}: {cfg} thr {thr:.4f} | OOF fa {t['train_oof']['falseAlarmsPerBaYear']:.2f} recall12 {t['train_oof']['recall12h']:.3f} "
              f"| TEST warned12 {t['test']['warned12h']}/{t['test']['testEvents']} fa {t['test']['falseAlarmsPerBaYear']:.2f}", flush=True)

    # Per-event table (test events), one lead column per model.
    rows = ev_test[["event_id", "ba", "start", "stop", "hours_above", "peak_frac", "peak_customers_out"]].copy()
    for name, m in results["models"].items():
        rows[f"lead_{name}"] = rows.event_id.map(m["test"]["event_leads"])
    scor = set(p_test.events.event_id)
    rows["ba_has_features"] = rows.event_id.isin(scor)
    # Events whose 72 h before the start hold no scored hour at least 12 h ahead cannot be warned in time.
    can = []
    for r in rows.itertuples():
        g = p_test.groups.get(r.ba)
        h = p_test.h[g[0]:g[1]] if g else np.empty(0)
        s0 = C.to_h([r.start])[0]
        can.append(bool(((h >= s0 - C.LOOKBACK_H) & (h <= s0 - C.MIN_LEAD_H)).any()))
    rows["scorable_12h"] = can
    rows.to_csv(C.OUT / "warn_events.csv", index=False)
    results["testEventsScorable12h"] = int(sum(can))
    for m in results["models"].values():
        m["test"].pop("event_leads"); m["train_oof"].pop("event_leads")

    # Shared outputs. p for training hours in the validation years is the out-of-fold value, so
    # the evidence page does not show in-sample hits; `in_sample` marks the rows where that was not possible.
    out = pd.DataFrame({"ba": df.ba.values, "hour": df.hour.values})
    for col, name in (("p_grid", "warn_grid"), ("p_full", "warn_full")):
        p = preds[name].copy()
        has = ~np.isnan(oofs[name])
        p[has] = oofs[name][has]
        out[col] = p
    out["in_sample"] = (df.h.values < C.SPLIT_H) & np.isnan(oofs["warn_grid"]) & scored
    out.to_parquet(C.SHARED / "ba_hour_pred.parquet", index=False)
    (C.SHARED / "warn_threshold.json").write_text(json.dumps(
        {"p_grid": thresholds["warn_grid"], "p_full": thresholds["warn_full"]}))
    (C.OUT / "warn_results.json").write_text(json.dumps(results, indent=1))
    print(f"done in {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
