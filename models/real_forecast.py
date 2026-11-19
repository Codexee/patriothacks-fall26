"""warn_fcst on REAL archived weather forecasts (2024), the "perfect prog" test.

warn_fcst stays exactly as trained in v2 (observed future weather standing in for a forecast). Here
its fx_ features are rebuilt from archived Open-Meteo forecasts (data/fetch/forecast_archive.py),
and the frozen model and its frozen v2 threshold score 2024 again. Nothing is refitted or retuned.

Lead rule (exact). For the hour t being scored and a valid hour v = t + k (k = 1..48), use the
forecast `previous_day{d}` with d = ceil((k + 6) / 24):
    k = 1..18  -> previous_day1 (predicted 24 h before v, so at least 6 h before t)
    k = 19..42 -> previous_day2 (48 h before v, so at least 6 h before t)
    k = 43..48 -> previous_day3 (72 h before v, so at least 24 h before t)
So every forecast value was predicted at least 6 h before t. The 6 h margin covers the delay
between a model run's start time and the time its output is published.

Station -> BA, as in data/build/features_ba_hour.py: temperature = weighted mean of the BA's
stations (weights from ba_stations.csv, missing values skipped); wind = max over stations; hourly
precipitation = max over stations; sea-level pressure = min over stations. Then the same windows as
the feature table: 24 h and 48 h max wind, min/max temperature, summed precipitation, min pressure.
z-scores and the record-low difference use the same past-only climatology as the feature table
(same-calendar-month mean and sample std of all earlier hours of the BA; record low = min of all
earlier hours), rebuilt here and checked against the table's own fx_ z values.

Writes: out/real_forecast.json
Run: uv run python real_forecast.py   (after train_warn.py; needs the forecast cache)
"""
from __future__ import annotations

import json
import math
import warnings

import duckdb
import lightgbm as lgb
import numpy as np
import pandas as pd

import common as C
import warn_lib as W

CACHE = C.SHARED / "forecast_archive"
MARGIN_H = 6
OBS = ["temp_c", "wind_max_ms", "precip_max_mm", "slp_min_hpa"]
API_VAR = {"temp_c": "temperature_2m", "wind_max_ms": "wind_speed_10m", "precip_max_mm": "precipitation",
           "slp_min_hpa": "pressure_msl"}
KEYS = ("testEvents", "warned6h", "warned12h", "warned24h", "recall12h", "peopleRecall12h", "custHoursRecall12h",
        "medianLeadHours", "falseAlarmsPerBaYear", "aucPr")
METHODS = ["warn_fcst_real", "warn_fcst_observed", "warn_full", "warn_grid", "rule_forecast_error", "rule_hand", "rule_record"]


def lead_day(k: int) -> int:
    return math.ceil((k + MARGIN_H) / 24)


def station_forecasts() -> pd.DataFrame:
    """Long table: station, valid hour, lead day d, and the 4 variables."""
    meta = json.loads((CACHE / "stations.json").read_text())
    rows = []
    for s in meta["stations"]:
        x = json.loads((CACHE / f"{s['station']}.json").read_text())
        h = x["hourly"]
        t = pd.to_datetime(h["time"])
        for d in (1, 2, 3):
            f = pd.DataFrame({"station": s["station"], "hour": t, "d": d})
            for col, api in API_VAR.items():
                f[col] = np.array(h[f"{api}_previous_day{d}"], dtype=float)
            rows.append(f)
    return pd.concat(rows, ignore_index=True)


def ba_forecasts(st: pd.DataFrame) -> pd.DataFrame:
    w = pd.read_csv(C.DATA_OUT / "ba_stations.csv", dtype={"usaf": str, "wban": str})
    w["station"] = w.usaf.str.zfill(6) + "-" + w.wban.str.zfill(5)
    w = w.groupby(["ba", "station"], as_index=False).weight.sum()
    m = w.merge(st, on="station")
    m["tw"] = np.where(m.temp_c.notna(), m.weight, np.nan)
    m["twx"] = m.temp_c * m.weight
    g = m.groupby(["ba", "d", "hour"])
    return pd.DataFrame({"temp_c": g.twx.sum(min_count=1) / g.tw.sum(min_count=1), "wind_max_ms": g.wind_max_ms.max(),
                         "precip_max_mm": g.precip_max_mm.max(), "slp_min_hpa": g.slp_min_hpa.min()}).reset_index()


