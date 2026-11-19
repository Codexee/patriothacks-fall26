# Residents-only check-first model: which areas stay dark longest

Nov 19, 2026. Scripts: `train_dark_residents.py` (TRAIN and DEV), `final_test_residents.py` (FINAL TEST, run once), `export_residents.py` (writes `prototypes/hollow-twin-poc/public/results/checkfirst.json`). Results: `out/dark_residents_results.json`, `out/dark_residents_final.json`.

## What it predicts

In an outage event, the model predicts the number of hours that each county of the event's region stays dark. "Dark" means at least 10% of the county's customers are out. The product is the order: crews and neighbors check the longest-dark areas first.

The target, the rows, the split and the history baseline are the same as the v2 dark model (`RESULTS.md`, "During model"). The only change is the inputs. The model uses only what residents of the Hollow have. It does not use weather, weather forecasts or grid-operator data.

## Inputs

### Kept (residents have them)

| Feature | Plain name | Hollow equivalent |
|---|---|---|
| `out_prev1h` | Homes reporting no power in the area, 1 h before the event start | Homes in the section that reported no power in the last hour |
| `out_max_prev6h` | Most homes reporting no power in the area, in the 6 h before the start | Most homes in the section that reported no power in the last 6 hours |
| `month` | Month of the event start | Month on the Hollow calendar |
| `hod` | Hour of day of the event start | Hour on the residents' clocks |
| `ba_past_events` | Earlier outage events in the region | Earlier blackouts in the district |
| `ba_past_mean_hours` | Mean length of earlier events in the region | Mean length of earlier blackouts in the district |
| `ba_hours_since_last` | Hours since the region's last event ended | Hours since the district's last blackout ended |
| `past_events` | Earlier events with a known outcome for the area | Earlier blackouts the section lived through |
| `past_dark_mean` | Mean dark hours of the area in earlier events | Mean hours the section stayed dark before |
| `past_dark_max` | Most dark hours of the area in one earlier event | Longest time the section stayed dark |
| `past_dark_share` | Share of earlier events with at least 1 dark hour | Share of earlier blackouts in which the section went dark |
| `customers` | Estimated electricity customers (EIA-861 2012, each utility's count split evenly over its counties) | Number of homes in the section |
| `pop` | Population | Head count of the section |
| `svi`, `svi_t1` … `svi_t4` | CDC Social Vulnerability Index 2010, overall and 4 themes | Depth and vulnerability of the section's level |
| `utilities` | Electric utilities that serve the area | Repair crews that serve the section |
| `ba_is_*` (36 columns) | Which region the area belongs to (vocabulary from TRAIN) | Which district the section belongs to |

Region history (`ba_*`) comes from the event list. Events are defined from EAGLE-I outage reports (a share of the region's customers out), not from grid-operator data. So residents can compute it from their own reports.

### Dropped

| Dropped | Why |
|---|---|
| 11 weather features at the event start (`ev_temp_c`, `ev_dew_c`, `ev_slp_min_hpa`, `ev_wind_max_ms`, `ev_precip_max_mm`, `ev_temp_anom_30d`, `ev_temp_min_24h`, `ev_temp_max_24h`, `ev_wind_max_24h`, `ev_precip_24h`, `ev_slp_chg_12h`) | Residents of the Hollow have no weather. |
| 7 grid-operator features from EIA-930 (`ev_fc_err`, `ev_fc_err_max_24h`, `ev_demand_vs_30d_peak`, `ev_import_share`, `ev_gas_share`, `ev_netgen_chg_6h`, `ev_gas_chg_6h`) | The Directorate does not give residents grid figures. |
| HHS emPOWER (Medicare beneficiaries on powered medical equipment) | Our copy is a 2026 snapshot. It was not known before the 2015–2024 events, so a test on this history would use future data. It is a fair Hollow input (residents can report it). It is not tested here. |

### Added candidates

`out_prev1h_share` and `out_max_prev6h_share`: the two report counts divided by the county's customer count (EAGLE-I MCC). DEV did not choose them (below).

## Method and selection

- LightGBM regression on log1p(dark hours). The objective is the v2 DEV choice. It was not chosen again.
- Configuration (leaves 7 or 15; at least 50 or 200 rows per leaf) and rounds (100, 200, 300): best within-event Spearman on TRAIN year folds (validation years 2017–2020, each fold trained on events that ended before that year).
- Feature set: best within-event Spearman on DEV.
- FINAL TEST: scored once, after every choice was frozen. `out/final_test_residents_runs.log` has one line.

## DEV (2021–2022): 309 events, 19,708 county-events

| Feature set | Config (TRAIN folds) | Fold Spearman | DEV within-event Spearman | DEV top-10 overlap | DEV MAE (h) |
|---|---|---|---|---|---|
| **residents (chosen)** | 7 leaves, 200 rows, 200 rounds | 0.306 | **0.340** | 0.442 | 2.51 |
| residents + shares | 7 leaves, 200 rows, 200 rounds | 0.310 | 0.337 | 0.454 | 2.47 |
| residents + shares, no region columns | 7 leaves, 200 rows, 100 rounds | 0.308 | 0.337 | 0.449 | 2.42 |
| History baseline | – | – | 0.210 | 0.256 | 4.13 |
| Chance | – | – | 0 | 0.135 | – |
| v2 with weather and grid (for reference) | 7 leaves, 50 rows, 300 rounds | – | 0.342 | 0.448 | 2.41 |

The three sets differ by at most 0.003 in Spearman and 0.012 in top-10 overlap. The rule picks the highest Spearman. The choice between them does not matter much.

## FINAL TEST (2023–2024): 390 events, 34,877 county-events

95% intervals: 2,000 bootstrap resamples of events (seed 20261118). Spearman: 256 events with at least 5 counties and more than one value. Top-10 overlap: 237 events with at least 10 counties and at least 1 dark county.

| Metric | Residents-only | History baseline | Chance | v2 with weather and grid |
|---|---|---|---|---|
| Within-event Spearman | **0.316** (0.285 – 0.347) | 0.220 (0.183 – 0.254) | 0 | 0.310 |
| Top-10 overlap | **0.459** (0.421 – 0.494) | 0.278 (0.243 – 0.316) | 0.132 (0.115 – 0.152) | 0.460 |
| MAE (h) | 2.27 (1.57 – 3.25) | 3.58 (2.86 – 4.58) | – | 2.23 |
| MAE of "predict 0 h" | 2.00 | | | |

Paired differences, residents-only minus history, same events:

| Metric | Difference | 95% interval |
|---|---|---|
| Within-event Spearman | +0.097 | 0.068 – 0.125 |
| Top-10 overlap | +0.182 | 0.145 – 0.219 |

The residents-only model beats the history baseline on FINAL TEST. Both intervals of the difference are above 0. It ranks as well as the v2 model with weather and grid inputs (0.316 against 0.310; 0.459 against 0.460). The v2 numbers come from `out/dark_final.json`. v2 was not retrained, so it has no intervals here.

Why removing weather did not hurt: every weather and grid feature has one value per event. All counties of one event get the same value. Such a feature can change the order of counties inside an event only through interactions with county features.

## Inputs by share of gain (chosen model)

| Input | Share of gain |
|---|---|
| Homes reporting no power, 1 h before the start | 0.292 |
| Month | 0.124 |
| Mean length of earlier events in the region | 0.096 |
| Population | 0.088 |
| Share of earlier events with a dark hour | 0.087 |
| Most homes reporting no power, 6 h before the start | 0.059 |
| Hours since the region's last event | 0.054 |
| Earlier events with a known outcome | 0.035 |
| Region columns (36, summed) | 0.034 |
| Earlier events in the region | 0.027 |

## Example: Hurricane Beryl, Texas (ERCOT, start 2024-07-08 12:00)

The rule was fixed before scoring: the FINAL TEST event with the most customers out at its peak (2,417,443). 188 counties; 49 had at least 1 dark hour.

| Model rank | County | Predicted (h) | Actual (h) | History (h) |
|---|---|---|---|---|
| 1 | Matagorda | 13.4 | 86 | 5.6 |
| 2 | Calhoun | 10.0 | 4 | 4.2 |
| 3 | Wharton | 8.8 | 120 | 7.5 |
| 4 | Colorado | 5.9 | 37 | 10.8 |
| 5 | Jackson | 5.5 | 17 | 4.3 |
| 6 | Brazoria | 4.1 | 165 | 6.3 |
| 7 | Galveston | 4.0 | 151 | 5.1 |
| 8 | Liberty | 2.6 | 143 | 7.2 |
| 9 | Chambers | 1.9 | 104 | 11.1 |
| 10 | Waller | 1.3 | 81 | 13.6 |

The model's top 10 holds 7 of the 10 longest-dark counties. The history baseline holds 2. Within-event Spearman for this event: 0.384. The model missed Harris County (176 h, the longest). Its outage reports showed 214 of about 1.8 million customers out 1 hour before the start, so the model predicted 0 h. Montgomery (156 h) and Trinity (141 h) were also outside the top 10.

## Limits

- The model ranks areas. Its hour values are much too low in large events (Brazoria: 4.1 h predicted, 165 h actual). Use the order, not the hours.
- Predicting 0 h everywhere has a lower MAE (2.00 h) than the model (2.27 h), because most county-events have no dark hour. MAE does not measure the ranking.
- The model is only as good as the reports. A gap in the reports at the start (Harris County, Beryl) gives a low rank.
- Month and hour can carry storm-season information. The Hollow has no storms, so part of what the model learned from the calendar may not carry over.
- The data is real US outages (EAGLE-I, 2015–2024). The Hollow inputs are stand-ins: outage reports for residents' reports, counties for sections, balancing-authority regions for districts, CDC SVI for depth.
- The model does not predict whether an event starts. It ranks areas once an event has started.
- `customers` is an estimate: each utility's 2012 EIA-861 count is split evenly over the counties it serves. It is not the EAGLE-I customer count.
- People on powered medical equipment (emPOWER) are not in the model, because no dated history of that data is available here.
