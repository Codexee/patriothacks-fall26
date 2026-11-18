# Branch `prototype/hollow-twin-product` (PROTOTYPE)

This branch implements `ideation/hollow-twin-product-proposal.md` (on `main`) on top of Neil's `prototype/hollow-twin-poc` (commit `88c2dcd`). Neil's branch is unchanged.

**The question it answers:** can the tools be real software that reads only what residents could know, and still save the Hollow? **Answer: yes.**

## The idea in one line

The sim is the **test world** (it keeps the hidden truth). The **residents' system** (`src/product/`) is the product: 9 modules that read only noisy observations and send outputs. The world applies the outputs and measures the result, so every result is earned.

## Modules and the track's problems

On screen each module has a plain name after the problem it solves (`src/product/names.ts`). The code keys in brackets are the internal names.

| Module | Problem | Reads (observations only) | Does |
| --- | --- | --- | --- |
| Blackout Warning (`earlyWarning`) | 1 | Plant feeder meters, public weather/grid outlook, census | Forecasts each plant (its own health trend × the outlook) against demand 36 h ahead; asks for load shedding before plants trip |
| Fair Rationing (`fairShare`) | 2 | Census, forecast, sensor heat | Plans power for the daily peak with a 12% margin: life support and farms first, the same share for everyone, more cooling for hot levels |
| Truth Check (`ledger`, includes the real outbreak count) | 9 (and publishes for 4, 13) | Plant meters, cough reports, clinics, bulletin | Catches Plant 3 failing; estimates real cases against the official count; hash-chained findings that expose lies |
| Water Safety (`snow`) | 4 | Water complaints, tap sensors | Traces bad water to the recycler; boil alerts to its levels only; repair crew |
| **Off-Network Messaging** (`lantern`) | **7** | Sensor power per level | Places battery relays so the phone mesh still reaches every level when the Directorate cuts the network |
| **Family Check-In** (`kin`) | **8** | Family check-ins per section | Finds sections whose families went quiet; sends neighbors (welfare checks cut deaths there by 25% for a day) |
| **Cooling** (`layout`) | **3** | Sensor wet-bulb per level, fan locations | Moves fans from cool upper levels to the hottest levels (2 crews a day) |
| **Food Sharing** (`larder`) | **12, 2** | Census food stores | Food runway per level; carries food from surplus levels; builds grow-lamp farms where food runs out |
| **Surface Truth** (`witness`) | **13** | Signed surface probe readings | Rejects unsigned devices, takes the median of the council's probes, broadcasts the verified answer, and publishes it (exposes "the air kills in minutes") |

## The world (what the sim adds for these problems)

- **Network (7, 8):** when a published finding exposes a lie, the Directorate cuts the network the next day for 48 h (or press "Cut network"). While it is cut, outputs reach and data come from only the sections the Lantern mesh reaches. A phone mesh passes through sections with life-support power or a battery relay.
- **Families (8):** 1 family per 40 residents checks in daily; distress (heat, bad air, sickness, blackout) lowers check-ins. With the network cut, only Kin over Lantern gets through.
- **Heat (3):** each powered fan now also cools its section by 0.7 °C wet-bulb.
- **Food (12):** on day 12 the Directorate diverts the farms of levels 40–50 (they feed their neighborhood at 30%). Residents' grow-lamp farms are not diverted.
- **Surface (13):** the truth is toxicity 2.2 (survivable for about 2 h with a mask). The Directorate says "kills in minutes"; a rumor says "healed". Rumor believers try the way up and die. A correct verified verdict that reaches residents shrinks the rumor by up to 40% a day.

## Results (`npm run sim`, deaths)

| Run | Texas s1 | Texas s2 | Texas s7 | Chicago s1 | Chicago s3 | Baseline s1 |
| --- | --- | --- | --- | --- | --- | --- |
| No modules (all lost) | 710,107 | 710,237 | 725,997 | 704,460 | 678,956 | 632,354 |
| First 4 modules | 461,523 | 409,814 | 466,083 | 506,515 | 528,462 | 391,575 |
| **All 9 (all stable)** | **3,452** | **16,251** | **6,286** | **609** | **3,095** | **511** |

Texas seed 1, all 9 minus one: Lantern 422,635 · Larder 314,196 · Witness 4,609 (906 climbers vs 29) · Kin 3,796 · Layout 3,492.

Determinism and purity checks pass (`npm run sim -- texas2021 1 --checks`).

## Honest limits

- The first 4 modules alone do much worse than before, because the world is now harder (network cuts, farm diversion). That is the point of the other 5, but say it in the pitch.
- Exposing a lie has a cost: the Directorate retaliates with a network cut. In Texas seed 2, Witness exposes a lie earlier, the cut lands on the worst storm days, and all 9 modules lose more people (16,251) than all 9 without Witness (10,020). This is a real trade-off of the model, not a bug.
- Layout and Kin save few lives in these scenarios (they matter most in heat and blackouts).
- Attribution with 9 modules is an estimate (6 sampled orderings, about 50 runs), not exact Shapley.
- Water quantity is not modeled; "fair sharing" covers power (Fair Share) and food (Larder).
- Problems 5, 6, 10, 11, 14 and 15 are not built (design sheets in `ideation/projects-1-15.md` on `main`).
- All thresholds are first guesses, not tuned.

Run it: `npm install`, then `npm run dev` (UI) or `npm run sim -- texas2021 1 --checks` (CLI).
