#!/usr/bin/env python3
"""Fetch and reduce Texas county outages and Census cartographic boundaries.

Run from any directory: python3 data/scripts/fetch_texas_geodata.py
Uses Python's standard library and curl; all full downloads stay in data/raw/.
The Census source is already generalized to 1:20m. Coordinates are rounded to
four decimals (about 11 m), preserving shared vertices and every county polygon.
"""
from __future__ import annotations

import csv
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
UUID = "fd2fd715-41eb-476a-a9b7-f50d886afb75"
METADATA_URL = f"https://data.4tu.nl/v2/articles/{UUID}"
ARCHIVE_URL = f"https://data.4tu.nl/ndownloader/items/{UUID}/versions/1"
CENSUS_URL = "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_county_20m.zip"
CSV_NAME = "tx_county_3h_with_ssi_labels.csv"


def download(url: str, path: Path, timeout: int = 90) -> Path:
    if path.exists():
        return path
    part = path.with_suffix(path.suffix + ".part")
    subprocess.run(
        ["curl", "--fail", "--location", "--silent", "--show-error",
         "--connect-timeout", "20", "--max-time", str(timeout),
         "--retry", "2", "--output", str(part), url],
        check=True,
    )
    part.replace(path)
    return path


def write_json(path: Path, value: object, limit: int | None = None) -> None:
    content = json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n"
    if limit is not None and len(content.encode()) >= limit:
        raise ValueError(f"{path.name} exceeds {limit:,} bytes")
    path.write_text(content, encoding="utf-8")
    print(f"{path.relative_to(ROOT)}: {len(content.encode()):,} bytes")


def reduce_outages() -> tuple[dict, dict]:
    metadata = json.loads(download(METADATA_URL, RAW / "texas-outages-metadata.json").read_text())
    if metadata["version"] != 1:
        raise ValueError("Source version changed; review the reducer before updating")
    csv_file = next(f for f in metadata["files"] if f["name"] == CSV_NAME)
    csv_path = RAW / CSV_NAME
    if not csv_path.exists():
        archive_path = RAW / "texas-outages-v1.zip"
        try:
            download(ARCHIVE_URL, archive_path, timeout=20)
            with zipfile.ZipFile(archive_path) as archive:
                member = next(n for n in archive.namelist() if Path(n).name == CSV_NAME)
                csv_path.write_bytes(archive.read(member))
        except (subprocess.CalledProcessError, zipfile.BadZipFile, StopIteration):
            # Same versioned repository member, with its repository checksum.
            download(csv_file["download_url"], csv_path)
    if hashlib.md5(csv_path.read_bytes()).hexdigest() != csv_file["computed_md5"]:
        raise ValueError("4TU CSV does not match the repository's MD5 checksum")
    download(next(f["download_url"] for f in metadata["files"] if f["name"] == "DATASETS.md"), RAW / "texas-outages-DATASETS.md")
    with csv_path.open(newline="", encoding="utf-8-sig") as stream:
        records = [
            {"county": row["county"].strip(), "time": row["time"],
             "outage_count": int(row["outage_count"]), "temp": float(row["temp"])}
            for row in csv.DictReader(stream)
        ]
    keys = {(r["county"], r["time"]) for r in records}
    if len(keys) != len(records) or len({r["county"] for r in records}) != 254:
        raise ValueError("Expected unique county/time rows for all 254 Texas counties")
    if any(r["outage_count"] < 0 or not math.isfinite(r["temp"]) for r in records):
        raise ValueError("Invalid outage count or temperature")
    records.sort(key=lambda r: (r["time"], r["county"]))
    write_json(ROOT / "texas-county-outages.json", records, 3_000_000)
    source = {
        "url": ARCHIVE_URL,
        "doi": "10.4121/fd2fd715-41eb-476a-a9b7-f50d886afb75.v1",
        "metadata_url": METADATA_URL,
        "member_url": csv_file["download_url"],
        "license": metadata["license"]["name"],
        "license_url": metadata["license"]["url"],
        "retrieved": datetime.now(timezone.utc).date().isoformat(),
        "notes": "Jikun Liu, 4TU.ResearchData, version 1. All 28,448 county/time records retained (254 counties, 112 three-hour timestamps, Feb 11-24 2021). Only county, time, outage_count and temp retained; numeric values preserved. Source DATASETS.md states timestamps are naive, with no timezone specified; do not label them UTC or align to EIA without verification. It calls outage_count outages/events, without confirming customers. Temperature is described only as degrees; Celsius/Fahrenheit is not specified. No unit conversion or imputation.",
        "raw_sha256": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
    }
    return source, {"counties": 254, "records": len(records), "first": records[0]["time"], "last": records[-1]["time"]}


