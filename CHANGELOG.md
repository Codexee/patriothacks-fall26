# Team changelog

Newest first. Add an entry whenever you change shared context, skills, or the workflow. Each teammate's AI shows the top entry at the start of every session (`scripts/hooks/sync_check.sh`).

## 2026-11-20 (28): "Watch it run" is the 2D cutaway again; Baseline is its default

- **`#/demo` opens the 2D cutaway** (`#/demo/classic` still works). The 3D workstation moved to `#/demo/3d`; no site link points to it now. The Results, disaster-page, and hero-video links say "Watch it run".
- **The cutaway starts on Baseline** instead of Cascade (`src/ui/App.tsx`). Pick a disaster with the Test World panel (`T`).
- **The hero video on Results is still the 3D film.** Nothing for teammates to do; redeploy Vercel to publish.

## 2026-11-20 (27): Results site redesign (Results, disaster pages, Model)

- **Full-width layout and new type:** IBM Plex Sans and Mono, hairline rules, numbered sections. The workstation (`src/twin3d/`) and its CSS tokens are unchanged.
- **Results (`#/`):** headline deaths 20,965,011 → 5,903 with the film, a KPI row (deaths avoided with 95% CI, stable at day 120, plant trips, hours without air), the all-runs daily chart, a 5-step Blackout Warning pipeline with a shaft figure (`src/site/Pipeline.tsx`), the disaster table, and Method (protocol, data sources with links, limits).
- **Shorter pages, no repeats:** Results no longer shows the check-first model (the Model tab covers it) or the constants table (Watch it run covers it). Disaster and Model pages use side-by-side layouts; secondary tables sit in "Table view" and similar details.
- **Model (`#/model`):** large test metrics against history and chance, a residents-only vs. with-weather comparison table, inputs and exclusions, and the Hurricane Beryl example.
- **Every number still comes from `public/results/*.json`.** New styles are in `src/site/landing.css`. Nothing for teammates to do; redeploy Vercel to publish.

## 2026-11-20 (26): "Watch it run" is a modeling workstation

- **`#/demo`** is now a full-screen workstation: a toolbar (disaster, any seed 1–20 with its set, step day, view mode, a day scrubber with event marks), a model inspector (Blackout Warning's frozen settings, the disaster's real input curves, the EAGLE-I repair histogram, cited vs guessed constants, data provenance), the 3D twin with a clickable section card (real counties), telemetry charts, a plant table, depth heat strips, and tabs for the event log, the module's daily output, residents' observations and all 400 sections.
- **Every value is real output** of the sim, the module or the data files, and carries a tag (SIM, MODULE, REAL DATA, GUESS, CITED, TUNED, HAND-SET, DERIVED). No decorative data.

## 2026-11-20 (25): 3D twin and homepage films

- **`#/demo` is now a 3D twin** (react-three-fiber): two Hollow shafts, without and with Blackout Warning, on the same disaster and a typical held-out seed, synced day by day, with a disaster dropdown, play/pause, a day scrubber and speed. The old 2D cutaway is at `#/demo/classic`.
- **Homepage film:** a 15 s HyperFrames film per disaster loops muted beside the headline numbers, with a dropdown for the 7 disasters (`public/films/`). The film shows the real 3D footage, live death counters per side, the event and the held-out result.
- **Rebuild the films:** `cd prototypes/hollow-twin-poc && npm run films` (3D footage, about 31 s each), then `cd video && node build-data.mjs && npx --yes hyperframes@0.9.70 render --batch rows.json --output "renders/{name}.mp4"`, then re-encode to `public/films/` (see `video/build-data.mjs`).
- **Action for everyone:** `git pull`; run `npm install` in `prototypes/hollow-twin-poc` (new: three, @react-three/fiber, @react-three/drei, playwright).

## 2026-11-20 (24): `main` is the Hollow; the models are the product; results site

