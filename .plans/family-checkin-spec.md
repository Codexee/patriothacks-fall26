# Family Check-In (problem #8): Master Spec
Status: locked   ·   Last updated: 2026-11-20   ·   Owner: Adarsh

## One-liner
The second app on the residents' phone. During a blackout, households tap "We're OK". Check-ins from dark levels hop phone to phone up to the first level with power, so families on other levels get news. When a family stays silent in a dark section, the app asks a household nearby that checked in OK to knock on their door.

## The winning demo (30-second scene)
1. 0–8 s: Day N. Blackout Warning has warned levels 40–50. The phone (home L39) shows a Family app badge. In the app: "Mom, L44: OK, 21:10 (relayed from a dark level)", "Brother, L12: OK", "Aunt, L50: silent, level dark. Neighbor asked to check."
2. 8–18 s: The presenter switches Family Check-In off and reruns the same seed. The same family list reads "No news" for everyone below the blackout line. The counter reads "families with no news tonight: 31,000".
3. 18–30 s: Switched on again: no-news families drop sharply, neighbor checks go to silent dark sections, and deaths fall by a measured amount. Presenter: "Blackouts cut the network where people need it most. The app routes news around the dark, and sends a neighbor when it doesn't arrive."

## Problem, user, and why now
Brief problem #8: families split across levels can't check on each other in a blackout. The user is a resident with relatives on other levels. It builds on Blackout Warning (same outage reports) and is the second app on the phone.

## Track fit (Life underground: which of the 15 Hollow problems it covers, by number)
#8 directly. It touches #7 (communication without the official network) and #1 (it uses the blackout warning to remind people to check in).

## Scope
### Must ship (demo path)
- **World (`src/sim/engine.ts`):**
  - Switch on `WORLD.families`.
  - New rule: a section whose power is out at the end of the day cannot send check-ins on its own; they are held and arrive the next day. Without the app they count as "no news" tonight.
  - With Family Check-In on: check-ins from a dark section get out if at least one level above it has power (phone-to-phone relay up to the first lit level). If the whole Hollow is dark, they are held, as without the app.
  - Neighbor checks use the existing `welfare` output and `WELFARE_CUT`.
- **Module (`src/product/familyCheckIn.ts`, key `kin`):**
  - Reads yesterday's `checkins` observations (expected and received per section) and outage reports (dark sections).
  - Sends a `welfare` output for sections that are dark and where under 70% of expected check-ins arrived ("silent").
  - Writes a log for the Modules panel and the phone.
  - Inputs are only the app's own check-ins and outage reports.
- **Names:** add `kin` to `BUILT` and name it "Family Check-In" in `product/names.ts`. The progress dots show 2 of 15.
- **Phone app (`src/ui/phone/apps.tsx`):**
  - A Family app with its own icon.
  - A sample family of 3 relatives on other levels (default L12, L44, L50). Each one's status comes from the sim's check-ins for their section: OK / silent (level dark, neighbor asked) / no news. Labelled SIMULATED.
  - A big "We're OK" button. It shows "Sent", or "Held: your level is dark; it goes out when power returns" when the whole Hollow is dark.
  - The badge counts relatives who went silent.
- **Modules panel card:** families with no news yesterday, silent dark sections, and neighbor checks sent.
- **Gate and results:**
  - `npm run gate` gets a "no-news families" column.
  - `npm run results` adds the no-news families number to `public/results/scenarios.json`.
  - Rerun on all seed sets, both with and without the app.

### Nice to have (only after must-ship is green)
- When Blackout Warning warns your level, the Family app reminds you to check in before the blackout.
- A results-site panel for problem #8.

### Explicit non-goals
- No messages or notes, no location tracking.
- No phone-to-phone relay when the whole Hollow is dark (user's choice: hold until power returns).
- No Directorate network shutdown (that's problem #7).

## Architecture
```
outage reports + checkins (yesterday) ──> familyCheckIn.ts ──> welfare(sections) ──> engine: welfareUntil, 25% fewer deaths there for a day
                                   └──> log ──> Modules panel card, phone Family app
engine end of day: path = lit ? 1 : (kin on && some level above lit) ? 1 : 0  ──> familiesNoNews, checkins obs
```
Stack unchanged: TypeScript, React, Vite. No new dependencies.

## Data & seeding plan
- **Family size:** `FAMILY_SIZE = 40` residents per split family. An existing sim guess.
- **Neighbor check effect:** `WELFARE_CUT = 0.25` fewer deaths in a section for a day. An existing guess, labelled as a guess: no study gives this number.
- **Relay assumption, stated:** phones on adjacent levels can reach each other.
- **Seeds:** the same seeds as the gate. Switching on families changes the observation noise, so all results are regenerated.

## UI / UX direction
- The same phone style as Blackout Warning.
- Family icon: a blue-violet gradient with a people glyph.
- Relative rows show an avatar initial, a name and level, a status pill (green OK, amber held or relayed, red silent), and the time of the last check-in.
- The "We're OK" button is large and green. Readable at a glance on video.

## Hardware (if hybrid)
None.

## Workstreams
| # | Workstream | Owner | Files/dirs owned | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| 1 | World rule and families on | Claude | `src/sim/engine.ts` | none | Without the app, no-news families rise in dark sections; typecheck passes |
| 2 | Family Check-In module | Claude | `src/product/familyCheckIn.ts`, `src/product/index.ts`, `src/product/types.ts`, `src/product/names.ts` | 1 | Welfare goes to silent dark sections; log filled |
| 3 | Family app and card | Claude | `src/ui/phone/apps.tsx`, `src/ui/ModulesPanel.tsx`, `src/ui/ProductView.tsx` | 2 | The demo scene works in the browser |
| 4 | Gate and results | Claude | `src/sim/gate.ts`, `src/sim/results.ts`, `public/results/*.json` | 1–2 | Numbers regenerated on all seed sets; Adarsh reviews before the push |

## Risks & fallbacks
- **Regenerating the results changes the published Blackout Warning numbers slightly.** Fallback: report both and update the site.
- **The death effect rests on a guessed 25%.** Say so in the pitch. The no-news number is the main claim.
- **Time.** If the gate is not green by the video slot, show Family Check-In on the demo page only and keep the old results.

## Demo script & pitch beats
"Blackouts cut the network where people need it most. Family Check-In passes 'We're OK' phone to phone up to the first lit level, and when a family stays silent in the dark, it sends a neighbor who is OK to knock. Problem 8, on the same phone as the blackout warning."

## Decisions made in this interview
- Core: check-in plus neighbor check (user).
- Without the app, dark sections can't send check-ins (user).
- Privacy: opt-in links; OK / silent / help only (user).
- Metric: no-news families plus deaths (user).
- Relay: phone to phone up to the first lit level (user).
- Whole Hollow dark: hold until power returns, no relay (user).
- Neighbor: a household that checked in OK nearby (user).
- Families switched on in the sim, results regenerated (user).
- Phone: a sample family from the sim (user).
- Build now, gate, then review before the push (user).
- Silent threshold 70% and the check-in reminder as a nice-to-have (Claude's defaults).

## Open questions
None.
