"""Small reference datasets: EIA-861, CDC SVI, HHS emPOWER, Census population, county shapes.

Run: uv run python fetch/small.py
"""
from __future__ import annotations

import json
import zipfile

import requests

from common import RAW, UA, download, record_source

EMPOWER = ("https://services2.arcgis.com/ZQ4jTQn6k7VPXEwO/arcgis/rest/services/"
           "HHS_emPOWER_REST_Service_Public/FeatureServer/2/query")


def empower() -> None:
    """County-level counts, paged (max 2000 rows per request)."""
    rows, offset = [], 0
    while True:
        r = requests.get(EMPOWER, headers=UA, timeout=60, params={
            "where": "1=1", "outFields": "*", "returnGeometry": "false",
            "resultOffset": offset, "resultRecordCount": 2000, "f": "json"})
        feats = r.json().get("features", [])
        rows += [f["attributes"] for f in feats]
        if len(feats) < 2000:
            break
        offset += 2000
    out = RAW / "empower" / "empower_county.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rows))
    print(f"done  empower_county.json  {len(rows)} counties", flush=True)
    record_source("empower", {
        "url": EMPOWER.rsplit("/query", 1)[0],
        "what": "HHS emPOWER: Medicare beneficiaries with electricity-dependent equipment, by county (de-identified, updated monthly)",
        "license": "US government, public",
    })


def main() -> None:
    z = download("https://www.eia.gov/electricity/data/eia861/zip/f8612024.zip", RAW / "eia861" / "f8612024.zip")
    with zipfile.ZipFile(z) as zf:
        zf.extractall(RAW / "eia861")
    record_source("eia861", {"url": "https://www.eia.gov/electricity/data/eia861/",
                             "what": "EIA-861 2024: service territory by county, utility balancing authority",
                             "license": "US government, public domain"})

    download("https://svi.cdc.gov/Documents/Data/2022/csv/states_counties/SVI_2022_US_county.csv",
             RAW / "svi" / "SVI_2022_US_county.csv")
    record_source("svi", {"url": "https://www.atsdr.cdc.gov/place-health/php/svi/",
                          "what": "CDC/ATSDR Social Vulnerability Index 2022, county", "license": "US government, public"})

    download("https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv",
             RAW / "census" / "co-est2024-alldata.csv")
    record_source("census", {"url": "https://www.census.gov/programs-surveys/popest.html",
                             "what": "Census county population estimates 2020-2024", "license": "US government, public domain"})

    download("https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json", RAW / "shapes" / "counties-10m.json")
    record_source("shapes", {"url": "https://github.com/topojson/us-atlas",
                             "what": "us-atlas 3.0.1 county TopoJSON (from Census cartographic boundaries)", "license": "ISC; data public domain"})

    empower()


if __name__ == "__main__":
    main()
