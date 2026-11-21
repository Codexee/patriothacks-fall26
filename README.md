# HollowGuard

**A phone app for residents of the Hollow. It reads only what residents can see, and warns them before power, air, water and food fail.**

Every disaster we test is built from real records. Four copy real US plant losses hour by hour (EIA-930); the others use real demand, plant-aging and census data. Our second model is trained and tested on real US outages (EAGLE-I).

Patriot HackFest Fall 2026 · Life underground track.

**Live site: https://hollow-twin-poc.vercel.app**

## Judge it in 2 minutes

1. Open the live site and press **Play the 90-second tour**. It walks through the result, the app and the 3D run by itself.
2. Open **Watch it run**. Two copies of the Hollow live through the same disaster: without HollowGuard on the left, with it on the right. The phone on the left shows what one resident gets each day. Click a section in the 3D view to move the phone there.
3. Open **Model** for the second model, which we tested on real US outages.

## The result

All numbers come from 70 test runs (7 disasters × 10 seeds). The seeds were not used for any tuning.

| Measure | Without HollowGuard | With HollowGuard |
| --- | --- | --- |
| Deaths, all 70 runs | 35,323,038 | **861,761** (97.6% fewer) |
| Runs stable at day 120 | 0 of 70 | **49 of 70** |
| Plant trips per run | 53 | **5** |
| Split families with no news, per night | 11,473 | **612** |

The test world has blackouts, bad air, heat, failing water recyclers, a lung sickness and food shortages. Deaths are simulated. One run has 1.6 million simulated people.

## What it does

HollowGuard has one app per problem from the brief. Each app reads residents' data only: outage reports, their own head count and the Directorate's census.

"Impact" is what the app adds: the 70 test runs with all apps, against the same runs with only that app off (`npm run impact`, `public/results/impact.json`).

| # | App | What it does | Impact |
| --- | --- | --- | --- |
| 1 | Blackout Warning | Warns each level before its power goes out, and asks all levels to save power so the plants do not trip. | 33,237,724 deaths avoided; 60 fewer plant trips per run |
| 2 | Fair Share | Asks levels that were dark yesterday, or that are overheating, to save less, so the deep levels do not always lose. | 142,869 deaths avoided |
| 4 | Water Safety | Counts bad-water reports per recycler. Tells those levels to boil water and calls a repair crew. | 4,201,744 deaths avoided |
| 7 | Off-Network Messaging | Places 40 battery relays each day, so alerts reach every level when the network is cut. | None measured: the test runs have no network cut |
| 8 | Family Check-In | "We're OK" taps pass phone to phone to relatives on other levels. | Split families with no news per night: 635 → 612 |
| 9 | Outbreak Tracker | Compares cough reports and clinic counts with the Directorate's number, and tells hot spots to isolate the sick. | 101,164 deaths avoided |
| 12 | Food Sharing | Finds levels running out of food from the councils' stock counts, and asks levels with spare food to send it. | 23,123,020 deaths avoided |

**The check-first model** ranks which areas will stay dark longest, so crews and neighbors check those first. It uses residents' data only (no weather, no grid data). We tested it once on real US outages from 2023–2024 that it never saw:

| Top-10 overlap with the 10 longest-dark areas | Score |
| --- | --- |
| HollowGuard model, residents' data only | **0.459** |
| The same model with weather and grid data | 0.460 |
| Each area's own history | 0.278 |
| Random order | 0.132 |

## What is real and what is simulated

| Real | Simulated |
| --- | --- |
| The apps' code: each one runs daily on residents' data only | The Hollow: 50 levels × 8 sections, 6 power plants |
| Plant losses copied hour by hour from real grid failures (EIA-930: Winter Storm Elliott 2022, Texas 2021, SPP wind 2021) | Deaths, air and blackouts in the Hollow |
| Repair times from real outages (EAGLE-I, ORNL) | The residents' reports that the apps read |
| Sections built from 400 real US counties (CDC Social Vulnerability Index) | |
| The check-first model: trained and tested on real US outage events, 2015–2024 (EAGLE-I) | |

## How we tested

1. **Tune** on seeds 1–5.
2. **Check** on seeds 6–10. Keep a change only if these seeds are no worse.
3. **Test once** on seeds 11–20, with all settings frozen. The site shows only these runs.

A seed fixes the random events, so both sides get the same disaster.

## Limits

- The simulation is our own. The disasters copy real data, but the Hollow itself is a model.
- Some constants are guesses, for example the death rate in bad air. Each one is listed in `prototypes/hollow-twin-poc/src/data/real/airParams.ts`.
- The check-first model ranks areas well, but its hour values are too low in large events. Use the order, not the hours.

## Run it yourself

```bash
cd prototypes/hollow-twin-poc
npm install
npm run dev               # the site at http://localhost:5180
npm run gate -- --test    # the test runs (seeds 11–20)
npm run results           # writes public/results/scenarios.json
```

The check-first model: `uv run python models/train_dark_residents.py`, then `uv run python models/final_test_residents.py`. Details are in `models/RESULTS_RESIDENTS.md`.

## Where things are

| Path | What |
| --- | --- |
| `prototypes/hollow-twin-poc/src/product/` | The apps (one file per module) |
| `prototypes/hollow-twin-poc/src/ui/phone/` | The resident's phone |
| `prototypes/hollow-twin-poc/src/sim/` | The test world (the simulated Hollow) |
| `prototypes/hollow-twin-poc/src/site/` | The results site |
| `models/` | The check-first model and its results |
| `docs/team-setup.md` | How the team works (AI context, skills) |

## Team

Neil, Adarsh, Anish and Darryl. Built during the event, Nov 14–20, 2026, with help from AI tools as the rules allow.
