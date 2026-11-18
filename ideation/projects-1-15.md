# 15 projects, one per problem: build and demo sheets (round 16, Tue Nov 17)

**The technical design of every project (architecture, data types, APIs, algorithms in code, tests) is in `ideation/projects-1-15-tech.md`.**

This file extends round 15 in `ideation/ideas.md`. Round 15 described each idea inside the story. This file describes each one **as the judges will see it in the video**: what is on the screen, what we type or click, what the code really computes, what we prepare in advance, and how a judge can tell that the result is not scripted.

Problem numbers follow the organizers' doc (`context/hollow-brief.md`).

---

## Part A. What is real and what is prepared (applies to all 15)

**The rule:** the Hollow is a setting, not a data source. We never say that a real sensor is a Hollow sensor.

| Part | Real or prepared? | What we say in the video |
| --- | --- | --- |
| The app (screens, buttons, code) | **Real.** It runs in a browser. | "This is the app." |
| The math (graphs, optimizer, statistics) | **Real.** It runs live on every click. | "It computes this now." |
| Reports, forms, choices | **Real.** A person types them on camera. A judge can type their own. | "Anyone can send a report." |
| The sector file ("Level 9, Ashvale") | **Prepared and fictional.** A JSON file: map, pipes, feeders, tunnels, households, stock. | "This is a fictional sector we built to test on." |
| A hidden future (only for forecasts) | **Prepared.** The file holds what happens next. The app cannot read it until we press Play. | "The app has not seen this part yet." |
| Safety limits, protocols, crop data | **Real** published numbers (WHO, OSHA, IMCI, USDA). | "These are real limits." |
| Network off (projects 7, 8) | **Real.** Airplane mode is really on. | "The network is really off." |

**How a judge can tell it is not scripted (use at least two in every video):**
1. A second person types a report the first person did not plan, and the result changes.
2. A slider or a rule changes, and the result changes in under a second.
3. The same file with a different random seed gives a different (but sensible) result.
4. For forecasts: the prediction is shown first, then the hidden future is revealed.

## Part B. The shared kit (build once, use in every project)

| Part | What it is | Tools |
| --- | --- | --- |
| **Sector file** | One JSON file: rooms, tunnels with heights, pipes (recycler → junction → tap), power feeders, vents, households (size, ages, medical needs, shifts), clinics and stock. About 40 households, 40 taps, 6 feeders. | Hand-written plus a small generator script with a seed |
| **Sector map** | An SVG cross-section of the levels, with layers (pipes, tunnels, feeders, vents) that turn on and off | React + TypeScript + Vite, plain SVG |
| **Report box** | Text or voice → a structured event `{place, type, severity, time}`. An LLM (for example Claude Haiku) does the parsing, with a keyword parser as a fallback so the demo works if the API fails | Web Speech API for voice, one server route |
| **Live sync** | Every phone and laptop sees changes at once | Small Node server + WebSockets |
| **Join by QR** | Phones join a sector by scanning a QR code on the laptop | `qrcode` library |
| **Alerts** | A message to the phones of the chosen households | Same WebSocket channel; offline path through project 7 |
| **Score card** | "Before / after" numbers for each project | One shared component |

With this kit, each project below is mostly one algorithm plus one or two screens.

**Scores (/25):** W = Wow, A = Active loop (input → process → outcome), F = Feasible by Thu night, D = Demo-able live and again, C = Connects to the shared kit.

---

## 1. Flicker: blackout and air-loss warnings from early signs  ·  **20/25**

**Problem it solves:** 1 (warn people before the power or air cuts out). Partly helps 2 and 3.

**One line:** residents report early signs (flicker, slow fans, tripped breakers); Flicker combines them with each feeder's load and warns the right sectors before the outage.

**What the judges see:** the sector map with 6 power feeders. Reports appear as pins. One feeder turns from green to red, a countdown appears on the phones in that sector, and then the hidden future plays and the outage happens close to the predicted time.

**Full process:**
1. **Input (on camera):** three people type reports on phones: "lights flickering in C-block", "corridor 4 fan slowing", "breaker tripped in C-3". The sector file holds each feeder's load for the last 24 hours.
2. **What the code does:**
   - Places each report on the nearest feeder.
   - Computes a risk score per feeder from three numbers: load ÷ capacity, how fast load is rising, and how many warning reports arrived recently (each report adds risk and fades over about an hour).
   - Runs the cascade rule: if a feeder fails, its load moves to its neighbors; if a neighbor goes over capacity, it is at risk too.
   - Turns the score into "chance of outage in the next 2 hours" and an estimated time.
3. **Output:** a warning to the phones in the at-risk sectors, with a countdown and a checklist ("charge lamps, fill water, move people on oxygen to Level 7"). People tap "Ready". The console shows how many are ready.
4. **Proof it works:** press Play. The hidden future in the file runs: C-feeder fails at 14:20 and D-feeder 12 minutes later. The score card shows "warned 47 minutes early; 312 of 400 ready".

**Video script (about 90 s):**
| Time | On screen | Narration (short) |
| --- | --- | --- |
| 0–10 s | Map, all green | "Blackouts in the deep levels come without warning." |
| 10–30 s | Three reports typed on phones; pins appear | "Residents notice the first signs." |
| 30–45 s | C-feeder turns red: "68% in 2 h; D at risk" | "Flicker combines the signs with the load." |
| 45–60 s | Phones show countdown and checklist; taps on "Ready" | "Only the sectors at risk are warned." |
| 60–80 s | Press Play; outage hits C, then D | "The app had not seen this part." |
| 80–90 s | Score card | "47 minutes of warning instead of none." |

