# Project skills: what each one does and when to use it

These skills live in `.claude/skills/` and load automatically when you open this repo in Claude Code. Other AIs (Codex, Cursor) can read the `SKILL.md` files directly.

**Skill reminders:** when your prompt looks like a job for a skill but you didn't call it, your AI asks one line, such as "Want to use `/systematic-debugging` for this?". It asks once per skill per session. On the first prompt of each session, the AI also gets a short reminder of which team tool fits which job (`docs/tooling.md`). Answer yes or no and keep going. The rules live in `.claude/skill-triggers.json`.

## By day

| Day | Main skills |
| --- | --- |
| Mon: set goals | `/ideate` → `/interview` → `/prototype` (if a question needs a quick test) |
| Tue–Wed: build | `/parallelize` → `/codex implement` (backend) · `/frontend-design` (new screens) · `/systematic-debugging` · `/handoff` |
| Thu: test | `/agent-browser` · `/webapp-testing` · `/codex review` · `/codex challenge` · `/better-interface` · `/agentation` |
| Fri: polish and submit | `/better-ui` · `/animate` · `/pitch` · `/humanizer` · `/hyperframes` |

## All skills

### Planning and workflow
| Skill | Use it when | Origin |
| --- | --- | --- |
| `/ideate` | You need project ideas, or want to re-score the shortlist | Team (from the video) |
| `/interview` | Starting a project or a big feature, or a plan needs stress-testing ("grill me"). Writes the master spec to `.plans/` | JMO + Matt Pocock `grilling` |
| `/prototype` | A design or logic question needs a throwaway test before you commit to it | Matt Pocock |
| `/parallelize` | The spec is locked and it is time to split the build across agents or teammates (hands off to Paradev `superset:orchestrate`) | Team (from the video) |
| `/handoff` | Someone else (a teammate or a new session) takes over your workstream | Matt Pocock (team override) |
| `/systematic-debugging` | Anything is broken: a bug, a failing test, an error message. Find the root cause before you change code | obra/superpowers |
| `/pitch` | Writing the judge pitch, the demo script, or the Devpost submission | Team (from the video) |

### Codex (second AI)
| Skill | Use it when | Origin |
| --- | --- | --- |
| `/codex review` | A diff is ready to merge. Returns GATE: PASS or GATE: FAIL | JMO + OpenAI plugin |
| `/codex challenge` | You want someone to attack the design or approach | JMO + OpenAI plugin |
| `/codex implement <task>` | A backend task should go to Codex. It runs in its own worktree | JMO + OpenAI plugin |
| `/codex <question>` | You want a second opinion or an investigation | JMO + OpenAI plugin |

### Design and UI
| Skill | Use it when | Origin |
| --- | --- | --- |
| `/frontend-design` | Building a **new** screen, or picking the look. Prevents generic "AI" design | Anthropic |
| `/impeccable` | Shaping UX before code (`shape`), critiquing a design (`critique`), or trying live variants (`live`) | Paul Bakaus |
| `/better-interface` | A full UI audit of the app (once, on Thu) | Jakub Krehel |
| `/interface-review` | Reviewing a branch's UI changes before merge | Jakub Krehel |
| `/better-ui` | Exact polish: radius, shadows, icons, press states | Jakub Krehel (JMO) |
| `/better-typography`, `/better-colors`, `/better-layout`, `/better-accessibility`, `/better-writing` | A specific area needs fixing. `/better-interface` calls these for you | Jakub Krehel |
| `/pick-ui-library` | You need a component (toast, drawer, command menu, chart). Don't hand-roll one | Emil Kowalski |

### Motion
| Skill | Use it when | Origin |
| --- | --- | --- |
| `/animate` | Adding any animation or transition | Emil Kowalski (JMO) |
| `/choreograph` | Several elements enter together (lists, dashboards) | Emil Kowalski |
| `/find-animation-opportunities` | You're unsure where motion would help | Emil Kowalski |
| `/review-animations`, `/improve-animations` | Checking motion that already exists | Emil Kowalski |

### Feedback and QA
| Skill | Use it when | Origin |
| --- | --- | --- |
| `/agentation` | You want to click an element in the running app and say "fix this" | Benji Taylor (JMO) |
| `/agentation-self-driving` | You want the agent to critique the page and annotate it by itself | Benji Taylor |
| `/agent-browser` | Checking that the app really works: click through it, take screenshots, read the console | Vercel |
| `superset:computer` | Driving a native app, the Claude for Chrome side panel, or a real browser window (needs Cua Driver or Peekaboo) | Paradev |
| `superset:orchestrate` | Running and watching the parallel workstream agents as Paradev workspaces (after `/parallelize`) | Paradev |
| `/webapp-testing` | You want repeatable Playwright tests for the demo path | Anthropic |

### Writing
| Skill | Use it when | Origin |
| --- | --- | --- |
| `/ste` | Any explanation, spec, or doc that must be clear (no "levers", "knobs", or "counterfactual") | JMO (upgraded) |
| `/humanizer` | Final prose that people will read: the Devpost, the pitch script, the README. Run it after `/ste` | blader |

### Demo video
| Skill | Use it when | Origin |
| --- | --- | --- |
| `/hyperframes` | Making the demo video or animated title cards (HTML rendered to video) | HeyGen |
| `/hyperframes-cli`, `/hyperframes-registry` | Called by `/hyperframes`. You rarely need them directly | HeyGen |

Full comparison and sources: `docs/skills-review.md`. How the design skills overlap: `docs/tooling.md` → "Which skill when".
