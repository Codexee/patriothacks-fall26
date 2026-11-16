@AGENTS.md

## Claude Code specifics

- Project skills live in `.claude/skills/` and load automatically for anyone who opens this repo. `docs/tooling.md` → "Which skill when" tells you which one to use.
  - **Workflow:** `/ideate` · `/interview` · `/parallelize` · `/codex` · `/pitch` · `/handoff` · `/prototype` · `/systematic-debugging`
  - **Design:** `/frontend-design` (new screens) · `/impeccable` · `/better-interface` and `/better-*` · `/interface-review`
  - **Motion:** `/animate` · `/choreograph` · `/review-animations` · `/improve-animations` · `/find-animation-opportunities` · `/pick-ui-library`
  - **Feedback and QA:** `/agentation` · `/agentation-self-driving` · `/agent-browser` · `/webapp-testing`
  - **Writing:** `/ste` (explanations) · `/humanizer` (finished prose)
  - **Demo video:** `/hyperframes` · `/hyperframes-cli` · `/hyperframes-registry`
- These include upgraded versions of every `jmo-workflow` skill. Nothing from JMO's versions was dropped (see `docs/skills-review.md`). `.claude/settings.json` disables the JMO plugin inside this repo, so each skill appears only once, and it enables OpenAI's official Codex plugin (`codex@openai-codex`), which `/codex` uses as its engine.
- `/codex` needs the Codex CLI (`npm i -g @openai/codex`, then `codex login`), and then `/codex:setup` once.
- `/parallelize` hands off to Paradev's `superset:orchestrate` skill when Paradev is installed and signed in.
- Run `/interview` through AskUserQuestion. Do not hold a long interview in prose.
