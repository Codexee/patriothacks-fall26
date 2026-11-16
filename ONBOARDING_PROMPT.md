# Onboarding prompt for a teammate's AI

Clone https://github.com/Codexee/patriothacks-fall26 (ask Neil for a collaborator invite), then paste everything in the box below into Claude Code (or Codex or Cursor), opened **inside the repo folder**.

```text
You are joining my team's AI setup for Patriot HackFest Fall 2026 (GMU, virtual, Nov 14–20, 2026).
The track is "Best Solution for a Dystopian World": build a tool to navigate, survive, or rebel
against a dystopian future. We are playing to win 1st place.

This repository is our shared brain. Every teammate's AI reads the same files, so we all work from
the same context. Do the following in order, and do not skip steps:

1. Read AGENTS.md (and CLAUDE.md if you are Claude Code), then every file in context/, then
   ideation/shortlist.md, ideation/decisions.md, and any .plans/*-spec.md. Treat a spec with
   "Status: locked" as the source of truth.

2. Check my toolchain and tell me exactly what is missing. Do not install anything without asking me:
   - Claude Code signed in; Codex CLI (`codex --version`, then `codex login`)
   - The jmo-workflow plugin (`claude plugin list`)
   - Paradev, formerly Superset (parallel agents in git worktrees). It is a macOS Homebrew cask.
     On other systems, suggest the alternatives listed in scripts/setup.sh
   - Offer to run `bash scripts/setup.sh` for me.

3. Confirm that the project skills in .claude/skills/ are available to you (/ideate, /interview,
   /parallelize, /codex, /pitch, /ste, /better-interface, /better-ui, /animate, /agentation, …).
   If you are not Claude Code, read the SKILL.md files directly and follow them when I name a skill.

4. Onboard me to the team. Use multiple-choice questions where you can. Ask:
   - my name (match it to a row in context/team.md if one exists),
   - whether I am local to GMU or remote,
   - my strongest skills (frontend, backend, ML/AI, hardware/EE, design, pitching),
   - which role and workstream I want. Roles in context/team.md are temporary, so I can change mine.
     If a locked spec exists, show its Workstreams table and its open owner slots.
   Then update my row in context/team.md, add a line to ideation/decisions.md, and show me the diff
   before you commit and push.

5. Give me a 5-line briefing: today's date versus the calendar in context/event.md, where the team
   is (the "Where we are" section of AGENTS.md), the current top idea, what I should do next, and the
   next in-person or online event.

Rules for the rest of the week:
- Follow context/video-playbook.md: think backward from the winning demo, plan before coding,
  one workstream per worktree, Claude for the frontend and Codex for the backend, copy references
  from inspiration/, and use a live demo.
- Write explanations in Standard Technical English (/ste).
- Respect context/constraints.md: remote-first, the hybrid hardware gate, and ethics.
- Touch only the files my workstream owns. Pull before you start and push when you finish.
- Log every decision in ideation/decisions.md.
```
