"""Fetch archived weather forecasts (Open-Meteo Previous Runs API) for every station in
data/out/ba_stations.csv, for 2024. Used by models/real_forecast.py to test warn_fcst on real forecasts.

Source: https://previous-runs-api.open-meteo.com/v1/forecast (docs: open-meteo.com/en/docs/previous-runs-api).
`<var>_previous_dayN` = the value predicted N x 24 h before the valid hour. Default model ("best match").
The archive starts about 2024-01-19 for these variables.

Variables: temperature_2m (C), wind_speed_10m (m/s), precipitation (mm), pressure_msl (hPa), each for
previous_day1, 2 and 3. Station coordinates: NOAA isd-history.csv, joined on usaf + wban.

Limits (free tier: 600 calls/min, 5,000/h, 10,000/day; a request counts as more than one call
when it has more than 10 variables or more than 2 weeks): one request per station for the whole
year counts as about 31 calls. One request every 5 s keeps the rate near 370 calls/min and the
total near 4,000. Every response is cached in BDA_SHARED/forecast_archive/; a rerun makes no calls.
No API key and no personal data are sent.

Run: python3 data/fetch/forecast_archive.py   (standard library only)
"""
from __future__ import annotations

import csv
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

MAIN = Path(os.environ.get("BDA_MAIN", "/Users/neil/Documents/patriothacks-fall26"))
SHARED = Path(os.environ.get("BDA_SHARED", MAIN / "data" / "raw" / "derived"))
CACHE = SHARED / "forecast_archive"
STATIONS = MAIN / "data" / "out" / "ba_stations.csv"
ISD_HISTORY = "https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv"
API = "https://previous-runs-api.open-meteo.com/v1/forecast"
VARS = [f"{v}_previous_day{d}" for v in ("temperature_2m", "wind_speed_10m", "precipitation", "pressure_msl") for d in (1, 2, 3)]
START, END = "2024-01-01", "2024-12-31"
PAUSE_S = 5.0
HEADERS = {"User-Agent": "research-client/1.0"}


def get(url: str) -> bytes:
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=120) as r:
                return r.read()
        except Exception as e:                                       # noqa: BLE001
            print(f"  retry {attempt + 1}: {e}", flush=True)
            time.sleep(30 * (attempt + 1))
    raise RuntimeError(f"failed: {url}")


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    hist = CACHE / "isd-history.csv"
    if not hist.exists():
        hist.write_bytes(get(ISD_HISTORY))
    coords = {}
    with open(hist, newline="") as f:
        for r in csv.DictReader(f):
            if r["LAT"] and r["LON"]:
                coords[(r["USAF"], r["WBAN"])] = (float(r["LAT"]), float(r["LON"]))
    with open(STATIONS, newline="") as f:
        stations = sorted({(r["usaf"].zfill(6), r["wban"].zfill(5)) for r in csv.DictReader(f)})
    index, missing, calls = [], [], 0
    for usaf, wban in stations:
        if (usaf, wban) not in coords:
            missing.append(f"{usaf}-{wban}")
            continue
        lat, lon = coords[(usaf, wban)]
        index.append({"station": f"{usaf}-{wban}", "lat": lat, "lon": lon})
        out = CACHE / f"{usaf}-{wban}.json"
        if out.exists():
            continue
        q = urllib.parse.urlencode({"latitude": lat, "longitude": lon, "hourly": ",".join(VARS), "start_date": START,
                                    "end_date": END, "wind_speed_unit": "ms", "timezone": "GMT"})
        body = get(f"{API}?{q}")
        json.loads(body)                                             # fail early on a bad body
        out.write_bytes(body)
        calls += 1
        print(f"{usaf}-{wban} ({lat:.3f}, {lon:.3f}) ok  [{calls} requests]", flush=True)
        time.sleep(PAUSE_S)
    (CACHE / "stations.json").write_text(json.dumps({"stations": index, "missingCoordinates": missing,
                                                      "variables": VARS, "period": [START, END], "api": API}, indent=1))
    print(f"done: {len(index)} stations cached, {len(missing)} without coordinates {missing}, {calls} new requests")
    if missing:
        sys.exit(0)


if __name__ == "__main__":
    main()
