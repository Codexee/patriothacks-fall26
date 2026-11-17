# Team changelog

Newest first. Add an entry whenever you change shared context, skills, or the workflow. Each teammate's AI shows the top entry at the start of every session (`scripts/hooks/sync_check.sh`).

## 2026-11-17 (13): GLiNER browser gate passed

- **The GLiNER half of the Tue-night gate passed.** `knowledgator/gliner-pii-edge-v1.0` (quint8, 46 MB) on WASM takes 83 ms p95 on a 147-word prompt, and 172 ms on one thread. It found 18 of 18 names, organizations, places, the address and the SSN at threshold 0.3.
- **The per-prompt budget is now 500–1000 ms** (was 300 ms). The spec and `AGENTS.md` are updated.
- **`gliner` npm (0.0.19) does not work with these models as it is.** It returns zero entities because of 3 bugs (tokenizer format, start token, output layout). `packages/core` must use its own small wrapper on `onnxruntime-web`.
- Full table, bug details and run steps: branch `prototype/gliner-bench`, file `prototypes/gliner-bench/README.md`. The prototype is not on main.
- **Action for the core-engine owner:** read that README before you start `packages/core`. Check recall again on the bank page and the activist chat log before you lock the threshold.

## 2026-11-17 (12): Off the Record spec drafted

- **New file: `.plans/off-the-record-spec.md`** (Status: draft). The hero moment is a hijacked bank agent that leaks only stand-ins. The activist half is a fact re-attack on a seeded persona. The video shows Claude for Chrome and our extension. The demo site is a playground where the model runs in the judge's browser.
- Darryl replaces AJ in `context/team.md`.
- **Action for everyone:** read the spec before the sync. Choose workstreams at the sync, then set `Status: locked`.
- **Action for Darryl:** fill in your row in `context/team.md`.
- **Action for anyone:** ask the directors about the judging format (video length, demo links).

## 2026-11-17 (11): Off the Record enters the next phase

- **New file: `ideation/off-the-record.md`.** A small model on your own machine sits between you and every AI (chatbots, AI browsers, computer-use agents, coding agents, MCP tools, and file uploads). It replaces anything that identifies you, including context clues and writing style (Unsign), and restores the real values in the replies. It also lets an agent type your real data without ever seeing it.
- The file has the prior art and the gap, the architecture, every entry point, 5 demo concepts, a recommended 3-act demo, risks, 4 cheap first tests, and open questions.
- **Action for Adarsh:** `git pull`, then workshop `ideation/off-the-record.md`, starting with the open questions.
- **Action for everyone:** read it. Anyone willing to share their own ChatGPT export for the demo, say so.

## 2026-11-17 (10): Option A, lead idea Off the Record

- Neil chose Option A: an idea qualifies if it clearly beats what already exists, in a way a judge can see.
- **Lead: Off the Record.** Audit your own ChatGPT export to see what anyone holding the logs could learn about you, then use a browser extension that hides context clues in new chats and restores them in the replies. Hook: a court ordered OpenAI to hand over 20M ChatGPT logs.
- **Runner-up: Receipt** (surveillance pricing; NYC banned it in Nov 2026), if a free 1-hour price-gap test passes.
- **Action for everyone:** read `ideation/ideas.md` → Round 13 and vote.

## 2026-11-17 (9): Round 12, scoped out; a decision is needed

- Ideation scoped out to the whole track. Fresh 2026 problems (ChatGPT logs handed to a court, ID leaks from age checks, Flock cameras) all already have tools.
- **Action for everyone:** read `ideation/ideas.md` → Round 12, and vote on which rule bends: A (relax "never done"), B (leave consumer privacy), or C (take the best idea so far).

## 2026-11-17 (8): Round 11, Flock cameras revisited

- Ground Truth is rejected (people do not trust an AI to judge whether a photo is real).
- Round 11 looked again at Flock. Many tools already exist (DeFlock, FlockHopper, Have I Been Flocked, EyesOnFlock). The two new candidates are **Unmarked** (how findable your car is to Flock's AI search by its stickers and dents, even with the plate hidden) and **Watch the Watchers** (find stalking-like searches in released audit logs). Neither is a clear winner.
- Team fit is no longer scored.
- **Action for everyone:** read `ideation/ideas.md` → Round 11 and give a yes or no on Unmarked.

## 2026-11-17 (7): Pinpoint dropped; new lead Ground Truth

- Neil dropped photo anonymizing (Pinpoint). New lead, **Ground Truth**: use the same photo-reading AI to check whether a viral photo matches its claim (place, time, earlier copies, uniforms and vehicles, AI-generated signs). Use cases: false campus rumors (for example, false ICE sightings), and fake rental listings.
- **Action for everyone:** read `ideation/ideas.md` → Round 10 and vote. The first test needs 10 debunked and 5 genuine campus-rumor photos from news reports.

## 2026-11-17 (6): Pinpoint failed its test, pivot recommended

- The Claude attacker test of the Pinpoint prototype (branch `prototype/pinpoint-demo`) failed 3 of 3 photos it could locate. The building, statue, or street itself was the clue. Small clues (signs, logos) were easy to remove.
- "Check before you post" apps already exist (Lookr, BlurPass, Privacy Guard, Censorify, PixelGuard).
- **Action for everyone:** read `ideation/ideas.md` → Round 9 and decide **today**: pivot, or run the 1-hour decisive test described there.

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
