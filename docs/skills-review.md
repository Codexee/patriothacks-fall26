# Skills review: JMO's skills against the best skills available

Reviewed on Nov 16, 2026. For each skill, I read the SKILL.md source of JMO's version and of the main alternatives. Star counts are GitHub stars. Install counts come from skills.sh, by way of the Linkly AI ranking, and are approximate.

## 1. JMO's skills against what the video says they do

| Skill | What the video says it does | What JMO's plugin ships | Verdict |
| --- | --- | --- | --- |
| `/interview` | "Keeps asking me questions on anything unclear until we are on the exact same page," then saves a document so later work does not drift | 17 lines. Its allowed tools are AskUserQuestion, Write, and Agent, so it **cannot read files or search the web**. It has no question strategy and no spec format. | **Weak.** It works, but it asks in an arbitrary order and cannot check facts. |
| `/ste` | Makes Claude stop explaining with "levers, knobs, counterfactual" | 30 lines of general clarity rules. It has **no banned-word list**. | **Partial.** It misses the specific problem the video names. |
| `/better-ui` | "Performs a UI audit of your entire app, recommends interface improvements, animations, and general polish" | An upstream snapshot of Jakub Krehel's `better-ui`, which is **polish only** (exact values for radius, shadows, icons). The whole-app audit is a different skill, `better-interface`, which was not included. | **Mismatch.** The video's description matches `better-interface`, not `better-ui`. |
| `/animate` | "Applies best practices of motion design and animations" | An unmodified copy of Emil Kowalski's `animate` | **Good.** But it refers to `review-animations`, `improve-animations`, and `pick-ui-library`, which were not included. |
| `/agentation` | Annotate the site and send each comment, with the element's ID, to the agent | Identical to upstream `benjitaylor/agentation` | **Good.** Upstream also has `agentation-self-driving` (the agent annotates the page by itself), which JMO left out. |
| `/codex` | "Lets Claude spawn a Codex sub-agent … to handle a feature or review Claude's work" | A new 35-line wrapper. The README says it *replaces* the gstack `/codex` used in the video. | **Weaker than the video's tool.** |

## 2. Best skill per job

| Job | Candidates (source, stars, license) | Best | Why |
| --- | --- | --- | --- |
| **Interview → spec** | JMO `interview` (216★) · **mattpocock `grilling` / `grill-me`** (325k★, ~1.5M installs, MIT) · obra `superpowers:brainstorming` (318k★, MIT) · our upgraded `/interview` | **Our `/interview` with the `grilling` loop added** | `grilling` has the best questioning method. It maps decisions as a tree, asks every question that is ready in each round with a recommended answer, and sends sub-agents to look up facts instead of asking the user. Our version adds the hackathon context, the demo-first opening, and the Workstreams spec. `brainstorming` is strong, but its hard gates (approach doc, then design doc, then writing-plans) add too much process for a 2-day build. |
| **Clear explanations** | JMO `ste` · our upgraded `/ste` | **Our `/ste`** | No better skill targets technical *explanations*. The anti-slop skills below edit *prose*. |
| **Anti-slop prose** (Devpost, pitch, README) | **blader `humanizer`** (70k★, MIT, 498 lines) · hardikpandya `stop-slop` (19k★, MIT, 68 lines) · vercel `writing-guidelines` (fetches rules at run time) | **`humanizer`** | It is the most complete: tells ranked by strength, a check that no facts were lost, and a file mode that leaves code blocks alone. `stop-slop` is a shorter subset of it. |
| **Design direction** (avoid "AI slop" looks) | **anthropics `frontend-design`** (official, ~1.1M installs, Apache-2.0) · **pbakaus `impeccable`** (111k★, Apache-2.0) · nextlevelbuilder `ui-ux-pro-max` (150k★, MIT, a style database) | **`frontend-design`** for new screens. `impeccable` is the alternative if you want one all-in-one tool. | `frontend-design` names the exact defaults that look AI-generated (cream and terracotta, the SaaS card kit, all-caps eyebrows) and makes Claude plan its design tokens before writing code. `impeccable` does more (shape, critique, audit, polish, animate, live variants), but it duplicates the `better-*` suite and needs its own binary. `ui-ux-pro-max` is a lookup table, not a design process. |
| **Whole-app UI audit and polish** | jakubkrehel `better-interface` and the `better-*` suite (12k★, MIT) · vercel `web-design-guidelines` · `impeccable audit` | **The `better-*` suite** (already in the repo) | It gives exact values, evidence-based findings, and a ranked report. It is what the video describes. |
| **Animation** | **emilkowalski `animate`** suite (57k★, MIT) · `impeccable animate` · `ui-ux-pro-max` GSAP presets | **Emil's suite** (already in the repo) | Emil Kowalski wrote Sonner and Vaul. The skill gives exact curves and durations and has a "should this animate at all?" gate. |
| **Visual feedback to the agent** | **benjitaylor `agentation`** (5k★, PolyForm Shield) · aidenybai `react-grab` (8k★) | **`agentation`**, plus optional `agentation-self-driving` | Annotations attach to elements and sync through MCP. `react-grab` is a clipboard loop that works only in React. |
| **Codex second opinion and handoff** | **openai `codex-plugin-cc`** (official, 35k★) · garrytan gstack `/codex` (142k★; needs the full gstack install) · JMO `codex` · our upgraded `/codex` | **The official OpenAI plugin** | It is maintained by OpenAI, and it has `/codex:review`, `/codex:adversarial-review`, `/codex:rescue` (hand off a task), background jobs with status, result, and cancel, and an optional review gate. Ours repeats this with shell commands. |
| **Parallel agents** | **Paradev `superset:orchestrate`** (installed) · obra `subagent-driven-development` · our `/parallelize` | **Our `/parallelize` for the split, then `superset:orchestrate` to run it** | The video runs its parallel work in Superset workspaces, and `orchestrate` drives exactly those. Our skill turns the spec into independent workstreams that own separate files, then hands off. `subagent-driven-development` adds a review after each task, which is good, but it is slower. |

