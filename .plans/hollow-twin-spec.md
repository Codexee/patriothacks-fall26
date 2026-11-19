# Hollow Twin — Master Spec
Status: superseded by `.plans/before-during-after-spec.md` (locked Nov 18; was: locked v2)   ·   Last updated: 2026-11-18   ·   Owner: Neil

v2 replaces v1 (Nov 17). v1 described 4 checkbox tools. v2 follows the product design on `prototype/hollow-twin-product` (Adarsh) and adds a real-world impact act and a visual effects pass. The evaluation behind v2 is in `.plans/hollow-twin-evaluation.md`.

## One-liner
Hollow Twin is a residents' system: 9 software modules that read only what residents can know (meter readings, reports, official bulletins) and send alerts, power plans and findings. We prove the modules on real disasters on Earth (Texas 2021, Flint 2015, Wuhan 2020), then run them in the Hollow, a pixel-art city of 2 billion people under a Directorate that lies.

## The winning demo (30-second scene)
1. **Earth (0–10 s).** A real map of Texas. The counties go dark hour by hour, Feb 14–18, 2021, from real outage data. A counter shows customers without power. A marker appears: "ERCOT emergency order, Feb 15, 1:25 am."
2. **The claim (10–15 s).** Our Early Warning module, which ran on the real EIA-930 hourly data, shows its alert line: "Warned N hours before the order." (N is the measured result of the backtest.)
3. **The turn (15–20 s).** "Now imagine a world where this never stops." The camera falls through the surface into the Hollow cutaway. The Texas map stays on the left, on the same clock.
4. **The Hollow (20–30 s).** Plant 3 sparks and trips. The lights die tile by tile toward the deep levels. The Directorate's bulletin says "Plant 3 is operating normally." The Ledger exposes the lie: the line glitches and is struck out, and a wave of light spreads down the levels as the residents act. The counter shows "lives saved" climbing.

Line for the judges: *"Same failures. Different decisions. Tested on Earth first."*

## Problem, user, and why now
- **The problem:** in a crisis, deaths depend on two things: who loses service first, and how long officials hide the data. Real cases:
  - **Texas, Feb 2021:** peak load shed was about 20,000 MW. About 4.3 million customers lost power. The official death count is 246.
  - **Flint, 2015:** citizen samples (Virginia Tech, Aug 20–Sep 10, 2015) showed a 90th percentile of 26.8 ppb lead, against the 15 ppb action level. The state admitted the problem in early Oct 2015.
  - **Wuhan, Jan 2020:** the official count was 41 cases on Jan 16. Imperial College estimated 1,723 cases (95% CI 427–4,471) with onset by Jan 12.
- **The user:** the residents' council in the story; on Earth, a community group or local emergency office that has public data but not the operator's internal data.
- **Why it is credible:** the modules run unchanged on real public data, and every number on screen links to its source.

## Track fit (Life underground: which of the 15 Hollow problems it covers, by number)
Working modules for **1, 2, 3, 4, 7, 8, 9, 12, 13** (9 of 15). Problems 5, 6, 10, 11, 14 and 15 are named in the pitch as next steps, with designs in `ideation/projects-1-15.md`.

## Scope
### Must ship (demo path)
1. **The product modules** (already on `prototype/hollow-twin-product`): Early Warning (1), Fair Share (2), Ledger + Truthcount (9), Snow (4), Lantern (7), Kin (8), Layout (3), Larder (12), Witness (13). Each reads only observations.
2. **The test world (sim):** the Hollow keeps the hidden truth, makes noisy observations, and applies the modules' outputs.
   - **8 sample districts.** Each district has its own seed, plant ages and plant mix. Each district stands for 156 similar districts, so the 8 together stand for 1,250 districts of 1.6 million people (2 billion in all). The hover says so.
   - Target: one run of 8 districts in under 150 ms.
