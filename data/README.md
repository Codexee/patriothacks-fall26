# data/ — the real-world data pipeline

Spec: `.plans/before-during-after-spec.md` (locked). Workstream 1 owns this folder.

## Set up

```bash
brew install uv libomp      # libomp: LightGBM needs OpenMP on macOS
cd data && uv sync
```

## Fetch (raw files go to `data/raw/`, which git ignores)

| Command | What | Size | Time |
| --- | --- | --- | --- |
| `uv run python fetch/eia930.py` | EIA-930 hourly balance, every BA, Jul 2015 → now | about 900 MB | about 3 min |
| `uv run python fetch/eaglei.py 2015 2024` | EAGLE-I county outages every 15 min (ORNL, CC BY 4.0) | about 10 GB | about 50 min |
| `uv run python fetch/small.py` | EIA-861 2024, CDC SVI 2022, HHS emPOWER (county), Census 2024 population, us-atlas county shapes | about 15 MB | 1 min |
| `uv run python fetch/weather.py` | NOAA ISD-Lite hourly, 3 county points per BA, 2015–2025 | about 120 MB | about 3 min |

Every fetch writes its source, licence and date to `out/sources.json`.

## Build (small outputs go to `data/out/`, which is committed)

| Command | Output | Notes |
| --- | --- | --- |
| `uv run python build/county_ba.py` | `out/county_ba.parquet` (county FIPS, BA, share) | See "County → BA" below |
| `uv run python build/labels.py` | `out/events.parquet`, `out/events.json`; `raw/derived/ba_hour_out.parquet` (large) | The event library |

## Decisions and known limits

- **Event rule (fixed before training):** a BA's share of customers out ≥ 1% for ≥ 4 hours in a row; events closer than 12 hours merge. Customers per county come from EAGLE-I's `MCC.csv`.
- **County → BA:** EIA-861 gives each utility's customers per state and the list of counties it serves, but not customers per county. We split a utility's customers evenly across its counties. This over-weights small utilities in big counties (example: Los Angeles County comes out 68% LADWP). Wires-only utilities (most of ERCOT, such as CenterPoint) are in `Delivery_Companies_2024.xlsx`, not in the sales file; both are used.
- **Connecticut:** Census 2022+ uses planning regions; EAGLE-I uses the old 8 counties. They are mapped to ISO-NE by hand (all of Connecticut is ISO-NE).
- **Unmatched:** 14 EIA-861 county names (Alaska boroughs that were split or renamed, the old Connecticut counties, Bedford City VA). Listed in `out/county_ba_unmatched.csv`.
- **Event types:** most events are storms (the 2015 PJM derecho, the Nov 2015 Spokane windstorm), not supply shortfalls. Grid data alone cannot see a storm coming, so weather is a model input, and the evaluation reports storm and supply events separately.
- **Weather:** NOAA ISD-Lite instead of Open-Meteo. Open-Meteo's free tier counts a 10-year hourly request as hundreds of calls; ISD-Lite is bulk, with no key and no limit. Some station-years are missing; the features treat them as missing.
- **EAGLE-I coverage** grows over the years (see `raw/eaglei/coverage_history.csv`), so early years can have fewer detected events.
- **Time zone:** EAGLE-I `run_start_time` is treated as UTC. Check: in Texas, rotating outages began at 01:25 CST on Feb 15, 2021 (07:25 UTC).
