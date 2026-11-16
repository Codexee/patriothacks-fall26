# Idea bank (round 1, Mon Nov 16)

Method: `/ideate` (think backward from the winning demo). Track: **Best Solution for a Dystopian World**. Constraints: remote-first, and hybrid only with in-hand parts plus a software fallback (`context/constraints.md`).

Scores run from 1 to 5. W = Wow, T = Track fit, F = Feasible in Tue–Wed, R = Remote-OK, Tm = Team fit (EE plus backend/CP), L = Live-demo-able.

---

## A. Shadow Route: navigation that avoids surveillance  ·  software only  ·  **27/30**

**Crazy version:** a live 3D city where every camera projects a view cone, and you plan a route through the gaps.
**Buildable version:** a map plus a router. The router finds the fastest route that keeps you out of view of license-plate readers (ALPRs), CCTV, and doorbell cameras. A phone-camera mode lets users spot a new camera and add it to the shared map.

**Winning demo (30 s):** "Fairfax to Union Station. Google's route passes **47 cameras**. *(map lights up red)* Shadow Route passes **6**, and costs 4 extra minutes." Drag the exposure slider and watch the route bend around camera clusters. Then hold a phone up to a camera on a pole. The app detects it, and the camera appears on every teammate's map within 2 seconds.

**How it works:**
- **Camera data:** the OpenStreetMap Overpass API, querying `man_made=surveillance` and `surveillance:type=ALPR` (the data behind DeFlock). It is free and needs no key. Coverage is strong in Virginia and DC.
- **Routing:** an OSM road graph with custom edge costs: `time + λ·exposure`. Exposure models each camera's position, direction, and field of view as a view cone. Anish's CP background fits the custom A* or contraction-hierarchies work. Another option is GraphHopper or Valhalla with custom models.
- **Camera spotting:** a fine-tuned YOLO model or a vision LLM looks at a phone photo, finds the camera, and estimates its direction. A realtime database (Supabase) shares new cameras with all users.
- **Extras:** an exposure timeline ("you were visible for 3 of 22 minutes"), and an "exposure heatmap of GMU".

**Why it wins:** a perfect "navigate" fit, a visual that judges get in 5 seconds, real data, and real algorithmic depth. It runs fully live.
**Risks:** OSM gaps in some areas, so seed and verify the demo corridor. Detecting cameras from photos is hard, so plan a fallback of manual tagging plus the vision LLM.
**Ethics:** it maps only public infrastructure. Present it as a privacy-rights tool.
**Scores:** W4 T5 F4 R5 Tm4 L5

---

## B. Ghost Protocol: an anti-surveillance "red team" mirror  ·  hybrid (light)  ·  **25/30**

**Crazy version:** clothing that makes you invisible to AI cameras.
**Buildable version:** a webcam app shows a dystopian surveillance HUD that tracks you: face detection, person re-identification, an "identity confidence" meter, and emotion. Then you test countermeasures live and watch the tracker lose you. The countermeasures are a printed adversarial patch, IR-LED glasses (built by the EE members), and a software "cloak" that changes your face in video calls so recognition fails while you still look like you to humans.

**Winning demo:** "They're watching." The HUD locks on: **Neil R., 97% match**. Put on the glasses or hold up the patch, and the box flickers and drops to **unknown, 12%**.

**Hardware (gate):** 850 nm IR LEDs, a coin cell or USB pack, resistors, and cheap glasses frames. All are at Micro Center Fairfax today, under $15. **Risk:** many laptop and phone cameras have IR-cut filters, so the effect may not show. Test on Tuesday morning with a cheap USB webcam that has no IR filter. **Fallback:** a software-only cloak plus a printed patch. The remote members build the HUD, the ML, and the cloak.
**Overlap:** "Big Brother" won Cyberpunk Theme in 2024 by building the tracker. We build the defense, which is the twist.
**Scores:** W5 T5 F3 R4 Tm5 L3

---

## C. Tailgate: a sniffer for trackers following you  ·  hybrid  ·  **25/30**