- **`main` now holds the Hollow** (merged from `hollow`, no force push). The old Earth main is tag `archive/earth-main`. `models/` and `data/` (code only; raw data stays local) came over. The shared context (this file, `ideation/`, `context/hollow-brief.md`, handoffs) was restored from the old main after the merge.
- **The product is the models.** (1) Blackout Warning, gated: across 7 disasters and held-out seeds 11–20, deaths fall from 20,965,011 to 5,903 (sim scale), and 70 of 70 runs end stable. (2) A new residents-only check-first model (LightGBM, no weather or grid data), tested once on 2023–2024: top-10 overlap 0.459 (0.421–0.494) against 0.278 for history and 0.132 for chance; the weather model scores 0.460. See `models/RESULTS_RESIDENTS.md`.
- **3 new disasters** shaped from real plant losses (EIA-930): TVA coal in Winter Storm Elliott 2022, TVA and CPLE together, SPP wind in Feb 2021. `npm run results` writes `public/results/scenarios.json`.
- **Results site, live at https://hollow-twin-poc.vercel.app** (Vercel project `codexee/hollow-twin-poc`; local: `prototypes/hollow-twin-poc`, `npm run dev`): `#/` results, `#/disaster/<id>`, `#/model`, `#/demo` (the cutaway).
- **Read `docs/competitor-analysis.md`:** STRATUM is the team to beat. Our gaps are coverage, a live URL and the video.
- **Action for everyone:** `git fetch --tags`, then `git switch main` and `git pull`. If git refuses because your local main has its own commits, ask before you reset.

## 2026-11-19 (23): The Hollow is the product; real data in its test world

- **Decision (Neil):** the Earth map (Before, During, After) is abandoned. Adarsh's Hollow on branch `hollow` is the project. `main` keeps the Earth work and the shared context.
- **New locked spec on `hollow`:** `.plans/hollow-real-data-spec.md`. The test world now uses real data: ERCOT demand (EIA-930), plant repair times from 100 real outages (EAGLE-I), the 400 sections built from 3,133 US counties sorted by SVI, and a cited CO₂ limit. The Residents' System still reads only residents' reports.
- **No storms:** Texas 2021 and Chicago 1995 are gone. Scenarios: Cascade (default: Plant 2 loss shaped like ERCOT Feb 2021), Baseline, Aging, Crowding.
- **`npm run gate`** (in `prototypes/hollow-twin-poc`): tune seeds 1–5, check 6–10, test 11–20. Blackout Warning retuned: `safeLoad` 0.82, `assumedCompliance` 0.75. Test set, run once: 3,628 deaths and 87 trips, against 20,382 and 184 with the first guesses (12.3 M without the module).
- **Adarsh's headline numbers changed** (Texas seed 1 is gone). New tables and limits: `prototypes/hollow-twin-poc/REBUILD.md`, Step 2.
- **Action for everyone:** `git fetch`, `git switch hollow`, `git pull`, then read REBUILD.md Step 2.

## 2026-11-19 (22): Hollow work moves to branch `hollow`; old Hollow branches archived

- **New branch: `hollow`** (Adarsh). It holds hollow-rebuild, the Residents' System prototype in `prototypes/hollow-twin-poc/` (Blackout Warning with the slow ease-off, the illustrated cutaway, the Modules panel). `main` and the Earth product do not change.
- **Archived as tags, branches deleted:** `archive/hollow-twin-poc`, `archive/hollow-twin-product`, `archive/hollow-twin-rebuild`, `archive/hollow-twin-rebuild-ui`, `archive/hollow-twin-revamp`. Each tag points at the last commit of that branch, so nothing is lost. To look at one: `git fetch --tags`, then `git switch --detach archive/hollow-twin-rebuild`.
- **Action for everyone:** `git fetch --prune --tags`. If you had a local `prototype/hollow-twin-*` branch, delete it. To work on the Hollow: `git switch hollow`.

## 2026-11-19 (21): Proposal: bring Neil's Earth work into hollow-rebuild

- **New: `docs/integrateEarthIntoRebuild.md`** (Adarsh). It checks each part of Before, During, After against the track brief and says what fits in hollow-rebuild and what does not.
- **Short version:** Neil's warning model does not fit, because residents have no weather or grid-operator data. His data (real counties shaping the levels) and his train / tune / test-once method do fit. The plan adds a "record line" warning and a "who to check first" list to Blackout Warning, each kept only if a regression gate shows no result gets worse.
- **This is a proposal, not a decision.** It has 4 open decisions, including which screen leads the video.
- **Action for everyone (Neil especially):** read it before the sync and give your view on the open decisions.

