#!/usr/bin/env python3
"""Fetch task-scoped EIA v2 hourly UTC series. No dependencies or paid services.

Run from any directory: python3 data/scripts/fetch_eia.py
EIA_API_KEY: environment, root/app .env.local, then rate-limited DEMO_KEY.
Raw caches omit EIA's request echo because it can contain the API key.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data'
RAW = DATA / 'raw' / 'earth-eia'
BASE = 'https://api.eia.gov/v2/electricity/rto/'
SETS = [
    ('ercot-2021', 'ERCO', '2021-02-08T00', '2021-02-22T23'),
    ('ercot-2019-2020', 'ERCO', '2019-01-01T00', '2020-12-31T23'),
    ('elliott-tva-2022', 'TVA', '2022-12-20T00', '2022-12-27T23'),
    ('elliott-duk-2022', 'DUK', '2022-12-20T00', '2022-12-27T23'),
]


def api_key():
    if os.environ.get('EIA_API_KEY'):
        return os.environ['EIA_API_KEY']
    for p in (ROOT / '.env.local', ROOT / 'app' / '.env.local'):
        if p.exists():
            for line in p.read_text().splitlines():
                name, sep, value = line.strip().removeprefix('export ').partition('=')
                if name.strip() == 'EIA_API_KEY' and sep and value.strip():
                    return value.strip().strip('\"\'')
    return 'DEMO_KEY'


def page(route, respondent, start, end, offset, key, refresh):
    params = [('frequency', 'hourly'), ('data[0]', 'value'),
              ('facets[respondent][]', respondent), ('start', start), ('end', end),
              ('sort[0][column]', 'period'), ('sort[0][direction]', 'asc'),
              ('sort[1][column]', 'respondent'), ('sort[1][direction]', 'asc'),
              ('sort[2][column]', 'type' if route == 'region-data' else 'fueltype'),
              ('sort[2][direction]', 'asc'), ('length', '5000'), ('offset', str(offset))]
    if route == 'region-data':
        params += [('facets[type][]', x) for x in ('D', 'DF', 'NG')]
    public_url = BASE + route + '/data/?' + urllib.parse.urlencode(params)
    cache = RAW / (hashlib.sha256(public_url.encode()).hexdigest() + '.json')
    if cache.exists() and not refresh:
        return json.loads(cache.read_text())
    url = public_url + '&api_key=' + urllib.parse.quote(key)
    for attempt in range(9):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Hollow-Twin-research/1.0'})
            with urllib.request.urlopen(req, timeout=100) as response:
                body = json.load(response)
            if 'response' not in body or 'data' not in body['response']:
                raise ValueError('API did not return a data response')
            out = {'retrieved_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                   'url': public_url, 'response': body['response']}
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(out, separators=(',', ':')))
            time.sleep(0.5)
            return out
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as exc:
            # Never print a request URL or an exception containing a credential.
            status = getattr(exc, 'code', type(exc).__name__)
            if isinstance(status, int) and status not in (408, 429, 500, 502, 503, 504):
                raise RuntimeError('EIA HTTP status %s' % status) from None
            if attempt == 8:
                raise RuntimeError('EIA request exhausted retries; status %s' % status) from None
            delay = min(120, 2 ** (attempt + 1))
            print('EIA retry: %s; waiting %ss' % (status, delay), flush=True)
            time.sleep(delay)


def fetch(route, respondent, start, end, key, refresh):
    rows, dates, urls, offset = [], [], [], 0
    while True:
        p = page(route, respondent, start, end, offset, key, refresh)
        response = p['response']
        batch = response['data']
        total = int(response['total'])
        rows.extend(batch)
        dates.append(p['retrieved_at'])
        urls.append(p['url'])
        print('%s %s %s: %s/%s' % (respondent, route, start[:4], len(rows), total), flush=True)
        offset += len(batch)
        if offset >= total:
            break
        if not batch:
            raise RuntimeError('Incomplete EIA pagination')
    return rows, dates, urls


def number(value):
    return None if value in (None, '', 'null') else float(value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--only', choices=[s[0] for s in SETS])
    args = parser.parse_args()
    key = api_key()
    print('EIA key source: %s' % ('DEMO_KEY' if key == 'DEMO_KEY' else 'environment/.env.local (hidden)'), flush=True)
    meta_path = DATA / 'scripts' / 'eia-sources.json'
    sources = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    for name, respondent, start, end in SETS:
        if args.only and args.only != name:
            continue
        rows, dates, urls = fetch('region-data', respondent, start, end, key, args.refresh)
        by_hour = {}
        for r in rows:
            hour = r['period'] + ':00:00Z'
            record = by_hour.setdefault(hour, {'time': hour, 'D': None, 'DF': None, 'NG': None})
            if record[r['type']] is not None:
                raise RuntimeError('Duplicate EIA hour/type: ' + hour)
            record[r['type']] = number(r['value'])
        first = dt.datetime.fromisoformat(start)
        last = dt.datetime.fromisoformat(end)
        expected = int((last - first).total_seconds() / 3600) + 1
        if len(by_hour) != expected:
            raise RuntimeError('Expected %s hourly timestamps, got %s' % (expected, len(by_hour)))
        output = {'respondent': respondent, 'timezone': 'UTC', 'timestamp_convention': 'hour ending',
                  'units': 'MWh per hourly interval (numerically average MW)',
                  'start': start + ':00:00Z', 'end': end + ':00:00Z',
                  'rows': [by_hour[t] for t in sorted(by_hour)]}
        filename = 'eia-' + name + '.json'
        (DATA / filename).write_text(json.dumps(output, separators=(',', ':')) + '\n')
        sources[filename] = {'url': BASE + 'region-data/data/', 'license': 'Public domain (US government)',
                             'license_url': 'https://www.eia.gov/about/copyrights_reuse.php',
                             'retrieved_date': max(dates)[:10], 'retrieved_at': sorted(set(dates)),
                             'query': {'respondent': respondent, 'frequency': 'hourly', 'start': start, 'end': end,
                                       'types': ['D', 'DF', 'NG'], 'length': 5000, 'offsets': list(range(0, len(rows), 5000))},
                             'notes': 'Source: U.S. Energy Information Administration. Historical revised values; not archived publication vintages. UTC hour ending. Null values retained. API length<=5000 with offset pagination.'}
        if name == 'ercot-2021':
            fuel, fdates, _ = fetch('fuel-type-data', respondent, start, end, key, args.refresh)
            types = {r['fueltype']: r.get('type-name', r.get('fueltype-name', r['fueltype'])) for r in fuel}
            records = {t: {'time': t, 'fuels': {k: None for k in sorted(types)}} for t in by_hour}
            for r in fuel:
                records[r['period'] + ':00:00Z']['fuels'][r['fueltype']] = number(r['value'])
            f = 'eia-ercot-2021-fuels.json'
            (DATA / f).write_text(json.dumps({'respondent': respondent, 'timezone': 'UTC',
                'timestamp_convention': 'hour ending', 'units': output['units'], 'fuel_types': types,
                'rows': [records[t] for t in sorted(records)]}, separators=(',', ':')) + '\n')
            sources[f] = {'url': BASE + 'fuel-type-data/data/', 'license': sources[filename]['license'],
                          'license_url': sources[filename]['license_url'], 'retrieved_date': max(fdates)[:10],
                          'query': {'respondent': respondent, 'frequency': 'hourly', 'start': start, 'end': end,
                                    'fueltypes': 'all (no fuel facet)', 'length': 5000},
                          'notes': 'All returned fuel types; missing values remain null. Fuel groups are not individual plant telemetry.'}
        meta_path.write_text(json.dumps(sources, indent=2) + '\n')
        print('Wrote %s (%s hours)' % (filename, expected), flush=True)


if __name__ == '__main__':
    main()
