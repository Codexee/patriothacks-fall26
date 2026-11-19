"""Hourly weather per balancing area from NOAA ISD-Lite (AWS open data, no key, no rate limit).

For each BA: its 3 largest counties (population x the county's share of the BA). For each county,
the nearest ISD station with data for the whole period. Then the ISD-Lite file per station and year.
Replaces Open-Meteo from the spec: its free tier counts a 10-year hourly request as hundreds of calls.

Outputs: out/ba_stations.csv (BA, county, station, distance), raw/isd/<station>-<year>.gz
Run: uv run python fetch/weather.py
"""
from __future__ import annotations

import io
import math
import zipfile
from concurrent.futures import ThreadPoolExecutor

import duckdb
import pandas as pd
import requests

from common import RAW, ROOT, UA, download, record_source

OUT = ROOT / "out"
YEARS = range(2015, 2026)
GAZ = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip"
HIST = "https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv"
LITE = "https://noaa-isd-pds.s3.amazonaws.com/isd-lite/data/{y}/{usaf}-{wban}-{y}.gz"


def haversine_km(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2)
    return 12742 * math.asin(math.sqrt(a))


def main() -> None:
    z = requests.get(GAZ, headers=UA, timeout=60).content
    with zipfile.ZipFile(io.BytesIO(z)) as zf:
        gaz = pd.read_csv(zf.open(zf.namelist()[0]), sep="\t", dtype={"GEOID": str})
    gaz.columns = [c.strip() for c in gaz.columns]
    gaz = gaz.rename(columns={"GEOID": "fips", "INTPTLAT": "lat", "INTPTLONG": "lon"})[["fips", "NAME", "lat", "lon"]]

    pop = pd.read_csv(RAW / "census" / "co-est2024-alldata.csv", encoding="latin-1",
                      usecols=["SUMLEV", "STATE", "COUNTY", "POPESTIMATE2024"])
    pop = pop[pop.SUMLEV == 50]
    pop["fips"] = pop.STATE.astype(str).str.zfill(2) + pop.COUNTY.astype(str).str.zfill(3)

    cba = duckdb.sql(f"SELECT fips, ba, share FROM '{OUT}/county_ba.parquet'").df()
    c = cba.merge(pop[["fips", "POPESTIMATE2024"]], on="fips").merge(gaz, on="fips")
    c["w"] = c.POPESTIMATE2024 * c.share
    top = c.sort_values("w", ascending=False).groupby("ba").head(3)

    hist = pd.read_csv(io.StringIO(requests.get(HIST, headers=UA, timeout=60).text), dtype=str)
    hist = hist[(hist.CTRY == "US") & (hist.BEGIN <= "20150101") & (hist.END >= "20250101")
                & (hist.USAF != "999999") & hist.LAT.notna()].copy()
    hist["lat"], hist["lon"] = hist.LAT.astype(float), hist.LON.astype(float)

    rows = []
    for _, r in top.iterrows():
        d = hist.apply(lambda s: haversine_km(r.lat, r.lon, s.lat, s.lon), axis=1)
        s = hist.loc[d.idxmin()]
        rows.append({"ba": r.ba, "fips": r.fips, "county": r.NAME, "weight": r.w,
                     "usaf": s.USAF, "wban": s.WBAN, "station": s["STATION NAME"], "km": round(d.min(), 1)})
    st = pd.DataFrame(rows)
    st.to_csv(OUT / "ba_stations.csv", index=False)
    print(f"{st.ba.nunique()} BAs, {len(st)} county points, {st[['usaf','wban']].drop_duplicates().shape[0]} stations; "
          f"median distance {st.km.median()} km, max {st.km.max()} km", flush=True)

    jobs = [(y, u, w) for u, w in st[["usaf", "wban"]].drop_duplicates().itertuples(index=False) for y in YEARS]
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(lambda j: download(LITE.format(y=j[0], usaf=j[1], wban=j[2]),
                                       RAW / "isd" / f"{j[1]}-{j[2]}-{j[0]}.gz"), jobs))
    record_source("isd_lite", {"url": "https://registry.opendata.aws/noaa-isd/",
                               "what": "NOAA ISD-Lite hourly: temperature, dew point, pressure, wind, precipitation",
                               "license": "US government, public domain", "years": [YEARS[0], YEARS[-1]]})


if __name__ == "__main__":
    main()
