# Submission form answers (each under 200 words)

## One-sentence pitch

HollowGuard forecasts disasters from what residents can see. In Hurricane Beryl (Texas, July 2024), our residents-only model picked 7 of the 10 longest-dark counties, against 2 for history. In the Hollow, on runs it never trained on, it cut deaths by 97.6%, from 35.3 million to 861,761, across seven disasters copied from real US plant failures.

Shorter (one breath): "Tested on real outages, it found 7 of Hurricane Beryl's 10 longest-dark counties, against 2 for history; in the Hollow it cuts deaths by 97.6%."

## What is your project?

HollowGuard is a phone app for the two billion people who live in the Hollow. It uses only what residents can see: which levels lost power, how many people live in each section, their own reports of bad water, coughs and food stocks, and the Directorate's census.

It has six apps for six of the brief's problems. Blackout Warning tells each level before its power goes out, and asks everyone to save power so the plants do not overload. Fair Share makes sure the deep levels are not always the ones cut. Water Safety finds a failing recycler and tells those levels to boil their water. Family Check-In tells you that a relative on another level is OK. Outbreak Tracker shows where the sickness really is. Food Sharing sends spare food to levels that are running out.

We tested HollowGuard on seven disasters copied from real US power plant failures, ten held-out runs each. Without it, 35.3 million people die and no run ends stable. With it, 861,761 die (97.6% fewer), and 49 of 70 runs end stable.

## How did you build it?

The apps are TypeScript modules. Each day they read only residents' observations (outage reports, head counts, the census, and water, cough and food reports) and send alerts. Blackout Warning forecasts from the blackout line: power reaches the top levels first, so the deepest lit level gives the supply, and its daily trend gives tomorrow's line.

We test the apps in a simulated Hollow: 50 levels × 8 sections, 6 plants, stepped hourly, with air, heat, water, sickness and food. Real data: EIA-930 hourly generation for the plant losses (Winter Storm Elliott 2022, Texas 2021, SPP wind 2021), ERCOT demand, EAGLE-I repair times, and 1,457 US counties (CDC SVI) as the sections. We tuned on seeds 1–5, checked on 6–10, and tested once on 11–20. We measured each app's impact by switching it off and rerunning all 70 test runs.

A second model, LightGBM trained on real EAGLE-I outages (2015–2020) with residents' inputs only, ranks which areas stay dark longest. Tested once on 2023–2024, it scores a top-10 overlap of 0.459, against 0.278 for history.

The site uses React, Vite and three.js, with a Web Worker, deployed on Vercel.

## Why did you choose to build this? What was your thinking?

The brief describes people who cannot trust the official numbers and cannot see the systems that keep them alive. We asked a simple question: what can residents do with only what they can see? A blackout answered it. Residents cannot see the plants, but they can see which levels went dark, and power reaches the top first. So the line between dark and lit levels shows the supply. If residents share their outage reports, they can forecast the next blackout without the Directorate.

From there we added one app per problem. Each app had to use residents' data only and had to show a measured effect. We did not want a demo that only looks good, so we tested on runs we never tuned on, copied real disasters, and published the results that go against us. Cooling showed no measurable effect, so we did not ship it.

The brief rewards one connected solution, so every app shares the same phone, the same residents' reports and the same test.

## Who built what? How did you collaborate?

Neil built the real-data pipeline (EIA-930, EAGLE-I and CDC SVI), the residents-only check-first model, and Blackout Warning's tuning and testing. He also built the 3D workstation, the guided tour, the per-app impact measurement and the final integration, and he deployed the site.

Adarsh built the resident's phone and five of its apps: Fair Share, Water Safety, Family Check-In, Outbreak Tracker and Food Sharing. He also built Blackout Warning's power-saving easing, the 2D cutaway and the harder test world with heat, sickness and food.

Richard redesigned the results site: the full-width layout, the type and the pipeline figure.

We worked in one shared GitHub repository. A shared brief for our AI tools (Claude Code and Codex) kept every teammate's setup working from the same facts. Each larger change started as a locked spec in `.plans/`. Each person worked on a branch, and a changelog entry told the others what changed and what to do next. Every result came from scripts in the repository, so anyone could rerun the numbers.
