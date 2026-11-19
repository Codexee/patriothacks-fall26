#!/usr/bin/env python3
"""Fetch the small Flint/Hubei source packs using Python's standard library.

Run from any directory: python3 data/scripts/fetch_health.py
Use --refresh to replace cached raw downloads. No API keys are needed.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET
import zipfile

DATA = Path(__file__).resolve().parents[1]
RAW = DATA / "raw" / "health"
FLINT_URL = "https://flintwaterstudy.org/wp-content/uploads/2015/12/Flint-Samples-FINAL.xlsx"
JHU_URL = (
    "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/"
    "csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv"
)
WHO_URL = "https://www.who.int/emergencies/disease-outbreak-news/item/2020-DON233"
NHC_URL = "https://en.nhc.gov.cn/2020-04/06/c_78840_2.htm"
IMPERIAL_URL = (
    "https://www.imperial.ac.uk/mrc-global-infectious-disease-analysis/"
    "covid-19/report-1-case-estimates-of-covid-19/"
)
IMPERIAL_ABSTRACT_URL = (
    "https://www.imperial.ac.uk/earth-observation-network/publications/"
    "?_type=on&id=1154&imaxyear=&iminyear=&itypes=&keywords=&limit=10&page=208"
    "&resgrpMemberPubs=true&respub-action=search.html"
)
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def download(url: str, filename: str, refresh: bool) -> Path:
    path = RAW / filename
    if path.exists() and not refresh:
        return path
    RAW.mkdir(parents=True, exist_ok=True)
    for attempt in range(5):
        try:
            request = Request(url, headers={"User-Agent": "HollowTwin-research/1.0"})
            with urlopen(request, timeout=90) as response:
                content = response.read()
            path.write_bytes(content)
            return path
        except (HTTPError, URLError, TimeoutError):
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("Download attempts exhausted")


def save(filename: str, data: object) -> None:
    (DATA / filename).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")


def flint(path: Path) -> list[dict]:
    """Read the included-samples worksheet only; retain duplicate source IDs."""
    with zipfile.ZipFile(path) as archive:
        shared = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        strings = ["".join(node.itertext()) for node in shared]
        root = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in root.findall(".//m:row", NS):
            cells = {}
            for cell in row:
                value_node = cell.find("m:v", NS)
                value = value_node.text if value_node is not None else None
                if value is not None and cell.get("t") == "s":
                    value = strings[int(value)]
                column = "".join(c for c in cell.get("r", "") if c.isalpha())
                cells[column] = value
            sample_id = cells.get("A")
            if sample_id is None or not sample_id.isdigit():
                continue
            rows.append({
                "SampleID": int(sample_id),
                "Zip": cells["B"],
                "Ward": int(cells["C"]),
                "Pb1": round(float(cells["D"]), 12),
                "Pb2": round(float(cells["E"]), 12),
                "Pb3": round(float(cells["F"]), 12),
            })
    if len(rows) != 271:
        raise ValueError(f"Expected 271 included Flint samples, got {len(rows)}")
    if max(row["Pb1"] for row in rows) != 158:
        raise ValueError("Flint first-draw maximum differs from workbook summary")
    if max(row[key] for row in rows for key in ("Pb1", "Pb2", "Pb3")) != 1051:
        raise ValueError("Flint all-draw maximum differs from workbook summary")
    return rows


def hubei(path: Path) -> dict:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        matches = [row for row in csv.DictReader(handle)
                   if row["Province/State"] == "Hubei" and row["Country/Region"] == "China"]
    if len(matches) != 1:
        raise ValueError(f"Expected one Hubei source row, got {len(matches)}")
    row = matches[0]
    cases = [{"date": datetime.strptime(date, "%m/%d/%y").date().isoformat(), "confirmed": int(value)}
             for date, value in row.items() if "/" in date and date not in ("Province/State", "Country/Region")]
    if cases[0] != {"date": "2020-01-22", "confirmed": 444}:
        raise ValueError("Unexpected JHU Hubei start date/value")
    return {"province": "Hubei", "country": "China", "latitude": float(row["Lat"]),
            "longitude": float(row["Long"]), "cases": cases}


def early_points() -> dict:
    return {
        "place": "Wuhan, Hubei, China",
        "notes": [
            "Hand-entered cited points; no interpolation or invented daily counts.",
            "The 59 unexplained-pneumonia cases and 41 laboratory-confirmed cases use different definitions. Their difference is not evidence of falling infections or concealment.",
            "The Imperial estimate was published January 17 and refers to symptom onset by January 12; it was not available on January 12.",
            "These Wuhan points and the JHU Hubei province series have different geographic coverage.",
        ],
        "points": [
            {"date": "2020-01-05", "reportedDate": "2020-01-05", "value": 59,
             "kind": "reported_unexplained_pneumonia", "scope": "Wuhan",
             "source": "Wuhan Municipal Health Commission; NHC retrospective timeline",
             "url": NHC_URL, "sourcePublicationDate": "2020-04-06",
             "notes": "NHC timeline attributes 59 cases to the Wuhan MHC January 5 briefing; the original January 5 bulletin is not downloaded here."},
            {"date": "2020-01-12", "reportedDate": "2020-01-12", "reportedDateStart": "2020-01-11", "value": 41,
             "kind": "reported_confirmed", "scope": "Wuhan", "source": "WHO Disease Outbreak News DON233",
             "url": WHO_URL, "sourcePublicationDate": "2020-01-12",
             "notes": "Chinese authorities conveyed 41 preliminarily diagnosed/confirmed cases to WHO January 11–12; symptom onsets December 8–January 2."},
            {"date": "2020-01-12", "reportedDate": "2020-01-17", "value": 1723,
             "kind": "estimated_symptomatic_onsets_by_date", "scope": "Wuhan",
             "confidenceInterval95": {"lower": 427, "upper": 4471},
             "source": "Imai et al., Imperial College London Report 1",
             "url": IMPERIAL_URL, "abstractUrl": IMPERIAL_ABSTRACT_URL,
             "sourcePublicationDate": "2020-01-17",
             "notes": "Model estimate from exported cases; includes uncertainty and assumptions, not an observed case count."},
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    flint_raw = download(FLINT_URL, "Flint-Samples-FINAL.xlsx", args.refresh)
    jhu_raw = download(JHU_URL, "time_series_covid19_confirmed_global.csv", args.refresh)
    flint_rows, hubei_row = flint(flint_raw), hubei(jhu_raw)
    save("flint-samples.json", flint_rows)
    save("hubei-cases.json", hubei_row)
    save("wuhan-early-points.json", early_points())
    retrieved = datetime.now(timezone.utc).date().isoformat()
    sources = [
        {"file": "data/flint-samples.json", "url": FLINT_URL,
         "license": "No explicit reuse license stated in the source workbook or download page; public research data, attribution retained.",
         "retrieved": retrieved, "raw_sha256": hashlib.sha256(flint_raw.read_bytes()).hexdigest(),
         "notes": "Virginia Tech FlintWaterStudy team and Flint residents. 271 included rows from 'Samples from Flint Water homes'; excluded-sample/comparison worksheets and names omitted. Zip is text; duplicate SampleIDs retained. Pb1/2/3 are ppb at first draw/45-second flush/2-minute flush. Values below 1 ppb are below the stated detection limit; do not treat them as precise measurements. Numeric XML cache binary artifacts rounded to 12 decimals. No per-sample dates are supplied; no admission-date comparison is inferred."},
        {"file": "data/hubei-cases.json", "url": JHU_URL, "license": "CC BY 4.0",
         "license_url": "https://github.com/CSSEGISandData/COVID-19#terms-of-use",
         "retrieved": retrieved, "raw_sha256": hashlib.sha256(jhu_raw.read_bytes()).hexdigest(),
         "notes": "COVID-19 Data Repository by the Center for Systems Science and Engineering (CSSE) at Johns Hopkins University (https://github.com/CSSEGISandData/COVID-19). Hubei/China row only, all source dates preserved. Cumulative confirmed cases; source revisions/decreases retained. Cite Dong E, Du H, Gardner L, Lancet Infect Dis 20(5):533–534, doi:10.1016/S1473-3099(20)30120-1. This is the final revised historical series, not vintage data as known each day."},
        {"file": "data/wuhan-early-points.json", "url": [NHC_URL, WHO_URL, IMPERIAL_URL, IMPERIAL_ABSTRACT_URL],
         "license": "Hand-entered factual numbers with citations; source text remains under each publisher's terms. No general dataset reuse license asserted for NHC, WHO or Imperial reports.",
         "retrieved": retrieved,
         "notes": "Three distinct cited points: Wuhan MHC 59 unexplained-pneumonia cases Jan5 (verified via NHC retrospective timeline); WHO41 confirmed reported Jan11–12; Imperial Report1 published Jan17 estimates1723 symptom onsets byJan12 (95%CI427–4471). Case definitions, event dates, publication dates and geography are distinct. Imperial abstract verified on official publication listing; report landing page returned403 during retrieval."},
    ]
    (DATA / "scripts" / "health-sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n")
    print(f"Flint: {len(flint_rows)} rows; Hubei: {len(hubei_row['cases'])} dates; Wuhan: 3 cited points")


if __name__ == "__main__":
    main()