**Buildable version:** an ESP32 pocket sniffer plus a phone and web app. It finds Bluetooth trackers (AirTag, Tile, SmartTag) that move with you over time, flags hidden Wi-Fi cameras by their network fingerprints, and gives a radar-style "find it" view based on signal strength (RSSI).
**Winning demo:** slip an AirTag into a teammate's bag on camera. Twelve minutes of footage later, the alert reads "**Unknown tracker has followed you for 12 min across 3 locations**." The radar then leads to the bag pocket.
**Hardware (gate):** an ESP32 dev board (Micro Center, about $10) and an AirTag someone already owns. **Fallback:** scan from a laptop or phone over Bluetooth Low Energy (BLE) using noble or a native app, with no ESP32 at all.
**Overlap:** AirGuard and Apple's own alerts exist. The angle must be multi-tracker, plus cameras, plus a "survival" UI.
**Scores:** W4 T5 F4 R3 Tm5 L4

---

## D. Blackout: messaging when the internet is cut  ·  hybrid  ·  **24/30**

**Buildable version:** encrypted, store-and-forward messaging over LoRa radios (Meshtastic firmware on Heltec V3 or T-Beam boards) when the internet is gone. Our layer adds: dead-drop boards, need/offer rationing posts, and a live hop-graph visualizer. Phones connect to the radios over BLE, and a browser simulator lets remote members run 20 virtual nodes.
**Winning demo:** unplug the router on camera. A message hops across 3 radios and the hop graph animates.
**Hardware (gate):** LoRa boards are about $20–35 each and need **Amazon 1-day delivery**, because Micro Center stock is uncertain. Order by Mon night, or this fails the gate. **Fallback:** the simulator only.
**Judge question to prepare for:** "Isn't this just Meshtastic?" The answer is the application layer.
**Scores:** W4 T5 F3 R3 Tm5 L4

---

## E. What They Know: a surveillance-state dossier on yourself  ·  software only  ·  **24/30**

**Buildable version:** you verify your own email or handle with a one-time code. Four AI agents then investigate you in parallel, in 4 visible panes (the "Opticon" look): breach data (the HaveIBeenPwned API), data-broker listings, reverse image search, and old posts. They build the file a dystopian state would keep on you. Then the "Go Dark" button sends agents to file data-broker opt-outs and CCPA/GDPR deletion requests.
**Winning demo:** a dossier wall that fills in live, then "Go Dark" sends 14 removal requests.
**Risks:** browser agents are unreliable live, so cache the runs. **The ethical line matters:** it must be self-only and verified, or it becomes a doxxing tool.
**Scores:** W5 T5 F3 R5 Tm3 L3

---

## F. Dead Drop: secret messages hidden in public memes  ·  software only  ·  **24/30**

**Buildable version:** encrypt a message, hide it (steganography) inside an AI-generated meme, and post it anywhere. Only your contacts' browser extension sees the message. It survives JPEG recompression through DCT-domain encoding with error correction (a CP/math fit).
**Winning demo:** post a cat meme to Instagram live. A teammate's extension shows "Meet at JC Room G, 2 pm".
**Risk:** Instagram's recompression may break the hidden message. Test this first, on Tuesday morning.
**Scores:** W4 T5 F3 R5 Tm3 L4

---

## G. Ration: fair allocation after collapse  ·  software only  ·  **25/30, but low wow**

A community stockpile with a fairness-optimizing allocator (CP or linear programming), an offline-first PWA, and shortage forecasting. It fits the track's "resource-rationing algorithm" example word for word, but the demo is a dashboard. Keep it as a *feature* inside another idea (for example, inside Blackout).
**Scores:** W2 T5 F5 R5 Tm3 L5

---

## Template for new ideas

```
## X. Name: one-liner  ·  software | hybrid  ·  NN/30
**Crazy version:**
**Buildable version:**
**Winning demo (30 s):**
**How it works:**
**Hardware (gate):** parts, source, cost, arrival, fallback
**Overlap with past winners:**
**Risks / Ethics:**
**Scores:** W T F R Tm L
```
