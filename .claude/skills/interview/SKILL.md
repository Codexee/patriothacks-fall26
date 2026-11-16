---
name: interview
description: Interview the user relentlessly about a project idea until there is no ambiguity left, then write a master spec to .plans/ that every agent on the team builds against. Use at the start of any project or major feature, or when a request is vague.
allowed-tools: AskUserQuestion, Read, Glob, Grep, Write, Edit, WebSearch, WebFetch, Agent
---

# Interview → master spec

Based on Johnathan Mo's `/interview` (jmo-skills, MIT). It is the step he credits most for his wins: he spent 2–3 hours being interviewed about the Opticon plan before he wrote any code. This version adds hackathon context, a fixed spec format, and a task breakdown that `/parallelize` can use.

## 0. Load context before you ask anything

Read these files if they exist. Do not ask questions that they already answer.

- `CLAUDE.md`, `context/event.md`, `context/team.md`, `context/constraints.md`
- `ideation/shortlist.md`, `ideation/decisions.md`
- Every file in `.plans/`. If a spec exists for this topic, you are **revising** it. Do not start over.

## 1. Start from the winning demo (think backward)

Your first questions are about the end state, not the implementation:

- What exact moment in the demo makes a judge say "this one wins"? Write it as a 30-second scene.
- What does the judge see on screen, second by second?
- Which part must be live, and which part can be pre-recorded or seeded?

Every later decision must serve that scene. If an answer does not serve it, say so.

## 2. Interview

Use AskUserQuestion. Ask up to 4 questions per round. Each question needs 2–4 concrete options, with your recommended option first and marked "(Recommended)". Keep going round after round until the spec is complete.

Rules:

- **No obvious questions.** Do not ask "what language?" when the team or the repo already decides it. Ask about the things that break hackathon projects: scope, the demo path, data sources, how to fake or seed data, auth, latency, offline behavior, what happens on stage when the network fails, who owns which part, and how much time each part may take.
- Cover all of these areas: the problem and the user; the demo moment; core features vs. cut lines; technical architecture; data and APIs; UI and UX feel; hardware, if any (parts, where to buy, arrival date, software fallback); risks and fallbacks; ethics and safety; division of work across remote and local teammates; the pitch.
- Push back. If an answer adds scope without making the demo better, say so and offer a smaller option.
- When the user is unsure, research it (WebSearch or WebFetch), then ask again with real options.
- Track open questions. Stop only when none are left, or when the user says "write it".

## 3. Write the spec

Save to `<repo root>/.plans/<kebab-name>-spec.md`. Use the absolute path and say the path in your reply. Do not save specs under `~/.claude/`.

Use exactly this structure:

```markdown
# <Project name> — Master Spec
Status: draft | locked   ·   Last updated: <date>   ·   Owner: <name>

## One-liner
## The winning demo (30-second scene)
## Problem, user, and why now
## Track fit (Best Solution for a Dystopian World: navigate / survive / rebel)
## Scope
### Must ship (demo path)
### Nice to have (only after must-ship is green)
### Explicit non-goals
## Architecture
(components, data flow, tech stack, external APIs/MCPs, a diagram in text or Mermaid)
## Data & seeding plan
## UI / UX direction
(reference designs to copy from, feel, key screens)
## Hardware (if hybrid)
(part list, source, cost, arrival date, who holds it, software-only fallback)
## Workstreams
| # | Workstream | Owner | Files/dirs owned | Depends on | Done when |
## Risks & fallbacks
## Demo script & pitch beats
## Open questions
```

The **Workstreams** table is the input to `/parallelize`. Each workstream must own its own directories, so that parallel agents never edit the same files.

## 4. After writing

- Add a one-line entry to `ideation/decisions.md` (date, decision, why).
- Tell the user to set `Status: locked` once the team agrees. After that, every agent treats the spec as the source of truth. Changes go through another `/interview` round, not through quiet drift.

<instructions>$ARGUMENTS</instructions>