**What we prepare:** the feeder graph and load history in the sector file; three hidden futures (with different seeds) so the demo can be run again.
**Build (about 10 h on top of the kit):** risk score and cascade (backend, 4 h), feeder layer on the map (frontend, 3 h), countdown and checklist on the phone (2 h), Play/reveal control (1 h).
**Risks and fallback:** a forecast that matches the hidden future too exactly looks fake. Use hidden futures made by the same random rules, not hand-picked, and show one run where the forecast is a little off.
**Scores:** W4 A4 F4 D4 C4

---

## 2. Fair Share: rationing that the deep levels can check  ·  **22/25**

**Problem it solves:** 2 (share power, water, and food fairly when there is not enough). Partly helps 3, 10, 12.

**One line:** households enter their needs, the supply drops, and an optimizer makes a fair plan under public rules; each household gets a receipt it can verify, and can appeal.

**What the judges see:** two plans side by side ("Directorate default" and "Fair Share") under a supply slider; a "Verify" button that turns green, then red when someone changes the plan in secret; an appeal that changes the plan in under a second.

**Full process:**
1. **Input (on camera):** three people fill in a form on their phones: household size, children, medical devices, heat exposure. 37 more households come from the sector file. The operator sets the supply (power, water, food) and the rules (for example "medical devices always on", "minimum per person", "no sector dark for more than 8 h in a row").
2. **What the code does:**
   - **Directorate default:** gives upper levels first (to show the problem).
   - **Fair Share:** a linear program. It first meets every hard rule, then raises the share of the worst-off household as high as possible, then the next worst-off, and so on (max-min fairness). For power, it also makes a rotating cut schedule over 24 hours.
   - Computes the outcome of each plan: heat-danger hours, people without water, medical devices without power.
   - **Receipt:** makes a SHA-256 hash of the inputs, the rules, and the plan, and publishes it.
3. **Output:** each household sees its share, its cut hours, and its receipt.
4. **Proof it works:** "Verify" runs the same optimizer in the household's browser from the published inputs and checks that it gives the same plan and the same hash. We then change one number in the plan on the server: Verify turns red. An appeal ("my child uses an oxygen concentrator") changes the plan live and shows who gave up how much.

