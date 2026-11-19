"""FINAL TEST (2023-2024) for the residents-only check-first model. Run once.

Reads the frozen predictions from train_dark_residents.py. Nothing is fitted or tuned here.
Intervals: 2,000 bootstrap resamples of test events (seeded). The example event is fixed by a rule
set before scoring: the test event with the most customers out at its peak.

Writes: out/dark_residents_final.json; appends a line to out/final_test_residents_runs.log
Run: uv run python final_test_residents.py
"""
from __future__ import annotations

import json
import time

import duckdb
import numpy as np
import pandas as pd
from scipy.stats import spearmanr

import common as C
import train_dark as D

N_BOOT = 2000


def per_event(d: pd.DataFrame) -> pd.DataFrame:
    """One row per event: within-event Spearman and top-10 overlap for the model and history,
    using the same eligibility rules as train_dark.within_event_spearman and topk_overlap."""
    rows = []
    for eid, g in d.groupby("event_id"):
        r = {"event_id": eid, "n": len(g), "abs_m": np.abs(g.pred - g.dark_hours).sum(),
             "abs_h": np.abs(g.baseline - g.dark_hours).sum(), "abs_0": g.dark_hours.abs().sum()}
        r["sp_m"] = (spearmanr(g.dark_hours, g.pred).statistic
                     if len(g) >= 5 and g.dark_hours.nunique() > 1 and g.pred.nunique() > 1 else np.nan)
        r["sp_h"] = (spearmanr(g.dark_hours, g.baseline).statistic
                     if len(g) >= 5 and g.dark_hours.nunique() > 1 and g.baseline.nunique() > 1 else np.nan)
        n_dark = int((g.dark_hours > 0).sum())
        if len(g) >= D.TOPK and n_dark > 0:
            k = min(D.TOPK, n_dark)
            g = g.sort_values("fips")
            act = set(g.sort_values("dark_hours", ascending=False, kind="stable").fips[:k])
            r["tk_m"] = len(act & set(g.sort_values("pred", ascending=False, kind="stable").fips[:k])) / k
            r["tk_h"] = len(act & set(g.sort_values("baseline", ascending=False, kind="stable").fips[:k])) / k
            r["tk_c"] = k / len(g)
        else:
            r["tk_m"] = r["tk_h"] = r["tk_c"] = np.nan
        rows.append(r)
    return pd.DataFrame(rows)


def ci(vals: np.ndarray, rng) -> dict:
    v = vals[~np.isnan(vals)]
    bs = v[rng.integers(0, len(v), (N_BOOT, len(v)))].mean(1)
    return {"mean": float(v.mean()), "lo": float(np.percentile(bs, 2.5)), "hi": float(np.percentile(bs, 97.5)), "events": int(len(v))}


def ratio_ci(num: np.ndarray, den: np.ndarray, rng) -> dict:
    pick = rng.integers(0, len(num), (N_BOOT, len(num)))
    bs = num[pick].sum(1) / den[pick].sum(1)
    return {"mean": float(num.sum() / den.sum()), "lo": float(np.percentile(bs, 2.5)), "hi": float(np.percentile(bs, 97.5))}


def summarize(d: pd.DataFrame) -> dict:
    rng = np.random.default_rng(C.SEED)
    e = per_event(d)
    both_sp = e[["sp_m", "sp_h"]].notna().all(1)
    return {"countyEvents": int(len(d)), "events": int(d.event_id.nunique()),
            "withinEventSpearman": ci(e.sp_m.values, rng), "historyWithinEventSpearman": ci(e.sp_h.values, rng),
            "withinEventSpearmanMinusHistory": ci((e.sp_m - e.sp_h).where(both_sp).values, rng),
            "top10Overlap": ci(e.tk_m.values, rng), "historyTop10Overlap": ci(e.tk_h.values, rng),
            "top10Chance": ci(e.tk_c.values, rng), "top10OverlapMinusHistory": ci((e.tk_m - e.tk_h).values, rng),
            "maeHours": ratio_ci(e.abs_m.values, e.n.values.astype(float), rng),
            "historyMaeHours": ratio_ci(e.abs_h.values, e.n.values.astype(float), rng),
            "zeroMaeHours": ratio_ci(e.abs_0.values, e.n.values.astype(float), rng)}


