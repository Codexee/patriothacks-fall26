# HollowGuard: talking points

Live site: https://hollow-twin-poc.vercel.app · Video script: `docs/demo-video.md` · Numbers: `README.md` (test seeds 11–20).

Story order: dystopia → victim → tool → live demo → how it works → what's next.

## One-sentence pitch

HollowGuard forecasts disasters from what residents can see. In Hurricane Beryl (Texas, July 2024), our residents-only model picked 7 of the 10 longest-dark counties, against 2 for history. In the Hollow, on runs it never trained on, it cut deaths by 97.6%, from 35.3 million to 861,761, across seven disasters copied from real US plant failures.

Shorter (one breath): "Tested on real outages, it found 7 of Hurricane Beryl's 10 longest-dark counties, against 2 for history; in the Hollow it cuts deaths by 97.6%."

## Hook (15 s)
2087. Two billion people live underground in the Hollow. The plants are failing, the recyclers are breaking, and a lung sickness is spreading. The deep levels lose first.

## Problem (20 s)
- Residents cannot see the plants. They see only which levels are dark.
- The Directorate controls the power, the network and the numbers.
- With no help, our 70 test runs (7 disasters × 10 seeds) end with **35,323,038 deaths**, and **0 of 70** runs end stable.

## Live demo script
1. **Homepage.** Point at the headline: **35,323,038 → 861,761** deaths (97.6% fewer). Say: "Same disasters, same seeds. The only difference is HollowGuard."
2. **"The app and its impact."** Say: "Seven apps for seven problems: #1, #2, #4, #7, #8, #9, #12. Each one reads residents' data only."
3. **Watch it run → "Two plants lost at once".** Press Play. ★ **Wow beat:** on day 5 the left shaft goes dark and the right one stays blue. Click a deep section, and the phone moves there and shows that day's alerts.
4. **Back to the impact bars.** "We switched each app off and reran the 70 tests. Blackout Warning avoids 33,237,724 deaths. Food Sharing avoids 23,123,020. Water Safety avoids 4,201,744."
5. **"Built on real-world data."** Point at the three real EIA-930 loss curves. "The disasters copy real plant losses, hour by hour."
6. **Model tab.** "The check-first model, tested once on real 2023–2024 outages: top-10 overlap 0.459, against 0.278 for history and 0.132 for chance."

## Under the hood (60 s+)
**Architecture:** apps (`src/product/`) read only residents' observations → a simulated Hollow (`src/sim/`, 50 levels × 8 sections, hourly) applies their alerts → result files (`public/results/*.json`) → the site. The 3D view runs both sides in a Web Worker, and the phone replays the "with" run for the day on screen.

**The 3 hardest problems:**
1. **Forecasting with no plant meters.** Power reaches the top levels first, so the deepest lit level in residents' outage reports gives the supply. Its trend from day to day gives tomorrow's blackout line. Blackout Warning asks for just enough saving to keep the plants below the load where they trip (82% of output).
2. **Honest testing.** Constants are tuned on seeds 1–5 and checked on seeds 6–10. Seeds 11–20 are run once, with everything frozen. Each app's impact is measured by switching that app off and rerunning the same 70 tests. Results that show no effect are published too.
3. **Real disasters inside a fictional world.** EIA-930 hourly generation becomes plant-loss shapes (TVA and Duke coal in Winter Storm Elliott, ERCOT in Feb 2021, SPP wind). EAGLE-I gives repair times, and 1,457 real counties (CDC SVI) become the 400 sections. The check-first model (LightGBM) is trained on real EAGLE-I outages, using only inputs that residents would have.

## Why it matters / what's next
- The method carries over to real cities: crowd-reported outages can forecast where the grid fails next, with no access to utility data.
- Next: test runs with network cuts (so Off-Network Messaging gets a measured number), more of the 15 problems, and field tests with real phones.

## Backup plan
- **The site is down:** play `public/films/twoplants.mp4` (it shows the same run) and show the README tables.
- **The 3D view stutters:** set Speed to 1 d/s, or use the homepage film.
- **Wow-beat clip:** record a separate 40 s take of the 3D beat (see `docs/demo-video.md`).

## Judge Q&A bank
1. **Are the deaths real?** No. They come from our simulated Hollow. The disasters inside it copy real US records, and the check-first model is tested on real outages.
2. **Why trust a simulation you wrote?** The apps never read the simulation's hidden state. Tuning and testing use separate seeds, and we publish the results that go against us: 21 runs that do not end stable, and two apps with zero measured effect.
3. **Why 49 of 70 and not 70 of 70?** In the harder world (heat, sickness, food), Aging and Crowding still fail in some runs. Without HollowGuard, 0 of 70 end stable.
4. **What does a resident actually do?** They follow alerts: save power, boil water, isolate the sick, send spare food, tap "We're OK".
5. **What if residents do not follow the alerts?** In the simulation, between 50% and 100% of residents follow, and the share rises as they come to trust the app. The base rate comes from studies of trust in officials (Kim & Oh 2015). Blackout Warning itself plans for 75% following.
6. **Why did you drop Cooling?** It had no measurable effect in our tests, so we did not ship it.
7. **Off-Network Messaging shows zero. Why keep it?** The brief gives no network-cut schedule, so our test runs have none. The app keeps alerts flowing when the network is cut, and the next step is to test it with cuts.
8. **What is the real-data model good for?** After a blackout starts, it ranks areas by how long they will stay dark, so crews and neighbors check those first. It nearly matches a model that also uses weather data (0.459 against 0.460).
9. **What is the hardest part technically?** Forecasting blackouts from residents' outage reports alone, with no plant data.
10. **Who did what?** Neil: the site, the 3D view, the phone, the integration. Adarsh: the apps and the harder world. Richard: the results site design (layout, type, the pipeline figure).