## 2026-11-19 (20): Handoff to Adarsh; real-forecast result; cross-section; deploy prep

- **Adarsh: start with `docs/handoffs/2026-11-19-earth-product.md`.** It says what works, what is not verified, the numbers to use and the next steps. Neil is offline until later on Thursday.
- **Models:** tested on real archived weather forecasts for 2024: 51% of events warned 12 h ahead, about 11 false alarms per area per year. A comparison at equal false-alarm rates is in `models/RESULTS.md` and on the evidence page.
- **App:** Hollow cross-section (`#/hollow`), Without/With the warning, live counters, detailed evidence and brief pages, live page with record features. App data trimmed to 14 MB.
- **Deploy:** not done. Steps are in `docs/deploy.md`; it needs a Vercel account and a free EIA key.
- **Action for everyone:** `git pull`, read the handoff and `TODO.md`, claim an item in `TODO.md` by writing your name after it.

## 2026-11-18 (19): First full build: data, models v2, map, story, brief, evidence

- **Data:** `data/` builds 1,477 real outage events (2015–2024) from EAGLE-I and EIA-930. Set up: `brew install uv libomp`, then `cd data && uv sync`. Raw files (about 12 GB) stay in `data/raw/`, which git ignores; see `data/README.md` to fetch them.
- **Models v2:** trained on 2015–2020, designed on 2021–2022, tested once on 2023–2024. Read `models/RESULTS.md` before you write any claim. Short version: 13% of events warned 12 h ahead without a weather forecast; 51% with one, as an upper bound; Texas 2021 alert 13 h before the first outage (19 h before the load-shed order) with the forecast model.
- **App:** `cd app && npm install && npm run dev`. Story mode: `#/?story=texas2021`. The old Hollow Twin screen is at `#/legacy`.
- **Rules for parallel work:** `contracts/README.md` says who owns which directories. Do not edit `app/package.json` or the contracts in a workstream branch.
- **Action for everyone:** `git pull`, read `models/RESULTS.md` and the spec, then pick an open item from "Next" in `AGENTS.md`. The live page needs `EIA_API_KEY` (see `.env.example`).

## 2026-11-18 (18): Pivot to Earth as the product (spec locked, project unnamed)

