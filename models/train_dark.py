"""During model: how many hours does a county stay dark in an event?

Builds the county-event table, trains a LightGBM regression, compares it with a history baseline,
and computes the equity result (observed dark hours by SVI quartile) on all events.

Target: hours in [event start, event stop] with >= 10% of the county's customers out.
Every feature is known at the event start (nothing from inside the event window).

Writes: artifacts/dark.txt, artifacts/county_event.parquet, out/dark_results.json,
        BDA_SHARED/county_event_pred.parquet
Run: uv run python train_dark.py
"""
from __future__ import annotations

import itertools
import json
import time

import duckdb
import lightgbm as lgb
import numpy as np
import pandas as pd
from scipy.stats import spearmanr

import common as C

DARK_SHARE = 0.10
CT_OLD = ["09001", "09003", "09005", "09007", "09009", "09011", "09013", "09015"]  # as in data/build/labels.py
EV_FEATS = C.GRID[:-2] + C.WX
FEATS = (["month", "hod", "ba_past_events", "ba_past_mean_hours", "ba_hours_since_last"]
         + [f"ev_{c}" for c in EV_FEATS]
         + ["customers", "pop", "svi", "svi_t1", "svi_t2", "svi_t3", "svi_t4", "utilities",
            "past_events", "past_dark_mean", "past_dark_max", "past_dark_share",
            "out_prev1h", "out_max_prev6h"])
BASE = dict(objective="regression", learning_rate=0.05, feature_fraction=0.8, bagging_fraction=0.8,
            bagging_freq=1, lambda_l2=10.0, seed=C.SEED, deterministic=True, force_row_wise=True,
            verbose=-1, num_threads=12)
CONFIGS = [dict(num_leaves=nl, min_child_samples=mcs) for nl, mcs in itertools.product([7, 15], [50, 200])]
# v2 objectives. The raw tree output is hours ("l2"), log1p(hours) ("log1p"), or log(hours)
# ("poisson", "tweedie"). Chosen on DEV by within-event ranking; see RESULTS.md.
OBJECTIVES = {"l2": dict(objective="regression"), "log1p": dict(objective="regression"),
              "poisson": dict(objective="poisson"), "tweedie": dict(objective="tweedie", tweedie_variance_power=1.3)}
DARK_OBJECTIVE = "log1p"          # best DEV ranking (out/dark_results.json "objectives")
TOPK = 10
ROUNDS = [100, 200, 300]
N_BOOT = 2000


