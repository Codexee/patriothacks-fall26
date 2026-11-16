# Team changelog

Newest first. Add an entry whenever you change shared context, skills, or the workflow. Each teammate's AI shows the top entry at the start of every session (`scripts/hooks/sync_check.sh`).

## 2026-11-16 (3): Skill reminders and sync check

- **New: skill reminders.** If your prompt looks like a job for a project skill and you didn't call it, your AI asks once: "Want to use /X for this?". The rules are in `.claude/skill-triggers.json`.
- **New: sync check.** At the start of every Claude Code session, your AI tells you if your copy is behind GitHub and offers to `git pull`.
- **New: `docs/skills.md`.** One page listing every project skill and when to use it, by day.
- **Action for everyone:** `git pull`, then restart Claude Code in the repo folder. If it asks you to trust the folder, say yes, because the project hooks only run in trusted folders. The hooks need `python3`, which macOS includes.

## 2026-11-16 (2): Skills upgraded after review (`docs/skills-review.md`)

- `/interview` now uses Matt Pocock's `grilling` questioning loop. All of JMO's rules are kept.
- `/codex` now runs on **OpenAI's official Codex plugin**. Run `/codex:setup` once.
- Added: `/frontend-design`, `/impeccable`, `/humanizer`, `/choreograph`, `/find-animation-opportunities`, `/agentation-self-driving`, `/agent-browser`, `/webapp-testing`, `/systematic-debugging`, `/handoff`, `/prototype`, `/hyperframes`.
- `/parallelize` hands off to Paradev's `superset:orchestrate`.
- Wispr Flow was removed from the toolchain.
- **Action for everyone:** `bash scripts/setup.sh` (it installs the Codex plugin and agent-browser).

## 2026-11-16 (1): Repo created

- Shared AI context: event, calendar, track, constraints, team, past winners, video playbook.
- Round-1 idea shortlist. **Ideation is on hold until Neil lifts the hold.**