- **`.plans/before-during-after-spec.md` is locked** and replaces `.plans/hollow-twin-spec.md`. The working name is "Before, During, After"; the project is unnamed because another team (anudeep-bonagiri/hollow-twin) already uses "Hollow Twin".
- **What changes:** two models trained on real US outages since 2015 (a 48-hour grid warning from EIA-930, and who stays dark longest from EAGLE-I with CDC SVI and HHS emPOWER), tested on 2021 onward. A deck.gl county map where counties sink by vulnerability (the Hollow's "deep levels"), a county brief, an evidence view, and a live page. Gated stretch ladder: heat → true count → air → water.
- **What leaves the demo path:** the PixiJS cutaway and the 9 hand-written modules (`app/src/world`, `app/src/product`, `app/src/sim`). Do not delete them.
- **Why:** `ideation/ideas.md` → Round 17 (6 competing repos; none uses real disaster data).
- **Action for everyone:** read the new spec, agree or object in the chat, then pick an open workstream. Python work goes in `data/` and `models/` (uv, DuckDB, LightGBM).

## 2026-11-18 (17): Spec v2 locked; the app now lives in `app/`

- **`.plans/hollow-twin-spec.md` is locked (v2).** It is the source of truth. The evaluation behind it is `.plans/hollow-twin-evaluation.md`.
  - The base is Adarsh's product design: 9 modules read only observations, and the sim is the test world.
  - New: an **Earth act** that opens the video. The same modules run on real data (Texas 2021 EIA-930 + county outages, Flint 2015, Wuhan 2020), plus a live grid page.
  - New: twin split (real Texas map beside the cutaway), cinematic cascade, truth wave + Lantern packets, scripted story mode, a Directorate agent with goals and its own panel, 8 sample districts (2 billion people), and a lives-first score.
  - The spec has a step-by-step plan (Wed night → Fri 6 pm) and a cut priority list.
- **`prototype/hollow-twin-product` is merged into `main`, and the app moved from `prototypes/hollow-twin-poc/` to `app/`.** The launch config is now named `hollow-twin`.
- **Action for everyone:** `git pull` on `main`, then `cd app && npm install`. Read the spec's "Step-by-step plan" and pick the next open step. Roles are not fixed. Stay inside the directories that the step's workstream owns.

## 2026-11-17 (16): New direction: Hollow Twin (software only)

- **The track is the Hollow** (`context/track.md`). Off the Record is on hold. Hardware is out (no parts in time). Earshot is dropped (too many unknowns).
- **New spec: `.plans/hollow-twin-spec.md`** (draft). A pixel-art cutaway of the Hollow (50 levels × 8 sections) that runs real-world data as the Hollow: Texas 2021 power, Chicago 1995 heat, Wuhan 2020 delays, Flint water.
  - The Directorate's lies delay the residents' response and cost trust.
  - Players use 4 tools (Early Warning, Fair Share, Ledger, Layout) and play one day per turn, trying to keep the Hollow alive.
  - A Shapley panel shows what each tool changed.
  - A rival algorithm, a leaderboard and a Claude-written summary come with each run.
- **Action for everyone:** read the spec before the sync, pick a workstream, and agree on the day-1 interfaces.

## 2026-11-17 (15): The official track brief changes the direction

- **The organizers published the real track: "Life underground" (the Hollow).** In 2087, 2 billion people live underground under a government called the Directorate. The brief lists **15 numbered problems** (power, heat, water, tunnels, crowding, communication, health, food, and the return to the surface). It says one connected solution that covers several problems can score higher. **New file: `context/track.md`.**
- **New facts in `context/event.md`:**
  - The deadline is **Fri Nov 20, 11:00 pm**, with no extensions.
  - Judging runs Nov 21–24 on an internal platform, so the video is almost certainly the demo.
  - No coding during judging. AI tools are allowed.
  - HackOverflow (GMU's hardware hackathon organization) co-runs the event.
- **Off the Record is on hold.** It covers 0 of the 15 problems directly. The spec and schedule are kept, not deleted.
- **New file: `ideation/hollow-pivot.md`.** It holds the fit analysis and 5 options. The recommendation is **Canary**: sensor nodes on every level, linked by a mesh, that warn before air or power fails, flag bad water, carry family check-ins through a network shutdown, and map the real outbreak next to the Directorate's numbers. It covers problems 1, 3, 4, 7, 8, 9 and 13. The GLiNER gate work is reused for anonymous symptom reports.
- Updated for the new track: `AGENTS.md`, `README.md`, `ONBOARDING_PROMPT.md`, `context/constraints.md`, `ideation/shortlist.md`, and the `/ideate` and `/interview` skills.
- **Action for everyone:** read `context/track.md` and `ideation/hollow-pivot.md`, and vote on the pivot today. If we pivot, the hardware must be bought tonight.

## 2026-11-17 (14): Schedule, gate G2 passed, tool reminders

- **New file: `.plans/off-the-record-schedule.md`.** It holds the gates, the critical path, the interfaces to agree on at the sync, an hour-by-hour plan for Tue–Fri, which tool to use for each step, and the 5 steps where we switch to Fable.
- **Gate G2 passed.** With the Claude in Chrome tools, the agent saw only stand-ins in text, attributes, inputs, hidden elements, shadow DOM, iframes, late content and masked last-4 digits. A stand-in typed at submit reached the bank as the real value. Details: branch `prototype/agent-view-gate`. One by-hand test in the real side panel is left.
- **The skill-reminder hook now also gives a tool reminder** on the first prompt of each session: Paradev `superset:orchestrate` and `superset:computer`, `/codex`, `/agent-browser`, `/webapp-testing`, `/agentation`, `/hyperframes`. New triggers: `superset:computer`, `superset:orchestrate`, `webapp-testing`, plus planning words for `/interview`. Run `git pull` to get it.
- **Setup (everyone with a Mac):** put the Paradev CLI on your PATH and sign in:
  - `ln -s /Applications/Superset.app/Contents/Resources/resources/bin/superset ~/.local/bin/superset` (needs `~/.local/bin` on PATH; `/usr/local/bin` needs sudo)
  - `superset auth login`
  - For computer control, install Cua Driver (https://cua.ai/docs/cua-driver) or `brew install steipete/tap/peekaboo`.
- **Action for everyone:** read the schedule before the sync.

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