def build_table() -> pd.DataFrame:
    con = duckdb.connect()
    files = sorted(C.SHARED.glob("county_hour_*.parquet"))
    years = [int(f.stem.split("_")[-1]) for f in files]
    con.execute(f"CREATE VIEW ch AS SELECT * FROM read_parquet({[str(f) for f in files]})")
    con.execute(f"""CREATE TABLE mcc AS SELECT lpad(CAST(County_FIPS AS VARCHAR),5,'0') AS fips, Customers AS customers
                    FROM read_csv('{C.RAW}/eaglei/MCC.csv', header=true) WHERE Customers > 0""")
    con.execute(f"""CREATE TABLE cba AS
        SELECT fips, ba FROM '{C.DATA_OUT}/county_ba.parquet' WHERE "primary" """)
    con.execute("INSERT INTO cba SELECT unnest(?), 'ISNE'", [CT_OLD])
    con.execute(f"CREATE TABLE ev AS SELECT * FROM '{C.DATA_OUT}/events.parquet'")
    required = {y for start, stop in con.execute("SELECT year(start), year(stop) FROM ev").fetchall()
                for y in range(start, stop + 1)}
    if not required.issubset(years):
        raise ValueError(f"Missing county-hour years {sorted(required.difference(years))}")
    con.execute("CREATE TABLE cov AS SELECT fips, year(hour) AS y, min(hour) AS first_report FROM ch GROUP BY 1, 2")
    con.execute("""CREATE TABLE ce AS
        SELECT e.event_id, e.ba, e.start, e.stop, c.fips, m.customers AS target_customers,
               first_year.fips IS NOT NULL AND last_year.fips IS NOT NULL AND m.customers > 0 AS covered,
               first_year.first_report <= e.stop AND last_year.first_report <= e.stop AS coverage_known_at_stop
        FROM ev e JOIN cba c USING (ba) LEFT JOIN mcc m USING (fips)
        LEFT JOIN cov first_year ON first_year.fips = c.fips AND first_year.y = year(e.start)
        LEFT JOIN cov last_year ON last_year.fips = c.fips AND last_year.y = year(e.stop)""")
    con.execute(f"""CREATE TABLE tgt AS
        SELECT ce.event_id, ce.fips,
               CASE WHEN any_value(ce.covered) THEN
                    count(*) FILTER (WHERE h.hour >= ce.start AND h.out >= {DARK_SHARE} * ce.target_customers)
               END AS dark_hours,
               coalesce(max(h.out) FILTER (WHERE h.hour = ce.start - INTERVAL 1 HOUR), 0) AS out_prev1h,
               coalesce(max(h.out) FILTER (WHERE h.hour < ce.start), 0) AS out_max_prev6h
        FROM ce LEFT JOIN ch h ON h.fips = ce.fips AND h.hour >= ce.start - INTERVAL 6 HOUR AND h.hour <= ce.stop
        GROUP BY ce.event_id, ce.fips""")
    evcols = ", ".join(f'f."{c}" AS "ev_{c}"' for c in EV_FEATS)
    df = con.execute(f"""
        SELECT ce.*, t.dark_hours, t.out_prev1h, t.out_max_prev6h,
               month(ce.start) AS month, hour(ce.start) AS hod, e.hours_above, {evcols},
               r.* EXCLUDE(fips), s.equity_svi
        FROM ce JOIN tgt t USING (event_id, fips) JOIN ev e USING (event_id)
        LEFT JOIN '{C.SHARED}/ba_hour_features.parquet' f
            ON f.ba = ce.ba AND f.hour = ce.start - INTERVAL 1 HOUR
        LEFT JOIN '{C.HERE}/reference/county_2010_2012.parquet' r ON r.fips = ce.fips
        LEFT JOIN (SELECT lpad(CAST(FIPS AS VARCHAR),5,'0') AS fips,
                          nullif(RPL_THEMES, -999) AS equity_svi
                   FROM read_csv('{C.RAW}/svi/SVI_2022_US_county.csv', header=true)) s ON s.fips = ce.fips
        ORDER BY ce.start, ce.event_id, ce.fips""").df()
    df["dark_hours"] = df.dark_hours.astype(float)
    # The CDC documentation for the 2010 SVI is dated March 31, 2015.
    df.loc[df.start < "2015-04-01", ["svi", "svi_t1", "svi_t2", "svi_t3", "svi_t4"]] = np.nan
    if df.duplicated(["event_id", "fips"]).any():
        raise ValueError("Multiple county-event rows for one key")

    # Earlier events in each BA must have finished before the current start.
    e = df.drop_duplicates("event_id")[["event_id", "ba", "start", "stop", "hours_above"]].sort_values(["ba", "start"])
    g = e.groupby("ba")
    if (g.stop.shift(1) >= e.start).any():
        raise ValueError("Overlapping events in the same BA")
    e["ba_past_events"] = g.cumcount().astype(float)
    e["ba_past_mean_hours"] = (g.hours_above.cumsum() - e.hours_above) / e.ba_past_events.replace(0, np.nan)
    e["ba_hours_since_last"] = (e.start - g.stop.shift(1)).dt.total_seconds() / 3600
    df = df.merge(e[["event_id", "ba_past_events", "ba_past_mean_hours", "ba_hours_since_last"]], on="event_id")
    df = df.sort_values(["fips", "start"]).reset_index(drop=True)
    g = df.groupby("fips")
    if (g.stop.shift(1) >= df.start).any():
        raise ValueError("Overlapping county-event history")
    # The year-end coverage check is appropriate for evaluating a target. To
    # use it as history, the county already needed a report when the event ended.
    history = df.dark_hours.where(df.coverage_known_at_stop.fillna(False))
    df["_known"] = history.notna().astype(int)
    df["_hours"] = history.fillna(0)
    df["_any"] = (history > 0).astype(int)
    df["past_events"] = g._known.cumsum() - df._known
    n = df.past_events.replace(0, np.nan)
    df["past_dark_mean"] = (g._hours.cumsum() - df._hours) / n
    df["past_dark_max"] = history.groupby(df.fips).transform(lambda s: s.shift(1).ffill().cummax())
    df["past_dark_share"] = (g._any.cumsum() - df._any) / n
    df["baseline"] = df.past_dark_mean.fillna(0.0)               # no history -> 0 h
    df["start_h"] = C.to_h(df.start)
    return df.drop(columns=["_known", "_hours", "_any"]).sort_values(["start", "event_id", "fips"]).reset_index(drop=True)


