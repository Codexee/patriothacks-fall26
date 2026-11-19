# Your walkthrough: everything you need to run and explain the Hollow rebuild

*For Adarsh. Written Nov 19, 2026. Use it to rehearse the demo and to answer questions.*

## Contents

1. [The idea in four sentences](#1-the-idea-in-four-sentences)
2. [Start it](#2-start-it)
3. [The screen, area by area](#3-the-screen-area-by-area)
4. [Controls and shortcuts](#4-controls-and-shortcuts)
5. [Demo recipes](#5-demo-recipes)
6. [How Blackout Warning thinks](#6-how-blackout-warning-thinks)
7. [The numbers to remember](#7-the-numbers-to-remember)
8. [Questions you may get, and honest answers](#8-questions-you-may-get-and-honest-answers)
9. [What was decided along the way](#9-what-was-decided-along-the-way)
10. [If something goes wrong](#10-if-something-goes-wrong)
11. [Where things are](#11-where-things-are)

---

## 1. The idea in four sentences

1. The **product** is the Residents' System: an app that the people of the Hollow run for themselves.
2. It solves the track's 15 problems one **module** at a time; the first module is **Blackout Warning** (problem #1).
3. The **test world** is a simulated Hollow that plays a disaster with the modules on and off, so you can show the
   difference.
4. The module uses **only data that residents have** (their outage reports, their head count, the Directorate's
   census and the fact that deep levels lose power first), never the simulation's hidden truth.

## 2. Start it

1. Open a terminal.
2. Go to the folder:
   `cd "C:\Users\adars\OneDrive\Documents\Projects\patriothacks-rebuild-ui\prototypes\hollow-twin-poc"`
3. Start the server: `npm run dev -- --port 5184`
4. Open **http://localhost:5184** in your browser.

In Claude Code, the same server is called **hollow-rebuild**. The older look is at http://localhost:5183
(server name **hollow-twin-rebuild**).

## 3. The screen, area by area

### The Hollow (largest area, left)

- **Header:** "The Hollow", the day, the disaster's name, and one status line in words (for example "Levels 46–50 are
  in a blackout. 357 of 400 sections with air and fans, 43 dark. Plants online: 6 of 6.").
- **Legend:** what each look means (described below).
- **The surface:** storms, poisoned air, fires, lightning, and dead buildings run by machines. Drones patrol it. The
  label says it is closed for 30 years.
- **50 levels of tunnel neighborhoods.** Each box is a section of a level: thousands of people living in an old subway
  tunnel (levels 1–18) or mine gallery (levels 19–50).
- **How to read a section:**
  - Warm light, many lit windows: **full power**.
  - Dimmer, fewer lit windows: **saving power** (this is not a blackout).
  - Black, a few small blue-white lights: **blackout**. The air and fans have no power. The lights are phones and
    torches.
  - Black with a pulsing red strip: **blackout and the air is unsafe**.
  - Grey with diagonal lines: **everyone in the section died**.
- **Red dashed line with a label:** where the blackout starts.
- **Your home:** blue outline with a "Home" tag.
- **Hover a section** to see its true numbers in the Test World panel (people, power, CO₂).
- **Small details:** power pulses on the pipes (only where there is power), people walking (they stop in the dark),
  fans, glowing plants with steam, sparks when a lamp dies, and a lift that **stops with a red light when its level
  is in a blackout**.

### Solution modules (the slim strip, or the panel)

- **Minimized (default):** a strip with an expand button and one chip per module. **#1** with a glowing dot means
  Blackout Warning is on. Click the chip to switch it.
- **Open (press M):** a card per module with an **On/Off switch**, the problem it solves, an **ⓘ** for how it works,
  and what it found today:
  - the Directorate's census against residents' own count;
  - yesterday's blackout line and its trend;
  - the power-saving request;
  - a table of the blackouts predicted for today.
- After you change a switch, a note says it applies from the next day. **Reset** starts over with it.

### Residents' System (right): one resident's phone

- **Home:** level and section. Keep **Home locked** on during a demo.
- **Next blackout on your level.**
- **Alerts for your level**, each with **Why?**.
- **Report a problem:** type it yourself; it joins tomorrow's data; the box clears each new day.

### Test world controls

- **Demo bar** (bottom of the Hollow): ▶ Next day, ⏭ skip to the end, ↺ reset, then day, deaths and "warned",
  then ⇄ Compare, ⚙ open the full panel, ⓘ shortcuts.
- **Full Test World panel** (press T): disaster and seed, play, scoreboard, Compare, **Trip a plant**, hidden truth
  (population 2.00 billion; the census is accurate), section details, event log.

### Info icons

Every ⓘ shows a description when you hover or click it. Descriptions are hidden until you ask for them.

## 4. Controls and shortcuts

| Key | Does |
| --- | --- |
| Space | Next day (plays 24 hours in about 4 seconds) |
| S | All solution modules on or off (from the next day) |
| R | Reset the run with your current choices |
| T | Open or minimize the Test World panel |
| M | Open or minimize the Solution modules panel |

Shortcuts do nothing while you type in a box.

**"Warned"** (in the demo bar and scoreboard) = of all the time people spent in a blackout, the share when an alert
for their level was already in effect. 75% means three quarters of the blackout time was warned.

## 5. Demo recipes

### A. The main demo (about 2 minutes)

1. Choose **Texas, Feb 2021** (press T, choose it, press T again). The module is off.
2. Press **Space** 5–6 times. Point at the red line climbing and the deep levels turning black, then red.
3. Press **S**, then **R**. The module is on and the Hollow restarts.
4. Set the phone's home to **level 47** and keep it locked.
5. Press **Space** a few times. Read the phone's "Next blackout" line and the "Save power" alert aloud. Open **Why?**.
6. Press **M** to show the module card: census against head count, and the predicted blackouts.
7. Press **⇄ Compare**. Wait about 30 seconds. Read: **637,782 without, 1,260 with, stable on day 21.**

### B. "It's not scripted"

With the module on, open the Test World panel (T), choose **Trip a plant**, and press Space. The system is not told.
The next day it reacts from residents' outage reports.

### C. Calm day (the default)

**Baseline (steady)** has no storm, but the Hollow still runs at its limit. Without the module, plants trip and the
deep levels die; with it, the Hollow is stable on day 21.

### D. After the end

When the banner says **Stable Hollow on day 21**, press **Keep playing** to continue to day 120.

## 6. How Blackout Warning thinks

1. **Reads yesterday's outage reports.** For each hour: how many levels from the top had power (the blackout line).
2. **Turns the line into a power supply.** Power goes to the upper levels first, so the plants made exactly enough
   for the levels above the line. Needs come from residents' head count.
3. **Compares with the day before** to see if the line moves up (less power) or down (more).
4. **Predicts today** and warns the levels that will go dark, with the time and length.
5. **Asks for power saving** so the plants stay under 88% of their output and do not trip.
6. **Keeps the request on quiet days,** because residents cannot see the plants.

## 7. The numbers to remember

- **637,782 → 1,260 deaths** in the Texas storm (seed 1), out of 1.6 million simulated people. That is 40% → less
  than 0.1%, a 99.8% drop.
- **Stable on day 21** with the module; never stable without it.
- **418 → 6** plant trips.
- **75%** of blackout time was warned.
- **The census is accurate:** 2.00 billion. (An undercount option exists in the code, switched off.)
- Each simulated person stands for about **1,250** people of the brief's 2 billion.

## 8. Questions you may get, and honest answers

**"Isn't the result scripted? You wrote the world and the module."**
The module only sees residents' data; an automatic check proves it never reads hidden data. The world replays the
same disaster for both runs, so the comparison is fair. But yes: we wrote both, and some rules are shared, such as
"deep levels lose power first", which comes from the brief.

**"Where does the data come from?"**
Residents' phones: they report when the power goes and comes back, and how many people live in each home. The brief
says residents have phones and a network.

**"Why is the first blackout not warned?"**
The module learns from outage reports. Before the first blackout there are none. A real app would already have
weeks of reports.

**"Why not use plant meters or a weather forecast?"**
The brief does not give residents either one. The Directorate controls the plants. We tested with them (1,167
deaths) and without them (1,260 deaths), and chose the honest version.

**"What does 'Save power' cost people?"**
Non-essential power: lights and devices, not air and fans. In the Texas run the request rises to 90% and stays. The
simulation does not count that discomfort. This is a known limit.

**"Are these real numbers?"**
The disaster shapes are approximate copies of real events (Texas 2021, Chicago 1995). The population and deaths are
simulated. Some rates are our assumptions, and the info icons list them.

**"How does this cover more than one problem?"**
Problem #1 fully; #2 partly (sharing the shortage); #6 groundwork (residents count who lives in each home). The
other modules come next.

## 9. What was decided along the way

- **No invented inputs.** If residents do not have it, the module does not use it. Plant meters, the weather
  forecast and sensor boxes were removed.
- **The census exists, but it lies.** Later replaced: **the census is accurate** (Nov 19), because the brief's "numbers
  don't match" is about the outbreak, not the population.
- **Residents count themselves,** and everyone uses the app.
- **Baseline** is the default disaster. Texas and Chicago stay.
- **Modules live in their own panel,** minimized by default, so new modules can be added.
- **The Test World panel is minimized** to a small demo bar.
- **Look:** no pixel art, but rich and lit: tunnel neighborhoods, a surface that matches the brief, and small
  animations that show real state.
- **The first blackout stays unwarned:** you chose not to add earlier reports.

## 10. If something goes wrong

| Problem | Do this |
| --- | --- |
| The page does not load | Start the server again (step 2). |
| The page is slow | Close other tabs; scroll so less of the Hollow is on screen. |
| The phone shows nothing | The module is off, or it is day 0. Switch it on, press R, press Space. |
| Compare seems stuck | It takes about 30 seconds. Wait. |
| You changed a switch and nothing happened | Changes apply from the next day. Press R to start over with them. |
| You want the old look | Open http://localhost:5183, or add `?pixel` to the address for the old pixel-art Hollow. |

## 11. Where things are

- **Branch with everything:** `prototype/hollow-twin-rebuild-ui` (folder `patriothacks-rebuild-ui`).
- **Branch with the logic and the older look:** `prototype/hollow-twin-rebuild` (folder `patriothacks-rebuild`).
- **Step-by-step log of the logic:** `prototypes/hollow-twin-poc/REBUILD.md`.
- **These documents:** `prototypes/hollow-twin-poc/presentation/` (for teammates, for judges, and this one).
