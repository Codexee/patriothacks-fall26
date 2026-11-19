# integrateEarthIntoRebuild

Nov 19, 2026 · Adarsh

## Summary

We can use Neil's Earth work in hollow-rebuild, but not his warning model. His **data** can shape the hidden world, and his **testing method** can tune and prove our Blackout Warning. His model's inputs (weather and grid-operator data) are things residents of the Hollow do not have.

Every change in this plan follows two rules:

1. **No invented inputs.** The Residents' System uses only what the track brief gives residents, or what our app itself collects and shows as part of the solution. If a resident doesn't have it, the system doesn't have it.
2. **Never worse.** A change to Blackout Warning stays only if deaths, plant trips and the warned share are no worse than the current version, on scenarios it was not tuned on.

## Background

|  | Before, During, After (Neil, `app/`) | hollow-rebuild (Adarsh, `prototype/hollow-twin-rebuild`) |
| --- | --- | --- |
| What it is | A real-world tool for county emergency offices | A Residents' System inside a simulated Hollow |
| Screen | 3D US county map; the Hollow is the opening and the labels | The Hollow: 50 levels × 8 sections (400 cells) |
| Data | 1,477 real US outages (2015–2024): EAGLE-I county outages, EIA-930 grid data, NOAA weather, CDC SVI, HHS emPOWER | A test world that keeps the hidden truth; the Residents' System sees only what residents report |
| Core feature | (1) 48 h grid-emergency warning; (2) which counties stay dark longest, and who there depends on powered medical equipment | Blackout Warning (problem #1): predicts which levels go dark and asks residents to save power |
| How it is tested | Trained on 2015–2020, tuned on 2021–2022, tested once on 2023–2024 with everything frozen; then retested on real archived 2024 weather forecasts | 5 hand-made scenarios (Texas seeds, Chicago, baseline); constants are first guesses |
| Best result | With a weather forecast: 51% of 2024 events warned 12 h ahead, about 11 false alarms per area per year. Without one: 13% | Residents' data only (Step 1d): Texas seed 1, 1,260 deaths against 637,782 without; 75% of blackout hours warned |

Neil's rationale: another team already ships a 3D Hollow simulation with no real data, and no team trains on real disasters. He bet on credibility over on-world storytelling. This plan tries to get both.

## What fits and what doesn't

The brief names three causes of blackouts: aging geothermal plants (#3), too many people for a Hollow "dug for millions" (#6), and the Directorate deciding who keeps the lights (#2). It never mentions weather, storms, or grid data that residents can see. Each piece of Neil's work is checked against that below.

| Piece of Neil's work | In the brief? | Verdict | Why |
| --- | --- | --- | --- |
| Weather and weather forecasts | No | Does not fit | Power is geothermal; heat comes from depth and aging plants. A surface exists (#13), but nothing ties its weather to power. Neil's best result (51%) depends on it. |
| Grid-operator data (demand vs forecast, generation by fuel, power traded with neighbors) | No | Does not fit | The Directorate runs the plants and its public numbers "don't match what people see." Nothing says residents get grid figures. |
| Neil's 1,477 events used as "storms" | No | Does not fit as storms | Most were caused by hurricanes, ice storms and heat waves. Calling them Hollow storms imports weather. |
| Hour of day | Yes, residents have clocks | Fits | |
| Past outage history (who went dark, when, for how long) | Yes: blackouts "hit the deep levels first" and "last for days" | Fits | Residents live through them; our app collects outage reports (#1, #7). |
| Population and crowding | Yes (#6) | Fits | Our app's head count. |
| Vulnerability by depth (CDC SVI) | Yes: "deep levels are darker, hotter and sicker" | Fits, in the hidden world | It shapes the world, not the system's inputs. |
| People on powered medical equipment (HHS emPOWER) | Implied by #10 (care for those who can't reach it) | Fits | Residents can tell our app if someone in their room depends on power. |
| The train / tune / test-once method | Not an input | Fits | It is how we test, not something residents use. |
| Neil's "demand above the record" rule | Not as written | Fits, translated | Residents can't see grid demand, but our app can estimate supply from the blackout line and demand from the head count. |

A note on our own test world: it has "a storm that cuts supply," which the brief does not support either. See Open decisions.

## How to integrate

Build in this order. Step 0 comes first because it is what makes "never worse" checkable.

### Step 0: a regression gate, using Neil's method

- Split the sim's scenarios and seeds into three sets: **tune** (set constants), **check** (catch mistakes), **test** (run once, frozen, at the end).
- Tune the guessed constants in `src/product/earlyWarning.ts`: `SAFE_LOAD` (0.88), `TRIP_STEP` (+0.15), `ASSUMED_COMPLIANCE` (0.85), `MAX_TREND` (0.1).
- Keep a change only if deaths, trips and the warned share are no worse on the check set.
- Compare old module vs new module on the **same world**. If the world changes, every number moves, so world changes are compared separately.
- **Fixes:** the "thresholds are first guesses" limit in `REBUILD.md`.

### Step 1: a "record line" warning (from Neil's strongest simple rule)

- **Neil's rule:** warn when tomorrow's demand is above the highest the grid handled this month. On Earth it warned 11 of 17 Texas-type events at about 1.3 false alarms per area per year.
- **Hollow version:** Blackout Warning already estimates supply from where the blackout line falls. It also keeps a **record**: the most power the plants carried without a blackout. When the residents' head count pushes demand past that record, it warns before anything goes dark.
- **Inputs:** outage reports and the head count, both collected by our app.
- **Fixes:** "the first trips happen unwarned."
- **Catch:** it needs history, so the app must run in calm weeks before the crisis. The sim needs a warm-up period.

### Step 2: "who to check first" (from Neil's who-stays-dark model)

- Each section's count of people on life-support equipment becomes a hidden fact of the world. Residents tell our app if someone in their room depends on power, just like the head count.
- When a blackout can't be avoided, warnings go first to the sections with the most life-support residents, and the app raises a check-on-neighbors list.
- **Performance:** fewer deaths in the blackouts that still happen. Our own results showed warnings cut deaths most in those blackouts.
- **Coverage:** adds problems #8 (reconnect families) and #10 (care), which helps the "covers several problems" criterion.

### Step 3: a smarter way to ease the save-power request

- Today the request ratchets up to 90% and never comes down, because residents can't see when the plants recover.
- With the record from Step 1, ease off slowly when demand stays well under the record, and tighten again at the first dark report.
- **Only if the gate agrees.** Easing off once failed badly (about 90 trips, 29,190 deaths in Texas seed 1).

### Step 4: real counties shape the levels (world realism; the module is unchanged)

- Sort all 3,142 US counties by vulnerability (SVI) and medical need (emPOWER) into the 400 sections: best-off at the top, worst-off at the bottom.
- Each section's hidden people, life-support count and census undercount come from its real counties.
- The Residents' System still sees only reports and head counts.
- **Gain:** "the deep levels are sicker and more fragile" becomes real data instead of an assumption, and gives the video its reveal: every room is a real place.
- **Data:** `app/public/data/v1/counties.json` (in git) has population, SVI, customers and emPOWER counts for every county.

## What we leave out

- **Neil's warning model inside Blackout Warning.** Its inputs are weather and grid-operator data, which residents don't have. Without weather it warned 13% of events, so even its legal part adds little.
- **Neil's events as Hollow storms.** Most were weather-driven. If we use them at all, it is only as shapes of power shortfalls (how deep, how long, how fast they recover), and only if the team agrees that is honest.
- **Earth history as a direct input to the module.** The residents' own outage history is the in-world source, and it is a better fit.
- **A new model trained on outage reports only.** It would be legal under rule 1, but it needs Neil's 12 GB of raw EAGLE-I data (on his Mac only) and a full training round. Not realistic before Fri.

## Open decisions and next steps

Open decisions for the team:

- [ ] **Replace the test world's storm?** The brief's causes are aging plants, crowding and the Directorate. Replacing the storm is more honest, and Step 1 likely works better against crowding than sudden storms, but every baseline number changes.
- [ ] **Level sort:** SVI + medical need (no outage history, so "deep levels go dark longer" is never true by construction), or SVI only (matches Neil's existing county levels)?
- [ ] **Neil's events as shortfall shapes:** use them, or leave them out entirely?
- [ ] **Which screen leads the video:** hollow-rebuild with Neil's evidence pages as proof, or Neil's map with the Hollow inside? Needs Neil's agreement.

Next steps:

1. Agree on the open decisions at the sync (Adarsh runs `/interview` to settle them).
2. Build Step 0 (the gate) in `prototypes/hollow-twin-poc/src/sim/cli.ts` on `prototype/hollow-twin-rebuild`.
3. Build Steps 1 and 2, each kept only if the gate passes.
4. Step 3 and Step 4 only if time allows before Fri 2:00 pm.
