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
