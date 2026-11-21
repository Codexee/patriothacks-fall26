# HollowGuard: evaluation on Wed Nov 18

Status: input to the spec revision · Branch checked: `prototype/hollow-twin-product` (`6605924`) · Author: Neil (with Claude)

This file compares what the prototype does now with what a 1st-place submission needs. It is the input to the next `/interview` round on `.plans/hollow-twin-spec.md`.

Time left: about 49 hours to the **Fri 6:00 pm** submission target. The deadline is Fri 11:00 pm.

## 1. What works (confirmed by running it)

- `npm run typecheck` passes with no errors.
- `npm run sim -- texas2021 1` runs 10 configurations in 7–13 ms each. The engine is fast enough without a Web Worker.
- The product split works. The 9 modules in `src/product/` read only observations, and the sim applies their outputs. The results come from the modules' decisions, not from fixed constants.
- Texas, seed 1: with no modules, the Hollow is lost on day 16 (710,107 deaths). With all 9 modules, the Hollow is stable on day 22 (3,452 deaths).
- In the browser, "All on" followed by "Skip to end" gives "Stable Hollow on day 22". All 4 Directorate lies show "EXPOSED". The council console shows each module's reasoning, and the Ledger shows a hash-chained list of published findings.
- Track coverage: problems 1, 2, 3, 4, 7, 8, 9, 12 and 13 have working modules (9 of 15).

## 2. What is missing or weak

The list is in order of risk to the win.

### 2.1 No locked spec, and two versions of the code

- The spec says `Status: draft`. It describes the "4 checkbox tools" design, not the product design that is now on Adarsh's branch.
- `prototype/hollow-twin-poc` (Neil) and `prototype/hollow-twin-product` (Adarsh) have different engines. Nobody can build in parallel until the team chooses one base.

### 2.2 The score does not measure lives

The score formula in `src/sim/engine.ts:1128` gives a stable run `MAX_DAYS × 100 + 500`, and gives alive % a weight of only 20. Results from the CLI:

| Run | Deaths | Score |
| --- | --- | --- |
| Fair Share only | 465,050 | 14,866 |
| All 9 modules | 3,452 | 15,433 |
| All 9 except Witness | 4,609 | 15,442 |

A run that kills 135 times more people scores only 4% less. A run that loses more people (without Witness) scores *higher*. A leaderboard or rival built on this score shows the wrong winner.

### 2.3 The data is not real yet

- `src/data/texas2021.ts` uses 11 daily values typed from public reports. The file says so: "approximate shape, not real hourly data yet". Chicago is the same.
- The pitch line "every system runs on a published model or a real dataset" is not true today. A judge who hovers and sees "approximate" will doubt the rest.
- The Wuhan and Flint packs do not exist.

### 2.4 The demo has no clear 30-second moment

- With 9 modules, the screen is mostly text: the console prints about 40 lines per day. On a video, a judge cannot read it.
- "Skip to end" jumps to day 22 at once. Nothing on screen shows the cause and effect, for example "the Ledger exposed the Plant 3 lie, so residents acted 2 weeks early".
- The cutaway (left side) does not show module actions, for example an alert that reaches a level or a fan that moves.
- The "Compare" and "Attribution" tabs exist, but they are not part of a scripted sequence.

### 2.5 Features in the spec that are not built

| Spec item | State |
| --- | --- |
| Claude-written summary of each run | Not built |
| Leaderboard (Supabase) | Not built |
| Rival algorithm and helper | Not built |
| Deployed public URL | Not built |
| Lai et al. validation chart (Wuhan) | Not built |
| Exact Shapley attribution | Estimate only (6 sampled orderings) |

### 2.6 Nothing for the submission yet

There is no pitch script, no video, no Devpost write-up and no `pitch/` folder. The organizers' submission requirements are not published. The judging is probably asynchronous by video, so **the video is the product** for most judges.

### 2.7 The "Teamwork" criterion

In the last 4 days, the git history has 33 commits by Neil, 3 by Adarsh, and 0 by Anish and Darryl. The 2025 rubric scores "shared contributions and clear roles". Each of the 4 members must own a visible part, and the video must show it.

### 2.8 Model results to explain or fix

These come from `PRODUCT-BRANCH.md`:
- The first 4 modules alone now do worse than on Neil's branch (about 460,000 deaths), because the world is harder.
- In Texas seed 2, Witness exposes a lie, the Directorate cuts the network on the worst storm days, and the result is worse with Witness than without it.
- All thresholds are first guesses.
- The Hollow has 1.6 million residents. The track says 2 billion. The pitch must say that one Hollow district is modeled, or the numbers must be scaled.

## 3. What a 1st-place submission needs (assumed rubric: the PatriotHacks 2025 Devpost rubric)

| Criterion | Need | Current state |
| --- | --- | --- |
| Innovation | A technical idea that judges can see | Strong: the "test world vs product" split is new. It must be shown on screen, not only said. |
| People impact | A clear problem and a real benefit | Medium: the real-world cases (Texas, Chicago, Flint, Wuhan) give impact, but the data is approximate. |
| Presentation | One clear story in about 3 minutes | Weak: no script, and the screen is too dense for video. |
| Quality | It works, live, at a public URL | Medium: it works locally. It is not deployed. |
| Teamwork | All 4 members visible | Weak: 2 of 4 members have no commits. |
| Track fit | Several of the 15 problems, connected | Strong: 9 problems with working modules. |

## 4. Recommended changes (for the interview to confirm)

1. Use `prototype/hollow-twin-product` as the base. Lock the spec against it today.
2. Show 4 modules in the main demo: Early Warning, Ledger, Fair Share and Snow. Keep the other 5 running, and show them in one 20-second "the rest of the system" segment.
3. Make the score measure deaths first, then days and fairness. Do this before any leaderboard or rival work.
4. Replace the approximate Texas and Chicago data with real hourly data (EIA-930 and NOAA). If this fails by Thu noon, label the data "shape from published reports" in the hover.
5. Build a "story mode" for the video: a scripted seed that pauses at each key event and draws the event on the cutaway.
6. Deploy a static build (Vercel or GitHub Pages) by Thu noon.
7. Cut the leaderboard and the rival. Build the Claude summary only if the items above are done, and give it a template fallback.
8. Give Anish and Darryl each a full workstream today.
