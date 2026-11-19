"""Shared paths, the train/test split constant, the feature lists and the event-level scoring.

The split is ONE constant: SPLIT. Hours and events before it are training data; the rest is test.
Override for a temporary run with the environment variable BDA_SPLIT (for example 2019-01-01).
"""
from __future__ import annotations

import os
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

SPLIT = os.environ.get("BDA_SPLIT", "2021-01-01")

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
WX = ["temp_c", "dew_c", "slp_min_hpa", "wind_max_ms", "precip_max_mm", "temp_anom_30d",
      "temp_min_24h", "temp_max_24h", "wind_max_24h", "precip_24h", "slp_chg_12h"]
FX = ["fx_wind_max_24h", "fx_temp_min_24h", "fx_temp_max_24h", "fx_precip_24h"]
VARIANTS = {"warn_grid": GRID, "warn_full": GRID + WX, "warn_full_fx": GRID + WX + FX}

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


def load_events() -> pd.DataFrame:
    ev = duckdb.sql(f"SELECT * FROM '{DATA_OUT}/events.parquet' ORDER BY ba, start").df()
    ev["start_h"] = to_h(ev.start)
    ev["stop_h"] = to_h(ev.stop)
    return ev


def data_end_h() -> int:
    """Last hour with outage data. Hours after it have no labels."""
    return int(to_h([duckdb.sql(f"SELECT max(hour) FROM '{SHARED}/ba_hour_out.parquet'").fetchall()[0][0]])[0])


def load_features() -> pd.DataFrame:
    """Every row of the BA-hour feature table, sorted by ba, hour, with labels and masks.

    Recompute y48 and in_event from events.parquet to detect mismatched input versions.
    Scored hours have a complete label horizon in an observed BA window.
    """
    cols = ", ".join(f'"{c}"' for c in GRID + WX + FX)
    df = duckdb.sql(f"""
        SELECT ba, hour, {cols}, y48 AS y48_table, in_event AS in_event_table
        FROM '{SHARED}/ba_hour_features.parquet' ORDER BY ba, hour""").df()
    df["h"] = to_h(df.hour)
    ev = load_events()
    coverage = duckdb.sql(f"""
        SELECT ba, year(hour) AS year, min(hour) AS first_hour, max(hour) AS last_hour
        FROM '{SHARED}/ba_hour_out.parquet' GROUP BY ba, year(hour)""").df()
    mapped = set(coverage.ba)
    # EAGLE-I lists positive outages only. Avoid treating absent BA-years and gaps
    # between annual observation windows as confirmed negatives.
    covered = np.zeros(len(df), bool)
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
        k = j - 1                                                   # last start <= h
        stop_max = np.maximum.accumulate(e.stop_h.values)
        ine[a:b] = (k >= 0) & (h <= stop_max[np.maximum(k, 0)] + HORIZON_H)
    df["y48"] = y
    df["in_event"] = ine
    df["mapped"] = df.ba.isin(mapped).values
    if (y != df.y48_table.values).any() or (ine != df.in_event_table.values).any():
        raise ValueError("BA-hour labels and the event library disagree. Rebuild the feature table.")
    df["scored"] = covered & ~ine
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

        def block(ev_mask, ep_mask, ba_years):
            l = lead_all[ev_mask]
            warned = ~np.isnan(l)
            w12 = int((l >= MIN_LEAD_H).sum())
            return {"testEvents": int(ev_mask.sum()), "warnedAny": int(warned.sum()), "warned12h": w12,
                    "recall12h": (w12 / int(ev_mask.sum())) if ev_mask.sum() else None,
                    "medianLeadHours": float(np.median(l[warned])) if warned.any() else None,
                    "episodes": int(ep_mask.sum()),
                    "falseEpisodes": int(r["ep_false"][ep_mask].sum()),
                    "baYears": float(ba_years),
                    "falseAlarmsPerBaYear": float(r["ep_false"][ep_mask].sum() / ba_years) if ba_years else None}

        out = block(np.ones(n_all, bool), np.ones(len(r["ep_false"]), bool), self.ba_years)
        out["seasons"] = {s: block(ev_season == s, ep_season == s,
                                   (self.season_rows == s).sum() / HOURS_PER_YEAR) for s in SEASONS}
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