3. **The Directorate as an agent with goals.** It chooses its policies to maximize 3 goals: order (no riots), output of the upper levels, and its own trust. Each choice (a lie, the power order, a network cut, the farm diversion) records its motive, its short-term gain and its cost. Example: "Cut the network 48 h. Why: stop riots after the Plant 3 finding. Gain: 0 riots for 2 days. Cost: 40,000 people missed the heat alert."
4. **Score: lives first.** Score = lives saved against the no-module run of the same seed, then fairness, then days. A run with more deaths must never score higher.
5. **Earth act (real-world impact).** The same module code runs on real data. The results show on screen in the opening of the video and on an "On Earth" view:

   | Backtest | Module | Real data | Output on screen |
   | --- | --- | --- | --- |
   | Texas 2021 | Early Warning | EIA-930 ERCOT hourly demand, day-ahead forecast, net generation and generation by fuel, Feb 8–22, 2021 | Hours of warning before the EEA3 order (Feb 15, 1:25 am CST) |
   | Texas 2021 | Fair Share | EIA-930 + county outages (4TU, 3-hour, by county) | Longest outage per county: real rotation against our rotation plan |
   | Flint 2015 | Snow | Virginia Tech 271 samples (ZIP, ward, 3 draws) | Wards flagged above 15 ppb, and the date the data supported a warning against the state's admission |
   | Wuhan 2020 | Truthcount | JHU CSSE Hubei counts from Jan 22; official 59 (Jan 5) and 41 (Jan 11–16); Imperial 1,723 | Estimated true cases against the official count, by day |

6. **Live grid.** The judge picks any EIA-930 balancing area and date range. Early Warning and Fair Share run on it in the browser. A Vercel function holds the EIA key and forwards the request. If the EIA API fails, the page uses cached JSON for Texas 2021, Winter Storm Elliott (Dec 2022) and one recent week.
7. **Visual effects:**
   - **Twin split:** the Texas county map (real outages) beside the Hollow cutaway, on one clock.
   - **Cinematic cascade:** the camera pans and zooms to each key event. A plant sparks and trips, the lights die tile by tile, and CO₂ fog and heat shimmer rise.
   - **Truth wave + Lantern packets:** when the Ledger exposes a lie, the bulletin line glitches and is struck out, and a wave of light spreads through the levels. Lantern messages hop between sections as visible packets while the network is cut.
8. **Story mode.** A fixed seed that plays by itself. It pauses 2–3 s at each key event, moves the camera to it, and shows a one-line caption. The video is recorded from story mode, and the same mode runs live if there is a call.
9. **Directorate panel.** A third column with the Directorate's 3 goals, its score over time, and its last choice with its motive. To make room, the module console and the event log move into hovers and overlays (see UI).
10. **Claude recap.** After each run, Claude (claude-opus-5-5, through a Vercel function) writes 3–4 sentences in Standard Technical English from the event log and the attribution only: which lie cost the most lives, and which module saved which levels. With no key or on an error, a fixed template writes it.
11. **Attribution:** lives saved by each module (sampled Shapley, labelled "estimate").
12. **Deploy:** a public Vercel URL. It works in a private window and on a phone.

### Nice to have (only after must-ship is green)
- Shared leaderboard (Supabase) with replay check.
- Rival algorithm and helper.
- Exact Shapley.
- Problems 5, 6, 10, 11, 14, 15 as working modules.
- Sound.

### Explicit non-goals
- Accounts and login.
- Claims that the backtests predict future events. A backtest shows what the module would have said on past data.
- Targeting or naming private people. All real data is public and aggregated (counties, wards, cities).
- Copying Terraria's art or assets.

## Architecture
```
app/                        the Vite + React + PixiJS app (moved from prototypes/hollow-twin-poc)
  src/sim/                  test world: districts, Directorate agent, observations, outputs, score
  src/product/              the 9 modules (read observations only) + run.ts
  src/earth/                backtest adapters: real data → observations → the same modules
  src/world/                PixiJS cutaway, camera, effects (cascade, truth wave, packets)
  src/map/                  Texas county map (SVG or Pixi) on the shared clock
  src/story/                story mode script: seed, events, captions, camera moves
  src/ui/                   panels, hovers, overlays
  api/                      Vercel functions: /eia (key proxy), /recap (Claude, template fallback)
data/                       fetch scripts + committed JSON (EIA, 4TU, county GeoJSON, Flint, JHU) with source metadata
```
Data flow in the Earth act:
1. A fetch script downloads the real data once and saves JSON with its source.
2. An adapter in `src/earth/` turns each record into the same observation types the Hollow makes (for example, an EIA-930 hour becomes a plant meter reading and a demand reading).
3. The unchanged module code reads the observations and sends its outputs.
4. The page compares the outputs with what really happened.

