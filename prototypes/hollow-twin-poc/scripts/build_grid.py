"""Build src/data/real/grid.ts from EIA-930 BALANCE files (workstream 1, spec: .plans/hollow-real-data-spec.md).

Usage (from prototypes/hollow-twin-poc):
    uv run --project <repo>/data python scripts/build_grid.py <folder with EIA930_BALANCE_*.csv>

It reads the ERCOT ("ERCO") rows of:
    EIA930_BALANCE_2023_Jan_Jun.csv, EIA930_BALANCE_2023_Jul_Dec.csv  -> demandWeek
    EIA930_BALANCE_2021_Jan_Jun.csv                                  -> cascadeLoss

Time: each row is one hour. We take "UTC Time at End of Hour", subtract 1 hour (hour start) and convert it to
US Central time (America/Chicago, with daylight saving time). This gives a clean local clock. On the spring DST day
the local 02:00 hour does not exist: we fill it by linear interpolation. On the fall DST day the local 01:00 hour
occurs twice: we take the mean.

demandWeek: 168 hourly multipliers, Monday 00:00 first, mean 1. Weeks are Monday to Sunday in 2023
(2023-01-02 .. 2023-12-31, 52 weeks). A week is "calm" when all of these are true:
  1. no hour is missing or zero, and no EIA imputed value is used;
  2. its mean demand is within 5% of the median weekly mean of the 2 weeks before and the 2 weeks after
     (no heat wave or cold snap relative to the season);
  3. its peak demand is within 8% of the same 5-week median of weekly peaks;
  4. in every hour, |net generation - demand| is at most 5% of demand (ERCOT is almost an island; a larger gap
     means a generation event or bad data);
  5. no hour-to-hour change of demand or net generation is larger than 12%;
  6. it contains no US federal holiday that changes the weekday pattern (New Year, Memorial Day, July 4,
     Labor Day, Thanksgiving, Christmas).
Each calm week is divided by its own mean (so summer weeks do not outweigh winter weeks), the weeks are averaged
hour by hour, and the result is divided by its mean again.

cascadeLoss: the hourly shape of ERCOT net generation lost during the rotating outages of Feb 2021.
  - Search window: Feb 10-24, 2021 (local).
  - Reference ("normal level before the event"): the mean net generation in the 24 hours before the collapse,
    Feb 14 00:00 - 23:00 local. Rotating outages started just after midnight on Feb 15.
  - Loss window: Feb 15 00:00 to Feb 19 00:00 local (96 h), the period FERC/NERC call the most severe
    (Feb 15-18) and in which ERCOT shed firm load. After Feb 18, net generation stays low because warm weather
    lowered demand, not because plants were lost, so it is not counted.
  - loss[t] = max(0, reference - netgen[t]) / max(loss). Peak = 1. No demand surge is applied anywhere.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

BA = "ERCO"
COLS = [
    "Balancing Authority", "UTC Time at End of Hour", "Demand (MW)", "Net Generation (MW)",
    "Demand (MW) (Imputed)", "Net Generation (MW) (Imputed)",
]
HOLIDAYS_2023 = ["2023-01-02", "2023-05-29", "2023-07-04", "2023-09-04", "2023-11-23", "2023-12-25"]
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "real" / "grid.ts"
URL = "https://www.eia.gov/electricity/gridmonitor/"


def load(folder: Path, names: list[str]) -> pd.DataFrame:
    parts = []
    for n in names:
        df = pd.read_csv(folder / n, usecols=COLS, thousands=",", low_memory=False)
        parts.append(df[df["Balancing Authority"] == BA])
    e = pd.concat(parts)
    utc_start = pd.to_datetime(e["UTC Time at End of Hour"], format="%m/%d/%Y %I:%M:%S %p") - pd.Timedelta(hours=1)
    e = e.assign(utc=utc_start.dt.tz_localize("UTC")).sort_values("utc").drop_duplicates("utc")
    e["imputed"] = e["Demand (MW) (Imputed)"].notna() | e["Net Generation (MW) (Imputed)"].notna()
    e = e.rename(columns={"Demand (MW)": "demand", "Net Generation (MW)": "netgen"})
    return e[["utc", "demand", "netgen", "imputed"]]


def local_clock(e: pd.DataFrame) -> pd.DataFrame:
    """Hourly series on a naive local wall clock (America/Chicago). Fills the spring gap, averages the fall repeat."""
    loc = e["utc"].dt.tz_convert("America/Chicago").dt.tz_localize(None)
    g = e.assign(loc=loc).groupby("loc").agg(demand=("demand", "mean"), netgen=("netgen", "mean"), imputed=("imputed", "max"))
    full = pd.date_range(g.index.min(), g.index.max(), freq="h")
    g = g.reindex(full)
    g["filled"] = g["demand"].isna()
    g[["demand", "netgen"]] = g[["demand", "netgen"]].interpolate(limit=1)
    g["imputed"] = g["imputed"].fillna(False).astype(bool)
    return g


def demand_week(folder: Path):
    g = local_clock(load(folder, ["EIA930_BALANCE_2023_Jan_Jun.csv", "EIA930_BALANCE_2023_Jul_Dec.csv"]))
    g = g.loc["2023-01-02 00:00":"2023-12-31 23:00"]
    holidays = {pd.Timestamp(h) for h in HOLIDAYS_2023}
    weeks = []
    for start in pd.date_range("2023-01-02", "2023-12-25", freq="7D"):
        w = g.loc[start:start + pd.Timedelta(hours=167)]
        weeks.append({"start": start, "w": w, "mean": w["demand"].mean(), "peak": w["demand"].max()})
    means = pd.Series([x["mean"] for x in weeks])
    peaks = pd.Series([x["peak"] for x in weeks])
    med_mean = means.rolling(5, center=True, min_periods=3).median()
    med_peak = peaks.rolling(5, center=True, min_periods=3).median()
    calm, dropped = [], []
    for i, x in enumerate(weeks):
        w, why = x["w"], []
        if len(w) != 168 or w["demand"].isna().any() or (w["demand"] <= 0).any() or w["imputed"].any():
            why.append("missing or imputed data")
        if abs(x["mean"] / med_mean[i] - 1) > 0.05:
            why.append(f"mean demand {x['mean'] / med_mean[i] - 1:+.1%} vs season")
        if x["peak"] / med_peak[i] - 1 > 0.08:
            why.append(f"peak demand {x['peak'] / med_peak[i] - 1:+.1%} vs season")
        gap = ((w["netgen"] - w["demand"]).abs() / w["demand"]).max()
        if gap > 0.05:
            why.append(f"generation-demand gap {gap:.1%}")
        jump = max(w["demand"].pct_change().abs().max(), w["netgen"].pct_change().abs().max())
        if jump > 0.12:
            why.append(f"hourly jump {jump:.1%}")
        if any(x["start"] <= h < x["start"] + pd.Timedelta(days=7) for h in holidays):
            why.append("federal holiday")
        (dropped if why else calm).append((x["start"].date().isoformat(), why))
    calm_starts = {s for s, _ in calm}
    stack = [x["w"]["demand"].to_numpy() / x["mean"] for x in weeks if x["start"].date().isoformat() in calm_starts]
    avg = sum(stack) / len(stack)
    avg = avg / avg.mean()
    filled = int(g["filled"].sum())
    return [round(float(v), 4) for v in avg], [s for s, _ in calm], dropped, filled


def cascade_loss(folder: Path):
    g = local_clock(load(folder, ["EIA930_BALANCE_2021_Jan_Jun.csv"]))
    window = g.loc["2021-02-10 00:00":"2021-02-24 23:00"]
    ref = float(window.loc["2021-02-14 00:00":"2021-02-14 23:00", "netgen"].mean())
    event = window.loc["2021-02-15 00:00":"2021-02-18 23:00", "netgen"]
    lost = (ref - event).clip(lower=0)
    peak_mw = float(lost.max())
    shape = [round(float(v), 4) for v in lost / peak_mw]
    stats = {
        "refMW": round(ref), "peakLossMW": round(peak_mw), "peakAt": str(lost.idxmax()),
        "minNetgenMW": round(float(event.min())), "hours": len(shape),
        "hoursAboveHalf": int((lost / peak_mw >= 0.5).sum()),
        "meanLossMW": round(float(lost.mean())),
    }
    return shape, stats


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: build_grid.py <folder with EIA930_BALANCE_*.csv>")
    folder = Path(sys.argv[1])
    week, calm, dropped, filled = demand_week(folder)
    loss, st = cascade_loss(folder)

    print(f"Calm weeks (Monday start), {len(calm)} of 52: {', '.join(calm)}")
    for s, why in dropped:
        print(f"  dropped {s}: {'; '.join(why)}")
    print(f"Local DST gaps filled: {filled}")
    print(f"demandWeek: min {min(week):.3f}, max {max(week):.3f}")
    print(f"cascade: {json.dumps(st)}")

    source = {
        "label": "EIA-930 hourly grid data, ERCOT (2023 calm weeks; Feb 2021 generation loss)",
        "detail": (
            f"Demand: ERCOT hourly demand, 2023, US Central time. {len(calm)} of 52 Monday-to-Sunday weeks are calm "
            "(no data gaps, mean within 5% and peak within 8% of the season, generation within 5% of demand, no hourly "
            "jump over 12%, no federal holiday). Each week is divided by its mean, then averaged: 168 multipliers, mean 1. "
            f"Plant loss: ERCOT net generation, Feb 15-18, 2021, below its mean of Feb 14 ({st['refMW'] / 1000:.1f} GW). "
            f"The loss peaks at {st['peakLossMW'] / 1000:.1f} GW ({st['peakAt'][:16]}) and is scaled so the peak = one whole plant. "
            "No demand surge is applied."
        ),
        "url": URL,
    }
    body = (
        "// Generated by scripts/build_grid.py from EIA-930 BALANCE files. Do not edit by hand.\n"
        f"// Calm 2023 weeks (Monday start): {', '.join(calm)}\n"
        f"// Cascade: {json.dumps(st)}\n"
        "import type { GridData } from './index.ts';\n\n"
        "export const grid: GridData | null = {\n"
        f"  demandWeek: {json.dumps(week)},\n"
        f"  cascadeLoss: {json.dumps(loss)},\n"
        f"  source: {json.dumps(source, ensure_ascii=False)},\n"
        "};\n"
    )
    OUT.write_text(body)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
