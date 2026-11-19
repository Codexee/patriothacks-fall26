"""Shared download helper: resumable, skips finished files, records sources."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
SOURCES = ROOT / "out" / "sources.json"
UA = {"User-Agent": "research-data-client/0.1"}


def record_source(key: str, info: dict) -> None:
    SOURCES.parent.mkdir(parents=True, exist_ok=True)
    data = json.loads(SOURCES.read_text()) if SOURCES.exists() else {}
    data[key] = {**info, "fetched": time.strftime("%Y-%m-%d")}
    SOURCES.write_text(json.dumps(data, indent=2, sort_keys=True))


def download(url: str, dest: Path, expected_size: int | None = None, tries: int = 5) -> Path:
    """Download url to dest. Resume a partial file. Skip a complete one."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    if dest.exists() and (expected_size is None or dest.stat().st_size == expected_size):
        print(f"skip  {dest.name}", flush=True)
        return dest
    for attempt in range(1, tries + 1):
        have = part.stat().st_size if part.exists() else 0
        headers = dict(UA)
        if have:
            headers["Range"] = f"bytes={have}-"
        try:
            with requests.get(url, headers=headers, stream=True, timeout=60) as r:
                if r.status_code == 404:
                    print(f"404   {url}", flush=True)
                    return dest
                r.raise_for_status()
                mode = "ab" if have and r.status_code == 206 else "wb"
                with open(part, mode) as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
            part.rename(dest)
            print(f"done  {dest.name}  {dest.stat().st_size / 1e6:.0f} MB", flush=True)
            return dest
        except Exception as e:  # network errors: back off and resume
            print(f"retry {attempt}/{tries} {dest.name}: {e}", file=sys.stderr, flush=True)
            time.sleep(5 * attempt)
    raise RuntimeError(f"failed: {url}")
