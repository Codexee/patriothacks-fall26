# PatriotHacks Fall '26 (Patriot HackFest)

Team repository for **Patriot HackFest Fall 2026** (GMU · virtual · Nov 14–20, 2026).
Track: **Best Solution for a Dystopian World**. Prizes: $2,000 / $1,000 / $500.

The repo holds both the project and the **shared AI context**. Every teammate's agent reads the same brief, calendar, constraints, ideas, and spec, so all four setups work from the same information.

## Quick start (teammates)

```bash
git clone https://github.com/Codexee/patriothacks-fall26 && cd patriothacks-fall26
bash scripts/setup.sh        # Codex CLI, JMO plugin, Paradev (Superset)
claude                       # then paste ONBOARDING_PROMPT.md
```

## Layout

```
AGENTS.md / CLAUDE.md     the team brief that every agent loads (Codex reads AGENTS.md, Claude reads CLAUDE.md, which imports it)
ONBOARDING_PROMPT.md      paste this into a new teammate's AI
context/                  event + calendar, constraints, team, past winners, video playbook
ideation/                 idea bank, ranked shortlist, decision log
inspiration/              UI references for the agents to copy (and the Cosmos board link)
.plans/                   master specs from /interview (the locked spec is the source of truth)
.claude/skills/           the team's skills (load automatically in Claude Code)
scripts/setup.sh          toolchain installer
docs/                     tooling notes, then pitch, Devpost, and demo-video drafts
```

## This week

| Day | Calendar | Run |
| --- | --- | --- |
| Mon 11/16 | Set goals, choose a direction | `/ideate` → team vote → `/interview <idea>` → lock the spec |
| Tue–Wed | Build | `/parallelize`; `/codex implement` for the backend |
| Thu 11/19 | Test; check-in JC C 10–1:30, JC G 2–4 | `/codex review`, `/codex challenge`, `/better-interface`, `/agentation` |
| Fri 11/20 | Polish and submit | `/pitch`, record the demo, submit on app.patriothackfest.com |

## Skills

See `context/video-playbook.md` for the full map. The skills are based on [jmo-skills](https://github.com/23jmo/jmo-skills), with upgrades. See `docs/tooling.md` for what changed and why.
