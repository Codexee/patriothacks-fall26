# Earth source packs

These files support the `earth-texas` assignment for Hollow Twin spec v2. The upstream project now has a newer spec. This task does not implement that newer scope.

The app runs offline from the committed JSON. Python 3.10 or newer is recommended for the fetch scripts. They use the standard library; the geodata script also calls `curl`.

```sh
python3 data/scripts/fetch_eia.py
python3 data/scripts/fetch_health.py
python3 data/scripts/fetch_texas_geodata.py
python3 data/scripts/build_earth_sources.py
python3 data/scripts/validate_earth_data.py
cd app
npm ci
npm run earth
```

The EIA fetcher reads `EIA_API_KEY` from the environment, root `.env.local`, or `app/.env.local`. It falls back to `DEMO_KEY`. It requests hourly UTC data, paginates with offsets and at most 5,000 rows, and retries rate limits with exponential backoff. Raw caches omit the API key and request echo. All large raw files stay in ignored `data/raw/`.

The shared `DEMO_KEY` quota was exhausted after the Texas 2021 requests. The official EIA six-month balance CSVs supply the other three packs through `python3 data/scripts/fetch_eia_fallback.py`. Their provenance identifies that fallback. The reducer selects raw demand, forecast and generation columns, rather than adjusted or imputed columns. Use the API fetcher with a free private key to refresh from the requested route. Run the manifest builder after any refresh.

| File | Coverage |
| --- | --- |
| `eia-ercot-2021.json` | ERCO D, DF, NG; Feb 8–22, 2021, inclusive; 360 UTC hour endings |
| `eia-ercot-2021-fuels.json` | All fuel types returned for the same 360 hour endings |
| `eia-ercot-2019-2020.json` | ERCO D, DF, NG; 2019–2020 inclusive; 17,544 UTC hour endings |
| `eia-elliott-tva-2022.json`, `eia-elliott-duk-2022.json` | D, DF, NG; Dec 20–27, 2022 inclusive; 192 UTC hour endings each |
| `texas-county-outages.json` | All 28,448 source records; 254 counties, Feb 11–24, 2021; 2.56 MB |
| `texas-counties.geojson` | Census 2020 boundaries, 254 Texas counties; 98 KB |
| `flint-samples.json` | All 271 included samples and the six requested columns |
| `hubei-cases.json` | Hubei only; 1,143 dates starting Jan 22, 2020 |
| `wuhan-early-points.json` | Three cited early reports/estimates; publication dates kept separate from onset dates |

`data/sources.json` covers these ten output files, including source URLs, license statements, retrieval dates and reduction notes. Fetcher metadata fragments stay in `data/scripts/` so the manifest can be rebuilt. Existing `data/out/` files belong to the upstream pipeline and retain their own manifest.

EIA values are energy over a one-hour interval in MWh, numerically equal to the average power in MW. Their timestamps mark hour endings. Historical values may include later revisions.

The 4TU source does **not** specify a timezone or temperature scale. It describes `outage_count` as outages/events without verifying that it counts customers. Do not label these values UTC, Celsius, Fahrenheit or customers without another source. County joins need `De Witt` → `DeWitt`; removing spaces handles that difference.

Flint has no per-sample dates and no explicit reuse license in the source workbook. Two duplicate SampleIDs are preserved. Wuhan's 59 unexplained pneumonia cases and 41 confirmed cases use different case definitions. Imperial's estimate was published Jan 17 and describes onsets by Jan 12. It was unavailable on Jan 12.
