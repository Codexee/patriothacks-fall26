---
name: pitch
description: Prepare the demo, judge pitch, demo video, and Devpost write-up following the video's judging playbook. Use on Thursday (test day) and Friday (polish and submit), or whenever someone asks for the pitch, the script, or the submission.
allowed-tools: Read, Glob, Grep, Write, Edit, AskUserQuestion
---

# /pitch — win the judging

These are the video's judging rules, adapted for a **virtual** event:

1. **Lead with the live demo.** Judges know that many teams fake features, so a demo that really works earns trust. Run it live on a screen share when you can. If you must record, record one continuous take with no cuts during the key moment.
2. **Keep the judges talking.** When judging is live, fill the time. Explain the motivation, the state of the world, the technical problems you solved, and the hard trade-offs. Plan more than enough material, so that the judges stay engaged.
3. **Show the technical depth.** Name the hard parts and how you solved them.
4. **Tell the story in this order:** dystopia → victim → tool → live demo → how it works → what's next.

## Steps

1. Read the locked spec (`.plans/*-spec.md`) and the **Status** section in `CLAUDE.md`.
2. Write `docs/pitch.md` with these sections:
   - **Hook (15 s):** a one-line picture of the dystopia.
   - **Problem (20 s):** who suffers, and how. Use a concrete number when possible.
   - **Live demo script:** numbered steps. Each step lists what to click, what the judge sees, and what to say. Mark the "wow" beat.
   - **Under the hood (60 s+):** the architecture and the 3 hardest technical problems.
   - **Why it matters / what's next.**
   - **Backup plan:** what to show if the network, an API, or a piece of hardware fails. Add a pre-recorded clip of the wow beat.
   - **Judge Q&A bank:** 10 likely questions, each with a short answer.
3. Write `docs/devpost.md` with these sections: Inspiration, What it does, How we built it, Challenges, Accomplishments, What we learned, What's next. Write it in Standard Technical English (see `/ste`) and keep it specific.
4. Write a shot list for the demo video in `docs/demo-video.md`. Keep it under 3 minutes unless the rules say otherwise.
5. Check the submission against `context/event.md`, which has the Friday deadline, and the app.patriothackfest.com submission form.