def climatology() -> pd.DataFrame:
    """Past-only climatology per BA-hour, as the window wmon / wexp in features_ba_hour.py."""
    fx = ", ".join(f'"{c}"' for c in C.FX)
    t = duckdb.sql(f"""SELECT ba, hour, temp_c, wind_max_ms, {fx}
                       FROM '{C.SHARED}/ba_hour_features.parquet' ORDER BY ba, hour""").df()
    t["month"] = t.hour.dt.month
    gm = t.groupby(["ba", "month"], sort=False)
    for c, p in (("temp_c", "t"), ("wind_max_ms", "w")):
        t[f"mu_{p}"] = gm[c].transform(lambda s: s.expanding().mean().shift(1))
        t[f"sd_{p}"] = gm[c].transform(lambda s: s.expanding().std().shift(1))
    t["rec_low"] = t.groupby("ba", sort=False).temp_c.transform(lambda s: s.expanding().min().shift(1))
    # Check: the table's observed fx_ z values must follow from this climatology.
    chk = {"fx_temp_min_48h_z": (t.fx_temp_min_48h - t.mu_t) / t.sd_t.replace(0, np.nan),
           "fx_wind_max_48h_z": (t.fx_wind_max_48h - t.mu_w) / t.sd_w.replace(0, np.nan),
           "fx_temp_min_48h_above_record": t.fx_temp_min_48h - t.rec_low}
    err = {k: float(np.nanmax(np.abs(v.values - t[k].values))) for k, v in chk.items()}
    print("climatology check, max abs difference against the table:", err, flush=True)
    assert all(e < 1e-6 for e in err.values()), err
    return t[["ba", "hour", "mu_t", "sd_t", "mu_w", "sd_w", "rec_low"]], err


def fx_from_forecast(bf: pd.DataFrame, clim: pd.DataFrame, hours: pd.DatetimeIndex) -> pd.DataFrame:
    """The 13 fx_ features per BA and scoring hour t, from forecasts with the lead rule above."""
    out = []
    for ba, g in bf.groupby("ba"):
        grid = {d: g[g.d == d].set_index("hour").reindex(hours.union(hours + pd.Timedelta(hours=48)))
                for d in (1, 2, 3)}
        n = len(hours)
        stack = {c: np.full((48, n), np.nan) for c in OBS}
        for k in range(1, 49):
            src = grid[lead_day(k)]
            idx = hours + pd.Timedelta(hours=k)
            for c in OBS:
                stack[c][k - 1] = src[c].reindex(idx).values
        f = pd.DataFrame({"ba": ba, "hour": hours})
        complete = np.ones(n, bool)
        for c in OBS:
            complete &= np.isfinite(stack[c]).all(0)
        with np.errstate(all="ignore"), warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            for hz in (24, 48):
                s = {c: stack[c][:hz] for c in OBS}
                f[f"fx_wind_max_{hz}h"] = np.nanmax(s["wind_max_ms"], 0)
                f[f"fx_temp_min_{hz}h"] = np.nanmin(s["temp_c"], 0)
                f[f"fx_temp_max_{hz}h"] = np.nanmax(s["temp_c"], 0)
                f[f"fx_precip_{hz}h"] = np.nansum(s["precip_max_mm"], 0)
            f["fx_slp_min_48h"] = np.nanmin(stack["slp_min_hpa"], 0)
        f["complete"] = complete
        out.append(f)
    f = pd.concat(out, ignore_index=True).merge(clim, on=["ba", "hour"], how="left")
    sd_t, sd_w = f.sd_t.replace(0, np.nan), f.sd_w.replace(0, np.nan)
    f["fx_temp_min_48h_z"] = (f.fx_temp_min_48h - f.mu_t) / sd_t
    f["fx_temp_max_48h_z"] = (f.fx_temp_max_48h - f.mu_t) / sd_t
    f["fx_wind_max_48h_z"] = (f.fx_wind_max_48h - f.mu_w) / sd_w
    f["fx_temp_min_48h_above_record"] = f.fx_temp_min_48h - f.rec_low
    return f


