# Shortlist (Tue Nov 17): the Hollow brief

## Round 17 (Wed Nov 18, night): Earth is the product

Scores /30: Wow, Track fit, Feasible by Thu noon, Remote-OK, Live-demo-able, **Applicable** (replaces Team fit). Details: `ideation/ideas.md` → Round 17. The project stays unnamed (another team already uses "HollowGuard").

| Rank | Idea | 30-second moment | Problems | **/30** |
| --- | --- | --- | --- | --- |
| 1 | **R17-A. Before, During, After** (3 models trained on hundreds of US disasters) | Pick Texas 2021: warned N h early, the vulnerable counties to check, then the official count against the model's | 1, 2, 3, 8, 9, 10, 13 | **27** |
| 2 | R17-D. Dark Hours (who stays dark longest) | "The most vulnerable counties stayed dark X% longer" | 2, 8, 10 | 26 |
| 3 | R17-C. The Undercount (independent death counts) | Official deaths against the model's estimate, disaster by disaster | 9, 13 | 25 |
| 4 | R17-B. Warn only, deep | Warning line before every one of 300 events, with its false-alarm rate | 1, 3 | 23 |

**Recommendation:** R17-A, because its three parts are B, C and D, so each part can fail without losing the project, and no other team on the track trains on real data.

---

> **Chosen (Neil, Nov 17): HollowGuard.** Software only. Spec: `.plans/hollow-twin-spec.md`. See "Neil's round 14 table" below.

> **Merge note (Nov 17):** Adarsh ran rounds 14–16 in parallel with Neil, before seeing HollowGuard choice. They are kept here as input for the sync, and they have not been reconciled with HollowGuard yet. Many of the 15 one-problem ideas (Fair Share, Flicker, Snow, Truthcount) could become tools inside HollowGuard.

## Adarsh's round 15 (Tue Nov 17, evening): one idea per problem

> **Adarsh's round 16 (Nov 17):** every project below now has a full build-and-demo sheet (what judges see, the full process, the video script, what we prepare, build hours, risks) in `ideation/projects-1-15.md`.

> **Inputs rule (Adarsh, Nov 17):** we do not pretend real-world sensors are the Hollow. Inputs are resident reports, a fictional "scenario pack" for one sector, user choices, a hidden future for honest forecast reveals, and real safety standards. Turning off the network is real, so ideas 7 and 8 use real phones. Details: `ideation/ideas.md` → Round 15.

Scores are /25: Wow, Active loop, Feasible by Thu night, Demo-able, Connects to the shared spine (report intake, sector graph, offline relay).

| Rank | # | Idea | 30-second moment | **/25** |
| --- | --- | --- | --- | --- |
| 1 | 4 | **Snow** (trace bad water to the broken recycler) | Four unrelated reports trace upstream to one recycler | **23** |
| 2 | 7 | **Lantern** (messages with no network) | Airplane mode on; a help call hops phone to phone; a fake notice is rejected | **23** |
| 3 | 5 | Floodline (flood spread and cut-off deadline) | "Low Market cut off in 3 h, 400 people" | 22 |
| 4 | 2 | Fair Share (verifiable rationing) | Supply to 60%; "Verify" catches a changed plan | 22 |
| 5 | 12 | Larder (food runway and grow plan) | Runway 4.2 days → 23 days | 22 |
| 6 | 9 | Truthcount (real outbreak vs official) | Official 310 vs real 1,240 | 22 |
| 7 | 8 | Kin (family check-ins offline) | 3 green, 1 grey, responder flagged | 21 |
| 8 | 13 | Witness (tamper-proof surface readings) | One changed reading turns every copy red | 21 |
| 9 | 15 | Exodus (plan the move up) | "One more lift saves 11 months" | 21 |
| 10 | 1 | Flicker (blackout early warning) | The hidden future plays; the outage hits as predicted | 20 |
| 11 | 3 | Draft (route cool air down) | Cool air routed to the baby's room | 20 |
| 12 | 6 | Swapline (room swap chains, shared beds) | A 4-way swap, +38% space | 20 |
| 13 | 10 | Runner (triage and medicine delivery) | Clinician approves; runner gets the QR | 20 |
| 14 | 14 | Vanguard (which option, who goes first) | 10,000 missions; the answer flips | 20 |
| 15 | 11 | Dawnline (light and sleep plan) | Body-clock drift flagged | 17 |

**Recommendation for `/interview` (before combining):**
1. **Snow**, because its demo is the clearest cause-and-effect moment (the John Snow story), and its "report → trace on a graph → alert only the right people" engine is the same engine Flicker, Floodline, and Draft need.
2. **Lantern**, because the network is really off in the demo, so nothing is pretend, and it is the delivery layer every other idea uses.