def names() -> pd.DataFrame:
    c = pd.read_csv(C.RAW / "census" / "co-est2024-alldata.csv", encoding="latin-1", dtype=str,
                    usecols=["SUMLEV", "STATE", "COUNTY", "STNAME", "CTYNAME"])
    c = c[c.SUMLEV == "050"]
    return pd.DataFrame({"fips": c.STATE + c.COUNTY, "name": c.CTYNAME + ", " + c.STNAME})


def example(d: pd.DataFrame) -> dict:
    ev = duckdb.sql(f"SELECT event_id, ba, start, stop, peak_customers_out FROM '{C.DATA_OUT}/events.parquet'").df()
    ev = ev[ev.event_id.isin(d.event_id)].sort_values("peak_customers_out", ascending=False)
    top = ev.iloc[0]
    g = d[d.event_id == top.event_id].merge(names(), on="fips", how="left")
    g["name"] = g.name.fillna(g.fips)
    g = g.sort_values("fips").sort_values("pred", ascending=False, kind="stable")
    one = per_event(d[d.event_id == top.event_id]).iloc[0]
    return {"event_id": top.event_id, "ba": top.ba, "start": str(top.start), "stop": str(top.stop),
            "peakCustomersOut": int(top.peak_customers_out), "areas": int(len(g)),
            "darkAreas": int((g.dark_hours > 0).sum()),
            "top10Overlap": None if np.isnan(one.tk_m) else float(one.tk_m),
            "historyTop10Overlap": None if np.isnan(one.tk_h) else float(one.tk_h),
            "withinEventSpearman": None if np.isnan(one.sp_m) else float(one.sp_m),
            "topAreas": [{"fips": r.fips, "name": r.name, "predictedHours": round(float(r.pred), 1),
                          "actualHours": float(r.dark_hours), "historyHours": round(float(r.baseline), 1)}
                         for r in g.head(10).itertuples()],
            "actualTopAreas": [{"fips": r.fips, "name": r.name, "actualHours": float(r.dark_hours),
                                "predictedHours": round(float(r.pred), 1)}
                               for r in g.sort_values("fips").sort_values("dark_hours", ascending=False, kind="stable").head(10).itertuples()]}


def main() -> None:
    f = pd.read_parquet(C.ART / "dark_residents_frozen.parquet")
    d = f[f.is_test].copy()
    res = summarize(d)
    res["example"] = example(d)
    (C.OUT / "dark_residents_final.json").write_text(json.dumps(res, indent=1))
    with open(C.OUT / "final_test_residents_runs.log", "a") as fh:
        fh.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} wSpearman {res['withinEventSpearman']['mean']:.4f} "
                 f"top10 {res['top10Overlap']['mean']:.4f} mae {res['maeHours']['mean']:.4f}\n")
    for k in ("withinEventSpearman", "historyWithinEventSpearman", "withinEventSpearmanMinusHistory", "top10Overlap",
              "historyTop10Overlap", "top10Chance", "top10OverlapMinusHistory", "maeHours", "historyMaeHours", "zeroMaeHours"):
        v = res[k]
        print(f"{k:34s} {v['mean']:.3f}  [{v['lo']:.3f}, {v['hi']:.3f}]  {v.get('events', '')}")
    x = res["example"]
    print(x["event_id"], x["start"], x["areas"], x["darkAreas"], x["top10Overlap"], x["historyTop10Overlap"])
    for a in x["topAreas"]:
        print("  ", a)


if __name__ == "__main__":
    main()
