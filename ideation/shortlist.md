# Shortlist (round 7, Mon Nov 16)

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

| Rank | Idea | Problem source | Wow | Track | Feasible | Remote | Team | Live | **Total** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **AA. Tripwire** (stops pages from hijacking your AI browser) | UW AI-browser study; LayerX BioShocking (2026) | 5 | 4 | 4 | 5 | 4 | 5 | **27** |
| 2 | **Q/AC. Pinpoint** (your photos show where you live; upgraded to a whole photo grid) | MultiPriv (2026); GeoSpy stalking (2025) | 5 | 5 | 4 | 4 | 4 | 5 | **27** |
| 3 | **AB. Veil** (your photos fail in nudify apps, even after upload) | Nudify apps, 705M downloads; SF City Attorney (Jul 2026) | 5 | 5 | 3 | 5 | 4 | 4 | **26** |
| — | Round 5 (Muffle, Unsign, Crowd, Hum) | | | | | | | | Neil: low wow |
| — | Round 6 (Ghost Price 24, Watched 25) | | | | | | | | Weak, prior art |
| — | A. Shadow Route | | | | | | | | **Already exists** (FlockHopper, FlockDetour) |
| — | H. Hush | | | | | | | | On hold (hardware) |

Tripwire and Pinpoint tie, and both have Wow 5. Tripwire is listed first because its demo works the same way every time (we host the attack page).

## The first test for each top idea (Tuesday morning, 2 hours max)

| Idea | Test | Pass |
| --- | --- | --- |
| Tripwire | Hidden-text attack on our own page against browser-use, and against Comet with the extension installed | The attack works without Tripwire, and Tripwire's DOM rewrite reaches the agent in at least the open-source agent |
| Pinpoint | 20 dorm-window photos against Mapillary images plus 30 min of campus video | ≥ 12 of 20 within 50 m |
| Veil | Protect 5 photos, run JPEG q=75 plus resizing, then an SD inpainting edit | ≥ 4 of 5 edits visibly broken after compression |

## Open questions for Adarsh and the team

1. Does any of AA, AB, or AC meet Neil's bar? If not, which criterion bends? (Almost every daily-use privacy problem already has some tool.)
2. Tripwire: is the "AI browser" story strong enough on the theme ("they're watching")? A possible framing: "the AI you trust is the one they turn against you."
3. Veil: can we show the demo with benign edits only and still make the impact clear?
4. Combination: Pinpoint and Veil both protect photos before posting. They could be one product ("Before you post"), with two checks.

## Next steps

1. Adarsh: read `ideation/ideas.md` → Round 7, then run `/ideate` again or start `/interview <idea>`.
2. Team vote in the chat.
3. Lock the spec tonight if possible, so that `/parallelize` can start Tuesday.
