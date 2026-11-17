# Team brief for every AI agent (Claude, Codex, Cursor, …)

We are a 4-person team competing in **Patriot HackFest Fall 2026** (George Mason University, virtual, **Nov 14–20, 2026**). The goal is to **win 1st place ($2,000)**.

**Track:** *Best Solution for a Dystopian World*. Build a tool to **navigate, survive, or rebel** against a dystopian future ("they're watching").

## Read before doing anything

| File | What it holds |
| --- | --- |
| `context/event.md` | Track text, prizes, the **calendar**, check-in times, the judging stand-in |
| `context/constraints.md` | **Hard rules**: remote-first, the hybrid hardware gate, ethics |
| `context/team.md` | Who is on the team, their skills, local or remote, and who owns which workstream |
| `context/video-playbook.md` | The 4-step winning workflow we follow, and the skill map |
| `context/past-winners.md` | What has won at GMU before, and what is overdone |
| `ideation/shortlist.md` | Current ranked ideas and the recommendation |
| `ideation/decisions.md` | Every decision so far. Do not re-open a decision without a reason. |
| `.plans/*-spec.md` | **The master spec. If one has `Status: locked`, it is the source of truth.** |

## Where we are (update this section after every milestone)

- **Phase:** Tue Nov 17, spec drafted; build starts after the team sync.
- **Done:** repo, shared context, skills, hooks, and **ideation rounds 1–13** (`ideation/ideas.md`, `ideation/shortlist.md`). **Read the top entry of `CHANGELOG.md`.**
- **Next:** the team reads `.plans/off-the-record-spec.md` and `.plans/off-the-record-schedule.md`, assigns workstreams at the sync, sets `Status: locked`, then `/parallelize`. Tue-night gate: agent reads only the rewritten DOM: **passed** with the Claude in Chrome tools (branch `prototype/agent-view-gate`); one by-hand side-panel test is left. GLiNER in the browser: **passed** (83 ms against a 500–1000 ms budget; branch `prototype/gliner-bench`).
- **Blockers:** the spec is a draft (not locked); the judging format is unknown (ask the directors).

## Start of every session (all AIs)

1. Run `git fetch`. If this copy is behind `origin/main`, tell the user and offer to run `git pull` (ask first if there are uncommitted changes). Then show the top entry of `CHANGELOG.md`. In Claude Code, `scripts/hooks/sync_check.sh` does this automatically.
2. Pick skills from `docs/skills.md`.

## Skill reminders (all AIs)

When a request looks like a job for a project skill (see the patterns in `.claude/skill-triggers.json`) and the user did not name that skill, **ask the user in one short line whether to use it** ("Want me to use /systematic-debugging for this?") before you start. Ask at most once per skill per session. Never run the skill without a yes. In Claude Code, `scripts/hooks/skill_nudge.py` sends this reminder automatically. Codex, Cursor, and other AIs must follow this rule themselves.

## Keeping the team in sync

When you change shared context, skills, hooks, or the workflow: add an entry at the top of `CHANGELOG.md` (what changed, and what each teammate must do), then commit and push.

## How we work

1. **Think backward from the winning demo.** Every feature must serve the 30-second judge moment in the spec. If it does not, push back.
2. **Plan, then parallelize.** No large coding before a locked spec. After that, each workstream runs in its own git worktree or Superset workspace and touches **only its own directories** (see the spec's Workstreams table).
3. **Frontend → Claude. Backend → Codex** (`/codex implement`). Review each other's work with `/codex review`.
4. **Copy, don't invent.** For UI, start from a reference in `inspiration/`. Polish with `/better-interface`, `/better-ui`, `/animate`, and `/agentation`.
5. **Write clearly.** Every explanation, doc, and Devpost text follows `/ste` (Standard Technical English). No "levers", "knobs", or "counterfactual".
6. **Keep the demo live.** Seed the demo data. Every external dependency needs a fallback.
7. **Ethics:** defensive, consent-based tools only. Never target or deanonymize real people.

## Repository rules

- Commit small, working steps with clear messages. Pull before you start work and push when you finish.
- Never commit secrets. Use `.env.local`, which git ignores. Document each variable name in `.env.example`.
- When you make a decision, add one line to `ideation/decisions.md`.
- When you finish a milestone, update "Where we are" above.
- The `app/` directory and the stack are decided in the locked spec. Do not scaffold a framework before the spec is locked.