## Data & seeding plan
| Data | Source | Format and size | Notes |
| --- | --- | --- | --- |
| ERCOT hourly | EIA API v2, `electricity/rto/region-data` and `fuel-type-data`, respondent `ERCO`, UTC hours | JSON, about 336 rows per series | Free key in the URL. CORS is open, but the key must not ship in the client: use `/api/eia` |
| Texas county outages | 4TU.ResearchData, DOI 10.4121/fd2fd715-41eb-476a-a9b7-f50d886afb75.v1, CC BY 4.0 | CSV, 6 MB, 3-hour steps from Feb 11, 2021 | Check against ORNL EAGLE-I (CC BY 4.0, 15-min) if time allows |
| County shapes | US Census cartographic boundary files (public domain) | GeoJSON, Texas only | Simplify to under 500 KB |
| EEA3 and load shed | ERCOT EEA overview (Jun 2021); ERCOT Feb 24, 2021 presentation | Two numbers | 1:25 am CST Feb 15; about 20,000 MW peak shed |
| Flint lead | flintwaterstudy.org, `Flint-Samples-FINAL.xlsx`, 271 samples | XLSX → JSON | No per-sample dates; sampling window Aug 20–Sep 10, 2015. Admission date about Oct 8, 2015 (to confirm) |
| Hubei cases | JHU CSSE time series (CC BY 4.0) | CSV, 1.8 MB | Starts Jan 22, 2020. Earlier points typed in with citations (WHO DON233, Imperial Report 1) |
| Elliott, Dec 2022 | EIA API v2, TVA and Duke balancing areas | JSON | Cache for the live grid fallback |

The demo uses one fixed seed per scenario, chosen and rehearsed Thu evening.

## UI / UX direction
- **Layout (3 columns on desktop):** the cutaway (or the twin split in the Earth act), the residents' phone, and the Directorate panel.
- **Declutter (to do before freeze):** move the module console, the event log and the hidden-truth list into hovers and overlays. The screen must be readable in a 1080p video at a glance: at most about 12 lines of text visible at once outside a hover.
- **Effects:** see Scope §7. Effects play in story mode and in normal play.
- **Art:** keep the current pixel style. Effects come after story mode works.

## Hardware (if hybrid)
None. Software only.

## Workstreams
Owners are not fixed (team decision, Nov 18). Each line owns its directories, so parallel agents do not edit the same files.

| # | Workstream | Files/dirs owned | Depends on | Done when |
| --- | --- | --- | --- | --- |
| 1 | Sim: districts, Directorate agent, score | `app/src/sim` | — | 8 districts in < 150 ms; each Directorate choice has motive, gain and cost; more deaths never scores higher |
| 2 | Modules + balance | `app/src/product` | 1 (observation types) | All 9 modules run on 8 districts; demo seed stable with all on |
| 3 | Earth data + backtests | `data/`, `app/src/earth` | 2 (module interfaces) | 4 backtests give a number with a source; cached JSON committed |
| 4 | Live grid + API | `app/api`, `app/src/earth/live` | 3 | Any balancing area runs; fallback works with the network off |
| 5 | World effects + map | `app/src/world`, `app/src/map` | 1 (state frame) | Twin split on one clock; cascade, truth wave and packets at 60 fps |
| 6 | Story mode + UI | `app/src/story`, `app/src/ui` | 1, 2, 5 | Story mode plays the 3-minute script without input; screen passes the declutter rule |
| 7 | Recap + deploy | `app/api/recap`, Vercel config | 2 | Public URL works in a private window; recap falls back to the template |
| 8 | Pitch + video | `pitch/` | all | Video uploaded; write-up done |

## Step-by-step plan
All times US Eastern. Submit by **Fri 6:00 pm**.

**Wed evening (now → about 1 am)**
1. Merge `prototype/hollow-twin-product` into `main`. Move the app to `app/`. Set this spec to `Status: locked`.
2. Write the fetch scripts and commit the JSON: ERCOT Feb 8–22, 2021; the 4TU county CSV; Texas county GeoJSON; Flint XLSX; JHU Hubei.
3. Change the score to lives first.
4. Run Early Warning on the real ERCOT data and measure the warning hours. This number is the opening claim, so it comes first.
5. Start the Texas county map on a shared clock.

**Thu morning (8 am → 12 pm)**
6. 8 districts and the Directorate agent with motives.
7. Story mode with the demo seed and captions.
8. Cinematic cascade (camera and tile effects).
9. Fair Share, Flint and Wuhan backtests.
10. **12:00 pm: deploy to Vercel. Feature freeze (G3).**

**Thu afternoon (12 pm → 6 pm)**
11. Directorate panel; move the console and log into hovers (declutter).
12. Truth wave and Lantern packets.
13. Live grid page with the `/api/eia` proxy and the cached fallback.
14. Claude recap with the template fallback.
15. `/codex review`, `/webapp-testing` on story mode, fix bugs.

**Thu evening (6 pm → midnight)**
16. `/pitch`: write the script. Choose and rehearse the demo seed.
17. Check the Earth claims against their sources one more time.

