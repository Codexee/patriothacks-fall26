# Shortlist (round 8, Mon Nov 16)

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
