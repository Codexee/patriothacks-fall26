# Off the Record: build plan and schedule

Status: **on hold** (the Hollow track brief arrived; see `ideation/hollow-pivot.md`) · was draft · Last updated: Tue 2026-11-17 · Source of scope: `.plans/off-the-record-spec.md`

All times are US Eastern. Submission is **Fri Nov 20**. The official deadline is **Fri 11:00 pm** (`context/event.md`).

## Gates (a gate stops the plan if it fails)

| Gate | When | Pass condition | If it fails |
| --- | --- | --- | --- |
| G1: GLiNER in the browser | Tue | < 1000 ms per prompt | **Passed:** 83 ms (branch `prototype/gliner-bench`) |
| G2: Agent reads only the rewritten page | Tue night (**passed Tue afternoon** with the Claude in Chrome tools; branch `prototype/agent-view-gate`. The real side panel is still to test) | Claude for Chrome's text read, accessibility tree and screenshot of the fake page contain 0 real values, and a stand-in typed by the agent becomes the real value at submit | The video uses our own Playwright harness for the agent half |
| G3: Full bank run | Wed night | Harness runs "categorize + pay bill" end to end, compromised mode leaks only stand-ins, counter reads 0 | Cut the live harness from the site; show a recorded run |
| G4: Feature freeze | Thu 12:00 pm | Every must-ship item works on the deployed site | Cut in this order: Unsign → companion app → WebLLM in Chat tab → Leak Test LLM (use a saved run) |
| G5: Submitted | Fri 2:00 pm | Video uploaded, Devpost text done, site link works in a private window | — |

## Critical path

```
G2 rewrite test ─┐
core: detect+replace+vault ─┬─> rewrite package ─┬─> harness ──> Bank Agent tab ──> video
fake bank ──────────────────┘                    └─> extension (agent mode)
core ─────────────────────────> proxy ──> Chat tab
persona + truth sheet ──> attacker prompt ──> Leak Test tab
```

The longest chain is **core → rewrite → harness → Bank Agent tab → video**. Do not let it wait for anything else.

## Interfaces to agree on at the sync (before anyone codes)

Write these as TypeScript types in `packages/core/src/types.ts` first, commit them, and then every workstream builds against them:

- `detect(text, opts) → Finding[]`, where `Finding = { start, end, text, kind, source: 'rule' | 'model' | 'vault', score }`
- `decide(task, findings) → Decision[]`, where `Decision = Finding & { result: 'read' | 'use' | 'withhold' | 'unsure' }`
- `replace(text, decisions, vault) → { text, map }`, where the stand-ins are same-length, format-valid, and the same in one session
- `restore(text, vault) → text`
- `receipt(decisions) → { given: Count[], withheld: Count[] }`
- Rewrite: `rewritePage(root: Document, vault)` and `armSubmitSwap(form, vault)`
- Server: `POST /api/chat` (stand-ins only), `GET /api/run/:id/frames` (SSE stream of agent frames and events)

## Schedule

### Tue Nov 17 (today)

| Time | Task | Owner | Output |
| --- | --- | --- | --- |
| Afternoon | G1 GLiNER benchmark | Neil + Claude | Done |
| Afternoon | G2 gate prototype: done. One by-hand test in the real Claude for Chrome side panel is left | Neil + Claude | branch `prototype/agent-view-gate` |
| Evening | **Team sync (30 min):** read the spec, assign workstreams, agree on the interfaces above, set `Status: locked` | All | Locked spec, filled-in `context/team.md` |
| Evening | Repo scaffold: pnpm workspace, `packages/core`, `packages/rewrite`, `apps/*`, shared tsconfig, `types.ts` | Neil | One commit everyone branches from |
| Night | `/parallelize`: each owner starts in their own worktree | All | First commits per workstream |
| Night | Ask the directors: deadline time, video length, live call or not, demo links allowed | Anyone | Answers in `context/event.md` |

### Wed Nov 18 (main build day)

