"""Plant downtime after a trip, from real US power-outage restoration times (EAGLE-I, 2015-2024).

Spec: .plans/hollow-real-data-spec.md, workstream 2. Contract: src/data/real/index.ts (OutageData).

Inputs (derived files from the patriothacks-fall26 data pipeline, data/build/labels.py):
  events.parquet       one row per outage event: a balancing authority (BA) with >= 1% of its
                       customers out for >= 4 h in a row (events closer than 12 h merge).
  ba_hour_out.parquet  customers out per BA per hour (hours with no outage are absent = 0).

What a real event maps to in the Hollow
  A plant trip is a sudden loss of supply. Its downtime is the time until most supply is back.
  So we use real events that look like a sudden loss:
    - large:   peak share of the BA's customers out >= LARGE (5%). That is 5 times the event rule
               and removes most small, local events. (A Hollow plant is 1/6 of capacity, about 17%,
               but only 123 real events reach 10%, and few of them start suddenly.)
    - sudden:  the peak comes <= SUDDEN_H (3) hours after the event starts. Slow-onset events
               (hurricanes that cut power over a day or more) do not look like a trip.
  Restoration time = whole hours from the peak hour to the first hour from which customers out
  stay at or below base + 10% x (peak - base) for 3 hours in a row (90% of the peak's extra
  customers restored). base = median customers out in the 7 days before the event start.
  The 3-hour rule stops a short reporting gap (out reads 0 for an hour) from ending an event early.

Output: src/data/real/outages.ts, with repairHours = N_SAMPLE evenly spaced quantiles (midpoints).

Run: uv run --project <patriothacks-fall26>/data python scripts/build_outages.py \
       <events.parquet> <ba_hour_out.parquet> [out.ts]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

LARGE = 0.05      # peak share of the BA's customers out
SUDDEN_H = 3      # max hours from event start to peak
RESTORED = 0.9    # share of the peak's extra customers back
HOLD_H = 3        # hours the level must hold
BASE_DAYS = 7
MAX_H = 30 * 24   # search window after the peak
N_SAMPLE = 50

HERE = Path(__file__).resolve().parents[1]
DEFAULT_OUT = HERE / "src" / "data" / "real" / "outages.ts"


def hourly(s: pd.Series, a: pd.Timestamp, b: pd.Timestamp) -> np.ndarray:
    """Customers out for every hour in [a, b]; a missing hour means no customers out."""
    return s[a:b].reindex(pd.date_range(a, b, freq="h")).fillna(0.0).to_numpy()


def restoration(s: pd.Series, start: pd.Timestamp, stop: pd.Timestamp) -> tuple[float, float, int | None]:
    w = s[start:stop]
    pk, peak = w.idxmax(), float(w.max())
    onset = (pk - start) / pd.Timedelta(hours=1)
    base = float(np.median(hourly(s, start - pd.Timedelta(days=BASE_DAYS), start - pd.Timedelta(hours=1))))
    level = base + (1 - RESTORED) * (peak - base)
    below = hourly(s, pk, pk + pd.Timedelta(hours=MAX_H)) <= level
    held = np.convolve(below, np.ones(HOLD_H, dtype=int), "valid") >= HOLD_H
    return onset, peak, int(np.argmax(held)) if held.any() else None


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    events = pd.read_parquet(sys.argv[1])
    out_ts = Path(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_OUT
    bah = pd.read_parquet(sys.argv[2], columns=["ba", "hour", "out"])
    series = {ba: g.set_index("hour")["out"].sort_index() for ba, g in bah.groupby("ba")}

    rows = []
    for ev in events.itertuples():
        onset, peak, hours = restoration(series[ev.ba], ev.start, ev.stop)
        rows.append({"id": ev.event_id, "frac": ev.peak_frac, "onset": onset, "peak": peak, "hours": hours})
    r = pd.DataFrame(rows)
    sel = r[(r.frac >= LARGE) & (r.onset <= SUDDEN_H)]
    unresolved = int(sel.hours.isna().sum())
    h = sel.hours.dropna().to_numpy(dtype=float)
    years = sorted({int(i.split("-")[-1][:4]) for i in sel.id})

    q = (np.arange(N_SAMPLE) + 0.5) / N_SAMPLE
    sample = [max(1, int(round(v))) for v in np.quantile(h, q)]
    med, p90, p99, mx = (float(np.quantile(h, p)) for p in (0.5, 0.9, 0.99, 1.0))

    print(f"all events: {len(r)}; large (>= {LARGE:.0%}): {int((r.frac >= LARGE).sum())}; "
          f"large and sudden (peak <= {SUDDEN_H} h after start): {len(sel)}; not restored in {MAX_H} h: {unresolved}")
    print(f"restoration hours: median {med:.0f}, p90 {p90:.0f}, p99 {p99:.0f}, max {mx:.0f}")
    print("sample:", sample)
    print("longest:", sel.sort_values("hours").tail(5)[["id", "frac", "hours"]].to_string(index=False))

    detail = (
        f"EAGLE-I county outages, {years[0]}-{years[-1]}, summed to balancing authorities. "
        f"A plant trip is a sudden loss of supply, so we use the {len(h)} large, sudden outage events: "
        f"peak >= {LARGE:.0%} of the area's customers out, reached <= {SUDDEN_H} h after the event starts. "
        f"Downtime = hours from the peak until 90% of the peak's customers are restored (held {HOLD_H} h). "
        f"Median {med:.0f} h, p90 {p90:.0f} h, longest {mx:.0f} h (not capped). "
        f"The {N_SAMPLE} values are evenly spaced quantiles. "
        "Most events are storm damage to wires, not plant failures, so this is a stand-in for plant repair time. "
        "The hourly trip chance stays a guess: EAGLE-I counts customers out, not plant trips or plant load."
    )
    source = {
        "label": f"Real US outage restoration times (EAGLE-I, median {med:.0f} h)",
        "detail": detail,
        "url": "https://doi.org/10.6084/m9.figshare.24237376",
    }
    out_ts.write_text(
        "// Generated by scripts/build_outages.py. Do not edit by hand.\n"
        "import type { OutageData } from './index.ts';\n\n"
        "export const outages: OutageData | null = {\n"
        f"  repairHours: {json.dumps(sample)},\n"
        "  stressTrip: null,\n"
        f"  source: {json.dumps(source, indent=4)[:-1]}  }},\n"
        "};\n"
    )
    print(f"wrote {out_ts}")


if __name__ == "__main__":
    main()
