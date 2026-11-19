# Outage model results

**The warning model failed the two-baseline test.** On 818 held-out events, `warn_full` warned 114 at least 12 hours ahead (13.9%). It produced 6.34 false alarms per balancing area (BA) per year. `rule_forecast_error` warned 60 with 6.09 false alarms per BA-year. `rule_hand` warned 76 with 6.92 false alarms per BA-year.

The project requires more events warned at least 12 hours ahead at the same or fewer false alarms than each baseline. All methods used thresholds chosen before the test period.

## Warning performance

Training used 2,424,897 BA-hours before 2021-01-01 UTC (1.19% positive). The event library contains 659 earlier events. The test period runs from 2021-01-01 through 2024-12-31 23:00:00 UTC and contains 1,795,029 eligible hours (2.03% positive). Of 818 test events, 809 had an eligible observation 12–72 hours before onset.

The `warn_full_fx` row uses observed future weather and appears only as a retrospective comparison.

| Method | Events | Any lead | ≥12 h | Recall ≥12 h (%) | Median lead (h) | False episodes | False / BA-year | PR-AUC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| warn_grid | 818 | 62 | 60 | 7.3 | 72.0 | 756 | 3.69 | 0.0276 |
| warn_full | 818 | 230 | 114 | 13.9 | 11.0 | 1299 | 6.34 | 0.0582 |
| rule_forecast_error | 818 | 61 | 60 | 7.3 | 67.0 | 1247 | 6.09 | 0.0204 |
| rule_hand | 818 | 79 | 76 | 9.3 | 72.0 | 1418 | 6.92 | 0.0197 |
| warn_full_fx | 818 | 360 | 324 | 39.6 | 24.0 | 1298 | 6.34 | 0.1444 |

Median lead uses the earliest alert among events with any warning. PR-AUC is hourly average precision. It ranks warnings across all thresholds. A missing baseline score ranks below every available score.

### Winter (December–February)

| Method | Events | Any lead | ≥12 h | Recall ≥12 h (%) | Median lead (h) | False episodes | False / BA-year | PR-AUC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| warn_grid | 240 | 18 | 18 | 7.5 | 72.0 | 82 | 1.65 | 0.0328 |
| warn_full | 240 | 68 | 37 | 15.4 | 14.5 | 402 | 8.09 | 0.0648 |
| rule_forecast_error | 240 | 18 | 18 | 7.5 | 65.5 | 259 | 5.21 | 0.0262 |
| rule_hand | 240 | 22 | 21 | 8.8 | 72.0 | 358 | 7.20 | 0.0253 |
| warn_full_fx | 240 | 102 | 95 | 39.6 | 23.0 | 340 | 6.84 | 0.1655 |

### Summer (June–August)

| Method | Events | Any lead | ≥12 h | Recall ≥12 h (%) | Median lead (h) | False episodes | False / BA-year | PR-AUC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| warn_grid | 236 | 11 | 10 | 4.2 | 72.0 | 9 | 0.17 | 0.0385 |
| warn_full | 236 | 34 | 17 | 7.2 | 11.0 | 161 | 3.11 | 0.0517 |
| rule_forecast_error | 236 | 11 | 11 | 4.7 | 67.0 | 338 | 6.53 | 0.0199 |
| rule_hand | 236 | 14 | 13 | 5.5 | 72.0 | 321 | 6.20 | 0.0195 |
| warn_full_fx | 236 | 79 | 70 | 29.7 | 24.0 | 275 | 5.31 | 0.1064 |

### March–May and September–November

| Method | Events | Any lead | ≥12 h | Recall ≥12 h (%) | Median lead (h) | False episodes | False / BA-year | PR-AUC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| warn_grid | 342 | 33 | 32 | 9.4 | 72.0 | 665 | 6.44 | 0.0240 |
| warn_full | 342 | 128 | 60 | 17.5 | 10.0 | 736 | 7.13 | 0.0599 |
| rule_forecast_error | 342 | 32 | 31 | 9.1 | 67.5 | 650 | 6.29 | 0.0184 |
| rule_hand | 342 | 43 | 42 | 12.3 | 72.0 | 739 | 7.16 | 0.0176 |
| warn_full_fx | 342 | 179 | 159 | 46.5 | 24.0 | 683 | 6.61 | 0.1602 |