| Time | Workstream | Task |
| --- | --- | --- |
| Morning | 1 Core | Rules (SSN, card with Luhn, ABA routing checksum, account, email, phone, address), the GLiNER wrapper in a Web Worker (own wrapper, not `gliner.js`), merge of overlaps, unit fixtures |
| Morning | 4 Bank | 3 screens, seeded account holder, 30 transactions, 2 person payees, injection memo, 1 bill. Deploy |
| Morning | 7 Pitch | Activist persona: 12-fact truth sheet and 30–60 message chat log. Confirm the two hooks (NYT v. OpenAI order, Brave research) and save the sources |
| Midday | 1 Core | Stand-in generator (checksum-valid, same length, same font width), vault in IndexedDB, restore, receipt |
| Midday | 2 Rewrite | DOM text, inputs, attributes, MutationObserver for late content, submit swap. Test against the bank: 0 real values |
| Afternoon | 1 Core | `decide`: the task classifier. Start with rules per task type (budget task → amounts and merchants are "read"; everything else "withhold"), fail closed |
| Afternoon | 5 Server | Claude proxy (stand-ins only, per-visitor cap, origin check). Playwright harness with the rewrite injected, normal and compromised modes, SSE frames |
| Afternoon | 6 Site | Vite + React shell, 3 tabs, Chat tab on core + proxy, wire view |
| Evening | 3 Extension | MV3: agent-mode rewrite on the bank, side panel with real values, submit swap. Then chat-mode hooks on claude.ai and chatgpt.com |
| Evening | 6 Site | Leak Test tab: attacker prompt, 12-fact grading, before/after scores, saved-run fallback |
| **Night** | All | **G3: full bank run.** Fix what breaks. Deploy site, bank, server |

### Thu Nov 19 (test and polish)

| Time | Task |
| --- | --- |
| 9:00–12:00 | Finish must-ship gaps. WebLLM context clues in the Leak Test. `/codex review` on core, rewrite, and server |
| 10:00–1:30 | Optional: in-person check-in in JC Room C, show the organizers the demo |
| **12:00** | **G4: feature freeze.** After this, fix bugs and polish only |
| Afternoon | `/better-interface` and `/frontend-design` pass on the split view, wire view, receipt, Leak Test. Test on a second machine and in a private window |
| Afternoon | Record test takes of every scene. Pre-warm model caches |
| Evening | `/pitch`: 3-minute script, shot list, Devpost draft. Rehearse once with a timer |

### Fri Nov 20 (submit)

| Time | Task |
| --- | --- |
| 9:00–12:00 | Record the final video (each scene has a fallback take). Edit. Captions |
| 12:00–2:00 | Devpost text (`/ste`, then `/humanizer`), screenshots, links, team roles. Submit by **2:00 pm** |
| After submit | Keep the site and server running through judging (Nov 25 at the latest) |

## Tools for each step (from `docs/tooling.md`)

| Step | Tool or skill |
| --- | --- |
| Lock the spec and interfaces | `/interview` (revise mode) |
| Split and run the build | `/parallelize`, then Paradev `superset:orchestrate`: one Paradev workspace and worktree per workstream. Teammates without Paradev use `git worktree` and several Claude Code sessions |
| Backend: server, proxy, harness | `/codex implement`, then `/codex review` |
| New screens: site, bank | `/frontend-design`, with references from `inspiration/` |
| Bugs | `/systematic-debugging` |
| Check that pages work | `/agent-browser` (explore), `/webapp-testing` (repeatable Playwright checks for the 0-real-values rule) |
| Claude for Chrome side panel tests, and recording the real product | Paradev `superset:computer` (needs Cua Driver or Peekaboo) |
| UI feedback and polish (Thu) | `/agentation`, `/better-interface`, `/animate` |
| A teammate takes over a workstream | `/handoff` |
| Pitch, Devpost, video (Thu–Fri) | `/pitch`, `/ste`, `/humanizer`, `/hyperframes` |

**Setup still needed (Neil):** sign in to the Paradev CLI and put it on your PATH, and install one computer-control driver. See "Setup" in the changelog entry of Nov 17 (14).

## Where Fable helps (ask Neil to switch the model)

The default model is Opus, to keep usage low. Switch to **Fable** only for these steps, where it should give a clearly better result:

1. **Locking the spec and the interfaces** (Tue evening). Mistakes here spread to every workstream.
2. **The `decide` task classifier** (Wed afternoon). It is the hardest logic, and it is what makes us "not just a redactor".
3. **The persona and chat log** (Wed morning). The Leak Test only works if the writing is realistic and the 12 facts leak through context, not names.
4. **The visual design pass on the site** (Thu afternoon). The split view is the hero shot.
5. **The pitch script and the Devpost text** (Thu evening and Fri). Storytelling is one of the five judging criteria.

Everything else (scaffolding, rules, the bank, the harness, the extension, bug fixes) stays on Opus.

## Risks to watch this week

- **The deadline time is unknown.** Until the directors answer, plan for Fri 2:00 pm.
- **Only 2 build days.** If G3 is not green by Wed midnight, cut the live harness from the site on Thu morning and show a recorded run.
- **Owners are not assigned yet.** Darryl's row is empty. Without owners, the Wed plan does not hold.
