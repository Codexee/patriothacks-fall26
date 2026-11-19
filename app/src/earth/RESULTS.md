# Early Warning on Earth

The unchanged Early Warning module gives **39.42 hours of warning in the tuned, ideal meter replay**. With EIA publication delays, the same settings alert **32.58 hours after** the emergency order. This result does not establish advance warning from the public EIA feed.

The reference is ERCOT's EEA3/load-shed order at **2021-02-15 07:25 UTC**, or 01:25 CST. Positive lead means before the order. The replay covers Feb 8–22 inclusive, with 360 hour endings.

| Adapter and access | First alert UTC | Lead hours | Alert hours / eligible hours |
| --- | --- | ---: | ---: |
| Untuned, ideal meters | Feb 8, 23:00 | 152.4167 | 332 / 337 |
| Tuned, ideal meters | Feb 13, 16:00 | 39.4167 | 48 / 337 |
| Untuned, public EIA delays | Feb 9, 16:00 | 135.4167 | 320 / 320 |
| Tuned, public EIA delays | Feb 16, 16:00 | -32.5833 | 72 / 320 |

The baseline was run and saved in `untuned-results.json` before calibration. Its near-continuous alerts make its long lead misleading.

Calibration tested 54 fixed adapter settings on Texas 2021 alone. It rejected alerts more than 72 hours before EEA3, then chose the largest positive lead. The selected settings multiply the trailing six-hour generation peak by **1.5**. The multiplier assumes spare capacity; EIA does not measure that capacity here. The module's thresholds, regression and 36-hour horizon remain unchanged.

The following results use those settings unchanged. No Elliott or 2019–2020 value enters calibration.

| Frozen-settings check | Ideal meters: first alert UTC; episodes | Public delay: first alert UTC; episodes |
| --- | --- | --- |
| Elliott, TVA | Dec 22, 2022 09:00; 3 | Dec 23, 2022 16:00; 2 |
| Elliott, DUK | Dec 22, 2022 11:00; 4 | Dec 26, 2022 16:00; 1 |
| ERCOT 2019–2020 | 594 episodes; **24.75/month** | 4 episodes; **0.1667/month** |

Hold-out alert-hour fractions are **28.59%** with ideal meters and **0.55%** with public delays. Every hold-out episode is counted as a false/unverified alarm because no emergency labels were supplied. Some could coincide with real stress. Consecutive alert hours count as one episode; month boundaries do not reset it. `results.json` includes all 24 monthly counts, episode starts and alert-hour totals.

The adapter maps aggregate generation, demand and forecasts into `plantMeter`, `feeder`, `outlook` and `census` observations. The existing `stepProduct` runner evaluates them hourly. Public-delay runs receive meter batches when published. Only Early Warning is enabled. Fuel groups are retained in the data pack but are not treated as individual plants. The 25% critical-demand share affects the requested reduction, not the alert trigger.

Ideal access assumes immediate meters and prior-day 11 a.m. Eastern access to day-ahead forecasts. Public access withholds generation until 11 a.m. Eastern after its operating day and forecasts until 11 a.m. on their target day. EIA documents those [publication delays and hour-ending timestamps](https://www.eia.gov/electricity/930-content/about.html). Revised historical values cannot reconstruct original releases. Delayed meters also shorten the useful part of the module's forecast horizon.

Net generation is dispatched output, not available capacity. Measured demand excludes disconnected load. TVA and DUK also depend on imports. These limits and the hold-out alarm rate prevent a general prediction claim. The data reductions, licenses and API-to-CSV fallback are documented in [data/EARTH.md](../../../data/EARTH.md) and [sources.json](../../../data/sources.json).

Run offline with `cd app && npm run earth`. Add `-- --checks` for causal-data and missing-hour checks, or `-- --write` to regenerate `results.json`. No product or sim changes were needed. A future public-feed model should account directly for delayed measurements and measured capacity/imports; that change is outside this task.
