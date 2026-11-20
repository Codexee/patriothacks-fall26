# Residents' Phone as Apps: Master Spec
Status: locked   ·   Last updated: 2026-11-20   ·   Owner: Adarsh

## One-liner
The resident's phone in the Residents' System panel becomes a real phone home screen. Each built module is an app. Alerts show as a notification banner and a red badge, like a normal phone.

## The winning demo (30-second scene)
1. 0–5 s: The judge sees the cutaway and, on the right, a phone with a home screen: a "Blackout Warning" icon and a "Report" icon. The status bar shows the sim clock, the day, and "L39 · S3".
2. 5–15 s: The presenter presses Space. The day runs. Next morning, a banner slides down: "Blackout Warning · Save power: switch off 38% of non-essential load." A red "1" appears on the icon.
3. 15–25 s: The presenter taps the icon. The app opens with an animation: the next blackout on your level, today's ask, and the alert with "Why?".
4. 25–30 s: The presenter says: "Every problem we solve becomes another app on the residents' phone." The Modules panel on the left is unchanged.

## Problem, user, and why now
The current phone is a flat list. It does not read as a phone, and it will get crowded as modules are added. An app per module scales to 15 problems and is easy to understand on video.

## Track fit (Life underground: which of the 15 Hollow problems it covers, by number)
No new problem. It presents #1 (Blackout Warning) better and gives every future module (#2–#15) a place on the phone.

## Scope
### Must ship (demo path)
- A phone frame: rounded body, notch, status bar (sim day and hour, signal, battery), wallpaper.
- Home screen: one icon per module in `BUILT` (from `product/names.ts`), plus a "Report" app. A new module in `BUILT` adds an icon with no other change. A module with no custom screen opens a default screen that lists its alerts for your level.
- Blackout Warning app: the resident's view as today (next blackout on your level, alerts for your level with "Why?"). If the module is off, the screen says so, as today.
- Report app: the existing "Report a problem" form and the queued count.
- Badge: red count of today's unread alerts for your level, per app. It clears when you open the app.
- Banner: slides down from the top when a new alert for your level appears or the save-power ask goes up. It hides after about 4 s. Tapping it opens the app.
- Home chip in the status bar ("L39 · S3" and a lock): tapping it opens a small sheet with level, section, and the lock. Same behavior as the current picker.
- Open and close animation for apps (scale from the icon); a back control ("Home" bar at the bottom).
- The Modules panel stays exactly as it is.

### Nice to have (only after must-ship is green)
- Haptic-style shake of the icon when a banner appears.
- App icon glyphs drawn in SVG per module.

### Explicit non-goals
- No lock screen.
- No council detail tab inside the app (the Modules panel already shows it).
- No changes to `src/product/` or `src/sim/`.

## Architecture
- `src/ui/ProductView.tsx`: keeps the header (title, 15-problem dots). The phone body moves to a new component.
- New `src/ui/phone/`:
  - `Phone.tsx`: frame, status bar, home chip and sheet, home screen, open-app state, banner.
  - `apps.tsx`: the app registry. `APPS` is built from `BUILT` plus the Report app. Each entry has key, name, icon (glyph and color), a screen component, and a function that returns its alerts for a level. Modules without a custom entry get the default icon and screen.
  - `phone.css`: phone styles, using the existing tokens in `ui/styles.css`.
- Unread state lives in `Phone.tsx`: the set of alert ids seen per app. Reset clears it. The banner compares today's alerts for your level with yesterday's (new id, or a higher `amount` on a save-power alert).
- Data: only `run.outputs`, `run.log`, and `run.memory`, as now. Nothing from the hidden world.

## Data & seeding plan
No new data. Default scenario Baseline, seed 1, as now.

## UI / UX direction
- A modern phone: dark frame, rounded corners, notch, glass status bar, a deep blue wallpaper that matches the site. Icons are rounded squares with a lit gradient. Banners are frosted glass cards.
- Readable at a glance on video. Respect `prefers-reduced-motion` (no slide; fade only).
- Follows the saved taste: no pixel art, rich and lit, animated, readable.

## Hardware (if hybrid)
None.

## Workstreams
| # | Workstream | Owner | Files/dirs owned | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| 1 | Phone apps UI | Claude (with Adarsh reviewing) | `src/ui/phone/`, `src/ui/ProductView.tsx` | none | The demo scene works in the browser, typecheck passes, Modules panel unchanged |

## Risks & fallbacks
- The right panel is narrow. Fallback: scale the phone to fit the panel width.
- Banner spam. The "only when it changes" rule limits it.
- Deadline. If not green by 4 pm, keep the current phone (no merge).

## Demo script & pitch beats
"Residents get one phone app per problem we solve. Today that is Blackout Warning. When it sends an alert, you get a notification like any other app."

## Decisions made in this interview
- Home screen: built modules plus a Report app (user).
- Alerts: banner plus badge, no lock screen (user).
- App screen: resident's view only; council detail stays in the Modules panel (user).
- Look: realistic phone (user).
- Home picker: chip in the status bar that opens a sheet (user).
- Banner rule: only when a new alert appears or the ask goes up (user).
- Badge clears when the app is opened (user).
- Claude builds now; Adarsh reviews before the push to main (user).
- Default screen and icon for modules with no custom app (Claude's default).

## Open questions
None.
