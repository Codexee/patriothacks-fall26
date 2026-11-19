# Contracts (frozen; coordinator-owned)

Every workstream codes against this file and `app/src/contracts.ts`. Do not change either one in a
workstream branch. If you need a change, stop and report it to the coordinator.

Spec: `.plans/before-during-after-spec.md`.

## Who owns what

| # | Workstream | Owns (edit only these) | Agent |
| --- | --- | --- | --- |
| 0 | Contracts + app shell | `contracts/`, `app/src/contracts.ts`, `app/src/shell/`, `app/src/main.tsx`, `app/package.json`, `app/index.html` | coordinator |
| 1 | Data + export | `data/`, `app/public/data/v1/` (written by `data/build/export_app.py`) | coordinator |
| 2 | Models + evaluation | `models/`, `app/public/models/` | Codex |
| 3 | Map + story mode | `app/src/earth/`, `app/src/story/` | Claude |
| 4 | Brief, evidence, live, browser model | `app/src/brief/`, `app/src/evidence/`, `app/src/live/`, `app/src/model/`, `app/api/` | Claude |

The old Hollow Twin code (`app/src/ui`, `world`, `sim`, `product`, `data`) is frozen. Nobody edits it.
It stays reachable at `#/legacy`.

**Dependencies:** `app/package.json` is coordinator-owned. deck.gl, MapLibre, react-map-gl,
topojson-client and vitest are installed. If you need another package, report it; do not add it.

## Shared data directory (large files, not in git)

`BDA_SHARED` = `/Users/neil/Documents/patriothacks-fall26/data/raw/derived` (absolute; the same for
every worktree on this machine). Read-only for everyone except as listed.

