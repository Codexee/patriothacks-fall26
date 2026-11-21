# HollowGuard: integrate Adarsh's 8-app world — Master Spec
Status: locked   ·   Last updated: 2026-11-20 20:00 EST   ·   Owner: Neil

## One-liner
Merge Adarsh's branch `hollow-earth-rebuild-2d` (frozen at `c615334`) into `main`. The harder world (heat, sickness and food on) becomes the product's test world. HollowGuard ships 7 apps for 7 of the 15 problems, and the site, README and films show the new numbers.

## The winning demo (30-second scene)
A judge opens the live site and presses "Play the 90-second tour". The headline shows deaths without and with HollowGuard in the harder world. "The app and its impact" lists 7 apps, each with a measured bar: Blackout Warning, Fair Share, Water Safety, Off-Network Messaging, Family Check-In, Outbreak Tracker, Food Sharing. The 3D run shows a disaster, and the phone shows the alerts. The "Stable at day 120" KPI honestly shows 52/70 (or the new value).

## Problem, user, and why now
The track rewards one solution that covers several of the 15 problems. Main covers 5. Adarsh's branch adds #9 and #12 in a world where heat, sickness and food matter. Deadline: Fri Nov 20, 11:00 pm.

## Track fit (Life underground)
#1 Blackout Warning, #2 Fair Share, #4 Water Safety, #7 Off-Network Messaging, #8 Family Check-In, #9 Outbreak Tracker, #12 Food Sharing. #3 (heat) is in the world, but Cooling is not shipped (Neil: almost no measurable effect).

## Scope
### Must ship (demo path)
1. Merge `origin/hollow-earth-rebuild-2d` at `c615334` into `main`. Keep every HollowGuard change from `main` (rename, 3D phone, tour, real data, impact, short text, 3 limits).
2. Take Adarsh's world and logic: `WORLD.heat/sickness/food = true`, farm lamps essential, warned residents escape heat, Fair Share heat cap, his 5-point easing, `outbreak.ts`, `foodSharing.ts`, his phone app screens.
3. `BUILT` = 7 apps: earlyWarning, fairShare, snow, lantern, kin, ledger (Outbreak Tracker), larder (Food Sharing). Not `layout` (Cooling). `cooling.ts` stays, because Fair Share uses its heat rates.
4. Re-run `npm run results` and `npm run impact` (7 apps). Every number on the site, README, tour and changelog comes from these files.
5. The site lists 7 apps with a line each, and the phone shows 7 apps. Remove "N of 15 problems have no app yet" and the phone's "More apps arrive…" line.
6. Show "Stable at day 120" honestly (the measured value against 0/70 without).
7. Re-render the 7 films in the background.
8. Commit, push and redeploy Vercel.
### Nice to have (only after must-ship is green)
- A tour caption for the new apps.
### Explicit non-goals
- Re-tuning any constant. Shipping Cooling. Restoring main's gentle easing. Any 2D cutaway work beyond what merges cleanly.

## Architecture
No new components. Same pipeline: `src/product/*` (apps) → `src/sim/engine.ts` (test world) → `npm run results` / `npm run impact` → `public/results/*.json` → site. The 3D view and the phone use `BUILT` through `WITH_TOOLS`, so they pick up the 7 apps automatically.

## Data & seeding plan
Same real data (EIA-930, EAGLE-I, SVI, ERCOT). Test seeds 11–20. Results are regenerated after the merge with `BUILT` = 7 apps.

## UI / UX direction
No visual changes. Add 3 rows to `APP_LINE` in `Results.tsx`: Outbreak Tracker and Food Sharing (one line each, in STE).

## Hardware (if hybrid)
None.

## Workstreams
| # | Workstream | Owner | Files/dirs owned | Depends on | Done when |
|---|---|---|---|---|---|
| 1 | Merge and resolve | Claude | `prototypes/hollow-twin-poc/src/**`, `CHANGELOG.md` | — | Type-check passes; `BUILT` has 7 apps |
| 2 | Regenerate results and impact | Claude | `public/results/*.json` | 1 | Both files are written from the merged code |
| 3 | Site, README, tour text | Claude | `src/site/**`, `README.md` | 2 | Every number matches the JSON files |
| 4 | Films | Claude (background) | `public/films/`, `video/` | 2 | 7 films show the new labels and numbers |
| 5 | Ship | Claude, with Neil's go-ahead | git, Vercel | 3, 4 | Live site shows the new headline |

## Risks & fallbacks
- **The merge is not green by 9:30 pm** → reset `main` to `backup/hollowguard-site-2026-11-20` (`85bb5d2`, the deployed site), and spend the rest of the time on the video and Devpost.
- **Results look worse with Cooling removed** → they are measured. Report them as they are, with no re-tuning.
- **Adarsh pushes more to his branch** → ignore it. Neil tells him the branch is frozen at `c615334`.
- **The impact run is slow** (more worlds on) → run it in the background while the site text is updated.

## Demo script & pitch beats
1. The headline: deaths without and with HollowGuard, in a world with heat, sickness and hunger.
2. Seven apps, each with its measured impact.
3. Real data: the plant-loss curves.
4. The 3D run and the phone.
5. Honest limits: 52/70 (or the new value) runs stable, and the reason.

## Decisions made in this interview
| Decision | Answer | Whose |
|---|---|---|
| Headline world | Adarsh's harder world becomes the headline | Neil (recommended) |
| Easing | Adarsh's 5 points every 5 quiet days | Neil (recommended) |
| Cut-off | 9:30 pm, then fall back to the backup branch | Neil |
| Films | Re-render | Neil (recommended) |
| Failed runs | Show the stable count honestly | Neil (recommended) |
| Cooling | Drop it (7 apps, 7 problems) | Neil |
| Branch tip | Freeze at `c615334` | Neil (recommended) |
| "N of 15" text | Remove it, as Adarsh did | Claude default |

## Open questions
- None. Neil tells Adarsh that his branch is frozen.