def within_event_spearman(d: pd.DataFrame, col: str) -> tuple[float | None, int]:
    vals = []
    for _, g in d.groupby("event_id"):
        if len(g) >= 5 and g.dark_hours.nunique() > 1 and g[col].nunique() > 1:
            vals.append(spearmanr(g.dark_hours, g[col]).statistic)
    return (float(np.mean(vals)) if vals else None), len(vals)


def equity(df: pd.DataFrame) -> dict:
    d = df[df.equity_svi.notna() & df.dark_hours.notna()].copy()
    d["q"] = np.clip(np.ceil(d.equity_svi * 4), 1, 4).astype(int)       # 4 = most vulnerable quarter of US counties
    ids, eidx = np.unique(d.event_id, return_inverse=True)
    S = np.zeros((len(ids), 4)); N = np.zeros((len(ids), 4))
    np.add.at(S, (eidx, d.q.values - 1), d.dark_hours.values)
    np.add.at(N, (eidx, d.q.values - 1), 1)
    rng = np.random.default_rng(C.SEED)
    pick = rng.integers(0, len(ids), (N_BOOT, len(ids)))
    bs = S[pick].sum(1) / N[pick].sum(1)                          # resample events
    quart = [{"quartile": q + 1, "meanDarkHours": float(S[:, q].sum() / N[:, q].sum()),
              "lo": float(np.percentile(bs[:, q], 2.5)), "hi": float(np.percentile(bs[:, q], 97.5)),
              "countyEvents": int(N[:, q].sum())} for q in range(4)]
    diff = bs[:, 3] - bs[:, 0]
    # Same comparison inside each event (removes "which regions get storms").
    both = (N[:, 0] > 0) & (N[:, 3] > 0)
    w = (S[both, 3] / N[both, 3]) - (S[both, 0] / N[both, 0])
    wb = w[rng.integers(0, len(w), (N_BOOT, len(w)))].mean(1)
    dur = d.drop_duplicates("event_id").set_index("event_id")
    long_ev = ((dur.stop - dur.start).dt.total_seconds() / 3600 >= 24).reindex(ids).values
    L = both & long_ev
    wl = (S[L, 3] / N[L, 3]) - (S[L, 0] / N[L, 0])
    wlb = wl[rng.integers(0, len(wl), (N_BOOT, len(wl)))].mean(1) if len(wl) else np.zeros(1)
    lpick = rng.choice(np.flatnonzero(long_ev), (N_BOOT, int(long_ev.sum())))
    lbs = S[lpick].sum(1) / N[lpick].sum(1)
    long = {"events": int(long_ev.sum()),
            "q4MinusQ1": {"mean": float(S[long_ev, 3].sum() / N[long_ev, 3].sum() - S[long_ev, 0].sum() / N[long_ev, 0].sum()),
                          "lo": float(np.percentile(lbs[:, 3] - lbs[:, 0], 2.5)), "hi": float(np.percentile(lbs[:, 3] - lbs[:, 0], 97.5))},
            "withinEventQ4MinusQ1": {"events": int(L.sum()), "mean": float(wl.mean()) if len(wl) else None,
                                     "lo": float(np.percentile(wlb, 2.5)), "hi": float(np.percentile(wlb, 97.5))}}
    return {"quartiles": quart, "events": int(len(ids)), "countyEvents": int(len(d)), "events24hOrLonger": long,
            "q4MinusQ1": {"mean": float(quart[3]["meanDarkHours"] - quart[0]["meanDarkHours"]),
                          "lo": float(np.percentile(diff, 2.5)), "hi": float(np.percentile(diff, 97.5))},
            "withinEventQ4MinusQ1": {"events": int(both.sum()), "mean": float(w.mean()),
                                     "lo": float(np.percentile(wb, 2.5)), "hi": float(np.percentile(wb, 97.5))}}


