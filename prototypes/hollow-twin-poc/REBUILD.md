# Branch `prototype/hollow-twin-rebuild` (PROTOTYPE): one problem at a time

Built from `prototype/hollow-twin-product` (commit `09b1638`), which is unchanged. This branch rebuilds the
Residents' System step by step: each step switches on one of the track's 15 problems in the test world, and adds
the one feature that answers it.

- **World switches:** `WORLD` at the top of `src/sim/engine.ts`. Step 1 turns on only `power` and `air`.
- **Features built:** `BUILT` and `PROBLEMS` in `src/product/names.ts` (the progress dots on screen).
- The other 8 features from the product branch were removed here; their code is still on `prototype/hollow-twin-product`.

## Step 1 — Problem #1: warn people before the power or air cuts out

**The world:** plants that age (Plant 3 wears out fast), a storm that cuts supply and raises demand, plants that trip
when overloaded (and push their load onto the others), the Directorate's "upper levels first" rationing, and fans that
need power, so air goes bad in a blackout. No heat, sickness, water, food, lies, network cuts, families or surface.

**The feature, Blackout Warning** (`src/product/earlyWarning.ts`), from observations only:
1. Forecasts plant output 36 h ahead: each plant's own health trend (its feeder meter) × the public weather and grid outlook.
2. Forecasts demand: the section census × the outlook's demand curve.
3. Predicts who goes dark and when, by replaying the Directorate's public rule (upper levels first) on the forecast.
4. Warns those levels ahead ("blackout on levels 46–47 in about 15 h, around 15:00, for about 6 h; air unsafe about N h after").
5. If the plants will run near their limit, asks everyone to switch off non-essential load, so the plants do not trip.
6. If even that is not enough, warns every level that a blackout of the whole Hollow is possible.
7. Warns levels whose air-and-fans circuit was off yesterday (from the sensor boxes).

A section counts as dark only when its life support (air, fans) loses power. Saving non-essential power dims the
lights; it is not a blackout.

**Results** (`npm run sim -- <scenario> <seed>`):

| Scenario | Without | With Blackout Warning |
| --- | --- | --- |
| Texas, seed 1 | not stable in 120 days, 637,782 deaths | stable day 23, 1,167 deaths, 100% of blackout hours warned |
| Texas, seed 2 | not stable, 565,107 | stable day 24, 1,468, 3% warned |
| Texas, seed 7 | not stable, 624,054 | stable day 21, 0 (no blackouts) |
| Chicago 1995 | not stable, 345,945 | stable day 14, 0 (no blackouts) |
| Baseline | not stable, 344,666 | stable day 14, 0 (no blackouts) |

### Step 1b: the Directorate's census undercounts (Nov 19)

The brief: 2 billion people, and the Directorate's numbers "don't match what people see". The census now misses a
share of residents that grows with depth (0% on level 1, 30% on level 50: our assumption). It reports 1.65 billion; the
real population is 2.00 billion (18% not counted). Only the test world's Hidden truth shows the real number. Blackout
Warning still trusts the census, so it under-forecasts demand on the deep levels:

| Scenario | Without | With (true census, before) | With (Directorate census, now) |
| --- | --- | --- | --- |
| Texas, seed 1 | 637,782 | 1,167, stable day 23, 100% warned | 79,993, never stable, 44% warned |
| Texas, seed 2 | 565,107 | 1,468, stable day 24, 3% warned | 80,651, never stable, 35% warned |
| Texas, seed 7 | 624,054 | 0, stable day 21 | 64,506, never stable, 34% warned |
| Chicago 1995 | 345,945 | 0, stable day 14 | 15,294, never stable, 49% warned |
| Baseline | 344,666 | 0, stable day 14 | 15,372, never stable, 34% warned |

The results table above is the "before" column.

### Step 1c: residents count themselves (Nov 19)

