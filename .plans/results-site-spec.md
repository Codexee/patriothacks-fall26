# Results site — Master Spec
Status: locked   ·   Last updated: 2026-11-19   ·   Owner: Neil

## One-liner
The product is our statistical models and their measured results. The website shows how they save the Hollow across 7 disasters, with and without, on held-out seeds with 95% intervals. The cutaway simulation becomes a "Watch it run" demo page.

## The winning demo (30-second scene)
1. The landing page opens on one number: "Across 7 disasters and 10 held-out seeds, Blackout Warning cut deaths from X to Y (95% interval …)."
2. Below it, a disaster-by-disaster comparison. Each row is a real-shaped disaster (Cascade from ERCOT 2021, Winter Storm Elliott 2022, …), with without/with deaths, plant trips and stable share, and a small line chart.
3. The judge clicks a disaster: the cumulative-deaths chart, the real data behind it, and a "Watch it run" button that opens the cutaway on that disaster.
4. The model section: the residents-only check-first model, trained on real US outages 2015–2020 and tested once on 2023–2024. Its score beats the history baseline and chance. A plain list of its inputs, each with what residents would use in the Hollow.
5. Line: *"Two models, real data, tested on data they never saw. The simulation is only how we show it."*

## Decisions (Neil, Nov 19)
| Decision | Answer |
| --- | --- |
| Main | `hollow` became `main` by merge (old main tagged `archive/earth-main`); `models/` and `data/` brought over |
| Model product | Retrain Neil's LightGBM check-first model on residents-only inputs (no weather, no grid-operator data); test once on 2023–2024 |
| Disasters | Keep Cascade, Baseline, Aging, Crowding; add 3 plant-loss shapes from other real grid failures (EIA-930) |
| Landing | Results first; the cutaway is the "Watch it run" page |
| Style | Less game-like: a clean results report (charts, tables, sources), dark theme allowed |

## Contract
`prototypes/hollow-twin-poc/src/site/contracts.ts`: `ScenariosFile` (`public/results/scenarios.json`) and `CheckFirstFile` (`public/results/checkfirst.json`).

## Workstreams
| # | Workstream | Files/dirs owned | Done when |
| --- | --- | --- | --- |
| A | 3 new disasters + results export | `scripts/build_grid.py`, `src/data/real/grid.ts`, `src/data/*.ts` scenario files, `src/sim/results.ts`, `package.json` script `results`, `public/results/scenarios.json` | 7 scenarios; `npm run results` writes the file on test seeds 11–20 with intervals and daily series |
| B | Residents-only model | `models/` (new files only; do not change v2 results), `public/results/checkfirst.json` | Model trained on TRAIN, chosen on DEV, tested once on FINAL TEST; JSON written; `models/RESULTS_RESIDENTS.md` |
| C | Results site | `src/main.tsx`, `src/site/` (except `contracts.ts`), `index.html` | `#/` results page, `#/disaster/<id>`, `#/model`, `#/demo` (the existing App); reads both JSON files; works at 375 px; no console errors |
| D | Integrate (lead) | docs, `CHANGELOG.md`, `ideation/decisions.md`, `AGENTS.md` | merged to `main`, verified in the browser, pushed |

## Non-goals
- No change to Blackout Warning's rules or constants (frozen by the gate).
- No change to the cutaway's look.
- No weather input for residents.

## Open questions
- Deploy needs a Vercel account (Neil's or Adarsh's).
