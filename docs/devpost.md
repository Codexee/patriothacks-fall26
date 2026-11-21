# HollowGuard (Devpost draft)

Live site: https://hollow-twin-poc.vercel.app · Code: https://github.com/Codexee/patriothacks-fall26

## Inspiration
In the Hollow, the deep levels lose first. Blackouts come without warning, recyclers fail, and the Directorate's numbers do not match what people see. Residents cannot see the power plants, but they can see which levels are dark. We wanted to find out how much residents can do with only what they can see.

## What it does
HollowGuard is a phone app for residents. It has 7 apps for 7 of the brief's 15 problems:

| # | App | What it does |
| --- | --- | --- |
| 1 | Blackout Warning | Warns each level before its power goes out, and asks all levels to save power so the plants do not trip. |
| 2 | Fair Share | Asks levels that were dark yesterday, or that are overheating, to save less. |
| 4 | Water Safety | Counts bad-water reports per recycler. Tells those levels to boil water and calls a repair crew. |
| 7 | Off-Network Messaging | Places 40 battery relays each day, so alerts reach every level when the network is cut. |
| 8 | Family Check-In | Passes "We're OK" taps phone to phone to relatives on other levels. |
| 9 | Outbreak Tracker | Compares cough reports and clinic counts with the Directorate's number, and tells hot spots to isolate the sick. |
| 12 | Food Sharing | Finds levels running out of food and asks levels with spare food to send it. |

In 70 test runs (7 disasters × 10 seeds that we never tuned on), deaths fall from **35,323,038 to 861,761** (97.6% fewer). **49 of 70** runs end stable, against 0 of 70 without HollowGuard.

A second model, the check-first model, ranks which areas will stay dark longest after a blackout starts. We tested it once on real US outages from 2023–2024: top-10 overlap **0.459**, against 0.278 for history and 0.132 for chance.

## How we built it
- **Apps** (TypeScript) read only residents' observations: outage reports, head counts, the census, cough and water reports.
- **Test world:** a simulated Hollow with 50 levels × 8 sections and 6 plants, stepped hourly. It has blackouts, bad air, heat, failing recyclers, sickness and food shortages. The apps never read its hidden state.
- **Real data:** EIA-930 hourly generation for the plant losses (TVA and Duke coal in Winter Storm Elliott 2022, ERCOT in Feb 2021, SPP wind in Feb 2021); ERCOT demand; EAGLE-I repair times; 1,457 US counties with CDC SVI scores for the 400 sections.
- **Check-first model:** LightGBM, trained on real EAGLE-I outages from 2015–2020, chosen on 2021–2022 and tested once on 2023–2024. No weather or grid inputs.
- **Site:** React and Vite. A three.js workstation runs both sides in a Web Worker, the resident's phone replays the "with" run, and a 90-second guided tour plays on its own. Deployed on Vercel.

## Challenges
- **Forecasting without plant data.** Power reaches the top levels first, so the deepest lit level gives the supply. Its day-to-day trend gives tomorrow's blackout line.
- **Not grading our own homework.** Constants are tuned on seeds 1–5 and checked on 6–10. Seeds 11–20 are run once, with everything frozen. We also publish the results that go against us.
- **Measuring each app.** For each app we switch it off and rerun the 70 tests. Two apps show no effect on deaths, and we say so.

## Accomplishments
- Measured impact per app: Blackout Warning avoids 33,237,724 deaths, Food Sharing 23,123,020, Water Safety 4,201,744, Fair Share 142,869 and Outbreak Tracker 101,164.
- A residents-only model that nearly matches a model with weather data (0.459 against 0.460).

## What we learned
- Residents' reports carry more signal than we expected: the blackout line alone is enough to prevent most plant trips.
- Fixing one problem exposes the next. With heat on, every late plant trip killed thousands, so we had to slow the power-saving easing.

## What's next
- Test runs with network cuts, so Off-Network Messaging gets a measured number.
- More of the 15 problems (Cooling did not help enough to ship).
- Field tests of the outage-report forecast on real crowd-reported outages.