Every household enters in the app how many people live in its room (assumption: everyone uses it and reports
honestly). Blackout Warning scales each section's census power need by residents' count ÷ census count. The console
shows both totals (census 1,318,400 vs residents 1,600,000 at the sim's scale: +21%, +43% on level 50). With an
honest, complete count the correction is exact, so the results return to the Step 1 table (Texas s1: 1,167 deaths,
stable day 23). Partial or inflated counts are not modelled yet.

### Step 1d: no plant meters, no forecast, no sensor boxes (Nov 19)

The brief gives residents none of these, so the Residents' System no longer receives them (the sim still makes them,
filtered by `residentsOnly` in `engine.ts`, so "without" results do not change). New input: residents' **outage
reports** in the app (the hour their section's air and fans lose power, and the hour it comes back).

How Blackout Warning now works (`src/product/earlyWarning.ts`):
1. From yesterday's outage reports, the **blackout line** for each hour: how many levels from the top had power.
2. Power goes to the upper levels first, so the line shows how much the plants made: the needs of every level above
   it (from residents' head count). Hours when almost the whole Hollow was dark at once are plant trips and are left out.
3. Trend: the same hours compared with the day before (capped at ±10% a day).
4. Today's prediction: yesterday's supply × the trend, replayed hour by hour with today's power saving → which levels
   go dark, from what time, for how long. Warnings are for today only (no forecast to see further).
5. Save power: enough that demand stays under 88% of the worst hour's supply. After a Hollow-wide trip with no other
   clue, +15 points. With no blackouts, the request is **kept**: residents cannot see the plants, so a quiet day is
   no evidence the power is back. (Easing off 15% a day let the load creep back until plants tripped: ~90 trips,
   never stable, 29,190 deaths in Texas s1.)

| Scenario | Without | Step 1c (meters + forecast) | Step 1d (residents' data only) |
| --- | --- | --- | --- |
| Texas, seed 1 | 637,782 | 1,167, stable day 23 | 1,260, stable day 21, 75% warned, 6 trips |
| Texas, seed 2 | 565,107 | 1,468, stable day 24 | 10,342, stable day 21, 85% warned, 12 trips |
| Texas, seed 7 | 624,054 | 0, stable day 21 | 6,473, stable day 22, 83% warned, 12 trips |
| Chicago 1995 | 345,945 | 0, stable day 14 | 1,570, stable day 18, 60% warned, 6 trips |
| Baseline | 344,666 | 0, stable day 14 | 1,208, stable day 21, 71% warned, 6 trips |

**Limits:** the system can't see a storm or a plant trip coming; it learns from the first day of blackouts, so the
first trips happen unwarned. The power-saving request ratchets up and stays high (it reached the 90% cap in Texas s1
by day 7), because nothing residents can see shows when the plants have recovered. The cost of that (non-essential
power switched off for weeks) is not counted in the sim. The 0.85 compliance, 88% safe load and +15 step are first
guesses; the hold rule was chosen after seeing that easing off failed.

Which part does the work (Texas seed 1, before the census change): warnings only → 374,185 deaths; saving power only → 2,379; both → 1,167.
Saving power stops the overloads that black out the whole Hollow; the warnings cut the deaths in the blackouts that
still happen.

**Limits:** in Texas seed 2 a plant trip blacked out the Hollow with almost no warning (3%). The warning depends on
the forecast, which is about ±3% off. Thresholds are first guesses. Without the feature, the Hollow is chronically
overloaded (plants trip about 3 times a day), so "without" never becomes stable.

Run: `npm install`, then `npm run dev` (UI) or `npm run sim -- texas2021 1 --checks`.

### Step 1e: the census is accurate (Nov 19)

The brief says the Directorate's public numbers "don't match what people see" only about the lung-sickness outbreak
(and problem #9), never about the population. So the census is now accurate (`WORLD.census = false`); the undercount
of Step 1b stays in the code as an option. Results do not change, because residents' own head count already gave the
true numbers: Texas s1 1,260 deaths, stable day 21, 75% warned. The "numbers don't match" lie belongs to problem #9.

Baseline, with Blackout Warning, seeds 1–10: warned 71, 69, 63, –, –, 71, –, 91, 70, 79% ("–" = no blackouts at all);
deaths 0 to 2,028; stable on day 21–22 (seed 9: day 36). The seed sets which plant trips when and the report noise.

### Step 1f: the power-saving request eases off slowly (Nov 19)

Before, a quiet day always kept the request, so once it reached the 90% cap it stayed there forever (even on
Baseline). Now, after 5 quiet days in a row, it drops by 5 points; it never goes below the request that was in effect
the last time there was a blackout or trip, plus 5 points (that memory fades after 7 quiet days). Any blackout or
trip sends it back up. Settings: `EASE` in `src/product/earlyWarning.ts`.

Tested on 14 runs (Texas seeds 1, 2, 7; Chicago; Baseline seeds 1–10), each played to day 60:

| Rule | Deaths by stable day | Deaths by day 60 | Average request | Request at day 60 |
| --- | --- | --- | --- | --- |
| Keep (before) | 27,250 | 30,542 | 76% | 90% in every run |
| 5 points after 3 quiet days | 30,510 | 39,823 | 53% | 58% |
| 3 points after 3 quiet days | 30,138 | 30,688 | 58% | 44% |
| **5 points after 5 quiet days (now)** | **27,251** | **29,771** | **58%** | **44%** |

The headline runs do not change (Texas s1: 1,260 deaths, stable day 21, 75% warned); checks pass.

## Step 2: real data in the test world, then the module retuned (Nov 19, Neil)

Spec: `.plans/hollow-real-data-spec.md` (locked). The Residents' System is unchanged: it still reads only residents'
outage reports and head counts. Only the hidden test world and the module's 4 guessed constants changed.

**The world now uses real data** (all of it in `src/data/real/`, each file with its source; scripts in `scripts/`):

| What | Real data | Old guess |
| --- | --- | --- |
| Everyday demand | ERCOT hourly demand, 36 calm weeks of 2023 (EIA-930): a 168-hour week, 0.82–1.17 × mean | flat ±5% daily cycle |
| Plant repair after a trip | 100 large, sudden US outages 2015–2024 (EAGLE-I): time to restore 90%, median 13 h, p90 36 h | 12–36 h, uniform |
| People per section | 3,133 US counties sorted into levels by CDC SVI; 8 equal-population sections per level | 2,000 (level 1) to 6,000 (level 50) |
| Hover card | Real counties, emPOWER power-dependent residents, Census 2020–2024 growth | — |
| CO₂ danger level | 5,000 ppm: OSHA PEL / NIOSH REL (the value did not change; it is now cited) | 5,000 ppm |

Kept as guesses, with the reason in `src/data/real/airParams.ts`: the air death rate, the share of deaths a warning
avoids, air volume per person (scaled), the alert follow rate, and the plant trip chance at full load.

**No storms.** The brief names aging plants, crowding and the Directorate as the causes of blackouts, not weather.
Texas 2021 and Chicago 1995 are removed. The new scenarios:

| Scenario | What happens |
| --- | --- |
| Cascade (default) | Plant 2 loses output in the shape of the real ERCOT generation loss of Feb 15–18, 2021 (peak 19.5 GW below Feb 14, 32%), from day 5. No storm, no demand surge. |
| Baseline | Real demand week, no extra failure. |
| Aging | Plants lose output at the real post-peak decline of The Geysers, about 10% a year (Foulger et al. 1997): 4 years played in 120 days. Cannot end before day 60. |
| Crowding | Each section grows at its real counties' 2020–2024 rate: 4 years played in 120 days. Cannot end before day 60. |

**The gate** (`npm run gate`): every scenario, with and without the module, on tune seeds 1–5 and check seeds 6–10;
`--test` adds seeds 11–20. Constants were chosen on the tune set, kept only if the check set was no worse, then the
test set was run once.

Tuning (tune set, with the module, deaths / plant trips): first guesses 5,427 / 120. One step each: `safeLoad` 0.85 →
4,169 / 90; `assumedCompliance` 0.75 → 4,488 / 91; `maxTrend` and `tripStep` changed nothing. Chosen:
**`safeLoad` 0.82 and `assumedCompliance` 0.75** → 3,564 / 78. Check set: 3,195 / 120 → 2 / 70.

**Test set, run once (seeds 11–20, all 4 scenarios, 40 runs):**

| | Deaths | Plant trips | Stable |
| --- | --- | --- | --- |
| Without the module | 12,260,961 | 9,026 | 0 of 40 |
| With, first-guess constants | 20,382 | 184 | 38 of 40 |
| **With, tuned constants** | **3,628** | **87** | **40 of 40** |

Seed 1, tuned: every scenario ends with 0 deaths (Cascade and Baseline stable on day 16, Aging day 67, Crowding day 73).
Without the module: 275,273 (Baseline) to 355,719 (Aging) deaths, never stable.

**Limits (say these in the pitch):**
- The warned share is low (about 12% on seed 1; 48–62% over the test set) because most blackouts are now prevented, so
  the few left are short and sudden. Warned share is not a good measure when there are almost no blackouts.
- The tuned module asks for more power saving (it keeps plants under 82% of their output, not 88%). The sim still
  does not count the cost of saving that much power.
- Cascade looks like Baseline on most seeds: the module's power-saving request already leaves room for Plant 2's loss.
  Without the module the Hollow collapses in every scenario, so the loss shows only in the "without" runs.
- Crowding changes little: real county growth is small (median about +0.5% a year, −1.3% to +4.1%).
- Time compression: Aging and Crowding play 4 real years in 120 days, and say so in their summaries.
- EAGLE-I measures customers getting power back after mostly storm damage to wires. It stands in for plant repair
  time; it does not measure it. The 10%/yr Geysers rate is the steep post-peak rate (today: 1–2% a year).
- The 9 counties without SVI (8 old Connecticut counties, Valdez-Cordova AK; 3.6 M people) are left out.
- Without the module the Hollow never stabilizes, even with real data: real peak demand (1.17) is above the plants'
  capacity margin (1.1).
