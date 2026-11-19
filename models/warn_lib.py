"""Shared pieces of the warning-model scripts: data preparation, the LightGBM fit with time-ordered
folds on TRAIN, the train-only alert threshold, the rule baselines, and event-level evaluation.

Nothing here scores events after DEV_END. final_test.py does that, once.
"""
from __future__ import annotations

import itertools

import lightgbm as lgb
import numpy as np
from sklearn.metrics import average_precision_score

import common as C

BASE = dict(objective="binary", learning_rate=0.05, feature_fraction=0.8, bagging_fraction=0.5,
            bagging_freq=1, lambda_l2=10.0, max_bin=63, seed=C.SEED, deterministic=True,
            force_row_wise=True, verbose=-1, num_threads=12)
ROUNDS = [100, 200, 300]
NAMED = ["ERCO-2021021501"]          # plus every event that starts Dec 23-25, 2022 (added in prepare)


def ap(y, s):
    """Hourly PR-AUC. A missing score ranks below every available score."""
    return float(average_precision_score(y, np.nan_to_num(s, nan=-1e300))) if y.any() else None


class Data:
    def __init__(self):
        df = C.load_features()
        ev = C.tag_event_groups(df, C.load_events())
        self.df, self.ev = df, ev
        self.all_starts = {b: g.start_h.values for b, g in ev.groupby("ba")}
        h, year = df.h.values, df.hour.dt.year.values
        self.year = year
        sc = df.scored.values
        self.y = df.y48.values
        # A training row needs its whole 48 h label horizon inside TRAIN.
        self.tr = sc & (h + C.HORIZON_H < C.TRAIN_END_H)
        self.dev = sc & (h >= C.TRAIN_END_H) & (h + C.HORIZON_H < C.DEV_END_H)
        self.test = sc & (h >= C.DEV_END_H) & (h < C.TEST_END_H)
        self.val_years = list(range(int(year.min()) + 2, C.from_h(C.TRAIN_END_H).year))
        self.oof_rows = np.flatnonzero(self.tr & np.isin(year, self.val_years))
        ev_tr = ev[ev.start_h < C.TRAIN_END_H]
        self.p_train = C.Panel(df, np.flatnonzero(self.tr), ev_tr)
        self.train_starts = {b: g.start_h.values for b, g in ev_tr.groupby("ba")}
        self.p_oof = C.Panel(df, self.oof_rows, ev_tr[np.isin(ev_tr.start.dt.year, self.val_years)])
        self.ev_dev = ev[(ev.start_h >= C.TRAIN_END_H) & (ev.start_h < C.DEV_END_H)]
        self.p_dev = C.Panel(df, np.flatnonzero(self.dev), self.ev_dev)
        st = self.ev_dev.start
        self.named = NAMED + sorted(self.ev_dev.event_id[(st >= "2022-12-23") & (st < "2022-12-26")])
        print(f"rows {len(df):,}  train {self.tr.sum():,} (pos {self.y[self.tr].mean():.3%})  dev {self.dev.sum():,} "
              f"(pos {self.y[self.dev].mean():.3%})  events train {len(ev_tr)} dev {len(self.ev_dev)}  folds {self.val_years}",
              flush=True)

    def test_panel(self) -> C.Panel:
        ev_te = self.ev[(self.ev.start_h >= C.DEV_END_H) & (self.ev.start_h < C.TEST_END_H)]
        return C.Panel(self.df, np.flatnonzero(self.test), ev_te)

    def evaluate(self, panel, scores, thr, starts=None):
        labels = self.y[panel.rows]
        b = panel.summary(scores, thr, starts or self.all_starts)
        b["aucPr"] = ap(labels, scores)
        for s in C.SEASONS:
            sel = panel.season_rows == s
            b["seasons"][s]["aucPr"] = ap(labels[sel], scores[sel])
        return b

    def threshold(self, oof_scores, train_scores):
        return C.pick_threshold(self.p_oof, oof_scores, self.train_starts, self.p_train, train_scores)


def features_for(name: str, design: dict) -> list[str]:
    if "feats" in design:
        return list(design["feats"])
    f = list(C.VARIANTS[name])
    if design.get("trail"):
        f += ["fc12_vs_month_record_max_72h"] if name == "warn_grid" else list(C.TRAIL)
    return f


def params_for(feats, cfg, design) -> dict:
    p = {**BASE, **cfg}
    if design.get("monotone"):
        p["monotone_constraints"] = [1 if f in C.MONOTONE_UP else 0 for f in feats]
        p["monotone_constraints_method"] = "advanced"
    return p