def main() -> None:
    assert (CACHE / "stations.json").exists(), "Run data/fetch/forecast_archive.py first"
    frozen = json.loads((C.OUT / "warn_frozen.json").read_text())["methods"]
    feats = frozen["warn_fcst"]["features"]
    bf = ba_forecasts(station_forecasts())
    clim, clim_err = climatology()
    hours = pd.date_range("2024-01-01", "2024-12-31 23:00", freq="h")
    fx = fx_from_forecast(bf, clim, hours)

    d = W.Data()
    df = d.df
    key = pd.MultiIndex.from_arrays([df.ba.values, df.hour.values])
    fxk = fx.set_index(["ba", "hour"])
    pos = key.get_indexer(fxk.index)
    keep = pos >= 0
    fxk, pos = fxk[keep], pos[keep]
    complete = np.zeros(len(df), bool)
    complete[pos] = fxk.complete.values
    # Common period: every BA's 48 h forecast window complete, and the label horizon inside the data.
    ok_hours = pd.Series(complete, index=df.hour.values)[df.ba.isin(fx.ba.unique()).values]
    by_hour = ok_hours.groupby(level=0).all()
    first = by_hour[by_hour].index.min()
    last = by_hour[by_hour].index.max()
    p0, p1 = C.to_h([first])[0], C.to_h([last])[0] + 1
    print(f"forecast period {first} .. {last}  ({by_hour.sum()} complete hours)", flush=True)

    Xreal = df[feats].values.astype(float)
    for c in C.FX:
        if c in feats:
            Xreal[pos, feats.index(c)] = fxk[c].values
    booster = lgb.Booster(model_file=str(C.ART / "warn_fcst.txt"))
    rows_mask = d.test & (df.h.values >= p0) & (df.h.values + C.HORIZON_H < p1) & complete
    rows = np.flatnonzero(rows_mask)
    sc = pd.read_parquet(C.ART / "warn_scores.parquet")
    assert (sc.ba.values == df.ba.values).all() and (sc.hour.values == df.hour.values).all()
    scores = {"warn_fcst_observed": sc.warn_fcst.values}
    real = np.full(len(df), np.nan)
    real[rows] = booster.predict(Xreal[rows], num_threads=12)
    scores["warn_fcst_real"] = real
    for n in METHODS[2:]:
        scores[n] = sc[n].values
    thr = {"warn_fcst_real": frozen["warn_fcst"]["threshold"], "warn_fcst_observed": frozen["warn_fcst"]["threshold"],
           **{n: frozen[n]["threshold"] for n in METHODS[2:]}}
    # Events whose whole 72 h warning window lies inside the forecast period.
    ev = d.ev[(d.ev.start_h >= p0 + C.LOOKBACK_H) & (d.ev.start_h < p1)]
    panel = C.Panel(df, rows, ev)
    res = {"period": [str(C.from_h(p0)), str(C.from_h(p1 - 1))], "eventsWindowFrom": str(C.from_h(p0 + C.LOOKBACK_H)),
           "scoredHours": int(len(rows)), "events": int(len(ev)), "bas": int(fx.ba.nunique()),
           "leadRule": "valid hour t+k uses previous_day ceil((k+6)/24): k 1-18 day1, 19-42 day2, 43-48 day3; "
                       "every value predicted at least 6 h before t",
           "source": "Open-Meteo Previous Runs API, best_match model, archive from about 2024-01-19",
           "climatologyCheckMaxAbsDiff": clim_err, "thresholds": thr, "models": {}}
    # Forecast skill: forecast-based against observed fx_ features on the scored hours.
    obs = df[C.FX].values[rows].astype(float)
    res["featureAgreement"] = {c: {"corr": float(pd.Series(obs[:, j]).corr(pd.Series(Xreal[rows, feats.index(c)]))),
                                   "meanAbsDiff": float(np.nanmean(np.abs(obs[:, j] - Xreal[rows, feats.index(c)])))}
                               for j, c in enumerate(C.FX) if c in feats}
    leads = {}
    for n in METHODS:
        b = d.evaluate(panel, scores[n][rows], thr[n])
        leads[n] = b.pop("event_leads")
        res["models"][n] = {k: b[k] for k in KEYS} | {"groups": b["groups"], "seasons": b["seasons"]}
        r = res["models"][n]
        print(f"{n}: events {r['testEvents']} w12 {r['warned12h']} w24 {r['warned24h']} fa {r['falseAlarmsPerBaYear']:.2f} "
              f"ap {r['aucPr']:.4f} people {r['peopleRecall12h']:.3f}", flush=True)
    o, rl = res["models"]["warn_fcst_observed"], res["models"]["warn_fcst_real"]
    res["survives"] = {k: (rl[k] / o[k] if o[k] else None) for k in ("warned12h", "warned24h", "peopleRecall12h", "aucPr")}
    ev_out = ev[["event_id", "ba", "start", "peak_customers_out", "group"]].copy()
    for n in METHODS:
        ev_out[f"lead_{n}"] = ev_out.event_id.map(leads[n])
    ev_out.to_csv(C.OUT / "real_forecast_events.csv", index=False)
    (C.OUT / "real_forecast.json").write_text(json.dumps(res, indent=1))
    print("survives:", res["survives"])


if __name__ == "__main__":
    main()
