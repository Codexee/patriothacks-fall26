# To do

Last updated: Thu Nov 19, 2026, 2:20 am. Deadline: **Fri Nov 20, 11:00 pm** (we submit by 6:00 pm).
Spec: `.plans/before-during-after-spec.md`. Who owns which folders: `contracts/README.md`. Model results: `models/RESULTS.md`.

To take an item: write your name after it, commit, push. Tick it when it is merged to `main`.

## Running now

No AI worker is running. Everything is merged to `main`. Start with `docs/handoffs/2026-11-19-earth-product.md`.

## Next (Thu morning)

- [ ] **Get an EIA API key** (free, 2 minutes): https://www.eia.gov/opendata/register.php. Put it in `.env.local` as `EIA_API_KEY` and in the Vercel project settings. — needs a person
- [ ] **Deploy to Vercel.** Steps and the after-deploy checklist are in `docs/deploy.md`. Needs a person with a Vercel account and the EIA key.
- [ ] **Pick the project name.** "Hollow Twin" is taken by another team. Working name: "Before, During, After".
- [ ] **Ask at the Thu check-in** (JC Room C, 10:00 am–1:30 pm): the judging criteria, the video length, what the submission form needs.

## Stretch ladder (each step only if the one before it passed)

- [ ] **1. Heat (problem 3).** Add heat-while-dark hours per county to the replay and the brief.
- [ ] **2. True count (problem 9).** Expected deaths per state-week from CDC weekly data; excess deaths after each hero event against the official count, with a range.
- [ ] **3. Air (problem 13).** Next-day unhealthy smoke per county from EPA monitor history.
- [ ] **4. Water (problem 4).** Likely to be cut.

## Pitch and submission (Thu evening → Fri)

- [ ] **Decide the lead claims.** Read `models/RESULTS.md` first. Strong: the record rule on Texas-type events, the check-first ranking, the real data. Weak: storm warning without a weather forecast. Do not lead with the weak one.
- [ ] **Check every number on screen against its source**, one more time.
- [ ] **Write the 3-minute script** (`/pitch`).
- [ ] **Record the video from story mode** (`#/?story=texas2021`), add overlays (`/hyperframes`).
- [ ] **Write the Devpost text** (`/ste`, then `/humanizer`). State what is real, what is a backtest, and the limits.
- [ ] **Run `/codex review`** on the models and the data pipeline.
- [ ] **Fri 2:00 pm: final deploy.** Fri 6:00 pm: submit, with all 4 members entered.

## Known limits to say out loud

- At equal false-alarm rates the forecast model is far ahead of every simple rule (real 2024 forecasts, about 5.3 false alarms per area per year: 35% of events and 56% of affected customers warned, against 9% and 7% for the rule). These operating points were read from the test period; the frozen-threshold result is the pre-registered one. Say both.

- The storm warning without a weather forecast warns 13% of events 12 h ahead. No model beats every simple rule at the same false-alarm rate.
- With real archived forecasts (2024, 212 events) the forecast model warned 51% of events 12 h ahead and 74% of affected customers, with about 11 false alarms per area per year (7.5 with observed weather). Earlier years still use observed weather as the forecast.
- The who-stays-dark model ranks counties better than past averages, but its hour counts are far too low for an extreme event (Texas: 1.4 h predicted against 49 h observed for Harris County).
- In Texas 2021 the deepest levels were not darker than an even rotation would have made them (15.8 h against 17.5 h per person). Show it as it is.
- Vulnerable counties are dark longer across events (3.4 h against 1.3 h), but not inside the same event. The gap comes from where long outages happen.
- Lives saved cannot be measured from a backtest. We report hours of warning and people reached.
- County-to-area mapping splits each utility's customers evenly over its counties (see `data/README.md`).

## Done

- [x] Competitor scan and pivot to Earth as the product (Round 17, locked spec).
- [x] Data pipeline: 1,477 real US outage events, 2015–2024 (gate G1).
- [x] Models v1 and v2, with a final test on 2023–2024 run once.
- [x] App: county map, event replay, story mode, county brief, evidence page, live page, browser model with parity tests.
- [x] Real archived forecast test (2024), Hollow cross-section (`#/hollow`), Without/With comparison, live counters, detailed evidence and brief pages.
- [x] Evidence page: comparison at equal false-alarm rates (chart), cards filled from data.
- [x] App data trimmed to 14 MB (19 replays); per-area demand records exported; Vercel config and `docs/deploy.md`.
- [x] Live page computes the record features; the EIA function has tests (400, 503, 200, 502). Not yet checked against the real EIA API (no key).
- [x] Smooth map surface: no county outlines, depths interpolated across borders. Not checked on a slow laptop or a phone.
- [x] Contracts and an app shell so parallel work does not collide.
