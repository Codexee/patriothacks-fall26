"""EIA-930 hourly balance files, all balancing areas, Jul 2015 -> now.

Source: https://www.eia.gov/electricity/gridmonitor/ (six-month CSV files, no key).
Run: uv run python fetch/eia930.py
"""
from __future__ import annotations

import datetime as dt

from common import RAW, download, record_source

BASE = "https://www.eia.gov/electricity/gridmonitor/sixMonthFiles"


def periods():
    today = dt.date.today()
    for year in range(2015, today.year + 1):
        for half in ("Jan_Jun", "Jul_Dec"):
            if year == 2015 and half == "Jan_Jun":
                continue  # EIA-930 starts Jul 2015
            if year == today.year and half == "Jul_Dec" and today.month < 7:
                continue
            yield year, half


def main() -> None:
    for year, half in periods():
        name = f"EIA930_BALANCE_{year}_{half}.csv"
        download(f"{BASE}/{name}", RAW / "eia930" / name)
    record_source("eia930", {
        "url": BASE,
        "what": "EIA-930 hourly balance (demand, day-ahead forecast, net generation, interchange, generation by fuel) by balancing area",
        "license": "US government, public domain",
    })


if __name__ == "__main__":
    main()
