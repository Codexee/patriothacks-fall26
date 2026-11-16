@AGENTS.md

## Claude Code specifics

- Project skills live in `.claude/skills/` and load automatically for anyone who opens this repo:
  `/ideate` · `/interview` · `/parallelize` · `/codex` · `/pitch` · `/ste` · `/better-interface` · `/better-ui` · `/better-*` · `/interface-review` · `/animate` · `/review-animations` · `/improve-animations` · `/pick-ui-library` · `/agentation`
- These are upgraded versions of the `jmo-workflow` plugin's skills. `.claude/settings.json` disables that plugin inside this repo, so each skill appears only once.
- `/codex` needs the Codex CLI (`npm i -g @openai/codex`, then `codex login`).
- Use `/interview` with AskUserQuestion. Do not hold a long interview in prose.
