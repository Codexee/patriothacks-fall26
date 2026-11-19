"""Shared paths, the three period constants, the feature lists and the event-level scoring.

Periods (v2): TRAIN = hours before TRAIN_END; DEV = TRAIN_END to DEV_END; FINAL TEST = DEV_END to
TEST_END. All fitting, hyperparameters and thresholds use TRAIN only. DEV chooses features and model
design (v1 already showed these years). FINAL TEST is scored once, by final_test.py.
"""
from __future__ import annotations

import os
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

TRAIN_END = "2021-01-01"
DEV_END = "2023-01-01"
TEST_END = "2025-01-01"
SPLIT = TRAIN_END                                     # v1 name, kept for the scripts that use it

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
MAIN = Path(os.environ.get("BDA_MAIN", "/Users/neil/Documents/patriothacks-fall26"))
SHARED = Path(os.environ.get("BDA_SHARED", MAIN / "data" / "raw" / "derived"))
DATA_OUT = MAIN / "data" / "out"
RAW = MAIN / "data" / "raw"
ART = HERE / "artifacts"                             # boosters and tables (git-ignored)
OUT = HERE / "out"                                   # small result files (committed)
APP_MODELS = REPO / "app" / "public" / "models"

SEED = 20261118
FA_LIMIT = 6.0            # false alarms per BA per year allowed on the training years
LOOKBACK_H = 72           # an event is warned if an alert fires in the 72 h before its start
MIN_LEAD_H = 12
HORIZON_H = 48
MERGE_H = 24              # alerts closer than this are one episode
HOURS_PER_YEAR = 8766.0

# Features. Only ratios and changes: no raw MW values, so the model cannot learn which BA it is.
# `doy` is left out: with 5 or 6 training years it would let the trees remember single storms.
GRID = ["fc_err", "fc_err_max_24h", "demand_vs_30d_peak", "import_share", "gas_share",
        "netgen_chg_6h", "gas_chg_6h", "hod", "month"]
# v2 adequacy: demand and the next-12-h day-ahead forecast against the BA's own past records.
ADEQ = ["demand_vs_record", "demand_vs_month_record", "fc12_vs_record", "fc12_vs_365d_peak",
        "fc12_vs_30d_peak", "fc12_vs_month_record"]
WX = ["temp_c", "dew_c", "slp_min_hpa", "wind_max_ms", "precip_max_mm", "temp_anom_30d",
      "temp_min_24h", "temp_max_24h", "wind_max_24h", "precip_24h", "slp_chg_12h"]
SWX = ["temp_z_month", "wind_z_month", "temp_above_record_low", "temp_below_record_high"]
OUTS = ["out_own_lag1", "out_own_chg_6h", "out_nat_lag1", "out_nat_chg_12h"]   # not available live
FX = ["fx_wind_max_48h", "fx_temp_min_48h", "fx_temp_max_48h", "fx_precip_48h", "fx_temp_min_48h_z",
      "fx_temp_max_48h_z", "fx_wind_max_48h_z", "fx_temp_min_48h_above_record", "fx_slp_min_48h",
      "fx_wind_max_24h", "fx_temp_min_24h", "fx_temp_max_24h", "fx_precip_24h"]
# Trailing summaries computed in load_features (past only). Used only if DEV shows they help.
TRAIL = ["fc12_vs_month_record_max_72h", "temp_z_month_min_72h", "wind_z_month_max_72h", "out_own_lag1_max_72h"]
LOAD_COLS = GRID + ADEQ + WX + SWX + OUTS + FX
VARIANTS = {"warn_grid": GRID + ADEQ, "warn_full": GRID + ADEQ + WX + SWX + OUTS,
            "warn_fcst": GRID + ADEQ + WX + SWX + OUTS + FX}
# Features where more must never lower the risk (monotone constraint +1), if DEV shows it helps.
MONOTONE_UP = ["demand_vs_record", "demand_vs_month_record", "fc12_vs_record", "fc12_vs_365d_peak",
               "fc12_vs_30d_peak", "fc12_vs_month_record", "fc12_vs_month_record_max_72h"]
FCST_LABEL = ("with a weather forecast; backtest uses observed weather as the forecast, so it is an upper bound")

SEASONS = {"winter": (12, 1, 2), "summer": (6, 7, 8), "other": (3, 4, 5, 9, 10, 11)}