def topk_overlap(d: pd.DataFrame, col: str) -> tuple[float | None, int, float | None]:
    """Mean share of the k counties with the most actual dark hours that are also in the k highest by
    `col`; k = min(10, counties with any dark hour). Events with >= 10 counties and >= 1 dark county.
    Ties are broken by FIPS, the same way for actual and predicted. Also returns the chance level k/n."""
    vals, chance = [], []
    for _, g in d.groupby("event_id"):
        n_dark = int((g.dark_hours > 0).sum())
        if len(g) < TOPK or n_dark == 0:
            continue
        k = min(TOPK, n_dark)
        g = g.sort_values("fips")
        act = set(g.sort_values("dark_hours", ascending=False, kind="stable").fips[:k])
        pred = set(g.sort_values(col, ascending=False, kind="stable").fips[:k])
        vals.append(len(act & pred) / k)
        chance.append(k / len(g))
    return (float(np.mean(vals)) if vals else None), len(vals), (float(np.mean(chance)) if chance else None)


def to_hours(raw: np.ndarray, obj: str) -> np.ndarray:
    if obj == "log1p":
        return np.expm1(np.maximum(raw, 0))
    if obj in ("poisson", "tweedie"):
        return np.exp(raw)
    return np.maximum(raw, 0)


def fit_obj(X, y, rows, obj, cfg, rounds):
    target = np.log1p(y[rows]) if obj == "log1p" else y[rows]
    return lgb.train({**BASE, **OBJECTIVES[obj], **cfg}, lgb.Dataset(X[rows], target, feature_name=FEATS_ALL), rounds)


FEATS_ALL: list[str] = []


