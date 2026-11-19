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
EV_FEATS = C.GRID[:-2] + C.WX                                   # the BA feature row at the start hour (no fx_)
FEATS = (["month", "hod", "ba_customers", "ba_n_counties", "ba_past_events", "ba_past_mean_hours",
          "ba_hours_since_last", "ba_frac_prev1h"]
         + [f"ev_{c}" for c in EV_FEATS]
         + ["customers", "pop", "svi", "svi_t1", "svi_t2", "svi_t3", "svi_t4", "n_ba", "primary_share",
            "cust_share_of_ba", "past_events", "past_dark_mean", "past_dark_max", "past_dark_share",
            "out_frac_prev1h", "out_frac_max_prev6h"])
BASE = dict(objective="regression", learning_rate=0.05, feature_fraction=0.8, bagging_fraction=0.8,
            bagging_freq=1, lambda_l2=10.0, seed=C.SEED, deterministic=True, force_row_wise=True,
            verbose=-1, num_threads=12)
CONFIGS = [dict(num_leaves=nl, min_child_samples=mcs) for nl, mcs in itertools.product([7, 15], [50, 200])]
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
        SELECT fips, ba, share AS primary_share FROM '{C.DATA_OUT}/county_ba.parquet' WHERE "primary" AND fips NOT LIKE '091%'""")
    con.execute("INSERT INTO cba SELECT unnest(?), 'ISNE', 1.0", [CT_OLD])
    con.execute(f"CREATE TABLE nba AS SELECT fips, count(*) AS n_ba FROM '{C.DATA_OUT}/county_ba.parquet' GROUP BY fips")
    con.execute(f"""CREATE TABLE ev AS SELECT * FROM '{C.DATA_OUT}/events.parquet'
                    WHERE year(start) IN ({','.join(map(str, years))}) AND year(stop) IN ({','.join(map(str, years))})""")
    # Counties with no EAGLE-I record in the event's year are not covered; a zero there is not real.
    con.execute("CREATE TABLE cov AS SELECT DISTINCT fips, year(hour) AS y FROM ch")
    con.execute("""CREATE TABLE ce AS
        SELECT e.event_id, e.ba, e.start, e.stop, c.fips, c.primary_share, m.customers, coalesce(n.n_ba, 1) AS n_ba
        FROM ev e JOIN cba c USING (ba) JOIN mcc m USING (fips) JOIN cov ON cov.fips = c.fips AND cov.y = year(e.start)
        LEFT JOIN nba n ON n.fips = c.fips""")
    con.execute(f"""CREATE TABLE tgt AS
        SELECT ce.event_id, ce.fips,
               count(*) FILTER (WHERE h.hour >= ce.start AND h.out >= {DARK_SHARE} * ce.customers) AS dark_hours,
               coalesce(max(least(h.out, ce.customers)) FILTER (WHERE h.hour = ce.start - INTERVAL 1 HOUR), 0) / any_value(ce.customers) AS out_frac_prev1h,
               coalesce(max(least(h.out, ce.customers)) FILTER (WHERE h.hour < ce.start), 0) / any_value(ce.customers) AS out_frac_max_prev6h
        FROM ce LEFT JOIN ch h ON h.fips = ce.fips AND h.hour >= ce.start - INTERVAL 6 HOUR AND h.hour <= ce.stop
        GROUP BY ce.event_id, ce.fips""")
    evcols = ", ".join(f'f."{c}" AS "ev_{c}"' for c in EV_FEATS)
    df = con.execute(f"""
        SELECT ce.*, t.dark_hours, t.out_frac_prev1h, t.out_frac_max_prev6h,
               month(ce.start) AS month, hour(ce.start) AS hod, e.hours_above, {evcols},
               coalesce(o.frac, 0) AS ba_frac_prev1h,
               s.svi, s.svi_t1, s.svi_t2, s.svi_t3, s.svi_t4, p.pop
        FROM ce JOIN tgt t USING (event_id, fips) JOIN ev e USING (event_id)
        LEFT JOIN '{C.SHARED}/ba_hour_features.parquet' f ON f.ba = ce.ba AND f.hour = ce.start
        LEFT JOIN '{C.SHARED}/ba_hour_out.parquet' o ON o.ba = ce.ba AND o.hour = ce.start - INTERVAL 1 HOUR
        LEFT JOIN (SELECT lpad(CAST(FIPS AS VARCHAR),5,'0') AS fips,
                          nullif(RPL_THEMES, -999) AS svi, nullif(RPL_THEME1, -999) AS svi_t1, nullif(RPL_THEME2, -999) AS svi_t2,
                          nullif(RPL_THEME3, -999) AS svi_t3, nullif(RPL_THEME4, -999) AS svi_t4
                   FROM read_csv('{C.RAW}/svi/SVI_2022_US_county.csv', header=true)) s ON s.fips = ce.fips
        LEFT JOIN (SELECT lpad(CAST(STATE AS VARCHAR),2,'0') || lpad(CAST(COUNTY AS VARCHAR),3,'0') AS fips, POPESTIMATE2022 AS pop
                   FROM read_csv('{C.RAW}/census/co-est2024-alldata.csv', header=true, encoding='latin-1') WHERE SUMLEV = 50) p ON p.fips = ce.fips
        ORDER BY ce.start, ce.event_id, ce.fips""").df()
    for c in ["dark_hours", "customers", "pop", "n_ba"]:
        df[c] = df[c].astype(float)

    # BA descriptors (numbers, not the BA name: the browser evaluator supports numeric splits only).
    ba = df.groupby("ba").agg(ba_customers=("customers", lambda s: 0.0), ba_n_counties=("fips", "nunique"))
    ba["ba_customers"] = df.drop_duplicates(["ba", "fips"]).groupby("ba").customers.sum()
    df = df.join(ba, on="ba")
    df["cust_share_of_ba"] = df.customers / df.ba_customers
    # History before the event start. Events of one BA do not overlap, so earlier rows have ended.
    e = df.drop_duplicates("event_id")[["event_id", "ba", "start", "stop", "hours_above"]].sort_values(["ba", "start"])
    g = e.groupby("ba")
    e["ba_past_events"] = g.cumcount().astype(float)
    e["ba_past_mean_hours"] = (g.hours_above.cumsum() - e.hours_above) / e.ba_past_events.replace(0, np.nan)
    e["ba_hours_since_last"] = (e.start - g.stop.shift(1)).dt.total_seconds() / 3600
    df = df.merge(e[["event_id", "ba_past_events", "ba_past_mean_hours", "ba_hours_since_last"]], on="event_id")
    df = df.sort_values(["fips", "start"]).reset_index(drop=True)
    g = df.groupby("fips")
    df["past_events"] = g.cumcount().astype(float)
    n = df.past_events.replace(0, np.nan)
    df["past_dark_mean"] = (g.dark_hours.cumsum() - df.dark_hours) / n
    df["past_dark_max"] = g.dark_hours.transform(lambda s: s.shift(1).cummax())
    df["_any"] = (df.dark_hours > 0).astype(float)
    df["past_dark_share"] = (g._any.cumsum() - df._any) / n
    df["baseline"] = df.past_dark_mean.fillna(0.0)               # no history -> 0 h
    df["start_h"] = C.to_h(df.start)
    return df.drop(columns="_any").sort_values(["start", "event_id", "fips"]).reset_index(drop=True)


def within_event_spearman(d: pd.DataFrame, col: str) -> tuple[float | None, int]:
    vals = []
    for _, g in d.groupby("event_id"):
        if len(g) >= 5 and g.dark_hours.nunique() > 1 and g[col].nunique() > 1:
            vals.append(spearmanr(g.dark_hours, g[col]).statistic)
    return (float(np.mean(vals)) if vals else None), len(vals)


def equity(df: pd.DataFrame) -> dict:
    d = df[df.svi.notna()].copy()
    d["q"] = np.clip(np.ceil(d.svi * 4), 1, 4).astype(int)       # 4 = most vulnerable quarter of US counties
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
    return {"quartiles": quart, "events": int(len(ids)), "countyEvents": int(len(d)),
            "q4MinusQ1": {"mean": float(quart[3]["meanDarkHours"] - quart[0]["meanDarkHours"]),
                          "lo": float(np.percentile(diff, 2.5)), "hi": float(np.percentile(diff, 97.5))},
            "withinEventQ4MinusQ1": {"events": int(both.sum()), "mean": float(w.mean()),
                                     "lo": float(np.percentile(wb, 2.5)), "hi": float(np.percentile(wb, 97.5))}}


def main() -> None:
    t0 = time.time()
    C.ART.mkdir(exist_ok=True); C.OUT.mkdir(exist_ok=True)
    df = build_table()
    df.to_parquet(C.ART / "county_event.parquet", index=False)
    X, y = df[FEATS].values.astype(float), df.dark_hours.values
    year = df.start.dt.year.values
    tr, te = df.start_h.values < C.SPLIT_H, df.start_h.values >= C.SPLIT_H
    split_year = C.from_h(C.SPLIT_H).year
    val_years = list(range(int(year.min()) + 2, split_year))
    print(f"county-events {len(df):,} in {df.event_id.nunique()} events; train {tr.sum():,} test {te.sum():,}; "
          f"mean dark h {y.mean():.2f}; share with any dark hour {(y > 0).mean():.1%}", flush=True)

    cv = []
    for cfg in CONFIGS:
        oof = {r: np.full(len(df), np.nan) for r in ROUNDS}
        for vy in val_years:
            a, b = np.flatnonzero(tr & (year < vy)), np.flatnonzero(tr & (year == vy))
            if not len(b):
                continue
            m = lgb.train({**BASE, **cfg}, lgb.Dataset(X[a], y[a], feature_name=FEATS), max(ROUNDS))
            for r in ROUNDS:
                oof[r][b] = np.maximum(m.predict(X[b], num_iteration=r), 0)
        for r in ROUNDS:
            ok = ~np.isnan(oof[r])
            cv.append({**cfg, "rounds": r, "mae": float(np.abs(oof[r][ok] - y[ok]).mean()), "_oof": oof[r]})
    best = min(cv, key=lambda c: c["mae"])
    cfg = {k: best[k] for k in ("num_leaves", "min_child_samples")}
    model = lgb.train({**BASE, **cfg}, lgb.Dataset(X[tr], y[tr], feature_name=FEATS), best["rounds"])
    model.save_model(str(C.ART / "dark.txt"))
    pred = np.maximum(model.predict(X), 0)                       # negative hours are not possible
    df["pred"] = pred

    def block(mask, p):
        d = df[mask].assign(pred=p[mask])
        if not len(d):
            return None
        wm, wn = within_event_spearman(d, "pred")
        wb, _ = within_event_spearman(d, "baseline")
        return {"countyEvents": int(len(d)), "events": int(d.event_id.nunique()),
                "meanDarkHours": float(d.dark_hours.mean()),
                "maeHours": float(np.abs(d.pred - d.dark_hours).mean()),
                "baselineMaeHours": float(np.abs(d.baseline - d.dark_hours).mean()),
                "zeroMaeHours": float(d.dark_hours.abs().mean()),
                "trainMeanMaeHours": float(np.abs(y[tr].mean() - d.dark_hours).mean()),
                "rmseHours": float(np.sqrt(((d.pred - d.dark_hours) ** 2).mean())),
                "baselineRmseHours": float(np.sqrt(((d.baseline - d.dark_hours) ** 2).mean())),
                "spearman": float(spearmanr(d.dark_hours, d.pred).statistic),
                "baselineSpearman": float(spearmanr(d.dark_hours, d.baseline).statistic),
                "withinEventSpearman": wm, "baselineWithinEventSpearman": wb, "withinEventSpearmanEvents": wn}

    oofm = ~np.isnan(best["_oof"])
    gain = model.feature_importance("gain")
    res = {"split": C.SPLIT, "features": FEATS, "config": {**cfg, "rounds": best["rounds"]},
           "cv": [{k: v for k, v in c.items() if k != "_oof"} for c in cv], "valYears": val_years,
           "years": [int(year.min()), int(year.max())],
           "gainShare": dict(sorted(zip(FEATS, (gain / gain.sum()).round(4).tolist()), key=lambda kv: -kv[1])[:12]),
           "train_oof": block(oofm, np.where(oofm, best["_oof"], 0)), "test": block(te, pred),
           "equity": equity(df)}
    (C.OUT / "dark_results.json").write_text(json.dumps(res, indent=1))
    out = df[["event_id", "fips"]].copy()
    out["pred_dark_hours"] = np.where(oofm, best["_oof"], pred)   # out-of-fold where it exists
    out["in_sample"] = tr & ~oofm
    out.to_parquet(C.SHARED / "county_event_pred.parquet", index=False)
    t = res["test"]
    if t:
        print(f"dark: cfg {res['config']} TEST mae {t['maeHours']:.2f} baseline {t['baselineMaeHours']:.2f} zero {t['zeroMaeHours']:.2f} "
              f"spearman {t['spearman']:.3f} (baseline {t['baselineSpearman']:.3f})", flush=True)
    print("equity:", [(q["quartile"], round(q["meanDarkHours"], 2), round(q["lo"], 2), round(q["hi"], 2)) for q in res["equity"]["quartiles"]],
          res["equity"]["withinEventQ4MinusQ1"], f"[{time.time()-t0:.0f}s]", flush=True)


if __name__ == "__main__":
    main()
