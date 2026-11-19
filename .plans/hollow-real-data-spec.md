# Hollow real data — Master Spec
Status: locked   ·   Last updated: 2026-11-19   ·   Owner: Neil

## One-liner
Replace the guessed numbers in the Hollow test world (`prototypes/hollow-twin-poc`) with real US data. Blackout Warning keeps the same rules and still reads only residents' reports. We retune its 4 constants through a tune / check / test gate.

## The winning demo (30-second scene)
1. The Hollow cutaway runs the **Cascade** scenario. Plant 2 goes offline. Its lost output follows the real shape of the ERCOT generation loss of Feb 15–18, 2021, with no storm and no demand surge.
2. The judge hovers over a deep section: "Built from 8 real counties, for example Starr County, TX (SVI 0.99). 412 residents here depend on powered medical equipment (HHS emPOWER)."
3. The judge hovers over a plant: "Repair time: real EAGLE-I restoration times, median 14 h." (Example value. The real figure comes from workstream 2.)
4. Compare: without the module, X deaths. With Blackout Warning, Y deaths. Its constants were tuned on seeds it was never tested on.

Line for the judges: *"Every number in this world comes from a real place or a real failure. The residents' system never sees it."*

## Problem, user, and why now
- Judges can say that we wrote both the world and the module, and that the world's numbers are guesses (REBUILD.md says "first guesses"). Real data and a held-out test answer that.
- Adarsh's proposal (`docs/integrateEarthIntoRebuild.md` on `main`) keeps Neil's data and Neil's test method and drops Neil's weather model. This spec follows it.

## Track fit
Problem 1 (power and air) now. The county data also prepares problems 6 (crowding) and 10 (care) for later modules.

## Scope

### Must ship (demo path, tonight)
1. **Gate:** `npm run gate` runs every scenario on fixed seed sets: tune = seeds 1–5, check = seeds 6–10, test = seeds 11–20 (run once, at the end). It prints deaths, plant trips and the warned share for each set, with and without the module. Determinism and purity checks still pass.
2. **New scenarios, no storms:** Baseline, Aging, Crowding, Cascade. Texas 2021 and Chicago 1995 are removed from the list (the files stay in git history).
3. **Real grid curves (EIA-930):** the everyday hourly and weekly demand cycle comes from calm ERCOT days. The Cascade scenario's plant-loss shape comes from the ERCOT generation loss of Feb 2021, applied to 1 plant, with normal demand.
4. **Real outage shapes (EAGLE-I):** plant repair times after a trip, and how fast power returns, come from the distribution of real restoration times.
5. **Retune:** the 4 Blackout Warning constants (`SAFE_LOAD`, `TRIP_STEP`, `ASSUMED_COMPLIANCE`, `MAX_TREND`) are tuned on the tune set, kept only if the check set is no worse, then run once on the test set.

### Nice to have (built in parallel; cut if not green tonight)
6. **Real counties as sections:** the 3,142 counties, sorted by SVI (CDC Social Vulnerability Index) into the 50 levels as in `counties.json`. Each section gets its population share, its count of power-dependent residents (emPOWER) and its growth rate (Census 2020–2024). Hover shows the top counties.
7. **Cited constants:** the air and response constants (`AIR_DANGER`, `AIR_DEATH`, `PREPARED_SAVE`, `VOL_PER_PERSON`, follow rate) get published values. Each one shows its source in the info icon.

### Explicit non-goals
- No new module rules (no record line, no check-first list). Those come in a later pass.
- No weather input anywhere. No grid-operator data for residents.
- No changes to problems that `WORLD` switches off.
- No Codex, no Paradev. Claude agents in Claude Desktop do all of the work.

## Architecture
```
data/raw (Neil's Mac, main checkout)          prototypes/hollow-twin-poc
 ├ eia930/*.csv  ──► scripts/build_grid.py    ──► src/data/real/grid.json
 ├ eaglei/*.csv  ──► scripts/build_outages.py ──► src/data/real/outages.json
 ├ census, svi, empower + app counties.json
 │               ──► scripts/build_sections.py──► src/data/real/sections.json
 └ (papers)      ──► (hand-written)           ──► src/data/real/airParams.ts
                                                     │
 src/data/real/index.ts (typed loaders, fallbacks) ◄─┘
        │
 src/sim/engine.ts reads: scenario curves, plant repair times, section people/growth, air constants
        │
 src/product/earlyWarning.ts (unchanged rules; retuned constants)   src/sim/gate.ts (npm run gate)
```
- Python scripts run with `uv run` from the main checkout's `data/` environment (pandas and pyarrow are installed there). They take the raw-data path as an argument. Their output JSON is committed, so the app needs no raw data and no network.
- Every JSON file holds a `source` block: dataset, URL, date range and the transform used.
- If a JSON file is missing, `src/data/real/index.ts` returns today's guessed values, so the sim always runs.

