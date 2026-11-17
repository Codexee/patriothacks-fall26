# The Hollow brief: does Off the Record still fit, and what to pivot to

Status: **decision needed today (Tue Nov 17)** · Written by Claude for Neil · Track summary: `context/track.md`

## 1. What changed

The organizers published the real track brief. The pre-event teaser was "navigate, survive, or rebel" and "they're watching". The real brief is a specific world: **the Hollow**, 2 billion people living underground in 2087 under a government called the Directorate. It lists **15 numbered problems**: power, heat, water, tunnels, crowding, communication, health, food, and the return to the surface. It also says that **one connected solution that addresses several problems can score higher.**

Other new facts (all in `context/event.md`):
- The deadline is **Fri Nov 20, 11:00 pm**, not 5:00 pm.
- Judging is on an internal platform from **Nov 21 to 24**. That is almost certainly asynchronous, so the **video and the write-up are the demo**.
- **HackOverflow, GMU's hardware hackathon organization, co-runs the event.**
- AI tools are allowed.

## 2. Does Off the Record adapt? Honest answer: no, not well

| Problem | Does Off the Record solve it? |
| --- | --- |
| 7: organize without the Directorate's network | **No.** The problem is that the network can be **shut down**. Off the Record protects what you send over a network that still works; it does not replace the network. |
| 9: the real outbreak vs official numbers | **Partly, as a component.** Anonymous symptom reports, stripped of identity on the device, so the Directorate can't punish the people who report. |
| 13: the truth about the surface | No. |
| The other 12 | No. |

**Direct coverage: 0 of 15. Indirect: 1–2.** To make it fit, we would have to invent a premise the brief never mentions, for example "the Directorate runs the only AI, and residents must use it." A judge who has just read 15 concrete problems about power, water and air will ask, "Which problem does this solve?" Our hooks (the 20M ChatGPT logs court order and banking agents) are real 2026 news, but they don't exist in the Hollow. In the video they would read as off-track.

**What we keep from the work so far:**
- **The GLiNER-in-the-browser gate (83 ms) is reusable.** It becomes anonymous reporting (problem 9) in the pivot.
- The agent-view rewrite (gate G2) has no use in the Hollow. It stays on its branch.

**Recommendation:** pivot today. The pivot costs about half a day. Staying costs most of the track-fit score.

## 3. Pivot options

Scores are 1–5:
- **Wow:** a judge reacts right away.
- **Cover:** how many of the 15 problems it addresses directly.
- **Feasible:** can be built by Fri 6 pm.
- **Real:** real-world impact outside the story.
- **Video:** it shows well in a recorded video.

### A. Canary: the Hollow measures itself  ·  hybrid, with a software fallback  ·  **recommended**

**The name:** miners carried canaries because the birds die from bad air before people do. This is a network of canaries for a city in a mine.

**The idea:** cheap sensor nodes on every level measure air, water, heat and power. The nodes talk to each other by radio over a **mesh** (each node relays messages for the others), with no central network. The mesh does four jobs:
- It **warns people before** the air or the power fails.
- It **flags bad water** before people drink it.
- It carries **"I'm OK" check-ins** between families when the Directorate shuts the network down.
- It builds an **outbreak map** from anonymous symptom reports plus the air data. The map sits next to the Directorate's official numbers, so everyone can see where the two disagree.

Every reading is signed by the node that made it, so anyone can check where the data came from without trusting us.

**Problems covered: 1, 3, 4, 7, 8, 9, 13 (7 of 15).** For problem 13: "send a canary up the shaft". A sealed node goes up and reports signed surface air readings that everyone can verify.

**Winning demo (30 s, on camera):**
1. Three small boards on a table, labelled Level 12, Level 31 and Level 47, next to a laptop dashboard of the Hollow's levels.
2. A side panel shows the "Directorate feed": "All levels nominal."
3. Neil drops the Level 47 water probe into a cup of salt water.
4. Within 2 seconds, Level 47 turns red on the map, and every phone on the table shows "Level 47, Block C: do not drink the water."
5. Neil unplugs the Wi-Fi router. The alert keeps spreading node to node, and a family check-in from Level 12 still arrives at Level 47.
6. He breathes on the CO₂ sensor, and the forecast line bends: "Air cut likely on Level 47 in about 40 min."
7. The Directorate feed still says "nominal."

Line for the judges: "They control the network and the numbers. They don't control the canaries."

**How it works:**
- **Radio and mesh: copy, don't invent.**
  - **Option 1:** Meshtastic firmware on LoRa boards (Heltec V3 or LilyGO T-Beam, about $20–35 each). Meshtastic already relays messages and sensor readings over a long-range mesh. We build our application on top of it.
  - **Option 2:** plain ESP32 boards with ESP-NOW (direct ESP32-to-ESP32 radio, no router). This needs fewer parts, but we write the relaying ourselves.
- **Sensors (per node):**

  | Sensor | Measures | About |
  | --- | --- | --- |
  | SCD40/41 | CO₂ | $45 |
  | BME280/680 | temperature, humidity, gas | $10–20 |
  | Analog TDS probe | dissolved solids in water | $10 |
  | INA219 | voltage and current | $5 |