**Fri (8 am → 6 pm)**
18. Record the video from story mode; add overlays with `/hyperframes`.
19. Write the Devpost text with `/ste`, then `/humanizer`.
20. 2:00 pm: final deploy; check in a private window and on a phone.
21. **6:00 pm: submit.** Enter all 4 members.

## Cut priority (cut from the top when a gate fails)
1. Leaderboard and rival (already in Nice to have)
2. Exact Shapley (keep the estimate)
3. Lantern packets (keep the truth wave)
4. Wuhan backtest
5. Live grid for any area (keep the cached Texas and Elliott data)
6. Flint backtest
7. Claude recap (keep the template)
8. 8 districts (fall back to 1 district, scaled ×1,250, labelled)
9. Directorate agent (fall back to the fixed script with a motive line per choice)
10. Truth wave
11. Cinematic camera (keep the tile effects)
12. Fair Share backtest

**Never cut:** the Texas Early Warning backtest, the twin split, story mode, the lives-first score, the deploy, the video.

## Risks & fallbacks
| Risk | Fallback |
| --- | --- |
| The Texas Early Warning result is weak (for example, under 6 h) | Tune the thresholds (team decision). Show the Fair Share result first if it is stronger |
| The EIA API fails or rate-limits during judging | Cached JSON for 3 events; the page says "cached" |
| The 4TU outage counts do not match EAGLE-I | Use EAGLE-I filtered to Texas, Feb 8–22, as a small committed file |
| 8 districts are too slow for attribution | Attribution on 1 district; results on 8 |
| The screen is too dense for video | Story mode hides the console and shows captions only |
| Claude API down | Template recap |

## Demo script & pitch beats (3 min, assumed)
1. **0:00–0:20 · Earth.** The Texas map goes dark. "246 people died. The data showed it coming." Early Warning's line: "Warned N hours before the emergency order."
2. **0:20–0:40 · More of Earth.** Flint: the wards our Snow module flags from citizen samples, weeks before the state's admission. Wuhan: Truthcount's estimate against the official 41.
3. **0:40–1:00 · The turn.** "Now a world where this never stops." The camera falls into the Hollow. The Directorate and its 3 goals.
4. **1:00–1:40 · Without the product.** The Directorate run. The cascade. Its choices and its reasons, for example the network cut. The Hollow is lost.
5. **1:40–2:30 · With the product.** Same seed. Early Warning, Ledger (truth wave), Fair Share, Snow. Then 20 s for Lantern, Kin, Layout, Larder and Witness.
6. **2:30–2:50 · Result.** Lives saved, by module. The Claude recap.
7. **2:50–3:00 · Try it.** The live grid, and the URL.

## Decisions made in this interview
| Decision | Answer | Source |
| --- | --- | --- |
| Base branch | `prototype/hollow-twin-product` | User |
| Demo modules | 4 featured (Early Warning, Ledger, Fair Share, Snow) + 5 in a 20 s segment | User |
| Score | Lives first, then fairness, then days | User |
| Data | Real hourly data, not typed approximations | User |
| Story mode | Scripted, auto-playing, pauses at key events | User |
| Cuts | None now; keep a cut priority list | User |
| Deploy | Vercel | User |
| Scale | 2 billion, through 8 sample districts (each stands for 156) | User (8 districts: Claude's recommendation) |
| Directorate | Agent with goals; each choice has a motive, gain and cost | User |
| Directorate display | A separate panel; move other text into hovers and overlays | User |
| Witness trade-off | Keep it, as a sign that the Directorate's choices have reasons | User |
| Claude recap | Cause-and-effect, 3–4 sentences, in STE, template fallback | User |
| Real-world impact | Texas, Flint and Wuhan backtests + live grid for any balancing area | User |
| Effects | Twin split, cinematic cascade, truth wave + Lantern packets | User |
| Earth act placement | It opens the video | User |
| Opening | Real Texas map, then the Early Warning claim | User |
| Weak backtest result | Tune until the result is strong | User |
| Roles | Not fixed; everyone codes with AI agents | User |

## Open questions
- **Tuning on the test event.** The team chose to tune Early Warning until the Texas result is strong. If the thresholds are fitted to Feb 2021, then "warned N hours earlier" shows what the module can do on that event, not what it would have done. A judge can ask. Claude recommends two guards: the hover says "thresholds set on this event", and the same thresholds also run on Winter Storm Elliott (Dec 2022) with that result shown. Team to decide.
- The Flint admission date (Oct 1, Oct 8 or Oct 16, 2015). Confirm from a primary source.
- Is the judging by video only? Is there a length limit? Ask at the Thu JC check-in.
- The Directorate agent's goal weights. Set Thu morning so that its choices look reasonable from its own side.