## Data & seeding plan
| Data | Raw input | Output | Transform |
| --- | --- | --- | --- |
| Demand cycle | EIA-930 BALANCE, ERCOT, calm weeks of 2023 | `grid.json.demandWeek` (168 hourly multipliers, mean 1) | demand ÷ weekly mean |
| Cascade shape | EIA-930 ERCOT net generation, Feb 10–24, 2021 | `grid.json.cascadeLoss` (hourly share of 1 plant lost, 0..1) | (normal gen − gen) ÷ peak loss |
| Repair times | EAGLE-I 2015–2024 outage events | `outages.json` (restoration-hours quantiles, sample list) | event start to 90% restored |
| Trip rate | EAGLE-I large events per area per year | `outages.json.tripsPerYear` | count ÷ years ÷ areas |
| Sections | `counties.json`, Census co-est2024, emPOWER | `sections.json` (400 rows) | SVI order → level; split each level into 8 sections |
| Air constants | OSHA / NIOSH CO₂ limits, published studies | `airParams.ts` | hand-entered, each with citation |

**Time compression (default, must be labelled on screen):** real aging and real growth are slow (a few % a year). The Aging and Crowding scenarios compress 4 real years into the 120-day run and say so: "4 years of real county growth, played in 120 days".

## UI / UX direction
- Scenario list: Baseline, Aging, Crowding, Cascade. Each has a one-line summary and its source.
- Hover cards and info icons show the source of each real number. No other layout change.

## Workstreams
| # | Workstream | Owner | Files/dirs owned | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| 0 | Contracts + gate | Neil's Claude (lead) | `src/sim/engine.ts`, `src/sim/types.ts`, `src/sim/cli.ts`, `src/sim/gate.ts`, `src/data/real/index.ts`, `package.json` | — | Engine reads `src/data/real/*` through typed loaders with fallbacks; `npm run gate` prints the 3 sets; checks pass; results equal today's with no JSON present |
| 1 | Grid curves + scenarios | agent A | `scripts/build_grid.py`, `src/data/real/grid.json`, `src/data/*.ts` scenario files and `src/data/index.ts` | 0 | 4 scenarios in the list; Cascade uses the real ERCOT shape; sources in each scenario |
| 2 | Outage shapes | agent B | `scripts/build_outages.py`, `src/data/real/outages.json` | 0 | Repair times and trip rate come from EAGLE-I; values and method in the JSON |
| 3 | Counties → sections | agent C | `scripts/build_sections.py`, `src/data/real/sections.json`, `src/ui/HoverCard.tsx` | 0 | 400 sections from real counties; hover shows top counties; Crowding uses their growth rates |
| 4 | Cited constants | agent D | `src/data/real/airParams.ts`, `src/ui/Info.tsx` text only | 0 | Each listed constant has a value and a citation; info icons show them |
| 5 | Integrate + retune | Neil's Claude (lead) | `src/product/earlyWarning.ts` constants, `REBUILD.md`, `CHANGELOG.md`, `ideation/decisions.md` | 1–4 | Gate: tune → check → test once; new tables in REBUILD.md; pushed to `hollow` |

## Risks & fallbacks
- **Real data makes results worse.** That is a valid result. We report it, with the cause. The gate decides only the module's constants, not whether the data stays.
- **EAGLE-I reads are slow (9.5 GB).** Use the derived `county_hour_*.parquet` files first.
- **A nice-to-have is not green tonight.** Do not merge it. The fallbacks keep the guessed values.
- **Adarsh pushes to `hollow` at the same time.** Run `git pull --rebase` before each push. Do not edit files outside this table.

## Demo script & pitch beats
1. "This is the Hollow." Cascade scenario, Plant 2 offline.
2. Hover a deep section: real counties, real power-dependent residents.
3. Compare with and without Blackout Warning. Say that the test seeds were never used for tuning.
4. Limits to say: time compression; one plant-loss shape is from one real event; the module still cannot warn the first blackout.

## Decisions made in this interview
| Decision | Answer | Whose |
| --- | --- | --- |
| Product | Earth map abandoned; Adarsh's Hollow (branch `hollow`) is the project | Neil |
| Data scope | Grid curves, counties, outage shapes, cited constants | Neil |
| Storms | Removed; failures come from aging, crowding and plant loss | Neil |
| Gate | Built first; tune 1–5, check 6–10, test 11–20 | Neil (seed split: Claude default) |
| Branch | Commit straight to `hollow` | Neil |
| Grid curves | Normal demand cycle + real plant-loss shape | Neil |
| Scenarios | Baseline, Aging, Crowding, Cascade | Neil |
| Level sort | SVI only | Neil |
| Module | Data only, then retune | Neil |
| Builder | Claude agents in Claude Desktop; no Codex, no Paradev | Neil |
| County names | Hover only | Neil |
| Time box | Tonight; counties and constants are nice-to-have | Neil |
| Time compression | 4 real years in 120 days, labelled | Claude default |
| Data reads | Python with `uv`, output JSON committed | Claude default |

## Open questions
- Is the 4-years-in-120-days compression acceptable to Adarsh? It is labelled, but a judge can question it.
- Does Adarsh agree to remove Texas and Chicago from the list? His headline numbers use Texas seed 1.