| File | Written by | Content |
| --- | --- | --- |
| `ba_hour_features.parquet` | data | One row per BA per UTC hour: features, `y48`, `in_event`. Columns: see `data/build/features_ba_hour.py` |
| `ba_hour_out.parquet` | data | `ba, hour, out, frac` (share of the BA's customers out) |
| `county_hour_<year>.parquet` | data | `fips, hour, out` (max customers out in the hour) |
| `ba_hour_pred.parquet` | **models** | `ba, hour, p_grid, p_full` for every row of the feature table |
| `county_event_pred.parquet` | **models** | `event_id, fips, pred_dark_hours` |
| `warn_threshold.json` | **models** | `{"p_grid": x, "p_full": y}`: the alert thresholds chosen on the training years |

Small committed inputs: `data/out/events.parquet` (the event library), `data/out/county_ba.parquet`,
`data/out/ba_stations.csv`. Raw inputs for county features: `data/raw/svi/`, `data/raw/empower/`,
`data/raw/eaglei/MCC.csv` (under the main checkout, same absolute root).

## Train/test rule (fixed)

Train on hours before `2021-01-01` UTC. Test on `2021-01-01` and later. Thresholds, features and
hyperparameters are chosen on the training years only (time-ordered folds inside 2015–2020).
Hours with `in_event = true` are not scored.

## Model files: `app/public/models/<name>.json`

Names: `warn_grid` (EIA-930 features only; the live page uses it), `warn_full` (grid + observed
weather; no `fx_` columns unless RESULTS.md shows the gain and labels it), `dark` (county dark hours).

```jsonc
{
  "name": "warn_grid",
  "version": "2026-11-19T02:00Z",
  "objective": "binary",            // "binary" -> sigmoid(sum of leaves); "regression" -> sum of leaves
  "features": ["fc_err", "..."],    // order = feature index in the trees
  "threshold": 0.12,                 // alert when p >= threshold (binary only)
  "trees": [ /* LightGBM booster.dump_model()["tree_info"], unchanged */ ],
  "parity": [ { "x": [0.01, null, ...], "p": 0.0312 } ]   // 200 rows; null = missing
}
```

The TypeScript evaluator (`app/src/model/`) walks `tree_structure` (`split_feature`, `threshold`,
`decision_type` "<=", `default_left`, `missing_type`, `left_child`, `right_child`, `leaf_value`).
A vitest test must reproduce every parity row within 1e-6.

Also from models: `models/RESULTS.md` and `app/public/models/metrics.json` (shape: `Metrics` in
`app/src/contracts.ts`).

## App data: `app/public/data/v1/` (static JSON; also the public API)

Types are in `app/src/contracts.ts`. Load with `fetch(import.meta.env.BASE_URL + 'data/v1/...')`.

| File | Type | Notes |
| --- | --- | --- |
| `counties.json` | `County[]` | 3,142 counties. `level` 1–50 from the SVI percentile (50 = most vulnerable = deepest). `dme` = Medicare users of electricity-dependent equipment |
| `counties-10m.json` | TopoJSON | us-atlas 3.0.1; `objects.counties`, `objects.states`; geometry `id` = FIPS |
| `events.json` | `EventLibrary` | Every event. `stub: true` until the models have run (then `firstAlert`, `leadHours` fill in) |
| `events/<id>.json` | `EventReplay` | Only where `hasReplay`. Hourly. `counties[].out` = percent of customers out, 0–100, one per hour. `risk` is null while `stub` |
| `evidence.csv` | — | `events.json` as CSV |

Real data is already in place for 2015–2019 (the hero is `irma2017`). Texas 2021 and Elliott 2022
arrive when the 2020–2024 files finish; ids and shapes do not change. Find heroes by `hero`
(`texas2021`, `elliott2022`, `irma2017`), never by a hard-coded id.

## Routes (the shell in `app/src/shell/` owns routing)

| Hash route | Page module (default export a React component) | Owner |
| --- | --- | --- |
| `#/` and `#/event/<id>` and `#/?story=<hero>` | `app/src/earth/Page.tsx` | 3 |
| `#/brief/<fips>` | `app/src/brief/Page.tsx` | 4 |
| `#/evidence` | `app/src/evidence/Page.tsx` | 4 |
| `#/live` | `app/src/live/Page.tsx` | 4 |
| `#/legacy` | old Hollow Twin app | frozen |

Pages read the route with `useRoute()` from `app/src/shell/router.ts` and link with `href="#/..."`.
Shared colors and type are CSS variables in `app/src/shell/theme.css`; use them, do not redefine.

## Labels (both names)

Line 1: Earth name ("Harris County, TX"). Line 2, smaller and dimmer: Hollow name ("Level 47").
Use `hollowName(county)` from `app/src/contracts.ts`.

## Change log

- **Nov 18, 10:30 pm (models v2).** Three-way split: TRAIN before 2021, DEV 2021–2022, FINAL TEST 2023–2024.
  New model file `warn_fcst` (with a weather forecast; the backtest uses observed weather, so it is an
  upper bound). `events.json` gains `warnModel` and `warnNote`; `EventRow` gains `leadHoursNoForecast`;
  `EventReplay` gains `warnModel`. `firstAlert`, `leadHours` and the replay `risk` line now come from
  `warn_fcst`. **Wherever a lead time is shown, show `warnNote` near it.** `metrics.json` has extra
  optional keys (`dev`, `importance`, `split`); `models` holds FINAL TEST results.
- **Nov 18, 11:15 pm.** `EventReplay` gains `firstAlertIndex` and `alertInputs` (plain-language model
  inputs at the first alert hour: label, unit, value; these are observed input values, not SHAP).
  New route `#/hollow` and `#/hollow/<event id>` → `app/src/earth/Page.tsx` (workstream 3 owns the
  cross-section view inside `app/src/earth/`).
- **Nov 19, 1:00 am.** New file `data/v1/ba_records.json` (`BaRecords` in `app/src/contracts.ts`): each
  area's demand records, so the live page can compute `demand_vs_record`, `demand_vs_month_record` and
  the `fc12_vs_*` features from a 7-day window. Deploy: Vercel project root = `app/` (see `app/vercel.json`).
