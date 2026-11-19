#!/usr/bin/env python3
"""Combine fetcher provenance fragments into data/sources.json (offline)."""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[1]
files = {}
for name in ('fallback-sources.json', 'eia-sources.json', 'texas-geodata-sources.json', 'health-sources.json'):
    path = DATA / 'scripts' / name
    if not path.exists():
        continue
    fragment = json.loads(path.read_text())
    if isinstance(fragment, list):
        fragment = {row['file'].removeprefix('data/'): row for row in fragment}
    for filename, source in fragment.items():
        source.pop('file', None)
        source['retrieved_date'] = source.pop('retrieved', source.get('retrieved_date'))
        files[filename] = source
(DATA / 'sources.json').write_text(json.dumps({'files': files}, indent=2) + '\n')
print('Wrote provenance for', len(files), 'source packs')