def season_of(month: np.ndarray) -> np.ndarray:
    m = np.asarray(month)
    return np.where(np.isin(m, SEASONS["winter"]), "winter",
                    np.where(np.isin(m, SEASONS["summer"]), "summer", "other"))


def to_h(ts) -> np.ndarray:
    """Timestamps -> whole hours since 1970 (int64)."""
    return pd.to_datetime(ts).values.astype("datetime64[h]").astype(np.int64)


def from_h(h) -> pd.Timestamp:
    return pd.Timestamp(np.datetime64(int(h), "h"))


SPLIT_H = int(to_h([SPLIT])[0])
TRAIN_END_H, DEV_END_H, TEST_END_H = (int(to_h([t])[0]) for t in (TRAIN_END, DEV_END, TEST_END))


def load_events() -> pd.DataFrame:
    ev = duckdb.sql(f"SELECT * FROM '{DATA_OUT}/events.parquet' ORDER BY ba, start").df()
    ev["start_h"] = to_h(ev.start)
    ev["stop_h"] = to_h(ev.stop)
    # Customer-outage-hours inside the event window (sum of hourly customers out in the BA).
    co = duckdb.sql(f"""
        SELECT e.event_id, sum(o.out) AS cust_hours FROM '{DATA_OUT}/events.parquet' e
        JOIN '{SHARED}/ba_hour_out.parquet' o ON o.ba = e.ba AND o.hour >= e.start AND o.hour <= e.stop
        GROUP BY e.event_id""").df()
    ev = ev.merge(co, on="event_id", how="left")
    ev["cust_hours"] = ev.cust_hours.fillna(0.0)
    return ev


def data_end_h() -> int:
    """Last hour with outage data. Hours after it have no labels."""
    return int(to_h([duckdb.sql(f"SELECT max(hour) FROM '{SHARED}/ba_hour_out.parquet'").fetchall()[0][0]])[0])


def load_features() -> pd.DataFrame:
    """Every row of the BA-hour feature table, sorted by ba, hour, with labels and masks.

    Recompute y48 and in_event from events.parquet to detect mismatched input versions.
    Scored hours have a complete label horizon in an observed BA window.
    """
    cols = ", ".join(f'"{c}"' for c in LOAD_COLS)
    df = duckdb.sql(f"""
        SELECT ba, hour, {cols}, y48 AS y48_table, in_event AS in_event_table
        FROM '{SHARED}/ba_hour_features.parquet' ORDER BY ba, hour""").df()
    df[LOAD_COLS] = df[LOAD_COLS].astype(np.float32)          # halves memory; trees do not need float64
    df["h"] = to_h(df.hour)
    ev = load_events()
    coverage = duckdb.sql(f"""
        SELECT ba, year(hour) AS year, min(hour) AS first_hour, max(hour) AS last_hour
        FROM '{SHARED}/ba_hour_out.parquet' GROUP BY ba, year(hour)""").df()
    mapped = set(coverage.ba)
    # EAGLE-I lists positive outages only. Avoid treating absent BA-years and gaps
    # between annual observation windows as confirmed negatives.
    covered = np.zeros(len(df), bool)
    y24 = np.zeros(len(df), bool)
    next_peak = np.zeros(len(df))
    y = np.zeros(len(df), bool)
    ine = np.zeros(len(df), bool)
    ba_codes, ba_names = pd.factorize(df.ba)
    bounds = np.r_[0, np.flatnonzero(np.diff(ba_codes)) + 1, len(df)]
    for i in range(len(bounds) - 1):
        a, b = bounds[i], bounds[i + 1]
        ba = ba_names[ba_codes[a]]
        h = df.h.values[a:b]
        spans = coverage[coverage.ba == ba].sort_values("year")
        windows = []
        for lo, hi in zip(to_h(spans.first_hour), to_h(spans.last_hour)):
            if windows and lo <= windows[-1][1] + 1:
                windows[-1][1] = hi
            else:
                windows.append([lo, hi])
        for lo, hi in windows:
            covered[a:b] |= (h >= lo) & (h + HORIZON_H <= hi)
        e = ev[ev.ba == ba]
        if e.empty:
            continue
        st = e.start_h.values
        j = np.searchsorted(st, h, side="right")                    # first start > h
        y[a:b] = (j < len(st)) & (st[np.minimum(j, len(st) - 1)] <= h + HORIZON_H)
        y24[a:b] = (j < len(st)) & (st[np.minimum(j, len(st) - 1)] <= h + 24)
        next_peak[a:b] = np.where(y[a:b], e.peak_customers_out.values[np.minimum(j, len(st) - 1)], 0.0)
        k = j - 1                                                   # last start <= h
        stop_max = np.maximum.accumulate(e.stop_h.values)
        ine[a:b] = (k >= 0) & (h <= stop_max[np.maximum(k, 0)] + HORIZON_H)
    df["y48"] = y
    df["y24"] = y24
    df["next_peak"] = next_peak
    df["in_event"] = ine
    df["mapped"] = df.ba.isin(mapped).values
    if (y != df.y48_table.values).any() or (ine != df.in_event_table.values).any():
        raise ValueError("BA-hour labels and the event library disagree. Rebuild the feature table.")
    df["scored"] = covered & ~ine
    # Trailing 72 h summaries per BA (past and present only; rows are sorted by ba, hour).
    g = df.groupby("ba", sort=False)
    for src, how in (("fc12_vs_month_record", "max"), ("temp_z_month", "min"), ("wind_z_month", "max"),
                     ("out_own_lag1", "max")):
        df[f"{src}_{how}_72h"] = getattr(g[src].rolling(72, min_periods=1), how)().reset_index(level=0, drop=True).values
    return df


