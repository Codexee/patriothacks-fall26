# Hollow Twin — Master Spec
Status: draft   ·   Last updated: 2026-11-17   ·   Owner: Neil (workstreams chosen at the team sync)

## One-liner
A pixel-art cutaway of the Hollow that you scroll through, with 50 levels and 8 sections per level. It runs real-world datasets and published models (power, air, heat, water, disease, food, medicine, crowding) as the Hollow. It shows how the Directorate's decisions and lies decide the Hollow's fate, and it challenges players to keep the Hollow alive longer with 4 resident tools. It then measures which tool made the difference.

## The winning demo (30-second scene)
1. Scroll down the cutaway, from the ruins on the surface to Level 50. A fixed panel shows the day, the population, the Directorate bulletin ("All levels nominal"), and the measured truth next to it.
2. Load the **Texas, Feb 2021** scenario pack. Hover over Plant 3: "Supply curve: ERCOT hourly data (EIA-930), Feb 10–20, 2021, rescaled to the Hollow." Press **Next day**. Each day plays as a 3–5 s time-lapse. The plants trip, the deep sections go dark tile by tile, and the CO₂ and heat overlays rise. The Directorate's run ends on **Day 19: Hollow lost**.
3. Turn on the tools and play the same seed. The Early Warning flags the cascade 40 hours early. Fair Share spreads the cuts. The Ledger exposes "Plant 3 is fine" as a lie, so residents act 2 weeks earlier. The run reaches **Day 71: Stable Hollow**.
4. The attribution panel shows each tool's share, for example "Ledger +24 days · Fair Share +17 · Early Warning +9 · Layout +2."
5. The auto-summary appears: "The lie about Plant 3 cost the most. Fair Share saved Levels 44–50." The leaderboard shows the player's run above the rival algorithm.

Line for the judges: *"Same plants, same failures. Different decisions."*

## Problem, user, and why now
- **The problem:** in the Hollow, as on Earth, deaths in a crisis depend on decisions and on the truth: who loses power first, and how long officials hide the data. Real cases:
  - **Texas, Feb 2021:** about 70% of ERCOT customers lost power. The official death count is 246; estimates go up to 702.
  - **Chicago, 1995:** the deaths in the heat wave clustered in poor, isolated areas.
  - **Flint, 2014–15:** officials said the water was safe.
  - **Wuhan, 2020:** Lai et al. (Nature, 2020) estimate that acting 1, 2 or 3 weeks earlier would have cut cases by 66%, 86% and 95%.
- **The user:**
  - judges and players, who try to keep the Hollow alive
  - in the story, the residents' council, which uses the tools against the Directorate
- **Why it's credible:** every system runs on a published model or a real dataset, and hovering shows the source.

## Track fit (Life underground: which of the 15 Hollow problems it covers, by number)
**Problems 1, 2, 3, 4, 5, 6, 9, 10, 11, 12** (and 13–14 through the "Stable Hollow" ending). Problem 7 (network shutdown) is a possible later rare event. One connected system covers 10 of the 15 problems.

## Scope
### Must ship (demo path)
1. **Simulation engine** (TypeScript, deterministic, seeded):
   - 50 levels × 8 sections = 400 sections. One tick is 1 hour; one day is 24 ticks.
   - It runs in a Web Worker, so the page doesn't freeze.
   - Same seed + same moves = same result.
2. **Systems and models** (each has a source shown on hover):

   | System | Model | Problem |
   | --- | --- | --- |
   | **Power** | Plant capacity that ages; demand per section; overload trips push load onto other plants (simplified cascading failure) | 1, 2 |
   | **Air** | CO₂ balance per section; fans need power | 1 |
   | **Lung sickness** | Wells–Riley with the Rudnick–Milton CO₂ method (rebreathed fraction), plus a crowding factor | 9 |
   | **Heat** | Geothermal gradient + body heat − cooling; stress limit at a wet-bulb temperature of 31 °C (Vecellio et al., 2022) | 3 |
   | **Water** | Recycler capacity, aging and contamination, leading to waterborne illness | 4 |
   | **Food** | Farm output depends on lamp power; each section has days of reserve | 12 |
   | **Medicine** | Clinic stock and reach, measured in levels | 10 |
   | **Crowding and movement** | People per room; the Directorate controls the lifts between levels | 6 |
   | **Sewage** | Pumps need power; a flooded section cuts off the sections next to it | 5 |
   | **Darkness** | Hours without light raise the sickness rate | 11 |
   | **Aging parts** | Spare parts and maintenance crews are limited | — |

