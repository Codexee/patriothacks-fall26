---
name: interview
description: Interview the user relentlessly about a project idea until there is no ambiguity left, then write a master spec to .plans/ that every agent on the team builds against. Use at the start of any project or major feature, when a plan needs stress-testing ("grill me"), or when a request is vague.
allowed-tools: AskUserQuestion, Read, Glob, Grep, Write, Edit, WebSearch, WebFetch, Agent
---

# Interview → master spec

This skill combines two sources:
- **Johnathan Mo's `/interview`** (jmo-skills, MIT). Every instruction from it is kept and marked **[JMO]**.
- **Matt Pocock's `grilling` loop** (mattpocock/skills, MIT), which supplies the questioning method: a design tree, rounds, and recommended answers.

This repo adds the hackathon context, the demo-first opening, and a spec format that `/parallelize` can split.

## 0. Load context before you ask anything

Read these files if they exist:
- `CLAUDE.md`, `context/event.md`, `context/track.md`, `context/team.md`, `context/constraints.md`
- `ideation/shortlist.md`, `ideation/decisions.md`
- every file in `.plans/`

If a spec for this topic already exists, you are **revising** it. Do not start over. Never ask what these files already answer, and never reopen a decision that `decisions.md` records, unless the user asks you to.

## 1. Build the design tree

Interview the user relentlessly until you reach a shared understanding. Map the work as a **design tree**: every decision branches into the decisions that depend on it.

The **root** is the end state, found by thinking backward:
- What exact moment in the demo makes a judge say "this one wins"? Write it as a 30-second scene.
- What does the judge see on screen, second by second?
- Which parts must run live, and which can be seeded?

Every other branch must serve that scene. If an answer does not serve it, say so.

The tree must cover all of these areas **[JMO: "literally anything: technical implementation, UI & UX, concerns, tradeoffs, etc."]**:
- the problem and the user
- the demo moment
- core features and the cut lines
- technical architecture
- data and APIs
- UI and UX feel
- hardware, if any: parts, source, arrival date, and the software fallback
- risks and fallbacks
- ethics and safety
- who owns what, across remote and local members
- the pitch

## 2. Ask in rounds

The **frontier** is every decision whose prerequisites are already settled. These are the questions you can ask *now* without guessing at answers you have not heard yet.

Each round:
1. Ask the **whole frontier** with AskUserQuestion **[JMO]**. One call holds up to 4 questions. If the frontier is bigger, make more AskUserQuestion calls in the same round.
2. Give every question 2–4 concrete options. Put your **recommended answer first**, labelled "(Recommended)". Word the question so that picking the first option accepts your recommendation.
3. Wait for the answers. Then recompute the frontier. Settled decisions push the frontier outward and unblock the questions that depended on them.
4. If a question depends on another question that is still open in this round, it belongs to a **later** round.

Rules:
- **Make sure the questions are not obvious [JMO].** Do not ask what the repo or the team already decides. Ask about what breaks hackathon projects: scope, the demo path, data sources, how to fake or seed data, auth, latency, offline behavior, what happens when the network fails during the demo, ownership, and time budgets.
- **Finding facts is your job, never the user's.** When a frontier question needs a fact from the environment (the code, docs, APIs, prices, part stock), send a sub-agent (Agent tool) with a fresh context to find it, or use WebSearch or WebFetch. Do not block on it. A running lookup is an unsettled prerequisite, so only the questions that depend on it wait. Ask the rest of the frontier now.
- **The decisions are the user's.** Put each one to them and wait.
- **Push back.** If an answer adds scope without improving the demo, say so and offer a smaller option.
- **Be very in-depth, and keep interviewing until the spec is complete [JMO].** The interview ends when the frontier is empty: every branch visited and nothing silently assumed. It also ends if the user says "write it".
- Do not act on the result until the user confirms that you have reached a shared understanding.

## 3. Write the spec to a file [JMO]

**Save location [JMO]:** `<cwd>/.plans/<relevant-name>-spec.md`
- `<cwd>` is the repository root: the project you are working in. Specs live with the code they describe, so they are easy to find, open in an editor, and commit alongside the work.
- `<relevant-name>` is a short kebab-case slug for the topic, ending in `-spec.md`, for example `shadow-route-spec.md`.
- Create `.plans/` if it does not exist.
- Always resolve and write the **absolute path**, and **state the path** in your reply.
- **Do not save specs under `~/.claude/`.** They become impossible to find there.

Use exactly this structure:

```markdown
# <Project name> — Master Spec
Status: draft | locked   ·   Last updated: <date>   ·   Owner: <name>

## One-liner
## The winning demo (30-second scene)
## Problem, user, and why now
## Track fit (Life underground: which of the 15 Hollow problems it covers, by number)
## Scope
### Must ship (demo path)
### Nice to have (only after must-ship is green)
### Explicit non-goals
## Architecture
(components, data flow, stack, external APIs/MCPs, a diagram in text or Mermaid)
## Data & seeding plan
## UI / UX direction
(reference designs to copy, the feel, key screens)
## Hardware (if hybrid)
(part list, source, cost, arrival date, who holds it, software-only fallback)
## Workstreams
| # | Workstream | Owner | Files/dirs owned | Depends on | Done when |
## Risks & fallbacks
## Demo script & pitch beats
## Decisions made in this interview
(each decision, its answer, and whether it was the user's choice or your default)
## Open questions
```

The **Workstreams** table is the input to `/parallelize`. Each workstream owns its own directories, so parallel agents never edit the same files.

## 4. After writing

- Add one line per major decision to `ideation/decisions.md` (date · decision · why · who).
- Ask the user to set `Status: locked` once the team agrees. After that, every agent treats the spec as the source of truth. Changes go through another `/interview` round, never through quiet drift.

<instructions>$ARGUMENTS</instructions>
