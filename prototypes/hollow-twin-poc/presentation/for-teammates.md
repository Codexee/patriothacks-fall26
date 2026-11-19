# The Hollow rebuild: what Adarsh built (for teammates)

*Written Nov 19, 2026. Status: working prototype on two branches. It is not on the team's locked demo path.*

## Contents

1. [Summary](#1-summary)
2. [Where this fits with the team's plan](#2-where-this-fits-with-the-teams-plan)
3. [How to run it](#3-how-to-run-it)
4. [What you see on screen](#4-what-you-see-on-screen)
5. [How Blackout Warning works](#5-how-blackout-warning-works)
6. [The test world (the simulation)](#6-the-test-world-the-simulation)
7. [Results](#7-results)
8. [What is real, and what is an assumption](#8-what-is-real-and-what-is-an-assumption)
9. [Known limits](#9-known-limits)
10. [Code map](#10-code-map)
11. [What comes next](#11-what-comes-next)

---

## 1. Summary

- **The product idea:** the *Residents' System*, an app that the people of the Hollow run for themselves. It solves
  the track's 15 problems one at a time. Each solution is a **module**.
- **Built so far:** one module, **Blackout Warning**, for problem #1 ("warn people before the power or air cuts out").
- **How we test it:** a simulated Hollow, the **test world**. It has 50 levels, 8 sections per level, 6 power
  plants, and about 1.6 million simulated people. It replays a disaster with the module on and with it off.
- **Main result:** in a Texas-2021-shaped storm, about **637,782** simulated people die without the module. With it,
  **1,260** die, and the Hollow becomes stable on day 21.
- **Main rule we follow:** the module uses only data that residents could really have, according to the track
  brief. It never reads the simulation's hidden truth.

## 2. Where this fits with the team's plan

- The team's locked spec (`.plans/before-during-after-spec.md`) makes **Earth the product** (real US outage data).
  The Hollow cutaway is off the demo path there.
- This rebuild is a **separate prototype**. It does not change `main` or Neil's work. It lives on its own branches:

| Branch | What it holds | Local address |
| --- | --- | --- |
| `prototype/hollow-twin-rebuild` | The step-by-step logic (problem #1), with the older look | http://localhost:5183 |
| `prototype/hollow-twin-rebuild-ui` | The same logic plus the new interface | http://localhost:5184 |
| `prototype/hollow-twin-product` | The earlier version with 9 modules (unchanged) | not running |

- **A possible use:** Blackout Warning uses the same idea as the Earth "Before" warning: predict who loses power
  next, and warn them. The Hollow version could open the video ("this is the Hollow…"), then cut to the real data.
  This is a team decision. Nothing here assumes it.

## 3. How to run it

1. Open a terminal in
   `C:\Users\adars\OneDrive\Documents\Projects\patriothacks-rebuild-ui\prototypes\hollow-twin-poc`
   (or check out the branch `prototype/hollow-twin-rebuild-ui` and go to `prototypes/hollow-twin-poc`).
2. Run `npm install` (one time).
3. Run `npm run dev -- --port 5184`.
4. Open http://localhost:5184.

To get the numbers without the interface: `npm run sim -- texas2021 1 --checks`. Change the scenario (`texas2021`,
`chicago1995`, `baseline`) and the seed (any whole number). `--checks` also tests that runs are repeatable and that
the module never reads hidden data.

## 4. What you see on screen

The screen has three areas, from left to right.

### 4.1 The Hollow (left)

- A cross-section of the whole Hollow: the surface at the top, then levels 1 to 50.
- **The surface:** storm clouds, poisoned yellow-green air, fires, lightning, and dead buildings that machines
  still run (cold blue window lights, patrol drones, a searchlight). The brief describes it this way.
- **Each section is a neighborhood, not a room.** Levels 1 to 18 are old subway tunnels (arched, with rails).
  Levels 19 to 50 are old mine galleries (rough rock, timber props). Deeper sections are more crowded.
- **Light shows the state of each section:**

| What you see | Meaning |
| --- | --- |
| Warm lamp light, many lit windows | Full power |
| Dimmer light, fewer lit windows | The section is saving power |
| Black, with a few small blue-white lights (phones and torches) | Blackout: no power for air and fans |
| Black with a pulsing red strip | Blackout, and the air is now unsafe |
| Grey with diagonal lines | Everyone in the section died |

- **A red dashed line** marks where the blackout starts, with a label such as "Blackout below level 12".
- **Moving parts:** power pulses run along the pipes on levels that have power. People move on lit streets and stop
  in the dark. Fans turn. Plants glow and steam. A lamp throws sparks when it dies. A lift moves between levels and
  **stops when its level has a blackout** (it shows a red light).
- **The header** says in words what is dark now, how many sections have air and fans, and how many plants run.
- **A legend** explains every color in words.
- **Your home** has a blue outline and a "Home" tag. Hover over a section to see its true values.

### 4.2 Solution modules panel (between the Hollow and the phone)

- One card per module. Now: **Blackout Warning #1**.
- Each card has an **On/Off switch**, the problem it solves, an info icon (ⓘ) that explains how it works, and today's
  results: census against residents' own count, yesterday's blackout line, the power-saving request, and a table of
  predicted blackouts.
- If you change a switch, a note says the change applies from the next day, with a **Reset** button.
- The panel **starts minimized** as a slim strip with one chip per module (for example "#1"). Click a chip to switch
  that module. Press **M** or the expand button to open the panel.

### 4.3 Residents' System (right): a resident's phone

- **Home:** choose a level and section. **Home locked** stops hovering from moving it.
- **Next blackout on your level:** for example "Today from about 15:00, lasting about 6 h", or "None expected today".
- **Alerts for your level:** "Blackout coming" (red) and "Save power" (amber). Each alert has **Why?**, which lists
  the evidence.
- **Report a problem:** type a report. It joins tomorrow's data. The box clears each new day.

### 4.4 Test world controls

- **Demo bar** (small, at the bottom of the Hollow): Next day, skip to the end, reset, day, deaths, the share of
  blackout time that was warned, Compare, and a button to open the full Test World panel.
- **Full Test World panel** (press **T**): choose the disaster, the seed, play, scoreboard, Compare, trip a plant,
  hidden truth, section details, and the event log.
- **Compare** runs the same disaster with and without the modules and shows both results side by side (about 30 s).
- **End banner:** "Stable Hollow on day 21" (green) or "Never stabilized in 120 days" (red). After a stable end,
  **Keep playing** continues to day 120.
- **Keyboard shortcuts:** Space = next day, S = all modules on/off, R = reset, T = Test World panel, M = Modules
  panel.
- The default disaster is **Baseline (steady)**. Texas and Chicago are in the list.

## 5. How Blackout Warning works

**Inputs.** Each one is in the track brief or is collected by the app itself:

| Input | Source |
| --- | --- |
| Outage reports: the hour a section's air and fans lose power, and the hour they come back | Residents, through the app (the brief: residents have phones and a network, problem 7) |
| Head count: how many people live in each home | Residents, through the app (assumption: everyone reports, honestly) |
| The Directorate's census | The brief: the Directorate's numbers "don't match what people see". Our census misses people on deep levels. |
| "Deep levels lose power first" | The brief: "the deep levels are where the blackouts hit first" |

**Not used:** plant meters, a weather or grid forecast, sensor boxes. The brief does not give residents any of these.

**Steps, each day:**

1. **Find the blackout line.** From yesterday's outage reports, for each hour: how many levels from the top still
   had power.
2. **Work out the power supply.** Power goes to the upper levels first. So the line shows how much power the plants
   made: the needs of all the levels above the line. Needs come from residents' own head count, not the census.
3. **Find the trend.** Compare the line with the day before: is it moving up or down?
4. **Predict today.** Yesterday's line plus the trend gives today's line, hour by hour. Levels below it get a
   "Blackout coming" alert, with the time and length.
5. **Ask everyone to save power.** The request is large enough to keep the plants under 88% of their output, so
   they do not overload and trip. A trip blacks out the whole Hollow.
6. **Keep the request on quiet days.** Residents cannot see the plants. A day with no blackout is not proof that
   the power is back.

## 6. The test world (the simulation)

- **Deterministic:** the same scenario and seed always give the same result. This makes "with" and "without" a fair
  comparison.
- **Problems switched on now:** power (plants age, trip when overloaded, and the Directorate gives power to upper
  levels first) and air (without power, fans stop and CO₂ rises). Heat, water, sickness, food, lies, network cuts,
  families and the surface rumor are switched off. Each comes back with its own module.
- **Scenarios:** *Texas, Feb 2021* (a storm cuts about 40% of plant output for 4 days while demand rises 30%),
  *Chicago, July 1995* (a demand spike), and *Baseline* (no storm). The shapes are approximate.
- **Scale:** about 1.6 million simulated people stand for the brief's 2 billion (each stands for about 1,250).
- **The census lie:** the Directorate's census reports 1.65 billion. The real population is 2.00 billion: 18% are
  not counted. Only the test world shows the real number.
- **How alerts change the world:** the share of residents who follow alerts is 50% + 50% × their trust in the system
  (about 85% at the start). Warned residents avoid 60% of the deaths from bad air.

## 7. Results

Seed 1 unless stated. "Warned" = the share of blackout person-hours that residents had been warned about.

| Scenario | Without the module | With Blackout Warning |
| --- | --- | --- |
| Texas 2021, seed 1 | 637,782 deaths, never stable | 1,260 deaths, stable on day 21, 75% warned |
| Texas 2021, seed 2 | 565,107 deaths, never stable | 10,342 deaths, stable on day 21, 85% warned |
| Texas 2021, seed 7 | 624,054 deaths, never stable | 6,473 deaths, stable on day 22, 83% warned |
| Chicago 1995 | 345,945 deaths, never stable | 1,570 deaths, stable on day 18, 60% warned |
| Baseline | 344,666 deaths, never stable | 1,208 deaths, stable on day 21, 71% warned |

Both automatic checks pass: runs are repeatable, and the module never reads hidden data.

**How the results changed as we removed invented inputs** (Texas, seed 1):

| Version | Deaths | Note |
| --- | --- | --- |
| Plant meters + forecast + true census | 1,167 | Used data that residents do not have |
| The Directorate's census (undercounts), still with meters + forecast | 79,993 | The module trusted a lie |
| + Residents' own head count, still with meters + forecast | 1,167 | The head count corrects the census |
| Residents' data only: no meters, no forecast (now) | 1,260 | Honest inputs; slightly worse |

## 8. What is real, and what is an assumption

**From the brief:** 2 billion people; geothermal plants; the deep levels lose power first; the Directorate's numbers
do not match reality; residents have phones and a network that the Directorate can cut.

**Assumptions we made (all are visible in the code and in the info icons):**

- The census misses 0% of people on level 1 and 30% on level 50.
- Everyone uses the app and reports their head count honestly.
- 50% + 50% × trust follow alerts; warned people avoid 60% of air deaths (`PREPARED_SAVE` in the engine).
- Thresholds: 88% safe load, 95% trip zone, 85% expected compliance, +15% after a trip. These are first guesses.
- The rule "keep the power-saving request on quiet days" was chosen **after** the first rule (ease off by 15% a day)
  failed: about 90 trips, never stable, 29,190 deaths in Texas seed 1.

## 9. Known limits

- **We wrote both the world and the module.** Some numbers are shared (for example, deep levels lose power first).
  A judge can say the test world grades its own homework.
- **The first blackout is never warned.** The module learns only from outage reports, and there are none before the
  first blackout.
- **Warnings cover today only.** There is no forecast, so a sudden plant trip cannot be predicted.
- **"Warned" counts hours under an active alert.** An alert sent at 00:00 for a blackout that started the day before
  still counts. The true "warned before it began" share is a little lower.
- **The power-saving request only goes up.** In Texas seed 1 it reaches the 90% cap by day 7 and stays. The sim does
  not count the cost of weeks with almost no non-essential power.
- **Without the module, the Hollow never stabilizes,** even in Baseline. The world is overloaded by design.

## 10. Code map

All paths are under `prototypes/hollow-twin-poc/`.

| Path | What it does |
| --- | --- |
| `src/sim/engine.ts` | The test world. `WORLD` switches problems on and off. Census lie, outage reports, `residentsOnly` filter. |
| `src/product/earlyWarning.ts` | Blackout Warning (the module). |
| `src/product/index.ts` | Reads observations into memory and runs the modules each day. |
| `src/product/names.ts` | `BUILT` (built modules) and `PROBLEMS` (the 15 problems). |
| `src/ui/App.tsx` | The day loop, panels, shortcuts. |
| `src/ui/ModulesPanel.tsx` | The Solution modules panel. Add a card to `MODULE_CARDS` for each new module. |
| `src/ui/ProductView.tsx` | The resident's phone. |
| `src/ui/DemoBar.tsx` | Demo bar, Compare card, end banner. |
| `src/ui/Panel.tsx` | The full Test World panel. |
| `src/world/FlatWorld.tsx` | The illustrated cutaway (canvas). Each section's look is cached for speed. |
| `REBUILD.md` | Step-by-step log of the logic and results. |

**To add a module for the next problem:** switch the problem on in `WORLD`; write the module in `src/product/`
(observations in, alerts out); add its key to `BUILT`; add a card in `ModulesPanel.tsx`; run
`npm run sim -- <scenario> <seed> --checks`.

## 11. What comes next

- **Problem #2 onward**, one at a time, each with the same rule: residents' data only.
- **Team decisions needed:** whether the Hollow rebuild has a place in the video or the pitch next to the Earth
  product, and whether to merge the UI branch into `prototype/hollow-twin-rebuild`.
- **Open ideas, not started:** give the module a few days of earlier outage reports so it can warn about the first
  blackout; let the power-saving request come down when the line shows spare power.
