# Proposal: make HollowGuard a product, not only a simulation

Status: proposal for the team sync · Author: Adarsh (with Claude) · Wed Nov 18, 2026
Applies to: `.plans/hollow-twin-spec.md` (draft) and the prototype on branch `prototype/hollow-twin-poc`

> **Summary.** Keep HollowGuard. Change one thing: the 4 tools become **real software modules** that read the information residents could really get (reports, meter readings, bulletins) and produce real outputs (alerts, ration schedules, routes). The simulation becomes the **test world** that produces that information, keeps the hidden truth, applies the tools' outputs, and scores the result. We keep most of Neil's work. The change makes our answer to the track ("build something that helps the people of the Hollow survive") a product that judges can see working.

---

## 1. The problem with the current design

The track asks us to *build something that helps the people of the Hollow survive*. The current prototype is a model of the Hollow in which each tool is a checkbox, and the checkbox changes a constant in the engine. Examples from `src/sim/engine.ts`:

| Tool | What the checkbox does now |
| --- | --- |
| Ledger | Changes the lie delay from `LIE_DELAY_H = 14 * 24` to `LEDGER_DELAY_H = 24`. No code reads reports or finds a lie. |
| Early Warning | The engine forecasts with its own internal plant state (the hidden truth) and then cuts demand by 10%. |
| Fair Share | Switches the engine's allocation rule from "upper levels first" to "max-min fair". |
| Layout | The engine moves its own fans and recyclers with full knowledge of every section. |

So the result of each tool is **set** by a constant, not **earned** by a decision. A judge sees settings and a seed, not a product. The spec already lists this risk: *"Judges call it just a game."*

## 2. The change: the tools are the product, the simulation is the test world

Self-driving companies test their driving software in a simulated city. The simulator makes traffic and rain and scores the drive. The driving software is the product. We use the same split:

```
 THE HOLLOW  (simulation: keeps the hidden truth)
    │  produces OBSERVATIONS: noisy meter readings, resident reports,
    │  official bulletins (which can be lies), messages
    ▼
 THE PRODUCT  ("the residents' system": what we build and pitch)
    report intake ─► Ledger (shared record) ─► modules ─► outputs
    │  produces OUTPUTS: alerts, ration schedules, layout moves,
    │  routes, messages
    ▼
 THE HOLLOW applies the outputs ─► deaths, heat, sickness, fairness, trust ─► score
```

### The one rule that makes it honest

**A module never reads the simulation's hidden state.** It gets only observations: the information a resident or a residents' council could really have. The simulation adds noise, delay and gaps to those observations. If a module's logic is weak, people die in the simulation. A good result is earned.

### What stays the same

Most of the current work is kept:

| Part | Status |
| --- | --- |
| Simulation engine (power, air, heat, sickness, water, food, end states) | **Kept.** It becomes the test world. |
| Scenario packs (Texas 2021, Chicago 1995, Wuhan delay, Flint) | **Kept.** They give the disasters real shapes. |
| Directorate lies, trust, and the 14-day response delay | **Kept.** Lies become observations (bulletins) that modules must check. |
| Pixel cutaway renderer | **Kept.** It shows the world. |
| Compare and Shapley attribution | **Kept.** It now attributes lives saved to **modules**, not checkboxes. |
| Rival, helper, leaderboard | Optional. Lower priority than the product view. |

What changes: the 4 `if (tools.x)` branches in the engine are removed. The engine applies module **outputs** instead. A new package holds the modules, and the page gets a second view: the product.

## 3. Interfaces (proposal for `types.ts`)

```ts
// What the product is allowed to see. The sim produces these each hour.
type Observation =
  | { kind: 'meter';    at: SectionId | PlantId; metric: 'power' | 'co2' | 'temp' | 'humidity' | 'waterQuality' | 'level'; value: number; t: Hour }
  | { kind: 'report';   from: SectionId; text: string; tags: string[]; t: Hour }  // typed by a resident (or by a judge)
  | { kind: 'bulletin'; text: string; claims: Claim[]; t: Hour }                   // the Directorate; can be false
  | { kind: 'stock';    at: SectionId; item: 'water' | 'food' | 'medicine'; amount: number; t: Hour }
  | { kind: 'census';   at: SectionId; people: number; needs: Need[]; t: Hour };

// What the product produces. The sim applies these.
type Output =
  | { kind: 'alert';      to: SectionId[]; text: string; action: 'conserve' | 'boilWater' | 'isolateSick' | 'evacuate'; t: Hour }
  | { kind: 'allocation'; plan: Record<SectionId, { powerHours: number[]; waterL: number; foodRations: number }> }
  | { kind: 'layoutMove'; item: 'fan' | 'recycler' | 'clinic'; from: SectionId; to: SectionId }
  | { kind: 'finding';    text: string; evidence: ObservationRef[]; contradicts?: BulletinRef }  // e.g. "Plant 3 is failing"
  | { kind: 'message';    from: SectionId; to: SectionId | 'all'; text: string; signed: boolean };

interface Module {
  id: string;                                   // 'earlyWarning', 'fairShare', 'snow', ...
  step(obs: Observation[], memory: unknown): { outputs: Output[]; memory: unknown };
}
```