**Video script (about 90 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–15 s | Three phones fill in the form | "Every household says what it needs." |
| 15–35 s | Slide supply to 60%; the two plans split | "The default plan cuts the deep levels for 3 days." |
| 35–50 s | Meter: heat-danger hours 2,140 → 310 | "Fair Share rotates the cuts and protects medical needs." |
| 50–65 s | Verify → green; edit plan on server → red | "Anyone can check that the plan follows the rules." |
| 65–90 s | Appeal; plan updates; "who gave up what" | "And anyone can appeal." |

**What we prepare:** 37 households in the sector file; the rules list; a "tamper" button in the operator view.
**Build (about 11 h):** optimizer with `javascript-lp-solver` or `glpk.js` (backend, 5 h), plans side by side and slider (frontend, 3 h), receipt and Verify (2 h), appeal flow (1 h).
**Risks and fallback:** linear programs can be slow with many households; keep it to 40 households and 24 one-hour slots.
**Overlap:** GeoGuard (resource allocation, Feb 2026). Verify and appeal make it different.
**Scores:** W4 A5 F4 D5 C4

---

## 3. Draft: send cool air to the people who need it most  ·  **20/25**

**Problem it solves:** 3 (keep the lower levels livable as heat rises and cooling fails). Partly helps 1 and 2.

**One line:** residents report heat and dead fans; Draft computes which dampers to open and which fans to run so the most at-risk people get cool air, and sends repair crews to the fans that protect the most people.

**What the judges see:** a cross-section of Levels 6–10, colored by temperature. Arrows show where air flows. After "Plan", the arrows change, dampers open, and the number of people above the heat-danger limit drops.

**Full process:**
1. **Input (on camera):** reports: "fan dead in corridor 9-B", "room 9-14 at 33 °C, baby inside". The sector file holds the vent graph (rooms and shafts, each with an airflow capacity), the fans (power use, status), and households (ages, illness).
2. **What the code does:**
   - Heat risk per room from the reported temperature and humidity, using wet-bulb temperature and real heat-stress limits.
   - **Airflow plan:** min-cost max-flow on the vent graph. Cool air is the "flow", the shafts are the edges, each fan costs power, and each room's demand is weighted by the number of at-risk people in it. The result is which dampers to open and which fans to run within the power budget.
   - **Repair plan:** orders the broken fans by "people protected per repair hour" and gives each crew a route (shortest path).
   - **Cool rooms:** if a room cannot get under the limit, the at-risk people in it get a place in the nearest cool room.
3. **Output:** the damper and fan settings, crew routes, and cool-room assignments, sent to the phones of the people involved.
4. **Proof it works:** mark a fan as repaired, and the plan re-runs and frees a crew. Lower the power budget, and the plan keeps the at-risk rooms cool and lets an empty storage tunnel warm up.

**Video script (about 75 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–10 s | Deep rooms in red | "The deep levels get hotter every year." |
| 10–25 s | Two reports typed | "Residents report heat and dead fans." |
| 25–45 s | Plan: arrows change, dampers open, crews routed | "Draft moves cool air to the people most at risk." |
| 45–55 s | Meter 180 → 22 people above the limit | |
| 55–75 s | Fan repaired; power budget cut; plan adapts | "It re-plans each time something changes." |

**What we prepare:** the vent graph (about 30 nodes) and the fans in the sector file.
**Build (about 12 h):** min-cost flow (backend and CP, 5 h), heat-risk and repair order (2 h), arrows and dampers on the map (frontend, 4 h), phone notices (1 h).
**Risks and fallback:** real airflow is fluid dynamics; ours is a capacity graph. Say so plainly in the video.
**Scores:** W4 A5 F3 D4 C4

---

## 4. Snow: trace sick taps back to the broken recycler  ·  **23/25**

**Problem it solves:** 4 (catch bad water before people drink it). Partly helps 5 and 10.

**One line:** residents report bad water or sickness at a tap; Snow follows the pipe network upstream from every report, finds the most likely broken recycler or junction, and warns only the households downstream of it.

**Name:** in 1854, John Snow mapped cholera cases in London and found the one water pump that caused them.

**What the judges see:** a pipe map with 3 recyclers and 40 taps. Four reports at four taps that look unrelated. Lines trace upstream and meet at one recycler. The households downstream get "do not drink" with their nearest safe tap; a household upstream gets nothing.

**Full process:**
1. **Input (on camera):** four people type reports tied to a tap or room: "tap 14 smells like eggs", "two kids vomiting in 9-C", "water is cloudy at T-22", "stomach pain after drinking at T-9". The sector file holds the pipe network (a directed graph: recycler → junctions → taps), which households use which tap, and the walking routes.
2. **What the code does:**
   - Places each report on a tap.
   - For each recycler and junction, finds every tap downstream of it (one graph search).
   - Scores each node: how many reported taps are downstream, compared with how many downstream taps are healthy (a likelihood ratio). A failure high up the network explains many reports but also predicts many healthy taps should be sick, so the score balances both.
   - Checks that the cluster is more than chance (a permutation test: shuffle the reports over random taps 1,000 times and see how often a node scores this high).
3. **Output:** "R-2 is the likely source (91%). 212 households are downstream." "Do not drink" alerts go only to those households, each with the nearest safe tap (shortest walking path to a tap not downstream of R-2). A work order goes to R-2.
4. **Proof it works:** a judge adds a report at a tap that is *not* downstream of R-2. Snow updates: "a second source is possible at junction J-6". After "R-2 repaired", two "water OK" reports clear the alert.

**Video script (about 75 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–10 s | Pipe map, all blue | "Bad water makes people sick before anyone knows why." |
| 10–25 s | Four reports from four phones | "Four reports, four places." |
| 25–40 s | Lines trace upstream and meet at R-2 | "Snow follows the pipes upstream." |
| 40–55 s | Downstream phones: "do not drink, safe tap T-31"; upstream phone: nothing | "Only the people at risk are warned." |
| 55–70 s | Judge adds an off-network report → second source | "New reports change the answer." |
| 70–75 s | Repair → alert clears | |

**What we prepare:** the pipe graph (3 recyclers, about 12 junctions, 40 taps), households mapped to taps.
**Build (about 9 h):** upstream scoring and permutation test (backend and CP, 4 h), pipe layer and trace animation (frontend, 4 h), alert and safe-tap path (1 h).
**Risks and fallback:** keep the graph small enough to read on a video. If the LLM parser fails, the report form has a tap picker.
**Overlap:** none at GMU.
**Scores:** W5 A5 F4 D5 C4

---

## 5. Floodline: see which neighborhood will be cut off, before the water gets there  ·  **22/25**

**Problem it solves:** 5 (keep tunnels safe to live in and move through). Partly helps 8, 10, 12.

**One line:** one report of water at a junction is enough for Floodline to spread the water downhill on the tunnel map, find when each neighborhood loses its last dry way out, and plan evacuation, supplies, and pumps before that happens.

**What the judges see:** a tunnel map shaded by height. After one report, blue water spreads on a time slider (+1 h, +2 h, +3 h). One neighborhood turns red: "cut off in about 3 h, 400 people". A pump dragged onto a junction pushes the deadline back.

**Full process:**
1. **Input (on camera):** a report: "sewage ankle-deep at J7". The sector file holds the tunnel graph with the height of each junction, the width of each tunnel, pumps, and neighborhoods with their exits.
2. **What the code does:**
   - Converts "ankle-deep" into a depth (about 10 cm) and a flow rate.
   - Steps time forward in 10-minute steps. At each step, water moves from a junction to its lower neighbors, faster on steeper and wider tunnels. Pumps remove water at their rate.
   - At each step, checks for each neighborhood whether a dry path to an exit still exists (a graph search that ignores tunnels deeper than 30 cm). The first step with no path is the cut-off time.
   - **Pump placement:** tries each free pump at each candidate junction, re-runs, and keeps the placement that delays the cut-off the most (greedy search).
3. **Output:** the cut-off deadline per neighborhood; an evacuation route for people who must leave; a "move in first" list (medicine, water, food) for the people who stay; pump orders; and a route finder that avoids the water.
4. **Proof it works:** drag a pump onto J9 and the deadline moves from 3 h to 8 h. A second report at another junction changes the projection. A judge asks for a route from A to B, and the route goes around the water.

**Video script (about 75 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–10 s | Tunnel map with heights | "One flooded tunnel can cut off a whole neighborhood." |
| 10–20 s | Report "sewage at J7" | "One report is enough." |
| 20–40 s | Time slider; water spreads; Low Market turns red | "Floodline shows where the water goes and when." |
| 40–55 s | Deadline, evacuation route, supply list; phones alerted | "People get the deadline, not the surprise." |
| 55–75 s | Drag pump → deadline +5 h; route around water | "And the plan changes as you act." |

**What we prepare:** the tunnel graph (about 40 junctions) with heights; 3 neighborhoods; 2 pumps.
**Build (about 11 h):** flow steps and cut-off search (backend, 5 h), pump search (2 h), water animation and slider (frontend, 4 h).
**Risks and fallback:** the water model is simple (graph steps, not hydraulics). Say so. Precompute the steps on the server so the slider is smooth.
**Overlap:** Rescue Safe (crowdsourced evacuation, 2022). The flood projection and cut-off deadline are new.
**Scores:** W5 A4 F4 D5 C4

---

## 6. Swapline: room swaps that give every family a better fit  ·  **20/25**

**Problem it solves:** 6 (find or make more space, or help people share it).

**One line:** families enter their size and room; Swapline finds chains of room swaps where every family gets a better fit, and matches night-shift and day-shift workers who agree to share a bed.

**What the judges see:** a floor plan with overcrowded rooms in red. After "Find swaps", an animation moves four families around a loop; red rooms turn green and "space per person" goes up.

**Full process:**
1. **Input (on camera):** three people enter their household: size, current room, sleep hours, needs (step-free access, near the clinic). 27 more households come from the sector file.
2. **What the code does:**
   - **Room swaps:** each household ranks the rooms that fit it better than its own room. Swapline runs **Top Trading Cycles**, a well-known algorithm (Shapley and Scarf). It finds swap loops in which no household is worse off and no group could do better by swapping among themselves.
   - **Bed sharing (opt-in only):** builds a graph of people whose sleep hours do not overlap and finds the best matching (bipartite matching), so one bed serves a day sleeper and a night sleeper.
3. **Output:** a proposed swap for each household in a loop. Every household in the loop must press "Accept" before it happens. A bed-sharing calendar for people who opted in. A "space per person" meter for the sector.
4. **Proof it works:** one household presses "Reject". Swapline removes it and finds a different loop. A judge adds a large family, and the loops change.

**Video script (about 75 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–10 s | Floor plan, red rooms | "Rooms meant for one hold families of five." |
| 10–25 s | Three phones enter households | |
| 25–45 s | Find swaps: 4-way loop animation; +38% space per person | "The space exists. It is in the wrong hands." |
| 45–60 s | One household rejects; a new loop appears | "No one moves without saying yes." |
| 60–75 s | Bed-sharing calendar | "Night and day workers can share a bed, if they choose." |

**What we prepare:** 27 households and 30 rooms of different sizes in the sector file.
**Build (about 8 h):** Top Trading Cycles and matching (backend and CP, 3 h), floor plan and loop animation (frontend, 4 h), accept/reject (1 h).
**Risks and fallback:** "shared beds" can sound grim. Present it as optional.
**Scores:** W4 A5 F4 D4 C3

---

## 7. Lantern: messages that travel with the network off  ·  **23/25**

**Problem it solves:** 7 (organize, share information, and call for help when the network is shut down). Partly helps 8, and it delivers alerts for 1, 4, 5, 9, and 13.

**One line:** phones pass signed messages to each other by sound or by QR code, with no network at all, and carry them on as people walk; a fake message is rejected.

**Why nothing is pretend:** in the video we really turn on airplane mode. The messages really move by sound.

**What the judges see:** three phones in airplane mode. A help call written on Phone A chirps to Phone B. Phone B is carried across the room and chirps to Phone C, the "clinic". The message shows its path, A → B → C. A fake message sent with A's name is rejected on every phone.

**Full process:**
1. **Input (on camera):** a person writes a message on Phone A: "medical help needed, room 9-14", with a priority (help, notice, or chat).
2. **What the code does:**
   - Signs the message with Phone A's private key (Ed25519, Web Crypto), and encrypts it if it is private.
   - Sends it as a short burst of sound with `ggwave` (an open-source data-over-sound library that runs in the browser). Fallback: an animated QR code that the other phone scans.
   - The receiving phone checks the signature, saves the message (IndexedDB), and adds itself to the path. When it meets another phone, it passes on every saved message the other phone does not have, highest priority first (store and carry). Each message has an ID, so no phone gets it twice, and a time limit.
3. **Output:** the help call arrives at the clinic phone with its full path and a verified sender. The clinic's reply goes back the same way.
4. **Proof it works:** a laptop sends a message that claims to be from Phone A but is signed with a different key. Every phone shows "signature does not match, rejected". When Wi-Fi comes back, everything syncs with no duplicates.

**Video script (about 90 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–10 s | Airplane mode turned on, on all three phones | "The network is off. Really off." |
| 10–30 s | Phone A writes a help call; chirp; Phone B receives | "Phones pass the message by sound." |
| 30–50 s | Phone B carried to Phone C; chirp; path A → B → C | "Then people carry it on." |
| 50–60 s | Clinic replies; the reply goes back | |
| 60–75 s | Fake message rejected on every phone | "Fake messages fail the signature check." |
| 75–90 s | Wi-Fi on; sync with no duplicates | |

**What we prepare:** three phones with the app open (a PWA, so it works offline), keys made in advance, a quiet room.
**Build (about 12 h):** ggwave transport (4 h), signing and checks (2 h), store-and-carry queue (3 h), message screens (frontend, 3 h).
**Risks and fallback:** sound range is about 1 m and needs a quiet room. A signed message must stay under about 120 bytes (40 characters of text) to fit one sound transmission, and each one takes several seconds; measure this on day 1. Longer messages go by QR, so the QR path must work too. Mic and camera need HTTPS or localhost. Test on the exact phones we will film with.
**Overlap:** none at GMU.
**Scores:** W5 A4 F4 D5 C5

---

## 8. Kin: know your family is safe during a blackout  ·  **21/25**

**Problem it solves:** 8 (reconnect families split across levels during a blackout). Partly helps 7.

**One line:** with the network off, each family member taps "I'm OK" or "I need help"; the check-ins hop phone to phone and through stairwell "beacon" devices, and anyone who stays silent is flagged to responders with their last known place.

**What the judges see:** four devices for a family on Levels 3, 6, 9, and 10. Network off. Taps on "I'm OK". Within about 30 seconds, Grandma's phone shows 3 green cards and 1 grey card. After a timeout, the grey member appears on a responder list.

**Full process:**
1. **Input (on camera):** each member taps "I'm OK" or "I need help", with an optional short note. Families register their members once, in advance.
2. **What the code does:**
   - Uses project 7's transport (sound or QR, signed).
   - A **beacon** is a laptop or old phone left at a stairwell in "beacon mode". It keeps the newest check-in from everyone and passes them to any phone that comes near.
   - Each member's status is "newest signed check-in wins". If a member has no check-in after a set time (shortened to 60 s for the demo), Kin marks them grey and adds them to the responder list with their last place and time.
3. **Output:** a family card per member: green (OK), red (needs help), grey (no news, with last place and time). Responders see one list of grey and red people in their area.
4. **Proof it works:** the grey member taps "I need help". The card turns red on Grandma's phone and on the responder list.

**Video script (about 75 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–10 s | Four devices, all green; press "Blackout"; Wi-Fi off | "A blackout splits a family across four levels." |
| 10–35 s | Taps on "I'm OK"; chirps; cards turn green on Grandma's phone | "Check-ins hop through phones and stairwell beacons." |
| 35–55 s | One grey card; timeout; responder list | "Silence is a signal too." |
| 55–75 s | Grey member taps "I need help" → red | |

**What we prepare:** four devices registered as one family; one laptop in beacon mode.
**Build (about 6 h on top of project 7):** family cards (frontend, 3 h), beacon mode (2 h), timeout and responder list (1 h).
**Risks and fallback:** depends on project 7. Build them together.
**Overlap:** Yap (finding people in rubble) is related.
**Scores:** W4 A4 F4 D5 C4

---

## 9. Truthcount: the real outbreak, next to the official one  ·  **22/25**

**Problem it solves:** 9 (track the real lung-sickness outbreak and get supplies where they are needed). Partly helps 10.

**One line:** anonymous, signed symptom reports and clinic visit lists give an estimate of the real number of cases, which is compared with the official count, and the supplies go to the real hotspots.

**What the judges see:** two curves that split apart: "official: 310" and "estimate: 1,240 (range 980–1,500)". A hotspot map. A bot that sends 200 fake reports is ignored. A supply plan that sends most masks and oxygen to Levels 9 and 10.

**Full process:**
1. **Input (on camera):** three people submit symptom reports on phones (cough, fever, short of breath, how many sick in the household). The sector file holds two weeks of reports, the clinic visit list, and the "official" count.
2. **What the code does:**
   - **Anonymous but not spammable:** each phone makes a key on first use and signs its reports. The server never learns who owns a key, but it limits each key to a few reports per day.
   - **Estimate of the real number:** uses **capture-recapture**, a real method from ecology and epidemiology. Two separate lists (self-reports and clinic visits) are compared. If few people are on both lists, many people are on neither, so the real total is much larger. The estimate comes with a range.
   - **Hotspots:** cases per sector against the sector's population.
   - **Supplies:** a small optimizer that splits masks, oxygen, and medicine in proportion to estimated cases and severity, with a minimum for each sector.
3. **Output:** the two curves, the hotspot map, the supply plan, and a comparison with the Directorate's plan (an even split by population).
4. **Proof it works:** a script sends 200 reports from one key, and Truthcount drops them ("200 reports from one key ignored"). New reports move the estimate. "Method check" tab: a simulation with a known true number of cases shows that the 95% range contains the truth in about 95% of 1,000 runs. (Public CDC flu data cannot test this method, because it has no two overlapping lists. See `projects-1-15-tech.md`.)

**Video script (about 90 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–10 s | Official count only | "The official count says 310." |
| 10–25 s | Three phones send reports | "People report what they see, anonymously." |
| 25–45 s | Estimate curve splits from the official one | "Two lists that rarely overlap mean many people are on neither." |
| 45–55 s | Bot flood ignored | "One device cannot flood it." |
| 55–75 s | Allocate: 70% to Levels 9–10 vs even split | "Supplies go where the sickness is." |
| 75–90 s | Method check on real data | |

**What we prepare:** two weeks of reports and clinic visits in the sector file; the bot script; the method check on real data, run in advance.
**Build (about 10 h):** capture-recapture and the allocation (backend, 4 h), signed reports and rate limit (2 h), curves and map (frontend, 4 h).
**Risks and fallback:** keep the method simple and say what it assumes (the two lists are independent).
**Overlap:** Inquire (early detection) is related.
**Scores:** W4 A5 F4 D5 C4

---

## 10. Runner: basic care for people far from a clinic  ·  **20/25**

**Problem it solves:** 10 (get basic care to people who cannot reach a clinic). Partly helps 5 and 9.

**One line:** a neighbor answers a fixed set of triage questions; Runner gives care steps right away, gets a clinician's approval, finds the nearest medicine, and sends a volunteer runner with a route and a pickup code.

**What the judges see:** a triage form on one phone, a clinician approval screen on a laptop, and a runner's phone that gets the job, the route, and a QR code. A stock map shows where medicine will run out next.

**Full process:**
1. **Input (on camera):** a neighbor answers questions for a sick child on Level 10 (fever, fast breathing, able to drink?). The sector file holds clinic stock and the volunteer runners.
2. **What the code does:**
   - **Triage:** a fixed decision tree based on a real, published protocol for low-resource care (the WHO IMCI danger signs), not a chatbot. The result is "home care", "needs medicine within 12 h", or "go now".
   - **Medicine:** finds the nearest clinic with stock (shortest path on the tunnel graph, avoiding flooded tunnels from project 5).
   - **Approval:** sends the case to the clinician queue. When the network is off, it goes through project 7.
   - **Runner:** assigns the nearest free runner (if there are several jobs, it uses an assignment algorithm so the total walking time is lowest).
   - **Stock forecast:** daily use per clinic gives "runs out in N days" and suggests a transfer.
3. **Output:** care steps for the family now; a delivery time; a job, route, and pickup QR for the runner; stock updates when the QR is scanned.
4. **Proof it works:** change one answer (the child cannot drink), and the result becomes "go now". Two cases at once get assigned to two different runners.

**Video script (about 75 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–15 s | Triage questions answered | "The nearest clinic is two levels up." |
| 15–25 s | Result and care steps | "A fixed medical protocol, not a chatbot." |
| 25–40 s | Clinician approves on laptop | |
| 40–55 s | Runner phone: job, route, QR; scan at clinic; stock −1 | "A volunteer brings the medicine." |
| 55–75 s | Stock map: "Level 10 runs out in 2 days; move 30 doses" | "And it warns before the medicine runs out." |

**What we prepare:** clinics, stock, and 5 runners in the sector file; the triage tree written from the published protocol.
**Build (about 10 h):** triage tree (3 h), routing and assignment (backend, 3 h), three screens (frontend, 4 h).
**Risks and fallback:** must not look like a medical chatbot. Show the protocol source on screen.
**Overlap:** CarePilot (triage kiosk) won in Feb 2026. Lead with the delivery and the stock forecast, not the triage.
**Scores:** W3 A5 F4 D4 C4

---

## 11. Dawnline: a planned "sunrise" for people who never see the sun  ·  **17/25**

**Problem it solves:** 11 (track and treat what life without sunlight does to sleep, mood, and the body). Partly helps 2.

**One line:** residents do a 20-second daily check-in; Dawnline finds people whose body clock is drifting, books them on scarce bright lamps, and plans the level's lights as an artificial day within the power budget.

**What the judges see:** one resident's 14 days of sleep as bars that slide later each day; a "drift" flag; a lamp booking; a 24-hour color strip that shows the level's light plan.

**Full process:**
1. **Input (on camera):** a check-in: bedtime, wake time, mood (the 2-question PHQ-2, a real screening tool), energy. The sector file holds 14 days of check-ins for 40 people and the lamp list.
2. **What the code does:**
   - **Drift:** fits a straight line to each person's mid-sleep time over 14 days. A slope of more than about 15 minutes later per day = drift.
   - **Mood:** flags a PHQ-2 score of 3 or more (the standard cut-off) for follow-up.
   - **Lamp booking:** assigns the scarce bright-lamp slots (morning only) to the people with the most drift and the lowest mood.
   - **Level light plan:** sets lamp brightness and color for each hour (bright and blue-rich in the morning, warm and dim at night) and fits it to the power budget, cutting evening light first.
3. **Output:** a personal plan (lamp time, bedtime target), a lamp booking, and a level report ("31% of residents drifting").
4. **Proof it works:** enter a new check-in, and the drift line moves. Cut the power budget, and the strip keeps the morning light.

**Video script (about 60 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–15 s | Sleep bars sliding later | "Without sun, the body clock drifts." |
| 15–30 s | Drift and mood flags; lamp booked | |
| 30–45 s | Level light strip; power budget cut | "Morning light is protected first." |
| 45–60 s | Level report | "Now someone is measuring it." |

**What we prepare:** 14 days of check-ins for 40 people.
**Build (about 7 h):** drift and booking (backend, 3 h), charts and strip (frontend, 4 h).
**Risks and fallback:** low wow. Best as a part of a larger project.
**Scores:** W2 A4 F4 D4 C3

---

## 12. Larder: how many days of food a cut-off neighborhood has, and how to make it more  ·  **22/25**

**Problem it solves:** 12 (help a cut-off neighborhood grow and share its own food). Partly helps 2 and 6.

**One line:** households report their pantry; Larder computes the neighborhood's food runway in days, plans what to grow where with the space, water, and power it has, and makes a sharing plan until the harvest.

**What the judges see:** a red "food runway: 4.2 days". Pantry reports from phones add to it. "Plan" assigns mushrooms to a dark tunnel, microgreens to lamps, and potatoes to a storage room, and the runway jumps to 23 days.

**Full process:**
1. **Input (on camera):** three households submit pantry lists on phones (a quick form, or free text that the parser turns into items and amounts). The sector file holds the other households' pantries, the free spaces (size, light or dark, water access), and the power budget. The crop table uses real public data: calories, days to harvest, light and water needs, yield per square meter.
2. **What the code does:**
   - **Runway:** total calories (and protein) ÷ daily need of everyone = days.
   - **Grow plan:** a linear program over 10 to 20 days. It chooses how much of each crop goes in each space, to get the most food by each day, within light, water, power, and space. Crops that need no light (mushrooms) and fast crops (microgreens, sprouts) fill the early gap; slower crops (potatoes) come later.
   - **Sharing plan:** splits the pantry stock fairly per person until the harvests come in (the Fair Share method from project 2).
3. **Output:** the new runway, a planting list per space, a harvest calendar, and each household's daily share.
4. **Proof it works:** cut power by half, and the plan moves more space to mushrooms and the runway drops to 19 days. A new pantry report moves the runway.

**Video script (about 75 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–10 s | "Central farm cut off"; runway 4.2 days | "The farm stops sending food." |
| 10–25 s | Three pantry reports; runway 5.1 days | "Every household reports what it has." |
| 25–45 s | Plan: crops placed; runway 23 days | "Larder plans what to grow where." |
| 45–60 s | Power cut by half; runway 19 days | |
| 60–75 s | Harvest calendar and daily shares | |

**What we prepare:** pantries for 37 households; 6 spaces; the crop table from public sources (we must collect and cite these numbers).
**Build (about 9 h):** runway and LP (backend, 4 h), runway meter, space plan, and calendar (frontend, 4 h), pantry form (1 h).
**Risks and fallback:** crop numbers must be real and cited, or a judge can attack them.
**Scores:** W4 A5 F4 D5 C4

---

## 13. Witness: surface readings no one can change in secret  ·  **21/25**

**Problem it solves:** 13 (prove whether the surface is safe, and get the true answer to everyone). Partly helps 7 and 9.

**One line:** every probe reading is signed and chained so that a changed reading is caught at once; copies live on many devices so they cannot be deleted; and a verdict engine compares the readings with real human safety limits.

**What the judges see:** a chart of 300 readings, each with a "signed" mark; a verdict table (no protection / mask / full suit / sealed dome); a "Directorate" edit that turns every copy red; the verdict sent to a phone with Wi-Fi off.

**Full process:**
1. **Input:** a probe log (fictional, from the sector file): CO, CO2, O2, fine particles (PM2.5), radiation dose rate, and temperature, with time and place.
2. **What the code does:**
   - **Signing and chaining:** each reading is signed with the probe's key, and each reading includes the hash of the one before it. Changing any reading breaks every hash after it.
   - **Copies:** the log is copied to three devices (and passed on by project 7). Each device checks the chain on its own.
   - **Verdict:** compares the readings with **real** limits (for example, OSHA's oxygen minimum of 19.5% and CO2 limit of 5,000 ppm, and the WHO PM2.5 guideline). For each type of protection, it divides the outside level by that protection's real protection factor (for example, OSHA's assigned protection factors for respirators) and checks the result against the limit.
3. **Output:** a plain verdict, for example "safe for 4 hours in a full suit; not safe to live with no protection (fine particles 6 times the limit)", with every limit and its source shown.
4. **Proof it works:** a "Directorate" user edits reading #214. All three devices show "reading #214 was changed after signing". A judge can press "Verify" on any device.

**Video script (about 75 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–15 s | Probe log loads; signed marks | "The Directorate says the surface kills. Some say it healed." |
| 15–35 s | Verdict table with limits and sources | "Real limits decide, not opinions." |
| 35–55 s | Edit #214 → red on every device | "No one can change the data in secret." |
| 55–75 s | Verdict sent to a phone with Wi-Fi off | "And the answer reaches everyone." |

**What we prepare:** a probe log of 300 readings; the limits table with sources; three devices.
**Build (about 8 h):** signing, chaining, and verify (backend, 3 h), verdict engine (2 h), chart and verdict table (frontend, 3 h).
**Risks and fallback:** the readings are fictional; the limits and the proof are real. Say that plainly. Check every limit against its source.
**Scores:** W4 A4 F4 D5 C4

---

## 14. Vanguard: which way up, and who goes first  ·  **20/25**

**Problem it solves:** 14 (decide which option works, suits, domes, or sealed outposts, and who tries first). Partly helps 15.

**One line:** Vanguard runs 10,000 simulated missions for each option on the surface conditions, shows the chance of success and what would change the answer, and picks a first crew that covers the needed skills with the lowest risk, from volunteers only.

**What the judges see:** three bars filling as missions run (suits, domes, outposts). A slider for radiation makes the best option change. A crew of 12 chosen from 200 volunteers, with the reason for each person.

**Full process:**
1. **Input (on camera):** surface conditions (from project 13, or sliders); the options with their numbers (build time, cost, protection time, failure rates); 200 volunteers from the sector file (health, skills, dependents, consent). A judge can change any slider.
2. **What the code does:**
   - **Monte Carlo:** for each option, runs 10,000 missions of 30 days. Each day, random events can happen (suit breach, storm, machine encounter, supply delay) with rates that depend on the conditions. A mission fails if exposure goes over the limit or supplies run out.
   - **What changes the answer:** re-runs with each input a little higher and lower and shows which input moves the result the most (a tornado chart).
   - **Crew picker:** chooses 12 people who cover every needed skill (medic, engineer, pilot, and so on) with the lowest total health risk (a small integer program, or a greedy set cover). People without consent are never picked. People with young children are left out unless they opt in.
3. **Output:** the best option with its success chance and range, the tornado chart, and the crew with a reason for each pick.
4. **Proof it works:** raise radiation, and the answer flips from outposts to domes (outposts take too long to build). A volunteer withdraws, and the crew updates.

**Video script (about 75 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–10 s | Three options | "The first people up need protection. Which kind?" |
| 10–30 s | 10,000 missions; bars: 61%, 84%, 92% | |
| 30–45 s | Radiation slider; answer flips | "The answer depends on the conditions, and it shows why." |
| 45–65 s | Crew of 12; reasons | "Only volunteers, and all skills covered." |
| 65–75 s | One withdraws; crew updates | |

**What we prepare:** option numbers and event rates (fictional, stated as such); 200 volunteers.
**Build (about 9 h):** Monte Carlo in a Web Worker (3 h), tornado chart (2 h), crew picker (backend and CP, 2 h), screens (frontend, 2 h).
**Risks and fallback:** all rates are made up. Say so, and make the point that the *method* shows what matters most.
**Scores:** W4 A4 F4 D4 C4

---

## 15. Exodus: plan the move of hundreds of millions back to the surface  ·  **21/25**

**Problem it solves:** 15 (plan the move back up). Partly helps 6 and 14.

**One line:** Exodus models the move as a flow through shafts and lifts to surface sites over time, finds the bottleneck at each stage, shows what each investment saves, and gives every family a ticket with its wave and date.

**What the judges see:** a cross-section of the Hollow and the surface. Dots flow up the shafts in waves. "Everyone up in 9.1 years." The bottleneck shaft turns red. Adding one lift changes the result to 7.3 years. A judge enters a family and gets a ticket.

**Full process:**
1. **Input (on camera):** the shafts and lifts with their capacities, surface sites with build rates, and the population by level (from the sector file); priority rules (deep levels first, sick first, families kept together). Sliders for lift count and build rate.
2. **What the code does:**
   - Groups people into units (1 unit = 100,000 people) so the model runs fast.
   - **Flow over time:** each month, people move from levels through shafts to sites. Each step is limited by lift capacity and by how many site beds have been built so far. The priority rules decide who moves first.
   - **Bottleneck:** for each period, finds the step that limits the flow the most (the minimum cut of the flow network).
   - **What each investment saves:** re-runs with one more lift in each shaft and one faster build crew at each site, and ranks them by months saved.
3. **Output:** the full timeline, the bottleneck, the ranked list of investments, and a ticket for each family (wave, month, site).
4. **Proof it works:** add one lift to shaft 3, and the timeline changes from 9.1 to 7.3 years. Change the rule to "deep levels first", and Level 10 moves from year 6 to year 1. A judge's family gets its own ticket.

**Video script (about 75 s):**
| Time | On screen | Narration |
| --- | --- | --- |
| 0–15 s | Plan: dots flow up; "9.1 years" | "If the surface is safe, two billion people want to go home." |
| 15–30 s | Shaft 3 red: "limits 41% of the plan" | "Exodus finds what slows the move." |
| 30–45 s | One more lift → 7.3 years | "And what each fix is worth." |
| 45–60 s | "Deep levels first" → Level 10 to year 1 | "The rules are a choice, and you can see their cost." |
| 60–75 s | A judge's family gets a ticket | |

**What we prepare:** population by level, shafts, lifts, sites (fictional numbers, stated as such).
**Build (about 9 h):** flow model and bottleneck (backend and CP, 4 h), investment ranking (1 h), flow animation and ticket (frontend, 4 h).
**Risks and fallback:** a planning tool, not a daily tool. Keep the sliders and the ticket so it stays interactive.
**Scores:** W4 A4 F4 D4 C5

---

## Summary table

| # | Project | Main problem | Also helps | What the judge sees | Build (h, on top of the kit) | **/25** |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Flicker | Blackout warning | 2, 3 | Reports → countdown → the hidden future hits on time | 10 | 20 |
| 2 | Fair Share | Fair rationing | 3, 10, 12 | Supply to 60%; Verify catches a changed plan | 11 | 22 |
| 3 | Draft | Heat and cooling | 1, 2 | Cool air routed to the baby's room | 12 | 20 |
| 4 | **Snow** | Bad water | 5, 10 | Four reports trace to one recycler | 9 | **23** |
| 5 | Floodline | Floods in tunnels | 8, 10, 12 | "Cut off in 3 h"; a pump buys 5 h | 11 | 22 |
| 6 | Swapline | Crowding | — | A 4-way room swap loop | 8 | 20 |
| 7 | **Lantern** | No network | 8 (+ delivers 1, 4, 5, 9, 13) | Airplane mode; a message hops by sound | 12 | **23** |
| 8 | Kin | Families in a blackout | 7 | 3 green, 1 grey, responder flagged | 6 (+ project 7) | 21 |
| 9 | Truthcount | Real outbreak | 10 | Official 310 vs estimated 1,240 | 10 | 22 |
| 10 | Runner | Care far from a clinic | 5, 9 | Runner gets route and pickup QR | 10 | 20 |
| 11 | Dawnline | No sunlight | 2 | Body-clock drift flagged | 7 | 17 |
| 12 | Larder | Food when cut off | 2, 6 | Runway 4.2 → 23 days | 9 | 22 |
| 13 | Witness | Is the surface safe? | 7, 9 | One changed reading turns every copy red | 8 | 21 |
| 14 | Vanguard | Who goes first, and how | 15 | The best option flips with radiation | 9 | 20 |
| 15 | Exodus | Plan the move up | 6, 14 | One more lift saves 1.8 years | 9 | 21 |

The shared kit (Part B) is about 12–15 hours of work and is needed by every project.

## Recommendation for `/interview`

1. **Snow (4):** its demo is the clearest cause-and-effect moment (four reports, one broken recycler), and its "report → trace on a graph → warn only the right people" engine is the same one that Flicker, Draft, and Floodline need.
2. **Lantern (7):** the network is really off in the video, so nothing is pretend, and every other project needs it to reach people.