- **Forecast:** trends plus thresholds per level, for example "CO₂ rising 40 ppm/min → time until unsafe." This is a fixed rule a judge can read, not an AI verdict.
- **Signed data:** each node signs its readings with its own key (Ed25519). The dashboard checks every signature and shows which node each reading came from.
- **Anonymous symptom reports:** a resident types "my son has had a cough for 3 days, we're on Level 47." The GLiNER model (already passed gate G1) removes the identity on the device and keeps only the level and the symptom. The report then joins the outbreak map.
- **Remote members:** the dashboard, the node simulator, the forecast and the reporting app need no hardware. The local members hold the boards.
- **Software fallback:** a simulated mesh of 20 virtual nodes in the browser runs the same dashboard. The hardware is an upgrade to the demo, not a dependency, as `context/constraints.md` requires.

**Prior art (honest):**
- Meshtastic already does mesh texting and has a sensor telemetry module.
- PurpleAir and Sensor.Community crowdsource air readings.
- Safecast crowdsourced radiation readings after Fukushima, because people did not trust the official numbers.

None of them combines independent sensing, forecast warnings, mesh alerts that survive a shutdown, an outbreak map from anonymous reports, and an official-vs-measured view in one system. That combination is what the brief asks for.

**Real-world impact:** Flint's water, wildfire smoke, internet shutdowns (governments shut down networks 296 times in 2024, according to Access Now; confirm before quoting), mine and tunnel safety, and disaster zones.

**Risks:**
- **It can look like an IoT dashboard.** Carbin, SmartBuilding and Sustainable Building Monitoring all won before. The fix is the demo beats an IoT dashboard doesn't have: the Directorate-vs-truth split, the router unplugged, and the forecast.
- **The parts must be in hand by Wed noon.**
- **LoRa range indoors is not an issue on one table.**

**Scores:** Wow 4 · Cover 5 · Feasible 4 · Real 5 · Video 5 = **23/25**

### B. Fair Share: a rationing system the Directorate can't rig  ·  software only

**The idea:** a public allocation algorithm for power, water and food during shortages (problems 2, 6, 12). Each level sees the rule, the inputs and its share. A simulation of the Hollow runs the Directorate's rule ("upper levels first") against a fair rule (equal hours of blackout, need-weighted) and counts the results: hours without air, sick people, food-days.
**Wow:** the simulation flips from "Level 47: 61 hours dark" to "every level: 9 hours dark".
**Weaknesses:** it covers 3 problems, it is mostly a chart, and its real-world use is policy rather than daily life.
**Scores:** Wow 3 · Cover 3 · Feasible 5 · Real 3 · Video 3 = **17/25**. **It could become a Canary module:** the rationing uses the canaries' real power data. That brings Canary's coverage to 8 problems.

### C. Dark Net: phones-only mesh for the shutdown  ·  software only

**The idea:** phones relay messages, check-ins and alerts to each other without the network, over Bluetooth or the acoustic modem from Whisper Net (round 3). It covers problems 7, 8 and 1.
**Weaknesses:** Bridgefy, Briar and Meshtastic exist, and Neil already rejected Whisper Net for low wow. Browsers can't make phone-to-phone Bluetooth meshes, so it would need native apps.
**Scores:** Wow 3 · Cover 3 · Feasible 3 · Real 4 · Video 3 = **16/25**

### D. Way Up: plan the return to the surface  ·  software only

**The idea:** a simulator for problems 13, 14 and 15. It compares suits, domes and outposts, chooses who goes first, and plans the move.
**Weaknesses:** it is fully fictional, its real-world impact is low, and it is hard to make convincing in 3 days.
**Scores:** Wow 3 · Cover 3 · Feasible 3 · Real 1 · Video 3 = **13/25**

### E. Keep Off the Record, reframed as "use the Directorate's AI anonymously"

**Scores:** Wow 4 · Cover 1 · Feasible 5 (gates passed) · Real 5 · Video 4 = **19/25**, but Cover 1 is the score the brief cares about most. **Not recommended.**

## 4. Recommendation

**Pivot to Canary (A) today, with Fair Share (B) as a module only if the core is green by Thu noon.** It covers 7 of 15 problems in one connected system, which is what the brief rewards. It shows well on camera. It suits a jury that includes a hardware organization and a team with two EE members. Each piece has a fixed-rule answer to "why should I trust it?": signed sensor readings, not an AI's judgment.

## 5. If we pivot: what to decide and do today

1. **Hardware gate (tonight):** choose the radio:
   - Meshtastic LoRa boards (Amazon Prime 1-day, or Micro Center if in stock)
   - ESP32 with ESP-NOW (Micro Center today)

   Buy 3 nodes, with sensors for at least one full node. Check Micro Center Fairfax stock before driving. Remote members start on the simulator now.
2. **Run `/interview Canary`** and write `.plans/canary-spec.md`. Off the Record's spec and schedule are on hold, not deleted.
3. **First tests (Wed morning):**
   1. One node reports CO₂ and TDS to the dashboard.
   2. A message hops across 3 nodes with the router off.
   3. GLiNER strips identity from 20 sample symptom reports.
