#!/usr/bin/env python3
"""Offline checks for the earth-texas source packs; run after fetching all packs."""
import datetime as dt
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[1]


def load(name):
    return json.loads((DATA / name).read_text())


def main():
    sources = load('sources.json')['files']
    expected = {
        'eia-ercot-2021.json': ('ERCO', '2021-02-08T00:00:00Z', '2021-02-22T23:00:00Z', 360),
        'eia-ercot-2019-2020.json': ('ERCO', '2019-01-01T00:00:00Z', '2020-12-31T23:00:00Z', 17544),
        'eia-elliott-tva-2022.json': ('TVA', '2022-12-20T00:00:00Z', '2022-12-27T23:00:00Z', 192),
        'eia-elliott-duk-2022.json': ('DUK', '2022-12-20T00:00:00Z', '2022-12-27T23:00:00Z', 192),
    }
    for file, (ba, first, last, count) in expected.items():
        pack = load(file)
        rows = pack['rows']
        assert pack['respondent'] == ba and len(rows) == count, file
        assert rows[0]['time'] == first and rows[-1]['time'] == last, file
        times = [dt.datetime.fromisoformat(r['time'].replace('Z', '+00:00')) for r in rows]
        assert all((b - a).total_seconds() == 3600 for a, b in zip(times, times[1:])), file
        assert all(set(r) == {'time', 'D', 'DF', 'NG'} for r in rows), file
        print(file, 'PASS', count, 'hour endings; nulls', {k: sum(r[k] is None for r in rows) for k in ('D', 'DF', 'NG')})
    fuels = load('eia-ercot-2021-fuels.json')
    assert len(fuels['rows']) == 360
    assert all(set(r['fuels']) == set(fuels['fuel_types']) for r in fuels['rows'])
    assert len(fuels['fuel_types']) >= 6
    outages = load('texas-county-outages.json')
    assert len(outages) == 28448 and len({r['county'] for r in outages}) == 254
    assert len({(r['county'], r['time']) for r in outages}) == len(outages)
    assert (DATA / 'texas-county-outages.json').stat().st_size < 3_000_000
    shapes = load('texas-counties.geojson')['features']
    assert len(shapes) == 254 and len({f['properties']['GEOID'] for f in shapes}) == 254
    assert (DATA / 'texas-counties.geojson').stat().st_size < 500_000
    outage_names = {r['county'].replace(' ', '').lower() for r in outages}
    assert outage_names == {f['properties']['NAME'].replace(' ', '').lower() for f in shapes}
    assert len(load('flint-samples.json')) == 271
    hubei = load('hubei-cases.json')['cases']
    assert len(hubei) == 1143 and hubei[0]['confirmed'] == 444
    points = load('wuhan-early-points.json')['points']
    assert [p['value'] for p in points] == [59, 41, 1723]
    outputs = list(expected) + ['eia-ercot-2021-fuels.json', 'texas-county-outages.json', 'texas-counties.geojson',
                                'flint-samples.json', 'hubei-cases.json', 'wuhan-early-points.json']
    for file in outputs:
        source = sources[file]
        assert all(source.get(k) for k in ('url', 'license', 'retrieved_date', 'notes')), file
    print('All', len(outputs), 'source packs, size limits, county joins, health counts and provenance: PASS')


if __name__ == '__main__':
    main()
