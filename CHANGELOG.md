# Team changelog

Newest first. Add an entry whenever you change shared context, skills, or the workflow. Each teammate's AI shows the top entry at the start of every session (`scripts/hooks/sync_check.sh`).

## 2026-11-16 (5): Pinpoint v2 is the lead idea

- Neil tested Pinpoint by hand with ChatGPT on a Zürich Street View photo. A blurred photo was ugly and was **still located**. Round 8 (`ideation/ideas.md`) redesigns Pinpoint to answer that: a privacy radius, crop first, small masked edits that copy every other pixel from the original, and a loop of 3–4 independent attackers that runs until all of them miss.
- Veil is dropped (protective noise can be removed, Hönig et al., ICLR 2025). Tripwire is set aside (few people use AI browsers).
- **Action for Adarsh:** `git pull`, read `ideation/shortlist.md` (open questions) and Round 8, then `/interview Pinpoint v2` or continue `/ideate`.

## 2026-11-16 (4): Ideation rounds 2–7, handoff to Adarsh

- **Ideation hold lifted** (Neil). `/ideate` ran 6 more rounds today. Every idea, its scores, and the reason for each rejection are in `ideation/ideas.md`. The decisions are in `ideation/decisions.md`.
- **Current top 3** (`ideation/shortlist.md`): **Tripwire** (stops web pages from hijacking AI browsers), **Pinpoint** (your photos show where you live), and **Veil** (your photos fail in nudify apps).
- **Shadow Route already exists** (FlockHopper, FlockDetour), so do not pick it without a new angle.
- **Neil's criteria** for any new idea are at the top of `ideation/shortlist.md`. Read them before you suggest ideas.
- Adarsh's GitHub handle (air842) is now in `context/team.md`.
- **Action for Adarsh:** `git pull`, read `ideation/shortlist.md`, then continue with `/ideate` or `/interview`.
- **Action for everyone else:** `git pull`, read the shortlist, and vote in the team chat.

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