def label_weight(d: Data, design: dict, rows: np.ndarray):
    y = (d.df.y24.values if design.get("target") == "y24" else d.y)[rows].astype(int)
    w = None
    if design.get("weights") == "size":
        # Positives weighted by the size of the coming event: log10(peak customers out), mean 1.
        lp = np.log10(d.df.next_peak.values[rows] + 10.0)
        pos = d.y[rows]
        w = np.where(pos, lp / lp[pos].mean(), 1.0) if pos.any() else None
    return y, w


def fit(d: Data, name: str, design: dict, cfgs: list[dict], log=print):
    """Choose cfg and rounds by mean PR-AUC over time-ordered folds on TRAIN; fit on all of TRAIN.
    Returns model, feats, best (dict), oof scores (aligned to d.oof_rows), full predictions."""
    feats = features_for(name, design)
    X = d.df[feats].values
    best, best_oof, cv = None, None, []
    for cfg in cfgs:
        fold = {r: np.empty(len(d.oof_rows)) for r in ROUNDS}
        aps = {r: [] for r in ROUNDS}
        for vy in d.val_years:
            a = np.flatnonzero(d.tr & (d.df.h.values + C.HORIZON_H < C.to_h([f"{vy}-01-01"])[0]))
            sel = d.year[d.oof_rows] == vy
            b = d.oof_rows[sel]
            ya, wa = label_weight(d, design, a)
            m = lgb.train(params_for(feats, cfg, design), lgb.Dataset(X[a], ya, weight=wa, feature_name=feats), max(ROUNDS))
            for r in ROUNDS:
                s = m.predict(X[b], num_iteration=r, num_threads=BASE["num_threads"])
                fold[r][sel] = s
                aps[r].append(ap(d.y[b], s))
        for r in ROUNDS:
            t = {**cfg, "rounds": r, "ap_by_fold": aps[r], "ap": float(np.mean(aps[r]))}
            cv.append(t)
            if best is None or t["ap"] > best["ap"]:
                best, best_oof = t, fold[r]
        log(f"    {name} {cfg} " + " ".join(f"{r}:{np.mean(aps[r]):.4f}" for r in ROUNDS))
    cfg = {k: best[k] for k in cfgs[0]}
    a = np.flatnonzero(d.tr)
    ya, wa = label_weight(d, design, a)
    model = lgb.train(params_for(feats, cfg, design), lgb.Dataset(X[a], ya, weight=wa, feature_name=feats), best["rounds"])
    p = np.full(len(d.df), np.nan)
    ok = ~d.df.in_event.values
    p[ok] = model.predict(X[ok], num_threads=BASE["num_threads"])
    return model, feats, best, cv, best_oof, p


def rules(d: Data, log=print) -> dict:
    """Rule baselines with every setting tuned on TRAIN. Returns {name: (scores, desc, cfg, thr)}."""
    df = d.df
    out = {}
    fc = df.fc_err.values.astype(float)
    out["rule_forecast_error"] = (fc, "alert when (demand - forecast) / forecast >= threshold", {})
    parts = (np.nan_to_num(np.clip(df.fc_err_max_24h.values, -1, 1), nan=0.0) / 0.1,
             np.nan_to_num(df.demand_vs_30d_peak.values, nan=0.0),
             np.nan_to_num(np.abs(df.temp_anom_30d.values), nan=0.0) / 10.0)
    best = None
    for wd, wt in itertools.product([0.5, 1.0, 2.0, 4.0], repeat=2):
        s = (parts[0] + wd * parts[1] + wt * parts[2]).astype(float)
        thr = d.threshold(s[d.oof_rows], s[d.p_train.rows])
        w12 = d.p_oof.summary(s[d.oof_rows], thr, d.train_starts)["warned12h"]
        if best is None or w12 > best[0]:
            best = (w12, wd, wt, s)
    _, wd, wt, s = best
    out["rule_hand"] = (s, "alert when fc_err_max_24h/0.1 + wd*demand_vs_30d_peak + wt*|temp_anom_30d|/10 >= threshold",
                        {"wd": wd, "wt": wt})
    out["rule_record"] = (df.fc12_vs_month_record.values.astype(float),
                          "alert when the day-ahead forecast peak of the next 12 h / the BA's past record for this month >= threshold", {})
    res = {}
    for n, (s, desc, cfg) in out.items():
        thr = d.threshold(s[d.oof_rows], s[d.p_train.rows])
        res[n] = (s, desc, cfg, thr)
        log(f"  {n}: {cfg} threshold {thr:.4f}")
    return res
