# Handoff: Earth product (all workstreams) — Thu Nov 19, 2026, about 1:30 am

From: Neil (with Claude). To: Adarsh. Neil is offline until later on Thursday.
Deadline: **Fri Nov 20, 11:00 pm**; we submit by 6:00 pm.

All code is on `main` and pushed. Start with `git pull`.

## Read these, in this order (do not repeat them; they are the record)

| File | What it gives you |
| --- | --- |
| `TODO.md` | What is left, what is done, the limits to state |
| `.plans/before-during-after-spec.md` | The locked spec (replaces the Hollow Twin spec) |
| `models/RESULTS.md` | Every model number. Read it before you write any claim |
| `contracts/README.md` | Who owns which folders, the data and model file formats, the change log |
| `data/README.md` | The data pipeline, its sources, its known limits |
| `docs/deploy.md` | Vercel steps and the after-deploy checklist |
| `ideation/decisions.md` (last 20 lines) | Every decision from this session |
| `ideation/ideas.md` → Round 17 | Why we pivoted, and the competitor scan |

## What happened in this session, in short

1. **Competitor scan.** Six other teams are on GitHub. One (anudeep-bonagiri/hollow-twin) has our old name, a deployed 3D cutaway and no real data. No team trains on real disasters.
2. **Pivot (Neil's decision).** Earth is the product: models trained on real US power outages. The Hollow is the frame ("the Hollow is what Earth became"). The project is unnamed for now; the working name is "Before, During, After".
3. **Data.** 1,477 real outage events, 2015–2024, from EAGLE-I county outages and EIA-930 grid data, with weather (NOAA), vulnerability (CDC SVI) and powered-medical-equipment counts (HHS emPOWER).
4. **Models.** Trained on 2015–2020, designed on 2021–2022, tested once on 2023–2024, then tested on real archived weather forecasts for 2024.
5. **App.** County map, event replay, Hollow cross-section, story mode, county brief, evidence page, live page.

## Run it

```bash
cd app && npm install && npm run dev
```

Open `http://localhost:5180`. Routes: `#/` · `#/event/ERCO-2021021501` · `#/hollow/ERCO-2021021501` · `#/?story=texas2021` · `#/evidence` · `#/brief/48201` · `#/live` · `#/legacy` (the old Hollow Twin screen, frozen).

Checks: `npm run typecheck`, `npm test` (32 tests), `npm run build`.

The app needs nothing else: its data is committed in `app/public/data/v1` and `app/public/models`.

To rebuild data or models you need the raw files (about 12 GB, not in git): `brew install uv libomp`, then follow `data/README.md`. They exist on Neil's Mac only. You do not need them for frontend, deploy or pitch work.

## What works (checked in a browser this session)

- Map with 3,142 counties, depth by vulnerability; replay of 19 events; the three heroes (Texas 2021, Elliott 2022, Irma 2017).
- Story mode: opens under the surface in Hollow language, rises to "This is not 2087. This is Texas winter storm (Uri), Feb 2021."
- Hollow cross-section: 50 levels of real counties going dark; Without/With the warning; live counters; fair-rotation what-if.
- Evidence page: four cards, a chart of every method at equal false-alarm rates, all 1,477 events, downloads.
- County brief with print layout. Live page on a saved sample.

## The numbers to use (all from `models/RESULTS.md`)

- **With real archived forecasts, 2024 (212 events):** 51% of events warned 12 h ahead, 74% of affected customers, median lead 47 h, about 11 false alarms per area per year.
- **At equal false-alarm rates (about 5.3 per area per year, real 2024 forecasts):** 35% of events and 56% of affected customers, against 9% and 7% for the best matching simple rule. These points were read from the test period; say so.
- **Texas 2021:** first alert 13 h before the first outage hour and 19 h before ERCOT ordered blackouts (forecast model; for 2021 the observed weather stands in for the forecast). The simple rule "tomorrow's demand forecast is above this month's record" alerted 22 h before.
- **Texas-type events (demand records):** that simple rule warned 11 of 17 at 1.3 false alarms per area per year.
- **Check-first list:** 46% of the true ten worst-hit counties are in the model's top ten; past history 28%; chance 13%.

## What is weak or goes against our story (say it; do not hide it)

- Without a weather forecast the model warns 13% of events. No model beats every simple rule at the threshold we fixed in advance.
- The who-stays-dark model ranks counties well but its hour counts are far too low in extreme events (Harris County, Texas 2021: 1.4 h predicted, 49 h observed).
- Vulnerable counties are dark longer across events (3.4 h against 1.3 h), but not inside the same event. In Texas 2021 the deepest levels were dark slightly less than an even rotation would give (15.8 h against 17.5 h).
- Lives saved cannot be measured from a backtest. We report hours of warning and people reached.

## In progress when Neil logged off

- **Smooth map surface** (branch `ws/bda-map`, folders `app/src/earth`, `app/src/story`): remove the county outlines and interpolate depths across county borders so the surface has no boxes. See "Status of the smoothing" at the end of this file for whether it was merged.

## Not done, and not verified

- **Deploy.** Not done. It needs a Vercel account and a free EIA key (`docs/deploy.md`). The serverless function `app/api/eia.ts` has tests but has never run on Vercel or against the real EIA API.
- **Live page.** Runs on a saved sample only. With real data, check that the "next 12 hours" forecast inputs are filled.
- **Story mode.** Checked through the reveal and the risk chart. The last captions (the warning line with its caveat, the closing line) were not watched to the end after the latest merges. Watch `#/?story=texas2021`, `elliott2022` and `irma2017` once each.
- **Phone layout.** Not checked.
- **`/codex review`** of `data/` and `models/`. Not run. The team rule sends backend work to Codex; this session's backend was written by Claude agents.
- **Project name, pitch script, video, Devpost text.** Not started.

## The exact next steps (pick from the top)

1. `git pull`, run the app, click through every route above, and note what looks wrong.
2. Get the EIA key, deploy with `docs/deploy.md`, and run its checklist.
3. Pick the project name with the team and replace the working name (`app/index.html` title, the top bar in `app/src/earth`, `AGENTS.md`).
4. Decide the lead claims with the team (section "The numbers to use"), then start `/pitch`.
5. Only if 1–4 are green: the heat step (spec → "Nice to have: the ladder").

## Rules that will save you time

- `contracts/README.md` says who may edit what. `app/package.json`, `app/src/contracts.ts` and `app/src/shell/` belong to the coordinator: change them on `main`, not inside a workstream branch.
- The app's data files are written by `data/build/export_app.py`. Do not edit `app/public/data/v1` by hand.
- Every number on screen must come from `metrics.json`, `events.json`, a replay file or `counties.json`. Do not type results into components.
- Wherever a lead time is shown, show the caveat (`events.json` → `warnNote`).
- Three git worktrees exist on Neil's Mac under `~/.paradev/worktrees/patriothacks-fall26/ws/` (`bda-models`, `bda-map`, `bda-brief`). Their branches are merged into `main` except as noted above. You do not need them.

## Suggested skills for the next session

- `/pitch` for the script, video plan and Devpost text.
- `/webapp-testing` or `/agent-browser` to watch story mode and check the phone layout.
- `/better-interface` and `/agentation` for a UI pass on the map and the cross-section.
- `/codex review` on `data/` and `models/`.
- `/ste`, then `/humanizer`, for every piece of public text.
- `/systematic-debugging` before changing code when something breaks.
- `/handoff` when you stop, so the next person gets the same.

## Status of the smoothing

Not merged yet at the time of writing. This section is updated when it lands.
