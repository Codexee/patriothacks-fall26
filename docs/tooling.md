# Tooling: what we use, and how it differs from the JMO plugin

## Audit of `jmo-workflow@jmo-skills` v1.0.0 against the video

The plugin was checked against what the video describes. Five gaps made it weaker than the workflow Johnathan used to win. Each gap is fixed in `.claude/skills/`.

| Video skill | Plugin version | Gap | Fix in this repo |
| --- | --- | --- | --- |
| `/interview` | 17 lines. Its tool list allows only AskUserQuestion, Write, and Agent, so it **cannot read the repo** or research anything. | It cannot use team context. It has no spec format, no think-backward step, and no task split for parallel agents. | Reads `context/` first, starts from the demo scene, uses a fixed spec template with a **Workstreams** table for `/parallelize`, and supports lock and revise. |
| `/codex` | A basic handoff wrapper. The README admits it replaces gstack's `/codex`, which the video used. | It lacks gstack's review (pass/fail gate), challenge (adversarial), and consult (follow-up) modes. | All three modes, plus an implement mode that runs in its own worktree. Standalone: gstack is not needed. |
| `/better-ui` | A snapshot of one skill. | Its text hands work to `better-accessibility`, `-typography`, `-colors`, `-layout`, and `-writing`, and the video's **"UI audit of your entire app"** is `better-interface`. **None of these were bundled.** | The full Jakub Krehel suite, including `better-interface` and `interface-review`, is vendored (MIT). |
| `/animate` | A snapshot of one skill. | It hands off to `review-animations`, `improve-animations`, and `pick-ui-library`, which were not bundled. | Those three are vendored (MIT, Emil Kowalski). |
| `/ste` | A general clarity guide. | It lacks the banned-word list ("levers, knobs, counterfactual") that the video gives as the reason for the skill. | A banned-word table and a self-check were added. |
| (workflow) | none | The video's steps 1 (think backward), 2b (split into parallel sub-agents), and 4 (pitch) had no skill. | `/ideate`, `/parallelize`, `/pitch`. |

`/agentation` is vendored unchanged. It is under the PolyForm Shield 1.0.0 license, included in its folder.

The plugin stays installed at user scope, as the guide says. `.claude/settings.json` turns it **off inside this repo**, so that each skill shows up once. This also follows the video's advice to turn off skills you do not need.

## Who does what

**You talk to Claude Code. Paradev does not think; it is a window manager for agents.**
Paradev (the Superset app's new name, made by Paradev) runs CLI agents such as Claude Code and Codex inside its own terminals. It gives each task its own git worktree and branch, and it shows the diffs to review and merge. It has no AI of its own.

| App | Role | When |
| --- | --- | --- |
| **Claude Code** | The main agent. Every prompt, skill, and plan goes through it. It also does the frontend work. | All week |
| **Codex CLI** | The second agent: backend work and reviews (`/codex`) | Tue–Thu |
| **Paradev (Superset)** | Runs several Claude Code or Codex sessions in parallel, one worktree per workstream, and reviews their diffs | Tue–Wed builds (`/parallelize`). Not needed Mon. |
| **Cosmos** | The inspiration board. The agents copy from it. | Mon–Tue design |
| **GitHub repo** | Shared memory and sync between the 4 setups | All week |

Paradev's desktop app is macOS-only (Linux is experimental, Windows is not supported). Teammates without it get the same result with `git worktree` and several Claude Code terminals, or with the Claude desktop app's parallel sessions.

## Local software

| Tool | Install | Used for |
| --- | --- | --- |
| Claude Code | https://code.claude.com/docs/en/setup | The main agent harness |
| Codex CLI | `npm i -g @openai/codex`, then `codex login` | Backend work and second-opinion reviews (`/codex`) |
| Paradev (Superset) | `brew install --cask superset` | Parallel agents in git worktrees, with a built-in browser and diffs |
| Cosmos | https://www.cosmos.so (web) | The inspiration board |

## MCPs (optional, add only when the spec needs them)

- Supabase / Neon: `claude plugin install jmo-supabase@jmo-skills` (or `jmo-neon`), then `/mcp` to sign in
- Stripe: `claude plugin install jmo-stripe@jmo-skills` (test mode only)
- Agentation live sync: `claude mcp add agentation -- npx -y agentation-mcp server`