### Texas and Winter Storm Elliott

Each cell gives hours from the earliest eligible warning to the event start. A dash means the method missed the event. The Elliott rows include every BA event starting December 23–25, 2022 UTC. The dates alone do not establish storm attribution.

For ERCO on February 15, 2021, `warn_full` issued no warning. For TVA on December 23, 2022, `warn_full` issued no warning.

| Event | BA event ID | Start (UTC) | warn_grid | warn_full | rule_forecast_error | rule_hand | warn_full_fx |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Texas freeze (Uri) | ERCO-2021021501 | 2021-02-15 01:00 | — | — | — | — | — |
| Winter Storm Elliott period | SPA-2022122303 | 2022-12-23 03:00 | — | — | — | — | — |
| Winter Storm Elliott period | BPAT-2022122307 | 2022-12-23 07:00 | — | — | — | — | — |
| Winter Storm Elliott period | PGE-2022122307 | 2022-12-23 07:00 | — | — | — | — | — |
| Winter Storm Elliott period | SOCO-2022122307 | 2022-12-23 07:00 | — | — | — | — | — |
| Winter Storm Elliott period | DUK-2022122310 | 2022-12-23 10:00 | — | — | — | — | 22 |
| Winter Storm Elliott period | ISNE-2022122310 | 2022-12-23 10:00 | — | 5 | — | — | 28 |
| Winter Storm Elliott period | CPLE-2022122312 | 2022-12-23 12:00 | — | — | — | — | 21 |
| Winter Storm Elliott period | SC-2022122312 | 2022-12-23 12:00 | — | — | — | — | — |
| Winter Storm Elliott period | SCEG-2022122312 | 2022-12-23 12:00 | — | — | — | — | 24 |
| Winter Storm Elliott period | TVA-2022122312 | 2022-12-23 12:00 | — | — | — | — | — |
| Winter Storm Elliott period | LGEE-2022122313 | 2022-12-23 13:00 | — | — | — | 7 | — |
| Winter Storm Elliott period | NYIS-2022122315 | 2022-12-23 15:00 | — | 8 | — | — | 30 |
| Winter Storm Elliott period | PJM-2022122315 | 2022-12-23 15:00 | — | — | — | — | — |
| Winter Storm Elliott period | TPWR-2022122320 | 2022-12-23 20:00 | — | — | — | — | — |
| Winter Storm Elliott period | SC-2022122413 | 2022-12-24 13:00 | — | — | — | — | — |
| Winter Storm Elliott period | TPWR-2022122514 | 2022-12-25 14:00 | — | — | — | — | — |

The full event ledger includes every held-out event, including misses. [Per-event results](out/warn_events.csv)

### Training and alert rules

A positive hour precedes an event start by up to 48 hours. An event begins when at least 1% of BA customers have lost power for four consecutive hours. The library merges qualifying runs separated by up to 12 hours. Scoring excludes the event, the next 48 hours and hours without a complete label horizon. Coverage uses each BA’s first and last reported outage in each year and joins adjacent windows. The training features start in July 2015. The label check against the event library found 0 disagreements.

LightGBM used expanding annual validation folds in 2017, 2018, 2019, 2020. Each fit dropped the last 48 training hours before the next period. Mean validation average precision selected among 100, 200 and 300 trees and positive-class weights of 1 and 10. The candidates paired 7 leaves with a minimum of 2,000 rows per leaf, or 15 leaves with a minimum of 500 or 5,000. The learning rate was 0.05. The warning models omit BA identity. The grid inputs are demand error, recent peaks, interchange, fuel and generation changes, hour and month. The full model adds station weather and trailing summaries.

