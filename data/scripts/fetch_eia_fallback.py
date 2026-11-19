#!/usr/bin/env python3
"""Fetch the task's hold-out/Elliott series from official unkeyed EIA-930 CSVs.

Use when the API's shared DEMO_KEY quota is exhausted. These are CSV downloads,
not API responses. Only raw reported D/DF/NG columns are used; imputed and adjusted
columns are deliberately excluded. Run: python3 data/scripts/fetch_eia_fallback.py
"""
from concurrent.futures import ThreadPoolExecutor
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path
import shutil
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data'
RAW = DATA / 'raw' / 'earth-eia-fallback'
BASE = 'https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/'
FILES = [(2018, 'Jul_Dec'), (2019, 'Jan_Jun'), (2019, 'Jul_Dec'),
         (2020, 'Jan_Jun'), (2020, 'Jul_Dec'), (2022, 'Jul_Dec')]
SETS = [
    ('eia-ercot-2019-2020.json', 'ERCO', '2019-01-01T00:00:00Z', '2020-12-31T23:00:00Z'),
    ('eia-elliott-tva-2022.json', 'TVA', '2022-12-20T00:00:00Z', '2022-12-27T23:00:00Z'),
    ('eia-elliott-duk-2022.json', 'DUK', '2022-12-20T00:00:00Z', '2022-12-27T23:00:00Z'),
]
COLUMNS = {'D': 'Demand (MW)', 'DF': 'Demand Forecast (MW)', 'NG': 'Net Generation (MW)'}


def download(period):
    year, half = period
    name = f'EIA930_BALANCE_{year}_{half}.csv'
    path = RAW / name
    meta = path.with_suffix('.retrieved.json')
    if path.exists() and meta.exists():
        return path, json.loads(meta.read_text())
    url = BASE + name
    RAW.mkdir(parents=True, exist_ok=True)
    for attempt in range(6):
        try:
            print('Downloading ' + name, flush=True)
            req = urllib.request.Request(url, headers={'User-Agent': 'Hollow-Twin-research/1.0'})
            with urllib.request.urlopen(req, timeout=180) as response:
                with path.with_suffix('.part').open('wb') as target:
                    shutil.copyfileobj(response, target, length=1024 * 1024)
            path.with_suffix('.part').replace(path)
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            source = {'url': url, 'retrieved_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                      'sha256': digest, 'bytes': path.stat().st_size}
            meta.write_text(json.dumps(source, indent=2) + '\n')
            print(f'Downloaded {name}: {source["bytes"]} bytes', flush=True)
            return path, source
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
            if attempt == 5:
                raise
            print(f'Retrying {name}: {type(error).__name__}', flush=True)
            time.sleep(min(30, 2 ** (attempt + 1)))


def number(raw):
    return None if raw.strip() in ('', 'NA', 'N/A', 'null') else float(raw)


def main():
    with ThreadPoolExecutor(max_workers=3) as pool:
        downloads = list(pool.map(download, FILES))
    rows = {name: {} for name, *_ in SETS}
    used = {name: [] for name, *_ in SETS}
    for path, source in downloads:
        file_used = set()
        with path.open(encoding='utf-8-sig', newline='') as handle:
            reader = csv.DictReader(handle)
            required = ['Balancing Authority', 'UTC Time at End of Hour', *COLUMNS.values()]
            if any(column not in reader.fieldnames for column in required):
                raise ValueError('Unexpected EIA schema: ' + path.name)
            for raw in reader:
                ba = raw['Balancing Authority']
                if ba not in ('ERCO', 'TVA', 'DUK'):
                    continue
                stamp = dt.datetime.strptime(raw['UTC Time at End of Hour'], '%m/%d/%Y %I:%M:%S %p')
                hour = stamp.strftime('%Y-%m-%dT%H:%M:%SZ')
                for name, respondent, start, end in SETS:
                    if ba != respondent or not start <= hour <= end:
                        continue
                    record = {'time': hour, **{kind: number(raw[column]) for kind, column in COLUMNS.items()}}
                    if hour in rows[name] and rows[name][hour] != record:
                        raise ValueError('Conflicting duplicate EIA hour: ' + hour)
                    rows[name][hour] = record
                    file_used.add(name)
        for name in file_used:
            used[name].append(source)
        print('Reduced ' + path.name, flush=True)
    sources = {}
    for name, respondent, start, end in SETS:
        first = dt.datetime.fromisoformat(start.replace('Z', '+00:00'))
        last = dt.datetime.fromisoformat(end.replace('Z', '+00:00'))
        expected = int((last - first).total_seconds() / 3600) + 1
        expected_hours = [(first + dt.timedelta(hours=i)).strftime('%Y-%m-%dT%H:%M:%SZ')
                          for i in range(expected)]
        if sorted(rows[name]) != expected_hours:
            missing = sorted(set(expected_hours) - set(rows[name]))
            raise ValueError(f'{name}: incomplete hours ({len(rows[name])}/{expected}), missing {missing[:10]}')
        output = {'respondent': respondent, 'timezone': 'UTC', 'timestamp_convention': 'hour ending',
                  'units': 'MWh per hourly interval (numerically average MW)', 'start': start, 'end': end,
                  'rows': [rows[name][hour] for hour in expected_hours]}
        (DATA / name).write_text(json.dumps(output, separators=(',', ':')) + '\n')
        nulls = {kind: sum(row[kind] is None for row in output['rows']) for kind in COLUMNS}
        sources[name] = {
            'url': BASE, 'license': 'Public domain (US government)',
            'license_url': 'https://www.eia.gov/about/copyrights_reuse.php',
            'retrieved_date': max(s['retrieved_at'] for s in used[name])[:10],
            'downloads': used[name],
            'selection': {'respondent': respondent, 'start': start, 'end': end,
                          'columns': COLUMNS, 'hours': expected, 'nulls': nulls},
            'notes': 'Official EIA six-month CSV fallback after API DEMO_KEY rate limits. '
                     'Not an API response. Uses raw reported columns, not imputed/adjusted values. '
                     'UTC hour ending. Null values retained. Half-year files partition by BA local date; '
                     'the prior half-year supplies UTC boundary hours. Historical revised values, '
                     'not archived publication vintages.',
        }
        print(f'Wrote {name}: {expected} hours, nulls {nulls}', flush=True)
    (DATA / 'scripts' / 'fallback-sources.json').write_text(json.dumps(sources, indent=2) + '\n')


if __name__ == '__main__':
    main()