**How the simulation applies an output:**
- An **alert** changes behavior only in the sections it reaches, and only for the share of residents who trust it. Trust comes from the existing trust value, and it goes up when a module's past alerts were right.
- An **allocation** replaces the Directorate's "upper levels first" rule for the next day.
- A **finding** that contradicts a bulletin ends that lie's delay, so residents respond early. This replaces the fixed 24-hour Ledger constant: the delay is now as long as the module needs to collect enough evidence.
- A **layout move** costs a crew and takes time.

## 4. Example: Fair Share as a real module (problem 2)

| | |
| --- | --- |
| **Inputs** | Census per section (people, infants, oxygen users, the sick); the power forecast from Early Warning; water and food stock reports |
| **Logic** | Life-critical loads first in every section (air handling, recyclers, clinics). Then max-min fair shares of what is left. Blackout hours rotate, so no section is dark two nights in a row. |
| **Output** | A published, **signed** schedule: *"L44 Section 3: power 18:00–02:00, water 40 L per person per day."* Anyone can check that the Directorate did not change it. |
| **What the sim measures** | Deaths, hours above the heat limit, and the fairness gap between the upper and deep levels |
| **Judge moment** | Same supply, two plans. The Directorate's plan keeps L1–20 at full power while L44–50 go dark. Fair Share's plan keeps the air running on every level. |

## 5. The seed

The seed stays, because it makes "with the product" and "without the product" face the **same** disaster. That is what makes the comparison fair. But it moves out of sight, under "Advanced / Replay". The interface gets live inputs instead:

- **Event buttons:** "Break the recycler on L38", "Directorate cuts the network", "Flood in Low Market", "Plant 3 trips".
- **Type a report as a resident:** a judge types *"the water on L39 tastes like metal"* and watches the Snow module use it.
- **Scenario packs** stay as the background disaster.

## 6. The product view (new screen)

The page shows two things side by side:

1. **The Hollow:** the existing cutaway and panel (the world).
2. **The residents' system:** a phone-sized view of what a resident sees, plus a council console:
   - alerts as they arrive ("Power cut on L40–50 in about 30 h. Conserve now.")
   - today's ration schedule for the resident's section
   - a report form
   - "Official vs measured": each Directorate claim, the evidence against it, and its status
   - the evidence behind each alert (which reports and readings)

The judge watches information come in, the product decide, and the world change because of it.

## 7. Modules for each of the 15 problems

All modules share one **backbone**: report intake → the Ledger (a shared, signed record that cross-checks reports and readings) → modules → delivery. Delivery uses Lantern (an offline mesh) when the Directorate shuts the network down.

Tier: **M** = must ship (real logic, in the demo) · **S** = stretch · **N** = named in the pitch as "next", with a design sheet in `ideation/projects-1-15.md`

| # | Problem | Module | Input | Logic | Output | Sim measures | Tier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | (backbone) | **Ledger** | All reports, meters, bulletins | Store, sign, cross-check. Mark a bulletin false when enough independent evidence contradicts it | Findings | Delay before residents respond; trust | **M** |
| 1 | Blackout warning | **Early Warning** | Plant meter readings, demand, past outages | Forecast supply against demand 24–48 h ahead from *measured* data | Alerts with a time and the sections affected | Plant trips avoided; CO₂ deaths | **M** |
| 2 | Fair sharing | **Fair Share** | Census, needs, forecast, stocks | Critical loads first, then max-min fair, rotating blackouts | Signed ration schedule | Deaths; fairness gap | **M** |
| 4 | Bad water | **Snow** | Water-quality meters, "tap water" reports, sickness reports | Trace cases upstream on the water network to the likely recycler (John Snow, 1854) | "Recycler L38 is the likely source. Boil water on L38–42." | Waterborne illness | **M** |
| 9 | Real outbreak | **Truthcount** | Symptom reports, clinic counts, the official number | Estimate the real case count from incomplete reports; flag the gap | "Official 310, estimated 1,240"; where to send supplies | Delay before response; infections | **M** (part of the Ledger view) |
| 3 | Heat | **Layout (cooling)** | Temperature and humidity readings, fan status | Rank the fan moves that cut the most heat-danger hours | Layout moves; cooling hours | Hours above wet-bulb 31 °C | **S** |
| 7 | Network shutdown | **Lantern** | Messages and alerts | Store-and-forward mesh between neighboring sections; signed messages | Delivery when the network is off; fake notices rejected | Alerts that arrived during a shutdown | **S** |
| 8 | Families split up | **Kin** | Check-ins | Check-ins carried over Lantern | "3 safe, 1 not heard from" | Time until families know | **S** (small, on top of Lantern) |
| 5 | Flooded tunnels | **Floodline** | Water-level and blockage reports | Flood spread on the tunnel graph | "Low Market cut off in 3 h"; route out | People trapped | **N** |
| 6 | Crowding | **Swapline** | Room sizes, households, swap requests | Find room-swap chains | A swap that gives everyone more space | Space per person; spread | **N** |
| 10 | Medicine | **Runner** | Clinic stock, patient reports | Triage plus delivery routes | "Runner A takes inhalers to L46" | Untreated cases | **N** |
| 12 | Food | **Larder** | Farm output, stocks | Days-of-food estimate and a grow plan | "4.2 days left → 23 days with this plan" | Hunger deaths | **N** |
| 11 | No sunlight | **Dawnline** | Sleep and mood check-ins | Light schedule per section | Lighting plan | Weak fit; a small sub-feature only | **N** |
| 13 | Is the surface safe? | **Witness** | Surface probe readings (made by the sim, with noise) | Signed readings that anyone can check | Public page; a changed reading is caught | Trust; spread of false claims | **N** |
| 14 | Who goes up first | **Vanguard** | Suit, dome and outpost options; volunteers | Many simulated missions per option | "Domes first; these 12 volunteers" | Mission survival | **N** |
| 15 | Moving everyone up | **Exodus** | Lift capacity, population per level | Move schedule | "One more lift saves 11 months" | Time to move everyone | **N** |