class Panel:
    """Scored rows of one period, grouped by BA, for fast event-level scoring."""

    def __init__(self, df: pd.DataFrame, rows: np.ndarray, events: pd.DataFrame):
        """rows: integer positions in df (sorted by ba, hour). events: the events to score."""
        self.rows = rows
        ba = df.ba.values[rows]
        self.h = df.h.values[rows]
        self.month = pd.DatetimeIndex(df.hour.values[rows]).month.values
        self.groups = {}
        if len(rows):
            bounds = np.r_[0, np.flatnonzero(ba[1:] != ba[:-1]) + 1, len(rows)]
            self.groups = {ba[a]: (a, b) for a, b in zip(bounds[:-1], bounds[1:])}
        self.events = events[events.ba.isin(self.groups)].reset_index(drop=True)
        self.all_events = events                               # includes BAs with no feature rows
        self.ba_years = len(rows) / HOURS_PER_YEAR
        self.season_rows = season_of(self.month)

    def run(self, score: np.ndarray, thr: float, all_starts: dict[str, np.ndarray]) -> dict:
        """score is aligned to self.rows. all_starts: every event start per BA (for the false-alarm test)."""
        leads = np.full(len(self.events), np.nan)
        ep_month, ep_false = [], []
        ev_by_ba = self.events.groupby("ba").indices
        for b, (a, z) in self.groups.items():
            s = score[a:z]
            ah = self.h[a:z][s >= thr]                           # NaN scores never alert
            if len(ah):
                brk = np.flatnonzero(np.diff(ah) >= MERGE_H)
                es, ee = ah[np.r_[0, brk + 1]], ah[np.r_[brk, len(ah) - 1]]
                st = all_starts.get(b, np.empty(0, np.int64))
                i = np.searchsorted(st, es, side="left")
                hit = (i < len(st)) & (st[np.minimum(i, max(len(st) - 1, 0))] <= ee + HORIZON_H) if len(st) else np.zeros(len(es), bool)
                ep_false.append(~hit)
                ep_month.append(es.astype("datetime64[h]").astype("datetime64[M]").astype(np.int64) % 12 + 1)
            indices = ev_by_ba.get(b)
            if indices is not None and len(ah):
                s0 = self.events.start_h.values[indices]
                i = np.searchsorted(ah, s0 - LOOKBACK_H, side="left")
                ok = (i < len(ah)) & (ah[np.minimum(i, len(ah) - 1)] < s0)
                leads[indices[ok]] = (s0 - ah[np.minimum(i, len(ah) - 1)])[ok]
        ep_false = np.concatenate(ep_false) if ep_false else np.zeros(0, bool)
        ep_month = np.concatenate(ep_month) if ep_month else np.zeros(0, int)
        return {"leads": leads, "ep_false": ep_false, "ep_month": ep_month}

    def false_alarm_rate(self, score: np.ndarray, thr: float, all_starts) -> float:
        r = self.run(score, thr, all_starts)
        return float(r["ep_false"].sum() / self.ba_years) if self.ba_years else 0.0

    def summary(self, score: np.ndarray, thr: float, all_starts) -> dict:
        r = self.run(score, thr, all_starts)
        n_all = len(self.all_events)
        # Events in BAs without feature rows cannot be warned; they stay in the count as misses.
        lead_all = np.full(n_all, np.nan)
        pos = self.all_events.reset_index(drop=True)
        key = {eid: i for i, eid in enumerate(pos.event_id)}
        for eid, l in zip(self.events.event_id, r["leads"]):
            lead_all[key[eid]] = l
        ev_season = season_of(pd.DatetimeIndex(pos.start).month.values)
        ep_season = season_of(r["ep_month"]) if len(r["ep_month"]) else np.zeros(0, str)

        peak = pos.peak_customers_out.values.astype(float)
        ch = pos.cust_hours.values.astype(float) if "cust_hours" in pos else np.zeros(n_all)

        def block(ev_mask, ep_mask, ba_years):
            l = lead_all[ev_mask]
            warned = ~np.isnan(l)
            n = int(ev_mask.sum())
            w12m = l >= MIN_LEAD_H
            w12 = int(w12m.sum())
            out = {"testEvents": n, "warnedAny": int(warned.sum()), "warned12h": w12,
                   "warned6h": int((l >= 6).sum()), "warned24h": int((l >= 24).sum()),
                   "recall12h": (w12 / n) if n else None,
                   "recall6h": (int((l >= 6).sum()) / n) if n else None,
                   "recall24h": (int((l >= 24).sum()) / n) if n else None,
                   "peopleRecall12h": float(peak[ev_mask][w12m].sum() / peak[ev_mask].sum()) if peak[ev_mask].sum() else None,
                   "custHoursRecall12h": float(ch[ev_mask][w12m].sum() / ch[ev_mask].sum()) if ch[ev_mask].sum() else None,
                   "medianLeadHours": float(np.median(l[warned])) if warned.any() else None}
            if ep_mask is not None:
                out.update({"episodes": int(ep_mask.sum()),
                            "falseEpisodes": int(r["ep_false"][ep_mask].sum()),
                            "baYears": float(ba_years),
                            "falseAlarmsPerBaYear": float(r["ep_false"][ep_mask].sum() / ba_years) if ba_years else None})
            return out

        out = block(np.ones(n_all, bool), np.ones(len(r["ep_false"]), bool), self.ba_years)
        out["seasons"] = {s: block(ev_season == s, ep_season == s,
                                   (self.season_rows == s).sum() / HOURS_PER_YEAR) for s in SEASONS}
        if "group" in pos:
            out["groups"] = {g: block(pos.group.values == g, None, None) for g in ("demand_record", "other")}
        out["event_leads"] = dict(zip(pos.event_id, [None if np.isnan(x) else float(x) for x in lead_all]))
        return out