## 3. Other popular skills that fit this project

| Skill | Source | Use here |
| --- | --- | --- |
| `agent-browser` | vercel-labs (52k★, ~1.5M installs) | Lets an agent drive a real browser for QA and dogfooding. `agentation-self-driving` needs it. |
| `webapp-testing` | anthropics (official) | Playwright scripts that test the local web app and take screenshots. |
| `systematic-debugging` | obra/superpowers | Find the root cause before fixing. Useful at 3 a.m. on Wednesday. |
| `handoff` | mattpocock (~1.1M installs) | Compresses a session into a handoff doc. Useful when a teammate takes over a workstream. |
| `prototype` | mattpocock (~1.1M installs) | Throwaway prototypes, to settle a UI or logic question on Monday or Tuesday. |
| `hyperframes` | heygen-com (85k★, ~1.5M installs, Apache-2.0) | Write HTML, render video. Useful for Friday's demo video. |
| `find-skills` | vercel-labs (#1 on skills.sh, ~4.4M installs) | Searches skills.sh from inside the agent. |

Not recommended: the full `superpowers` framework and gstack. Both are large systems with mandatory gates that would slow a 2-day build and conflict with our workflow. The video's own advice is to turn off skills you do not need.

## 4. Team decision (Nov 16): all recommended upgrades, plus Impeccable

Rule from Neil: every change must be a **straight upgrade** over JMO's skills. Nothing JMO wrote may be lost. Where a better skill lacked something JMO's had, the better skill was edited to include it.

| JMO skill | Now | What was kept from JMO |
| --- | --- | --- |
| `interview` | Our `/interview` with the `grilling` loop | All of it, marked **[JMO]** in the file: AskUserQuestion, "not obvious" questions, "literally anything" coverage, "continue until complete", the `.plans/<slug>-spec.md` location, the absolute path stated in the reply, never under `~/.claude/` |
| `codex` | Our `/codex`, which routes to OpenAI's `codex@openai-codex` plugin | All of it, marked **[JMO]**: the CLI check with install guidance, reading repo instructions and git status, read-only by default, focused prompts with no credentials, telling Codex which files are modified, heredoc stdin, no flags that bypass the sandbox, separate worktrees with no concurrent edits, verifying findings, no automatic commit or push. The official plugin lacks worktree isolation and finding verification, so the router adds them. |
| `ste` | Our `/ste` | It had dropped two JMO rules ("lists for steps, prose for dependent ideas" and "remove filler and decorative jargon"). Both are restored. |
| `better-ui` | Upstream at a newer commit | The line-by-line diff against JMO's pinned copy shows only the author's fixes (reduced-motion guards, renamed headings). Nothing was removed. |
| `animate` | Upstream at a newer commit | The diff shows only fixes (Motion 14.2+ guidance, documented duration exceptions). Its new reference to `choreograph` would have been a broken link, so `choreograph` and `find-animation-opportunities` were vendored too. |
| `agentation` | Unchanged | Identical to upstream. `agentation-self-driving` was added. |

**Added:** frontend-design, impeccable, humanizer, agent-browser (plus its CLI), webapp-testing, systematic-debugging, handoff, prototype, hyperframes (plus its CLI and registry skills), and the Paradev orchestrate hand-off in `/parallelize`.

**Local edits to imported skills:** `systematic-debugging` pointed at two superpowers skills that are not installed, so those lines now hold the steps inline. `handoff` saves to `docs/handoffs/` when a teammate takes over, so the handoff reaches them through git.
