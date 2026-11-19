# Competitor analysis: Life Underground track

Nov 19, 2026, 11 pm · Neil (with Claude) · Source: public GitHub repositories only. Private repositories are not visible, so the real field is larger.

## Summary

- **We have one thing no rival has:** statistical models trained on real disasters (1,477 US outage events, 2015–2024) and tested once on years they never saw. Two rivals use real data (STRATUM and Undercurrent). Neither trains a predictive model on real outages.
- **Our largest gap is coverage.** The brief rewards one solution that covers several of the 15 problems. STRATUM claims all 15, with a matrix that says how deep each one goes. We measure 1 (problem #1), plus the check-first model for #10.
- **Our second gap is evidence that judges can open.** STRATUM and Hollow Twin have live URLs, a judge mode and labels on every number (LIVE, REPLAY, SIMULATED). We have no deploy and no video yet.
- **STRATUM is the team to beat.** Undercurrent is second.

## The field

The search found 10 public repositories for this track: `patriot hacks` sorted by update, plus `hackfest`, `directorate`, `hollow` and `2087` for repositories created after Nov 10, 2026. "Commits" is the count on the default branch on Nov 19.

| Repository | Problems | What it is | Evidence | Commits | Live URL |
| --- | --- | --- | --- | --- | --- |
| [royalgillz/stratum](https://github.com/royalgillz/stratum) | 1–15 (4 live on a phone, the rest modelled) | A phone hears the grid hum sag before a power cut, plus signed sound packets, a ledger and a fair allocator | Hum tracker scored on 130 real grid recordings (ENF-WHU); water detector on GECCO 2018; 20-seed harness with 95% intervals; a "stress week" where they lose; unit and e2e tests | 166 | yes |
| [michvinh-7/undercurrent](https://github.com/michvinh-7/undercurrent) | 7, 13, 5 (alerts) | A signed, encrypted residents' network over hubs; sensor boxes | 0 of 300 forgeries accepted; 200 of 200 alerts after 26 link cuts; local LLM triage 76% [69, 83] | 106 | no |
| [anudeep-bonagiri/hollow-twin](https://github.com/anudeep-bonagiri/hollow-twin) | 1, 2, 7, 8, 9 | A live 3D twin of one sector, fed by watches, relays, sensors and a rover (hardware lanes) | No real data; a live feed from devices | 19 | yes |
| [realtechnerd/surfacegpt](https://github.com/realtechnerd/surfacegpt) | 13 (+7, 14) | "Edge AI" for surface safety; the README lists Rust, CUDA, Verilog and 10 CPU instruction sets | The badges are not backed by results we could find; claims "no AI used" | 1,153 | yes |
| [Luke-Poh/HackFest](https://github.com/Luke-Poh/HackFest) (HOLLOWNET) | 1–15 (thin) | One Python server with 15 small modules on a 10 × 5 simulated Hollow | 26 tests; no real data | 4 | no |
| [AliXperia71/…-Ascent](https://github.com/AliXperia71/PatriotHackFestFall2026-Ascent) | 13 (14, 15 planned) | Signed surface probes in a hash chain, with a tamper demo | Works end to end for step 1 of 3 | 1 | no |
| [sidnemani07/hollow-watch](https://github.com/sidnemani07/hollow-watch) | 1, 3, 8 | A least-squares trend on sensor readings gives "minutes to failure" | None | 1 | no |
| AnPH42/hackfest-hollow-project, victoroola/patriothackfest26 (Undergrid), jerryalex2018/hackfest103 | ? | Early or empty | — | 1–3 | no |

## Where we stand on each judging criterion

The criteria are not published. We use the 2025 rubric as a stand-in (`context/event.md`).

| Criterion | Us | STRATUM | What closes the gap |
| --- | --- | --- | --- |
| Innovation, technical depth | **Ahead.** Real trained models, a tune/check/test gate, residents-only inputs | Real signal processing on a phone; no trained predictor | Lead with the models and the held-out test. Say that no other team trains on real disasters. |
| People impact | Strong story (the deep levels go dark first), but 1–2 problems measured | 15 problems with depth labels | A coverage matrix (see below) |
| Presentation | Results site in progress; no video, no live URL | Judge mode, a 90-second story, a write-up | Deploy, record the video, and add a 90-second "judge path" on the site |
| Quality, realism | The sim is our own, so a judge can say it grades its own work | Labels every number LIVE, REPLAY or SIMULATED; shows a week where they lose | Label every number REAL DATA or SIMULATED; publish a disaster where we lose; a README with "reproduce the evidence" commands |
| Teamwork | Commits mostly from Neil and Adarsh | Not known | Every teammate commits and is named in the write-up |

## What we must do to win (Fri Nov 20, in order)

1. ~~**Deploy the results site.**~~ Done Nov 19: https://hollow-twin-poc.vercel.app. Judges grade links and a video. Without a URL we lose against 3 rivals that have one.
2. **Make Cascade show the model working.** With the model on, Cascade looks like Baseline, because the power-saving request already covers Plant 2's loss. The video needs a disaster where "with" visibly beats "without" and also beats doing nothing smart. Workstream A's new disasters may fix this; check it first thing.
3. **A coverage matrix page,** honest like STRATUM's: *measured* (#1 Blackout Warning; #10 and #8 check-first model on real data), *prototype* (the 8 modules on tag `archive/hollow-twin-product`: #2, #3, #4, #7, #8, #9, #12, #13, with their old numbers labelled "earlier world, not gated"), *roadmap* (the rest). This closes most of the coverage gap without new code.
4. **Label every number** REAL DATA (EIA-930, EAGLE-I, Census, SVI, emPOWER, held-out test) or SIMULATED (the Hollow test world). Add one "where we lose" disaster or seed to the site.
5. **README rewrite:** what it is, the live link, "what is real", "reproduce the evidence" (`npm run gate -- --test`, `npm run results`, `uv run python models/train_dark_residents.py`), limits.
6. **Video (about 2–3 min)** with `/pitch` and `/hyperframes`. Open in the Hollow (cutaway, deep levels going dark), reveal the real data, end on the held-out numbers. Record by 6 pm.
7. **Devpost/write-up** in Standard Technical English, then `/humanizer`.
8. **If time is left:** bring back one more module through the gate (Fair Rationing for #2, or Family Check-In for #8, both on tag `archive/hollow-twin-product`), so 3 problems are measured instead of 1.

## Risks

- **STRATUM's "hear the grid" phone demo is striking on video.** We cannot beat it on spectacle. We beat it on proof: trained models, a held-out test, and real disasters.
- **The model numbers are modest.** The weather-free warning model warned 13% of events 12 h ahead. The check-first model's top-10 overlap is about 0.46 against 0.28 for history (the weather version). Present them as measured and honest, next to the baselines, never alone.
- **Overclaiming is the fastest way to lose a careful judge.** SurfaceGPT's README is an example of what not to do.