Starting at high training-score quantiles, threshold selection lowered the threshold until either the validation predictions or the final fit on training hours exceeded six false episodes per BA-year. It retained the last passing threshold. An alert episode joins alerts less than 24 hours apart. It counts as false if none of its alerts has an event start in the next 48 hours. An event counts as warned when any alert falls in the preceding 72 hours. These windows differ by design. One BA-year equals 8,766 eligible hours. Seasonal rates use eligible hours in that season, the month of event onset and the month of the episode’s first alert.

The forecast-error rule uses (demand − forecast) / forecast. The hand rule adds maximum 24-hour forecast error (clipped to ±1 and divided by 0.1), demand divided by its trailing 30-day peak, and absolute temperature anomaly divided by 10. Missing hand-rule components contribute zero. Training event recall selected the two weights.

| Method | Selected settings | Threshold | Validation false / BA-year | Fitted training false / BA-year |
| --- | --- | --- | --- | --- |
| warn_grid | num_leaves=7, min_child_samples=2000, scale_pos_weight=1.0, rounds=200 | 0.034866495 | 5.75 | 2.23 |
| warn_full | num_leaves=7, min_child_samples=2000, scale_pos_weight=1.0, rounds=100 | 0.079436864 | 5.52 | 5.52 |
| rule_forecast_error | threshold only | 0.32970784 | 5.15 | 5.73 |
| rule_hand | wd=0.5, wt=1.0 | 3.9784984 | 5.51 | 5.84 |
| warn_full_fx | num_leaves=7, min_child_samples=2000, scale_pos_weight=1.0, rounds=200 | 0.098848311 | 5.92 | 5.74 |

#### Predictions from training-year validation folds

| Method | Events | Any lead | ≥12 h | Recall ≥12 h (%) | Median lead (h) | False episodes | False / BA-year | PR-AUC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| warn_grid | 508 | 70 | 67 | 13.2 | 71.0 | 1165 | 5.75 | 0.0209 |
| warn_full | 508 | 124 | 67 | 13.2 | 13.0 | 1118 | 5.52 | 0.0365 |
| rule_forecast_error | 508 | 46 | 44 | 8.7 | 72.0 | 1042 | 5.15 | 0.0142 |
| rule_hand | 508 | 59 | 58 | 11.4 | 72.0 | 1115 | 5.51 | 0.0139 |
| warn_full_fx | 508 | 218 | 187 | 36.8 | 22.5 | 1198 | 5.92 | 0.0891 |

### Future weather experiment

The report-only variant uses the next 24 hours of observed weather as a stand-in for a forecast. It warned 324 events at 12 hours, a change of +210. PR-AUC changed by +0.0863 and false alarms by -0.005 per BA-year. Only past and current observations enter the exported warning models.

## County dark hours

The county model predicts the number of event hours with at least 10% of county customers reported out. The pipeline generated 95,789 county-event rows. The outage files support targets for 91,558 rows across 1,244 of 1,477 library events.

Each county belongs to its primary BA in the shared crosswalk. The eight historic Connecticut counties belong to ISO New England. Some BAs have no primary counties. EAGLE-I’s modeled customer counts define the 10% threshold. The target includes both ends of the event and counts distinct hours. A county needs a denominator and an outage record in each endpoint year to contribute to evaluation. A missing county-hour within that coverage counts as zero reported outages.

At onset, the model uses the last completed grid and weather hour, the preceding six hours of reported county outages, the start month and hour, BA identity, and BA and county histories from completed events. An EIA hour is timestamped at its beginning, so the row ending at onset carries the previous hour’s timestamp. Earlier held-out outcomes can enter the history for a later event after the earlier event ends. History requires a county outage report by the earlier event’s end.