**Coverage:** must ship covers problems **1, 2, 4, 9** with real logic, and the stretch tier adds **3, 7, 8**. The pitch can show one connected system that reaches 7 problems working and names the other 8 with designs. That is stronger than 10 problems covered by checkboxes.

## 8. Demo (3 minutes, assumed)

1. **0:00–0:20 · The Hollow.** The cutaway, the Directorate's bulletin ("All levels nominal"), and the real-world twins (Texas 2021, Flint, Wuhan).
2. **0:20–0:50 · Without the product.** Texas pack. Plant 3 decays while the Directorate says it is fine. The deep levels go dark. The Hollow is lost on day 16.
3. **0:50–2:00 · With the product.** Same disaster.
   - Meter readings and reports arrive. **Early Warning** sends "power cut on L40–50 in about 30 h".
   - The **Ledger** marks "Plant 3 is operating normally" as **false**, with the evidence.
   - A judge types a report: *"the water on L39 tastes like metal."* **Snow** traces it to recycler L38 and sends a boil-water alert to L38–42 only.
   - **Fair Share** publishes the signed schedule, and the air stays on at every level.
4. **2:00–2:30 · The result.** Compare: lost on day 16 against stable. Attribution: lives saved by each module.
5. **2:30–3:00 · The rest of the system.** Lantern delivers an alert with the network off (if the stretch tier is done). Then the "next" modules and the URL.

## 9. Changes to the spec's workstreams

| # | Workstream | Change |
| --- | --- | --- |
| 1 | Sim engine | Remove the 4 `if (tools.x)` branches. Add the **observation layer** (noise, delay, gaps) and **apply outputs**. |
| 2 | Scenario packs | No change. |
| 3 | Renderer | No change. Optional: show alerts arriving in sections. |
| 4 | Panel and controls | Add event buttons and the report box. Move the seed to "Advanced". |
| **5 (new)** | **Product modules** (`packages/product`) | Ledger, Early Warning, Fair Share, Snow, Truthcount. Each one is unit-tested against recorded observations. |
| **6 (new)** | **Product view** (`apps/web/src/product`) | Resident phone view and council console. |
| 7 | Rival, helper, attribution | Attribution over modules. Rival and helper move to "nice to have". |
| 8 | API, leaderboard, summary | Leaderboard moves to "nice to have". Summary stays. |
| 9 | Pitch and video | New demo script (section 8). |

## 10. Cost and risks

| Risk | Answer |
| --- | --- |
| Less time: it is Wed, and the deadline is Fri 11:00 pm | The engine, packs and renderer already exist. The new work is the observation layer (about half a day), 4 small modules (about half a day each, and they can be built in parallel), and the product view (about a day). The rival and leaderboard move out of the must-ship list to pay for it. |
| Modules fail on noisy data, and the demo looks bad | Good: that proves the result is earned. Tune the noise level so a good module wins clearly, and show one honest failure case in the pitch ("Early Warning missed this cut because 3 meters were dark"). |
| Too many modules | 4 are must ship. The other 11 are "next", with design sheets already written. |
| Judges ask "would this work in reality?" | The modules use real methods (load forecasting, max-min fair allocation, upstream tracing, under-reporting estimates). The world is fictional; the logic is not. |

## 11. Decisions needed at the sync

1. Adopt the split (product modules + simulation as test world)? **Yes / no.**
2. Must-ship modules: Ledger, Early Warning, Fair Share, Snow, Truthcount? Or a different set?
3. Move the rival, helper and leaderboard to "nice to have"?
4. Owners for the new workstreams 5 (modules) and 6 (product view).
5. Lantern (problem 7) as the first stretch item?
