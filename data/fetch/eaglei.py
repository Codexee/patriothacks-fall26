"""EAGLE-I county power outages every 15 minutes, 2014-2025 (ORNL), from figshare.

Source: figshare article 24237376, CC BY 4.0. About 13 GB in all.
Run: uv run python fetch/eaglei.py [first_year] [last_year]   (default 2015 2024)
"""
from __future__ import annotations

import sys

import requests

from common import RAW, UA, download, record_source

ARTICLE = "https://api.figshare.com/v2/articles/24237376"


def main() -> None:
    first, last = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) == 3 else (2015, 2024)
    files = requests.get(ARTICLE + "/files", headers=UA, timeout=60, params={"page_size": 100}).json()  # default page is 10
    wanted = {f"eaglei_outages_{y}.csv" for y in range(first, last + 1)}
    wanted |= {"MCC.csv", "DQI.csv", "coverage_history.csv"}
    for f in sorted(files, key=lambda f: f["size"]):  # small files first
        if f["name"] in wanted:
            download(f["download_url"], RAW / "eaglei" / f["name"], expected_size=f["size"])
    record_source("eaglei", {
        "url": "https://doi.org/10.6084/m9.figshare.24237376",
        "what": "EAGLE-I customers out by county every 15 min (Brelsford et al., ORNL)",
        "license": "CC BY 4.0",
        "years": [first, last],
    })


if __name__ == "__main__":
    main()