def pick_threshold(panel: Panel, score: np.ndarray, all_starts, train_panel, train_score) -> float:
    """Scan descending thresholds under the budget on both historical panels.

    The scan stops at the first threshold above the limit, so every higher threshold also passes.
    """
    s = score[~np.isnan(score)]
    qs = 1.0 - np.logspace(-5, np.log10(0.5), 120)             # top 0.001% down to the median
    cands = np.unique(np.r_[np.quantile(s, qs), np.nanmax(train_score), s.max()])[::-1]
    best = float(np.nextafter(cands[0], np.inf))
    for t in cands:
        if (panel.false_alarm_rate(score, float(t), all_starts) > FA_LIMIT
                or train_panel.false_alarm_rate(train_score, float(t), all_starts) > FA_LIMIT):
            break
        best = float(t)
    return best


def tag_event_groups(df: pd.DataFrame, ev: pd.DataFrame) -> pd.DataFrame:
    """group = "demand_record" when fc12_vs_month_record >= 1.0 at any hour in the 24 h before the
    start (the forecast says demand will reach the BA's record for that month); else "other"."""
    ev = ev.copy()
    hit = np.zeros(len(ev), bool)
    pos = {b: (g.h.values, g.fc12_vs_month_record.values) for b, g in df[["ba", "h", "fc12_vs_month_record"]].groupby("ba")}
    for i, (b, s0) in enumerate(zip(ev.ba.values, ev.start_h.values)):
        if b in pos:
            h, v = pos[b]
            lo, hi = np.searchsorted(h, s0 - 24), np.searchsorted(h, s0)
            hit[i] = bool(np.nanmax(v[lo:hi], initial=-np.inf) >= 1.0) if hi > lo else False
    ev["group"] = np.where(hit, "demand_record", "other")
    return ev