---

## Adarsh's round 14 table (replaced by his round 15: its inputs pretended real sensors were the Hollow)

> **The track changed.** The organizers' doc sets a specific world, "Life underground" (the Hollow), with 15 problems (`context/hollow-brief.md`). Off the Record, Pinpoint, and the Flock ideas do not fit it. Round 14 replaces them. The Off the Record spec and schedule in `.plans/` are no longer the plan.

> **How we build for a fictional world:** a simulated Hollow (a digital twin) produces the problems; the product is real software that reads data, decides, and acts; real phone signals stand in for the fictional ones (a charger pulled = a power cut). Details: `ideation/ideas.md` → Round 14 → "How to build for a world that does not exist".

Scores are /25: Wow, Problems covered, Active loop, Feasible by Thu night, Demo-able.

| Rank | Idea | Hook | Problems | **/25** | Next step |
| --- | --- | --- | --- | --- | --- |
| 1 | **H1. Canary** (residents' phones as sensors, forecasts, offline sound relay) | Pull a charger: the map predicts the next blackout. Turn off Wi-Fi: the warning still arrives by sound. | 10 of 15 | **22** | `/interview Canary` |
| 2 | H3. Undergrid (Canary + Fair Share) | The people's data drives the Directorate's plan | 12 of 15 | 21 | Stretch goal for H1 |
| 3 | H2. Fair Share (verifiable rationing optimizer) | "Heat-danger hours: 2,140 → 310" | 6 of 15 | 21 | Fold into H1 as act 3 |
| 4 | H4. First Light (signed surface readings, first wave, the move) | A changed reading is caught on the public page | 3 of 15 (bonus path) | 19 | Optional closing scene |
| 5 | H5. Lantern (sound-chirp messaging) | Message arrives with Wi-Fi off | 2–4 of 15 | 19 | Part of H1 |
| 6 | H6. Deep Clinic | Offline triage and medicine runs | 3 of 15 | 16 | Drop |

**Recommendation:**
1. **Canary**, because it is the only idea whose demo inputs are real (a pulled charger, a real cough, a real test strip, Wi-Fi turned off), so judges see it work, and it covers 10 of the 15 problems in one loop.
2. **Fair Share as act 3 of Canary (= Undergrid)**, only if Canary's minimum version (power + forecast + sound relay) works by Wed night, because it adds problems 2, 6, and 12 and gives the Directorate side.

---

## Neil's round 14 table

> **Chosen (Neil, Nov 17): HollowGuard.** Software only. Spec: `.plans/hollow-twin-spec.md`. Earshot and Canary are dropped (unknowns and hardware).

Scores are /25: Wow, Cover (Hollow problems), Feasible, Real-world, Video. Details: `ideation/ideas.md` → Round 14 and `ideation/hollow-pivot.md`.

| Rank | Idea | Problems covered | **/25** | Hardware | Next step |
| --- | --- | --- | --- | --- | --- |
| 1= | **Earshot**: the phone listens to machines, lungs and the grid | 1, 3, 4, 5, 9, 10, 11 | **23** | none | 1-hour test: fan baseline and blow test against a peak-flow meter |
| 1= | **Canary + grid sense**: sensor mesh, with an Iberian-blackout backtest | 1, 2, 3, 4, 7, 8, 9, 13 | **23** | buy tonight | Find the Apr 28, 2025 frequency data; buy parts |
| 3 | Canary, as in the pivot doc | 1, 3, 4, 7, 8, 9, 13 | 23 | buy tonight | superseded by the grid-sense version |
| 4 | Off the Record (on hold) | 0 directly | 19 | none | ask a judge whether it is in scope |
| 5 | Fair Share (rationing) | 2, 6, 12 | 17 | none | module only |

**Update (Neil, Nov 17): software only, because no parts can arrive in time.** Both Canary versions are out. **Recommendation: Earshot**, with household props only. It drops the plastic peak-flow meter; the trust beat becomes two phones agreeing on the same blow, plus the straw test.

---

## Round 13 (old teaser track, out of date)

> **Option A chosen (Neil, Nov 17):** an idea qualifies if it clearly beats what already exists, in a way a judge can see. Scores are /25 (Wow, Track, Feasible, Live, Beats existing).

| Rank | Idea | Hook | **/25** | Next step |
| --- | --- | --- | --- | --- |
| 1 | **Off the Record** (audit your ChatGPT history, then mask context clues in new chats) | Court orders 20M ChatGPT logs | **22** | `/interview Off the Record` |
| 2 | **Receipt** (buy at the clean price, with evidence and a complaint) | NYC bans surveillance pricing | **20** | Free 1-hour price-gap test first |
| 3 | Mirror (live AI dox drill, then free opt-outs) | Chatbots dox from broker data | 19 | |

Full list and reasons: `ideation/ideas.md` → Round 13.

## Round 11 table

> **Status (Nov 17):** Ground Truth is rejected, because people do not trust an AI to judge whether a photo is real. Round 11 looked again at Flock cameras. **No clear winner.** If the Unmarked "right to know" framing does not work for the team, scope out and run ideation again.

| Rank | Idea | Hook | Wow | Track | Feasible | Remote | Live | **Total /25** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | AG. Unmarked | "Police can search every Flock camera for 'a blue car with a bumper sticker'" | 4 | 5 | 4 | 4 | 4 | **21** |
| 2 | AH. Watch the Watchers | "An officer used Flock to track his ex more than 2,000 times" | 3 | 5 | 3 | 4 | 4 | 19 |

Team fit is no longer scored (Neil, Nov 17: every member has a coding agent).

## Earlier rounds (kept for reference)

> **Handoff:** Neil ran rounds 1–7 on Nov 16. **Adarsh continues ideation from here.** Read "Neil's criteria" first, then "Open questions".

## Neil's criteria (all rounds so far)

1. **Big wow.** A judge reacts in 5 seconds. Neil rejected rounds 4–5 for low wow.
2. **Daily use or a clear real-world impact.** Judges want to use it themselves, or they see who it saves.
3. **Not done before**, or at least not done this way. Check prior art before scoring.
4. **Mainly digital.** No hardware dependency.
5. **Relevant to GMU or college students**, and on the track theme ("they're watching").
6. **Defeat the system, do not comply with it.** Flagged was rejected because it helped students pass AI proctoring.
7. **Feasible Tue–Wed**, a fast demo (no day of setup), and **more than a thin library or LLM wrapper**.

## Current ranking

| Rank | Idea | Wow | Track | Feasible | Remote | Team | Live | **Total** | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **AD. Pinpoint v2** (remove only the clues that matter, check with 3–4 attackers, keep the photo beautiful) | 5 | 5 | 4 | 5 | 4 | 5 | **28** | **Lead idea.** Neil: "a GREAT idea"; v2 answers his 4 critiques |
| — | AA. Tripwire | 5 | 4 | 4 | 5 | 4 | 5 | 27 | Set aside: few people use AI browsers, so the impact does not feel real (Neil) |
| — | AB. Veil | | | | | | | | Dropped: protective noise can be removed (Hönig et al., ICLR 2025), and we avoid the nudify topic for publicity |
| — | A. Shadow Route | | | | | | | | Already exists (FlockHopper, FlockDetour) |

## How Pinpoint v2 answers Neil's critique (details in `ideation/ideas.md` → Round 8)

| Critique | Answer |
| --- | --- |
| A photo blurred enough to be safe is ugly | Privacy **radius** ("city OK, hide street"), then the cheapest edit first: **crop**, then remove one small object, then recolor, then a decoy caption. People are never edited. Show "96% of pixels unchanged". |
| Blur is not foolproof | The attackers themselves point to the clues (VLM boxes plus a GeoCLIP occlusion map). A loop of 3–4 **independent, fresh** attackers runs until every guess is outside the radius. Report "closest guess 6.2 km away", never "100% safe". |
| Editing by program is hard, and diffusion changes too much | SAM 2 masks plus LaMa inpainting **inside the mask only**. Every other pixel is copied from the original. Prefer cropping for large landmarks. Reject edits with a poor LPIPS score. |
| Veil: noise can be trained around | Correct, and research agrees. Pinpoint **removes** information instead of hiding it under noise, so no future model can recover it. |

## First test (Tuesday morning, 2 hours max)

10 photos (Neil's Zürich photo plus 9 campus photos). Run SAM 2 + LaMa + crops by hand against 2 VLMs and GeoCLIP. **Pass:** ≥ 7 of 10 photos pass a street-level radius with ≥ 90% of pixels unchanged.

## Open questions for Adarsh and the team

1. Misuse: the attacker loop could locate *other people's* photos. Do we show guesses only as distances after the edit, or show pins only for photos from the user's own camera?
2. Default radius: street, neighborhood, or city?
3. Stretch goal: a live camera mode that outlines clues in the viewfinder before the photo is taken ("turn left 10° and the stadium leaves the frame"), so no editing is needed at all.
4. Is Pinpoint v2 ready for `/interview`, or does it need one more round?

## Next steps

1. Adarsh: read `ideation/ideas.md` → Round 8 (Pinpoint v2), then start `/interview Pinpoint v2` or run `/ideate` again.
2. Team vote in the chat.
3. Lock the spec tonight if possible, so that `/parallelize` can start Tuesday.
