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

- **Phase:** Mon Nov 16, ideation (calendar: "review the challenge, set goals, choose a project direction").
- **Done:** repo, shared context, skills, and the round-1 idea shortlist (`ideation/shortlist.md`).
- **Next:** team vote, then `/interview <idea>`, then lock the spec tonight, then `/parallelize` on Tuesday morning.
- **Blockers:** none.

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
