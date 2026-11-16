# The playbook: "How I won 5/5 hackathons" (Johnathan Mo)

Source: https://www.youtube.com/watch?v=AoxK3JpxbRc. This file summarizes the workflow so that every agent follows the same process.

## The 4 steps

### 1. Think backward from the winning demo (most important)
- Imagine you have already won. What demo did the judges see that made them say "yep, that one"?
- Pick the **craziest, coolest** idea you can think of, then check whether it can be built. Keep scaling it down until it is still impressive **and** can be built.
- Stay aware of current events and trends. Twitter/X is a good source for ideas and UI inspiration. Save references in **Cosmos** (cosmos.so), which works like Pinterest for the web, or in `inspiration/`.
- Skill: `/ideate`, then `/interview`.

### 2. Build fast with AI agents
- Use agents. Typing code by hand is too slow. Give the agent a lot of context in each prompt.
- **Harness** (Claude Code, Codex, Cursor) = the wrapper around the model that handles memory, context, and routing.
- **Agent IDE** (Superset) = runs many agents in parallel, each in its own **git worktree**, with a built-in browser and a diff view.
- **Write the plan first.** For Opticon, the team spent 2–3 hours being interviewed by Claude about the plan. They then split the plan into independent tasks and ran one sub-agent per task for 5–6 hours, refined by hand with `/agentation` for 1 hour, and slept. The project won.
- Claude is better at the frontend and Codex is better at the backend. Use `/codex` to hand off backend work and to get reviews.
- **Agents copy better than they invent.** Point them at a reference design you like, then iterate.
- Turn off skills you do not need. Too many skills can hold a smart model back.

### 3. Don't sleep (much)
- For a 24-hour event: pull an all-nighter. For 36 hours: sleep 5 hours the first night.
- 4 a.m. is the hardest point. Eat something, and take shifts.
- *Our event is a week long. Adapt: plan the build hours, and keep the agents running overnight on Tue and Wed.*

### 4. Pitching and judging
- Talk with the judges for as long as you can. Explain the motivation, the state of the world, and the technical details and challenges.
- **A live demo beats a video.** Many teams fake features, so a working demo shows real effort.
- Skill: `/pitch`.

## Skill map (all in this repo, in `.claude/skills/`)

| Video skill | Here | Use it to |
| --- | --- | --- |
| `/interview` | `/interview` (upgraded) | Turn an idea into a locked master spec in `.plans/` |
| `/ste` | `/ste` (upgraded) | Get clear explanations with no "levers / knobs / counterfactual" filler |
| `/better-ui` | `/better-ui` and the full `better-*` suite, including `/better-interface` | Run a whole-app UI audit and polish |
| `/animate` | `/animate`, `/review-animations`, `/improve-animations` | Add motion design |
| `/agentation` | `/agentation` | Click an element in the app and send the comment to the agent |
| `/codex` | `/codex` (review / challenge / consult / implement) | Get backend work done or a second-opinion review |
| (workflow) | `/ideate`, `/parallelize`, `/pitch` | Run steps 1, 2, and 4 of the playbook |
| MCPs | Supabase, Neon, Stripe (optional) | Create databases and payments from the agent |