def main() -> None:
    global FEATS_ALL
    t0 = time.time()
    C.ART.mkdir(exist_ok=True); C.OUT.mkdir(exist_ok=True)
    df = build_table()
    y = df.dark_hours.values
    stops = C.to_h(df.stop)
    st = df.start_h.values
    ok = np.isfinite(y)
    tr = (stops < C.TRAIN_END_H) & ok
    dev = (st >= C.TRAIN_END_H) & (st < C.DEV_END_H) & ok
    te = (st >= C.DEV_END_H) & (st < C.TEST_END_H) & ok
    # The browser supports numeric splits. Learn the BA vocabulary on training events only.
    names = sorted(df.loc[tr, "ba"].unique())
    ba_features = {f"ba_is_{name}": (df.ba == name).astype(int) for name in names}
    df = df.assign(**ba_features)
    FEATS_ALL = FEATS + list(ba_features)
    df.to_parquet(C.ART / "county_event.parquet", index=False)
    X = df[FEATS_ALL].to_numpy(dtype=float, na_value=np.nan)
    year = df.start.dt.year.values
    val_years = list(range(int(year.min()) + 2, C.from_h(C.TRAIN_END_H).year))
    print(f"county-events {len(df):,} in {df.event_id.nunique()} events; train {tr.sum():,} dev {dev.sum():,} test {te.sum():,}; "
          f"mean dark h {np.nanmean(y):.2f}; share with any dark hour {(y[ok] > 0).mean():.1%}", flush=True)

    def block(mask, p):
        d = df[mask].assign(pred=p[mask])
        if not len(d):
            return None
        wm, wn = within_event_spearman(d, "pred")
        wb, _ = within_event_spearman(d, "baseline")
        tk, tn, tc = topk_overlap(d, "pred")
        tb, _, _ = topk_overlap(d, "baseline")
        return {"countyEvents": int(len(d)), "events": int(d.event_id.nunique()),
                "meanDarkHours": float(d.dark_hours.mean()),
                "maeHours": float(np.abs(d.pred - d.dark_hours).mean()),
                "baselineMaeHours": float(np.abs(d.baseline - d.dark_hours).mean()),
                "zeroMaeHours": float(d.dark_hours.abs().mean()),
                "rmseHours": float(np.sqrt(((d.pred - d.dark_hours) ** 2).mean())),
                "baselineRmseHours": float(np.sqrt(((d.baseline - d.dark_hours) ** 2).mean())),
                "spearman": float(spearmanr(d.dark_hours, d.pred).statistic),
                "baselineSpearman": float(spearmanr(d.dark_hours, d.baseline).statistic),
                "withinEventSpearman": wm, "baselineWithinEventSpearman": wb, "withinEventSpearmanEvents": wn,
                "top10Overlap": tk, "baselineTop10Overlap": tb, "top10Events": tn, "top10Chance": tc}

    # For each objective: configuration and rounds by within-event Spearman on TRAIN folds; then DEV.
    study, models, oofs = {}, {}, {}
    for obj in OBJECTIVES:
        cv = []
        for cfg in CONFIGS:
            oof = {r: np.full(len(df), np.nan) for r in ROUNDS}
            for vy in val_years:
                a = np.flatnonzero(tr & (stops < C.to_h([f"{vy}-01-01"])[0]))
                b = np.flatnonzero(tr & (year == vy))
                if not len(b):
                    continue
                m = fit_obj(X, y, a, obj, cfg, max(ROUNDS))
                for r in ROUNDS:
                    oof[r][b] = to_hours(m.predict(X[b], num_iteration=r, raw_score=True), obj)
            for r in ROUNDS:
                mm = ~np.isnan(oof[r])
                ws, _ = within_event_spearman(df[mm].assign(pred=oof[r][mm]), "pred")
                cv.append({**cfg, "rounds": r, "withinEventSpearman": ws,
                           "mae": float(np.abs(oof[r][mm] - y[mm]).mean()), "_oof": oof[r]})
        best = max(cv, key=lambda c: c["withinEventSpearman"] or -1)
        cfg = {k: best[k] for k in ("num_leaves", "min_child_samples")}
        model = fit_obj(X, y, np.flatnonzero(tr), obj, cfg, best["rounds"])
        pred = to_hours(model.predict(X, raw_score=True), obj)
        oofm = ~np.isnan(best["_oof"])
        models[obj], oofs[obj] = (model, pred, cfg, best["rounds"]), best["_oof"]
        study[obj] = {"config": {**cfg, "rounds": best["rounds"]}, "cvWithinEventSpearman": best["withinEventSpearman"],
                      "train_oof": block(oofm, np.where(oofm, best["_oof"], 0)), "dev": block(dev, pred)}
        dv = study[obj]["dev"]
        print(f"dark {obj}: {study[obj]['config']} | DEV mae {dv['maeHours']:.2f} (base {dv['baselineMaeHours']:.2f}) "
              f"wSpearman {dv['withinEventSpearman']:.3f} (base {dv['baselineWithinEventSpearman']:.3f}) "
              f"top10 {dv['top10Overlap']:.3f} (base {dv['baselineTop10Overlap']:.3f}, chance {dv['top10Chance']:.3f})  [{time.time()-t0:.0f}s]",
              flush=True)

    model, pred, cfg, rounds = models[DARK_OBJECTIVE]
    model.save_model(str(C.ART / "dark.txt"))
    df["pred"] = pred
    oof = oofs[DARK_OBJECTIVE]
    oofm = ~np.isnan(oof)
    gain = model.feature_importance("gain")
    imp = sorted(zip(FEATS_ALL, (gain / gain.sum()).tolist()), key=lambda kv: -kv[1])
    res = {"periods": {"train": "event stop < " + C.TRAIN_END, "dev": [C.TRAIN_END, C.DEV_END], "test": [C.DEV_END, C.TEST_END]},
           "objective": DARK_OBJECTIVE, "features": FEATS_ALL, "config": {**cfg, "rounds": rounds},
           "valYears": val_years, "years": [int(year.min()), int(year.max())],
           "countyEventRows": len(df), "observedRows": int(ok.sum()),
           "observedEvents": int(df.loc[ok, "event_id"].nunique()), "allEvents": len(C.load_events()),
           "importance": [{"feature": f, "gain": float(g)} for f, g in imp[:10]],
           "objectives": study, "train_oof": study[DARK_OBJECTIVE]["train_oof"], "dev": study[DARK_OBJECTIVE]["dev"],
           "equity": equity(df)}
    (C.OUT / "dark_results.json").write_text(json.dumps(res, indent=1))
    out = df[["event_id", "fips"]].copy()
    out["pred_dark_hours"] = np.where(oofm, oof, pred)            # out-of-fold where it exists
    out.to_parquet(C.ART / "county_event_pred.parquet", index=False)
    # Frozen predictions for the final test (scored by final_test.py, not here).
    df[["event_id", "fips", "start_h", "dark_hours", "baseline", "pred"]].assign(
        is_test=te).to_parquet(C.ART / "dark_frozen.parquet", index=False)
    e = res["equity"]
    print("equity:", [(q["quartile"], round(q["meanDarkHours"], 2), round(q["lo"], 2), round(q["hi"], 2)) for q in e["quartiles"]],
          e["withinEventQ4MinusQ1"], e["events24hOrLonger"], f"[{time.time()-t0:.0f}s]", flush=True)


if __name__ == "__main__":
    main()