3. **The Directorate:**
   - Its policies (for example "upper levels first") and its **lies** ("hide the outbreak", "water is safe", "Plant 3 is fine") are part of each scenario.
   - A lie **delays the residents' response**, calibrated to Lai et al.'s delay curve.
   - When the truth comes out, **trust falls**, and fewer residents follow alerts.
   - The panel shows each lie next to the truth.
4. **4 resident tools.** Each tool costs crews or power, so every combination involves a trade-off:
   - **Early Warning (problems 1, 3):** forecasts failures from measured signals.
   - **Fair Share (problems 2, 3, 12):** an allocation optimizer that aims to make the worst-off section as well off as possible (max-min fairness).
   - **Ledger (problems 9, 13):** residents' own measurements, published. It removes the delay caused by a lie.
   - **Layout planner (problems 3, 6):** move or build fans, pumps, farms, clinics and recyclers, within the parts and crews available.
5. **Turns:**
   1. The player makes the day's choices: allocation, which tools are on, layout changes, and lift access.
   2. The player presses **Next day**, and the day plays as a 3–5 s time-lapse.
   3. The run ends at **"Hollow lost"**: more than half of the population is lost, or 10 levels are fully lost.
   4. It also ends at **"Stable Hollow"** (equilibrium): 14 days in a row with the power margin at 0 or above, the wet-bulb temperature below 31 °C, safe CO₂, food reserves not falling, and infections falling. *(Claude's default for these thresholds.)*
6. **Modes:**
   - **Challenge:** a fixed daily seed, the leaderboard, and at most 3 hints.
   - **Sandbox:** any scenario pack, tools and lies, and unlimited hints. The hint button is shown only when the player asks for it. A small nudge appears when the player is failing or has stopped making progress.
7. **Rival and helper:** a search algorithm with a fixed compute budget per day (beam search or Monte Carlo rollouts, about 2,000 rollouts, running during the time-lapse).
   - **As the rival,** it plays the same seed, and its score is on the leaderboard.
   - **As the helper,** it suggests the single best next move and gives its reason.
8. **Attribution panel:** after a run, or on request in the sandbox, the worker replays the run with all 16 on/off combinations of the 4 tools. It then shows each tool's share of the result as **Shapley values**, a standard method for dividing credit fairly among the parts that produced a result.
9. **Scenario packs:** each pack is a real dataset, bundled as JSON and rescaled to drive one system:

   | Pack | Data | Drives |
   | --- | --- | --- |
   | Texas, Feb 2021 | EIA-930 ERCOT hourly supply and demand | the plants and the cascade |
   | Chicago, July 1995 | NOAA hourly temperature and humidity | the heat |
   | Wuhan delay, 2020 | Lai et al. delay results | the outbreak and the cost of each lie |
   | Flint, 2014–15 | lead sampling results | the water and the "water is safe" lie |

10. **Score:** weighted points, with the parts shown: days survived, people alive, and fairness (the gap between the best and worst level). A bonus is added for reaching "Stable Hollow". *(The exact weights are Claude's default, to be tuned on Thu.)*
11. **Findings summary:**
    1. The simulation computes the facts: what failed and when, which tool mattered, and which lie cost the most.
    2. Claude (claude-opus-5-5, through a serverless function) writes a short report from those facts only.
    3. If the API fails, a fixed template writes the report instead.
12. **Shared leaderboard:** Supabase. Each entry holds a name, the seed, the score with its parts, and the list of moves. A serverless function replays the moves to check the score. No accounts.
13. **Hover:** every tile and every number in the panel shows the model, its equation, the dataset, and a link to the source.

### Nice to have (only after must-ship is green)
- A network-shutdown event (problem 7) that happens rarely: alerts spread only from section to section.
- Return to the surface (problems 13–14): scouts and suits after a "Stable Hollow" ending.
- More scenario packs (Iberia 2025 grid oscillations).
- Art polish, animation and sound.

### Explicit non-goals
- Real-time play (turns are deliberate, so runs can be replayed and checked).
- Accounts and login.
- Precise forecasts of real-world events. The models are illustrative: they use published equations and data, rescaled to the Hollow. The site says so.
- Copying Terraria's art or assets. Only the visual style is a reference.

## Architecture
```
packages/sim      deterministic engine: systems, Directorate, tools, scoring, end states (pure TS, no DOM)
packages/search   rival + helper (budgeted search), Shapley attribution (16 runs)
data/packs        scenario packs (JSON) + loaders/rescalers + source metadata for hovers
apps/web          Vite + React (panel, controls, hovers, leaderboard, summary) + PixiJS (cutaway renderer)
                  sim + search run in Web Workers
api/              serverless: POST /summary (Claude, facts only) · POST /score (replay-verify, write Supabase)
```
Data flow for one day:
1. The player's choices go to the sim worker.
2. The worker runs 24 ticks and sends back a state frame for each tick.
3. PixiJS animates the frames as the 3–5 s time-lapse.
4. The panel updates.
5. During the time-lapse, the rival worker thinks about its own move for the next day.

## Data & seeding plan
- **Scenario packs:** each dataset is downloaded once and committed as JSON with its source metadata. The loaders rescale each dataset to the Hollow's units. For example, the ERCOT supply curve becomes a plant capacity curve.
- **Daily seed:** the seed comes from the date. The demo uses a fixed seed and a fixed pack, rehearsed in advance.
- **Validation:** a script shows that the outbreak model with lie delays of 1, 2 and 3 weeks reproduces about 66/86/95% fewer cases (Lai et al.). The page shows the result as a chart.

## UI / UX direction
- **The cutaway:** one tall page you scroll. Each level is a row of 8 section tiles, in the style of Terraria: side view, cave and industrial tiles.
- **Status overlays on the tiles:**

  | Overlay | Shows |
  | --- | --- |
  | Dark tiles | no power |
  | Red haze | heat |
  | Grey-green fog | CO₂ |
  | Brown drips | bad water |
  | Blue water | flooding |
  | Icons | farms, clinics, fans, pumps |

- **The fixed panel:**
  - the day and the end-state progress
  - the population
  - the Directorate bulletin next to the measured values
  - tool toggles
  - the Next day button
  - the hint button
- **Art:** functionality comes first. Use a CC0 tileset (Kenney or itch.io) and recolor it. Make any missing sprite with the Codixel Claude Code skill (github.com/mankidev/codixel, MIT). Don't polish the art before the sim works.

## Hardware (if hybrid)
None. Software only.

## Workstreams
Owners are chosen at the sync.

| # | Workstream | Owner | Files/dirs owned | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| 1 | Sim engine + models | tbd | `packages/sim` | — | Texas pack seed runs 60 days deterministically; each system unit-tested; Lai validation script passes |
| 2 | Scenario packs | tbd | `data/packs` | 1 (interfaces) | 4 packs load, rescale, and carry source metadata |
| 3 | Renderer | tbd | `apps/web/src/world` | 1 (state frame type) | 400 tiles with overlays at 60 fps; day time-lapse |
| 4 | Panel, controls, hovers | tbd | `apps/web/src/ui` | 1, 2 | Full day loop playable; every hover shows a source |
| 5 | Rival, helper, attribution | tbd | `packages/search` | 1 | Rival beats random play; helper suggests in < 5 s; Shapley panel for 16 combos |
| 6 | API + leaderboard + summary | tbd | `api/` | 1, 5 | Score replay-verified; Claude summary with template fallback |
| 7 | Pitch + video | tbd | `pitch/` | all | 3-minute video |

**Day-1 interfaces** (agree on these first, in `packages/sim/src/types.ts`):
- `State`
- `Action`
- `Scenario`
- `step(state, actions, seed) → frames[]`
- `score(state)`
- `endState(state)`

## Risks & fallbacks
| Risk | Fallback |
| --- | --- |
| The sim is too slow for 16 attribution runs at 400 sections | Run the attribution at 1 tick per 4 hours; or show only "each tool alone" (5 runs) |
| The models are too complex to finish | Ship power, air, heat, sickness and the Directorate first; add water, food, medicine, sewage, darkness and parts in that order |
| The game is too easy or too hard | Tune on Thu with the rival's score as the reference |
| The rival is weak | Make it a greedy rule-based player; it is still a baseline to beat |
| Judges call it "just a game" | Hover sources, the Lai validation chart, the real-data packs, and the fate report written as a plan |
| Supabase or Claude is down | Local leaderboard; template summary |
| Pixel art takes too long | Flat colored tiles with overlays; art is the last thing we polish |

## Demo script & pitch beats (3 min, assumed)
1. **0:00–0:20:** the Hollow, and its real-world twin: Texas 2021, Chicago 1995, Flint, Wuhan. "The same thing kills people: bad decisions and hidden truth."
2. **0:20–1:10:** scroll the cutaway, load the Texas pack, hover over a source, and play the Directorate's run until the Hollow is lost.
3. **1:10–2:10:** play the same seed with the tools until the Hollow is stable. Then show the attribution panel and the lie that cost the most.
4. **2:10–2:40:** a challenge run against the rival, the hints, and the leaderboard and summary.
5. **2:40–3:00:** the Lai validation chart, then "Try to keep the Hollow alive" and the URL.

## Decisions made in this interview
| Decision | Answer | Source |
| --- | --- | --- |
| Layout | Levels split into sections with status tiles; fixed panel | User |
| Emotional hook | No single family; the hook is that the sim runs real-world data as the Hollow | User |
| Sources | Hover on every tile and number shows the model and data source | User |
| Core loop | Challenge + sandbox | User |
| Real data | Bundled scenario packs: Texas 2021, Chicago 1995, Wuhan delay, Flint | User |
| Tool effects | Any combination; Shapley attribution over 16 runs | User |
| Optimizer | Rival and helper: unlimited hints in the sandbox, on request only; 3 hints in competitive mode | User |
| Turns | One turn per day; the day plays as a 3–5 s time-lapse; ends at "Hollow lost" or at a stable equilibrium | User |
| Lies | They delay the response, and trust falls when the truth comes out | User |
| Factors | Food, medicine, crowding, movement, sewage, darkness, aging parts (plus the core systems) | User |
| Network shutdown | Out for now; a possible rare event later | User |
| Summary | Facts computed by the sim + a Claude narrative, with a template fallback | User |
| Competition | Shared leaderboard with replay verification | User (replay verification: Claude's default) |
| Score | Weighted points, with the parts shown | User (weights: Claude's default) |
| Scale | 50 levels × 8 sections | User |
| Stack | Vite + React + PixiJS, sim in Web Workers, Supabase, serverless functions | User |
| Art | CC0 tileset + Codixel for missing sprites; the demo works before the art is polished | User |
| Thresholds for the end states | As listed in Scope §5 | Claude's default |

## Open questions
- The score weights, and the exact thresholds for "Stable Hollow". Tune them Thu.
- Raw data availability. ERCOT Feb 2021 (EIA-930) and NOAA hourly for Chicago Midway, July 1995, should be public. Flint lead sampling: Virginia Tech's Flint Water Study data. Confirm each one Wed morning.
- Is the judging format a video only? Is there a video length limit?
- Who owns each workstream? Decide at the sync.