County population, the Social Vulnerability Index (SVI) and its four theme ranks use the 2010 CDC county file. The model treats SVI ranks as missing before April 2015, following the date of the CDC documentation. Utility count uses distinct utilities reporting service in 2012. The county customer estimate divides each utility’s state total evenly across its reported counties. These historical estimates keep later county characteristics out of the model. A missing match remains missing. The committed county reference makes training repeatable offline. [CDC county data](https://svi.cdc.gov/Documents/Data/2010/csv/states_counties/SVI_2010_US_county.csv) · [CDC methodology](https://svi.cdc.gov/map25/data/docs/SVI-2010-Documentation-H.pdf) · [EIA 2012 archive](https://www.eia.gov/electricity/data/eia861/archive/zip/f8612012.zip)

Expanding training-year folds selected regression settings by mean absolute error (MAE). Candidates used 7 or 15 leaves, minimum leaf sizes of 50 or 200, and 100, 200 or 300 trees. The learning rate was 0.05. The selected settings were num_leaves=7, min_child_samples=50, rounds=100. The history baseline uses the county’s mean observed dark hours in earlier events, with zero for a first event. The evaluator and replay files floor negative estimates at zero. The exported regression trees return the raw sum of leaves.

| Period | County-events | Events | Model MAE (h) | History MAE (h) | Zero MAE (h) | Model Spearman | History Spearman | Model within-event Spearman | History within-event Spearman |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Test | 54585 | 699 | 3.91 | 3.78 | 2.11 | 0.298 | 0.180 | 0.313 | 0.216 |
| Training validation | 31011 | 425 | 4.61 | 4.15 | 2.72 | 0.259 | 0.206 | 0.282 | 0.183 |

Spearman correlation measures rank agreement. The within-event column averages correlations across BA events with at least five counties and variation in both rankings.

On the test years the model’s MAE was 0.14 hours higher than the history baseline.

## Observed dark hours by vulnerability

The equity comparison covers all years. It groups 91,134 observed county-events across 1,244 BA events with a 2022 SVI rank. Quartile 4 contains counties above the 75th national percentile. Each county-event has equal weight. The 95% intervals use 2,000 bootstrap samples of whole BA events.

| National SVI quartile | County-events | Mean dark hours | 95% interval (h) |
| --- | --- | --- | --- |
| 1 | 21845 | 1.27 | 0.97–1.59 |
| 2 | 23127 | 2.05 | 1.69–2.46 |
| 3 | 23182 | 2.49 | 1.99–3.12 |
| 4 | 22980 | 3.38 | 2.39–4.64 |

The most vulnerable quartile averaged +2.11 hours relative to the least vulnerable quartile (95% interval 1.15 to 3.29). Within the 712 BA events containing both quartiles, the equal-event mean difference was +0.11 hours (-0.75 to 1.07). These are observed differences. Storm location, event length and reporting coverage can affect them. A single storm can also cause several BA events.

## Reproduction and limits

Run `models/run_all.sh` with the shared data mounted. Each browser model includes 200 Python predictions for comparison with the browser evaluator. The model files store LightGBM’s numeric split trees unchanged.

| Browser model | Trees | Bytes | Maximum tree-walk difference |
| --- | --- | --- | --- |
| warn_grid | 200 | 510974 | 1.4e-16 |
| warn_full | 100 | 296964 | 1.9e-16 |
| dark | 100 | 348862 | 1.4e-14 |

The shared BA prediction file contains 6,338,453 rows. Masked hours have null scores in the labelled period. Post-coverage estimates have no measured outcomes. Eligible training validation rows use out-of-fold predictions. Other training predictions can be in-sample. Held-out rows use the final training fit.

The grid and weather archives may include revisions and reporting delays. EAGLE-I records positive outage reports, so a silent hour can mean either no outage or incomplete reporting. BA boundaries use the 2024 crosswalk across all years. Event attribution uses weighted county shares, while the county model uses only primary assignments. Dark hours end at the BA event boundary. These tests measure retrospective performance and do not establish a live warning service’s reliability.

Machine-readable results include every candidate setting, unrounded scores and additional regression diagnostics. [Warning results](out/warn_results.json) · [County results](out/dark_results.json) · [Export checks](out/export_info.json)