def dbf_records(data: bytes) -> list[dict[str, str]]:
    count, header_size, record_size = struct.unpack_from("<IHH", data, 4)
    fields = []
    for offset in range(32, header_size - 1, 32):
        name = data[offset:offset + 11].split(b"\0")[0].decode("ascii")
        fields.append((name, data[offset + 16]))
    records = []
    for i in range(count):
        offset = header_size + i * record_size
        if data[offset:offset + 1] != b" ":
            raise ValueError("Unexpected deleted DBF record")
        offset += 1
        record = {}
        for name, size in fields:
            record[name] = data[offset:offset + size].decode("utf-8").strip()
            offset += size
        records.append(record)
    return records


def reduce_boundaries() -> dict:
    archive_path = download(CENSUS_URL, RAW / "cb_2020_us_county_20m.zip")
    with zipfile.ZipFile(archive_path) as archive:
        attributes = dbf_records(archive.read("cb_2020_us_county_20m.dbf"))
        shapes = archive.read("cb_2020_us_county_20m.shp")
    offset, index, features = 100, 0, []
    while offset < len(shapes):
        _, words = struct.unpack_from(">ii", shapes, offset)
        record = shapes[offset + 8:offset + 8 + words * 2]
        offset += 8 + words * 2
        attr = attributes[index]
        index += 1
        if attr["STATEFP"] != "48":
            continue
        shape_type = struct.unpack_from("<i", record)[0]
        part_count, point_count = struct.unpack_from("<ii", record, 36)
        # Verified property of the cb_2020 20m Texas subset. Fail on changed
        # geometry rather than silently dropping multipart polygons or holes.
        if shape_type != 5 or part_count != 1:
            raise ValueError("Expected single-ring Polygon for cb_2020 Texas county")
        ring = [[round(x, 4), round(y, 4)] for x, y in
                struct.iter_unpack("<dd", record[44 + part_count * 4:44 + part_count * 4 + point_count * 16])]
        # Shapefile exterior rings are clockwise; RFC 7946 uses counterclockwise.
        ring.reverse()
        features.append({"type": "Feature", "id": attr["GEOID"],
                         "properties": {"GEOID": attr["GEOID"], "NAME": attr["NAME"], "STATEFP": "48"},
                         "geometry": {"type": "Polygon", "coordinates": [ring]}})
    features.sort(key=lambda f: f["id"])
    if len(features) != 254 or len({f["id"] for f in features}) != 254:
        raise ValueError("Expected 254 Texas counties")
    write_json(ROOT / "texas-counties.geojson", {"type": "FeatureCollection", "features": features}, 500_000)
    return {
        "url": CENSUS_URL,
        "license": "Public domain (U.S. government work)",
        "license_url": "https://www2.census.gov/foia/ds_policies/ds027.pdf",
        "retrieved": datetime.now(timezone.utc).date().isoformat(),
        "notes": "U.S. Census Bureau cb_2020_us_county_20m, all 254 Texas counties (STATEFP 48). Source is already generalized to 1:20,000,000. Retained GEOID, NAME, STATEFP, and all polygon vertices, rounded to 4 decimal places; rings reversed to GeoJSON exterior orientation. NAD83 longitude/latitude treated as WGS84 at this display scale; no datum transform. Not for engineering measurements.",
        "raw_sha256": hashlib.sha256(archive_path.read_bytes()).hexdigest(),
    }


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    outages, stats = reduce_outages()
    boundaries = reduce_boundaries()
    sources = {"texas-county-outages.json": outages, "texas-counties.geojson": boundaries}
    (Path(__file__).parent / "texas-geodata-sources.json").write_text(json.dumps(sources, indent=2) + "\n")
    print(json.dumps(stats))


if __name__ == "__main__":
    main()
