---
name: ideate
description: Generate and rank hackathon project ideas by thinking backward from the winning demo. Use when the team needs ideas, wants to add an idea to the shortlist, or needs to re-score ideas after the track or constraints change.
allowed-tools: Read, Glob, Grep, Write, Edit, WebSearch, WebFetch, AskUserQuestion
---

# /ideate — think backward from the winning demo

This is step 1 of the workflow in `context/video-playbook.md`. Picture the team on stage after winning. What demo did the judges see?

## Inputs (read first)

- `context/track.md`: the Hollow world and its 15 problems (the track brief)
- `context/event.md`: the track, prizes, calendar, and rules
- `context/past-winners.md`: what has already won at GMU, and what is overdone
- `context/team.md` and `context/constraints.md`: skills, who is remote, and the hardware rules
- `ideation/ideas.md` and `ideation/shortlist.md`: do not duplicate existing ideas. Extend them.
- `inspiration/`: any saved Twitter/X or Cosmos references

## Method

1. **Write the demo first.** For each idea, write the 30-second judge moment before you write any feature list.
2. **Start with the craziest idea, then check whether it can be built.** Write the wildest version, then the version that can ship by Thursday's test day. Keep the wild part in the demo when you can.
3. **Check for overlap.** Compare with `context/past-winners.md`. GMU has seen many "AI assistant for X" winners. An idea that looks like a past winner needs a sharper angle.
4. **Score each idea from 1 to 5 on each criterion:**
   - **Wow:** does the demo make a judge react right away?
   - **Track fit:** how many of the 15 Hollow problems (`context/track.md`) does it address directly, and does the demo show them?
   - **Feasible:** can it be built in the Tue–Wed build window, with Thu for testing?
   - **Remote-OK:** can the two remote members do half of the work? Does any hardware arrive in time, with a software fallback?
   - **Team fit:** does it use the EE strengths and the backend/competitive-programming (CP) strength?
   - **Live-demo-able:** can it run live during a virtual judging call, with no faked parts?

   Total = sum. Ties are broken by Wow.
5. **Run the hardware gate** (hybrid ideas only). List each part with its source (Micro Center Fairfax, GMU labs or makerspace, Amazon Prime 1-day) and cost, and the date it arrives. Any part that arrives after Tuesday night, or that has no software-only fallback, fails the gate.

## Output

- Add new ideas to `ideation/ideas.md` using the template in that file.
- Rewrite the ranked table in `ideation/shortlist.md`.
- Write in Standard Technical English (see `/ste`).
- End by recommending the top 1–2 ideas to take into `/interview`, with one sentence for each on why.

<instructions>$ARGUMENTS</instructions>
