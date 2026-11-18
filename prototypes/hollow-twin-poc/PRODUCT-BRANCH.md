# Branch `prototype/hollow-twin-product` (PROTOTYPE)

This branch implements `ideation/hollow-twin-product-proposal.md` (on `main`) on top of Neil's `prototype/hollow-twin-poc` (commit `88c2dcd`). Neil's branch is unchanged.

**The question it answers:** can the 4 tools be real software that reads only what residents could know, and still save the Hollow? **Answer: yes.**

## What changed

- **`src/sim/engine.ts` is now the test world.** The 4 `if (tools.x)` branches are gone. The engine
  1. produces **observations** (`SimState.observations`): noisy plant and switchyard meters, 2 sensor boxes per level, resident reports (including false ones), clinic counts, a census, the Directorate's bulletin with its public case count, and a public weather and grid outlook with error;
  2. applies **outputs**: alerts (`shed`, `boilWater`, `isolateSick`, followed in proportion to the residents' trust in the system), a power plan, published findings (they end a lie's 14-day delay only if the problem is real; a wrong finding costs trust), and repair crews (2 days).
- **`src/product/`** is the residents' system. It never reads `SimState.internal`.
  - `earlyWarning.ts`: per-plant trend from the meters × the public outlook → shortfall forecast → load-shedding alert.
  - `fairShare.ts`: weighted max-min plan from the census, planned for the daily peak with a 12% margin; life support and farms first; more cooling for hot levels.
  - `ledger.ts`: Plant 3's share against its baseline; Truthcount (estimated cases from cough reports and clinics, compared with the official count); a hash chain of findings.
  - `snow.ts`: complaint rate and tap readings per recycler service area → boil-water alert to those levels only + repair crew.
  - `run.ts`: one day = system reads yesterday's observations → outputs → sim applies them.
- **"Stable Hollow"** now follows the spec: power margin ≥ 0 (no unplanned shortfall), wet-bulb < 31 °C, CO₂ < 1,500, food not falling, infections falling. The old test (power ≥ 95% in every section) could never hold while residents ration power on purpose. For a run with no modules, it is the same test.
- **UI:** a new "Residents' system" column (a resident's phone + the council console), World events buttons (break a recycler, trip a plant, start an outbreak), a report box, the seed under "Advanced / replay", and a second trust bar.

## Results (`npm run sim`, Texas 2021, seed 1)

| Modules | Result | Deaths |
| --- | --- | --- |
| None | Lost, day 16 | 709,868 |
| Fair Share | Stable, day 33 | 208,580 |
| Early Warning + Fair Share | Stable, day 33 | 19,050 |
| All 4 | Stable, day 21 | 2,035 |

All 4 modules were stable in every case tested (Texas seeds 1, 2, 7; Chicago seeds 1, 3; baseline), with 481–7,254 deaths. With no modules, every case was lost (633,000–726,000 deaths). Attribution (Texas, seed 1): Fair Share +664,233 lives, Early Warning +27,820, Ledger +9,496, Snow +6,284.

## Honest limits

- Early Warning alone ends with more total deaths than no modules (it survives longer, but its alerts still go through the Directorate's "upper levels first").
- Snow keeps warning about a repaired recycler for about 2 days (its complaint window is 2 days).
- The residents' system starts with one day of history before the scenario (it was already running).
- All thresholds are first guesses, not tuned.

Run it: `npm install`, then `npm run dev` (UI) or `npm run sim -- texas2021 1 --checks` (CLI with determinism and purity checks).
