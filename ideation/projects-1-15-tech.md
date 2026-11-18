# 15 projects: technical design (round 16, Tue Nov 17)

Companion to `ideation/projects-1-15.md` (what the judges see). This file says **how each project works in code**: architecture, data types, API and WebSocket messages, the core algorithm (TypeScript or pseudocode), libraries, complexity, and tests.

This is a **proposed** design. The stack is final only when the spec is locked (`AGENTS.md`). Do not scaffold `app/` before that.

---

## Part 0. Shared technical kit

### 0.1 Stack and layout

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript everywhere | One language; the algorithms run on the server **and** in the browser (needed for Verify in projects 2 and 13) |
| Algorithms | `packages/core`: pure functions, no I/O | Easy to unit-test; same code on both sides |
| Server | Node + Fastify (REST) + `ws` (WebSocket) | Small, fast, one process |
| Web | React + Vite; routes `/console` (laptop), `/phone` (resident), `/verify` | One app, two views |
| Validation | `zod` schemas for every message and the sector file | Bad input fails loudly, not silently |
| Offline | `vite-plugin-pwa` (service worker), IndexedDB through `idb-keyval` | Projects 7 and 8 must work with no network |
| Heavy loops | Web Worker | Monte Carlo, flood steps, and LP do not freeze the UI |
| Tests | `vitest`, with fixed seeds and small fixture sectors | Same input → same output, every time |
| Hosting | One HTTPS host (needed for the mic and camera on phones), or `localhost` for laptops | Browsers block mic and camera on plain HTTP |

```
app/
  packages/core/        # algorithms: flicker.ts, fairshare.ts, draft.ts, snow.ts, ...
  packages/sector/      # zod schema, seeded generator, sectors/ashvale-l9.json
  apps/server/          # fastify routes, ws hub, LLM report parser, replay engine
  apps/web/             # React: console/, phone/, verify/, shared map components
```

### 0.2 Sector file (the world data)

```ts
type Id = string;

interface Sector {
  id: Id; seed: number; now: number;              // ms since scenario start
  levels: { id: Id; depth: number }[];
  rooms: { id: Id; level: Id; areaM2: number; node: Id; tap: Id; sector: Id }[];
  walk: Graph;                                     // walking graph (rooms, junctions, stairwells)
  tunnels: Graph<{ z: number; exit?: boolean }, { lengthM: number; widthM: number }>;
  pipes: Graph<{ kind: 'recycler' | 'junction' | 'tap' }>;   // directed: recycler -> taps
  feeders: { id: Id; capKW: number; neighbors: Id[]; sectors: Id[]; loadKW: number[] }[]; // 5-min samples
  vents: Graph<{ kind: 'intake' | 'shaft' | 'room' | 'exhaust' }, { capM3min: number; fan?: Fan }>;
  households: Household[];
  clinics: { id: Id; node: Id; stock: Record<string, number>; dailyUse: Record<string, number> }[];
  hidden?: TimedEvent[];                           // server-only; never sent to clients
}

interface Graph<N = {}, E = {}> {
  nodes: Record<Id, N & { label?: string; x: number; y: number }>;
  edges: ({ from: Id; to: Id } & E)[];
}

interface Household {
  id: Id; room: Id; people: number; children: number; elderly: number;
  medicalKW: number; sleep: [startMin: number, endMin: number]; consent: Record<string, boolean>;
}
```

- `packages/sector/generate.ts` builds a sector from a seed, so we can make many test sectors and one hand-tuned demo sector.
- Seeded random numbers: `mulberry32(seed)`. Never call `Math.random()` in `core`.
- **Determinism rule:** every algorithm breaks ties by `id` (string order). Then the same input always gives the same output, on the server and in any browser.

### 0.3 Report pipeline (text or voice → structured event)

```ts
const ReportKind = z.enum(['flicker','fan','breaker','heat','water_bad','sick','flood',
                           'blockage','symptom','ok','help','other']);
const Parsed = z.object({
  kind: ReportKind,
  place: z.string(),                  // must resolve to a sector id
  severity: z.number().int().min(1).max(3),
  numbers: z.record(z.number()).optional(),   // e.g. { tempC: 33, depthCm: 10 }
});
```

1. Phone sends `POST /api/reports { text, deviceKey, sig }`. Voice uses the Web Speech API to make the text first.
2. Server calls an LLM with the zod schema as a JSON schema (structured output) and the list of place names and aliases from the sector.
3. `resolvePlace(place)` maps the answer to a real id (exact match, then alias match, then fuzzy match with `fuse.js`). If nothing matches, the phone asks the user to pick from a list.
4. **Fallback with no LLM:** keyword rules (`/flicker|dim/ → flicker`, `/smell|cloudy|vomit/ → water_bad`, …) plus the same place matcher. The demo must work with the API key removed.
5. The server stores the report and broadcasts `{ t: 'report.new', report }`.

### 0.4 WebSocket protocol (all projects)

```ts
type ServerMsg =
  | { t: 'state'; sector: PublicSector }          // on connect and after reset
  | { t: 'report.new'; report: Report }
  | { t: 'alert'; to: Id[]; alert: Alert }         // to = household ids
  | { t: 'plan'; project: string; plan: unknown }  // each project's output
  | { t: 'replay.event'; event: TimedEvent };      // hidden future, released on Play
type ClientMsg = { t: 'join'; householdId?: Id; role: 'console' | 'phone' | 'clinician' | 'runner' };
```

- Phones join by scanning a QR code that encodes `https://host/phone?sector=ashvale-l9&hh=H17`.
- `POST /api/reset?seed=N` reloads the sector, for a clean re-demo.

### 0.5 Replay engine (hidden future)

- The server keeps `sector.hidden` (events with times). `POST /api/replay/play?speed=60` releases the events in time order at 60× speed through `replay.event`.
- **Honesty rule:** the forecast must be computed and shown **before** Play, and the client code never receives `hidden` early. Test: a unit test checks that `PublicSector` has no `hidden` field.

---

## 1. Flicker: blackout warning

**Modules:** `core/flicker.ts`, `server/routes/flicker.ts`, `web/console/FeederLayer.tsx`, `web/phone/Countdown.tsx`.

**Inputs:** `feeders[].loadKW` (load history), reports of kind `flicker | fan | breaker` placed on a feeder (`room → sector → feeder`).

**Algorithm:**

```ts
// 1. Features per feeder
const u     = last(f.loadKW) / f.capKW;                    // utilization
const slope = olsSlope(f.loadKW.slice(-12));               // kW per 5 min, last hour
const r     = reportsOn(f).reduce((s, rep) =>
                s + W[rep.kind] * rep.severity * Math.exp(-(now - rep.at) / TAU), 0); // TAU = 60 min

// 2. Risk = logistic model
const p = sigmoid(B0 + B1 * u + B2 * slope + B3 * r);       // P(outage in next 2 h)

// 3. Time to trip
const ttt = slope > 0 ? (f.capKW - last(f.loadKW)) / slope * 5 /* min */ : Infinity;

// 4. Cascade: what fails if this one fails
function cascade(feeders, failed: Id): { id: Id; afterMin: number }[] {
  const load = new Map(feeders.map(f => [f.id, last(f.loadKW)]));
  const down = new Set([failed]); const out = []; const q = [failed]; let t = 0;
  while (q.length) {
    const id = q.shift()!; const alive = byId(id).neighbors.filter(n => !down.has(n)).sort();
    for (const n of alive) load.set(n, load.get(n)! + load.get(id)! / alive.length);
    for (const n of alive) if (load.get(n)! > byId(n).capKW) {
      down.add(n); q.push(n); out.push({ id: n, afterMin: (t += 12) });  // fixed delay per hop
    }
  }
  return out;
}
```

**Where B0–B3 come from (honest training):** `generate.ts` simulates feeders with the same rules as the hidden future (load = random walk with drift; a feeder fails when load > cap × (1 + noise); warning reports appear with a probability that rises as `u → 1`). We generate 500 seeds, fit the 4 coefficients with logistic regression (about 30 lines of gradient descent in `core/logreg.ts`), and test on 100 **other** seeds. We report two numbers in the video: the share of outages warned at least 30 minutes early, and the false-alarm rate. The demo seed is not in the training set.

**API:** `GET /api/flicker/risk` → `{ feederId, p, tttMin, cascade }[]`; `POST /api/flicker/warn { feederIds }` → sends `alert` to the households in those sectors; `POST /api/flicker/ready { householdId }`.

**Complexity:** O(F + R) per update (F feeders, R reports). Under 1 ms.

**Tests:** cascade on a 3-feeder line; risk rises as reports are added; a held-out test set with recall above a threshold we set after the first run.

**Libraries:** none beyond the kit.

---

## 2. Fair Share: verifiable rationing

**Modules:** `core/fairshare.ts` (shared by the server and the `/verify` page), `core/canonical.ts`, `web/console/PlansSideBySide.tsx`, `web/verify/Verify.tsx`.

**Inputs:** households (`people`, `children`, `elderly`, `medicalKW`), `supplyKW[24]` (one value per hour), rules `{ medicalAlwaysOn, minKWPerPerson, maxDarkHoursInRow }`.

**Algorithm (deterministic, so the browser gets the same answer):**

1. **Medical first:** give every household its `medicalKW` in every hour. If this is more than supply, stop and report "supply too low for medical needs".
2. **Max-min share by water-filling** (no LP solver, so no solver differences between machines):

```ts
// demand d_h = need of household h (weights for children, elderly); supply S
// find level L so that sum(min(d_h, L * w_h)) = S; everyone gets min(d_h, L * w_h)
function waterFill(d: number[], w: number[], S: number): number[] {
  const idx = d.map((_, i) => i).sort((a, b) => d[a] / w[a] - d[b] / w[b] || a - b);
  let left = S, wLeft = w.reduce((a, b) => a + b, 0); const x = Array(d.length).fill(0);
  for (const i of idx) {
    const L = left / wLeft;
    if (d[i] <= L * w[i]) { x[i] = d[i]; left -= d[i]; wLeft -= w[i]; }
    else { for (const j of idx.slice(idx.indexOf(i))) x[j] = L * w[j]; break; }
  }
  return x;
}
```

   This is the known algorithm for max-min fairness with one resource. It runs in O(n log n).
3. **Rotating cuts:** if the supply cannot keep every sector at its minimum in an hour, some sectors go dark. For hour t, choose the dark sectors greedily: the ones with the most "dark-hour quota" left, never one that is already dark for `maxDarkHoursInRow` hours, ties by id.
4. **Directorate default (to compare):** fill levels from the top down until the supply runs out.
5. **Outcome metrics:** `heatDangerHours = Σ_h Σ_t [x_ht < coolingNeed_h]`, people with medical devices unpowered, and dark hours per level.

**Receipt and Verify:**

```ts
const canon = (o: unknown) => JSON.stringify(sortKeysDeep(o));       // canonical JSON
const sha = async (s: string) => hex(await crypto.subtle.digest('SHA-256', utf8(s)));
receipt = { inputsHash: await sha(canon(inputs)), rulesHash: await sha(canon(rules)),
            planHash: await sha(canon(plan)), share: plan.byHousehold[h] };
```

`/verify` downloads the public `inputs` and `rules`, runs `allocate()` from the same `core` package in the browser, and compares the hash. The operator's "tamper" button changes one value in the stored plan, so the hash no longer matches and Verify shows red.

**Appeal:** `POST /api/fairshare/appeal { householdId, medicalKW, note }` → recompute → `diff(oldPlan, newPlan)` → `{ householdId, deltaKWh }[]`, sorted by size.

**API:** `POST /api/fairshare/plan { supplyKW, rules }`, `GET /api/fairshare/inputs`, `GET /api/fairshare/receipt/:hh`, `POST /api/fairshare/tamper` (demo only).

**Tests:** water-filling sums to S; nobody gets more than demand; equal weights give equal shares; medical always met; the same input gives the same hash in Node and in the browser (a Playwright test).

**Complexity:** 24 × O(n log n). Under 5 ms for 40 households.

---

## 3. Draft: cool-air routing

**Modules:** `core/mincostflow.ts`, `core/draft.ts`, `core/wetbulb.ts`, `web/console/VentLayer.tsx`.

**Inputs:** the vent graph (intake on Level 6, shafts, rooms, exhaust), edge capacities, fans `{ powerW, on, broken }`, heat reports with `tempC` and humidity, households per room.

**Heat risk:** wet-bulb temperature with Stull's formula (2011), a published approximation:

```ts
const tw = (T: number, RH: number) =>
  T * Math.atan(0.151977 * Math.sqrt(RH + 8.313659)) + Math.atan(T + RH) - Math.atan(RH - 1.676331)
  + 0.00391838 * RH ** 1.5 * Math.atan(0.023101 * RH) - 4.686035;
// danger if tw >= 31 °C (from recent human heat-tolerance studies; cite the source in the README)
```

**Airflow plan (min-cost flow):**
- Build a flow network: `source → intake`, the vent edges (capacity = airflow; a fan edge only exists if the fan is on and not broken), `room → sink` with capacity = the room's air need, and **cost −wᵣ**, where wᵣ = (at-risk people in the room) × (wet-bulb above the limit). A negative cost means "the solver wants flow here".
- Solve with **successive shortest paths using Bellman-Ford/SPFA**, which handles negative costs. The graph has about 30 nodes, so this is instant.
- **Power budget:** there are at most about 8 fans, so we try every on/off set (2⁸ = 256), skip the sets over the budget, and keep the one with the lowest total cost. This gives the exact best answer, not a guess.

```ts
let best;
for (let mask = 0; mask < 1 << fans.length; mask++) {
  if (powerOf(mask) > budgetW) continue;
  const { cost, flow } = minCostFlow(buildNet(sector, mask));
  if (!best || cost < best.cost) best = { mask, cost, flow };
}
```

- **New temperature per room (simple model):** `T' = T − k × flowᵣ / volumeᵣ`. Say in the video that this is a capacity model, not fluid dynamics.

**Repairs:** for each broken fan f, re-run the plan with f fixed and measure Δ(people above the limit). Order by `Δ / repairHours[f]`. Give crews jobs in that order; each crew gets a route by Dijkstra on `walk`.

**API:** `POST /api/draft/plan { budgetW }` → `{ fansOn, dampers, flows, rooms: { id, tempAfter, twAfter }, crews, coolRooms }`; `POST /api/draft/fanfixed { fanId }`.

**Tests:** flow conservation; capacities respected; with more budget the cost never goes up; a room with a baby gets air before an empty storeroom.

**Complexity:** 256 × SPFA flow on about 30 nodes and 60 edges. Tens of milliseconds.

---

## 4. Snow: trace bad water upstream

**Modules:** `core/snow.ts`, `core/bitset.ts`, `web/console/PipeLayer.tsx`.

**Inputs:** the pipe graph (a directed acyclic graph from recyclers to taps); reports of kind `water_bad | sick` resolved to a tap (`room → tap`); households per tap.

**Step 1. Downstream taps of every node (bitsets, computed once):**

```ts
// taps are numbered 0..T-1; down[v] = bitset of taps reachable from v
for (const v of reverseTopoOrder(pipes)) {
  down[v] = isTap(v) ? Bitset.single(tapIndex[v]) : Bitset.empty(T);
  for (const c of children(v)) down[v].orInPlace(down[c]);
}
```

**Step 2. Score each candidate node (log-likelihood ratio):**
- Model: if v is broken, a tap downstream of v produces a report with probability p₁ (for example 0.5). Any other tap produces one with background probability p₀ (for example 0.02).
- With n = taps downstream of v and k = reported taps among them:

```ts
const llr = k * Math.log(p1 / p0) + (n - k) * Math.log((1 - p1) / (1 - p0));
```

- A node high in the network has a large n. If most of its taps are healthy, the second term pulls the score down. This is why the method finds the right level of the network, not just the recycler with the most taps.
- **Confidence:** `P(v) = exp(llr_v) / Σ_u exp(llr_u)` (softmax, uniform prior). This is the "91%".

**Step 3. Is it more than chance? (permutation test):** place the same number of reports on random taps 1,000 times (seeded RNG), compute the best LLR each time, and `pValue = share of runs ≥ observed`. Show "p < 0.01".

**Step 4. Second source:** remove the reports explained by the best node, score again, and accept a second source only if its LLR is above a threshold (for example 5) and its p-value is below 0.05.

**Step 5. Outputs:**
- Alert targets: households whose tap is in `down[best]`.
- Nearest safe tap for each household: **multi-source BFS** on `walk`, starting from every tap **not** in `down[best]`. One pass gives the nearest safe tap for everyone.
- Trace animation: for each reported tap, follow parent links up to `best`.

**API:** `GET /api/snow/analysis` → `{ suspects: { id, p, llr }[], pValue, affected: Id[], safeTap: Record<Id, { tap, minutes }> }`; `POST /api/snow/alert`; `POST /api/snow/repaired { nodeId }`.

**Tests:** a fixture with a known broken junction and 4 reports finds it; adding healthy-tap noise does not move the answer; a report outside the subtree creates a second suspect; the safe tap is never downstream of the source.

**Complexity:** bitsets O(V·T/32) once; scoring O(V); permutation 1,000 × O(V). About 10 ms.

---

## 5. Floodline: flood spread and cut-off deadline

**Modules:** `core/flood.ts` (runs in a Web Worker), `core/dijkstra.ts`, `web/console/FloodLayer.tsx`.

**Inputs:** the tunnel graph with height `z` per junction, `lengthM` and `widthM` per tunnel, pumps `{ node?, rateM3min }`, neighborhoods `{ nodes, exits }`, and a flood report → `{ node, depthCm }`.

**Water model (simple, explicit time steps, Δt = 1 min, 6 hours):**

```ts
// state: depth d[v] in m; each node has a plan area A[v] in m^2
for (let step = 0; step < 360; step++) {
  const dv = new Float64Array(N);
  dv[src] += inflowM3 / A[src];                              // from the report severity
  for (const e of edges) {
    const hu = z[e.from] + d[e.from], hv = z[e.to] + d[e.to];
    const [hi, lo] = hu > hv ? [e.from, e.to] : [e.to, e.from];
    const dh = Math.abs(hu - hv); if (dh < 1e-4 || d[hi] <= 0) continue;
    let q = C * e.widthM * d[hi] * Math.sqrt(dh / e.lengthM);   // m^3/min, a simple flow law
    q = Math.min(q, (d[hi] * A[hi]) / 4);                       // never drain a node below 0
    dv[hi] -= q / A[hi]; dv[lo] += q / A[lo];
  }
  for (const p of pumps) if (p.node) dv[p.node] -= p.rateM3min / A[p.node];
  for (let v = 0; v < N; v++) d[v] = Math.max(0, d[v] + dv[v]);
  if (step % 10 === 0) snapshots.push(d.slice());             // for the time slider
}
```

**Cut-off time per neighborhood:** for each snapshot, BFS from the neighborhood's nodes to any exit, using only tunnels whose two ends have `d < 0.3 m`. The first snapshot with no path is the cut-off time.

**Pump placement (greedy):** for each free pump, try the 15 deepest junctions at +3 h, re-run the simulation, and keep the junction that delays the earliest cut-off the most. Then do the next pump. 2 pumps × 15 × 360 steps × 60 edges ≈ 650,000 edge updates, well under a second in a worker.

**Safe route (time-dependent Dijkstra):** the weight of a tunnel is its walking time, or infinite if its depth is ≥ 0.3 m in the snapshot at the time the walker would arrive.

**Supply list:** for a neighborhood with cut-off time T, list the items to move in before T: medicine for the households with medical needs, water and food for (days until pumps clear) × people. The items come from the clinic and pantry data.

**API:** `POST /api/flood/project { node, depthCm }` → `{ snapshots (quantized to cm), cutoff: Record<Id, minutes>, pumps, evac, supplies }`; `POST /api/flood/route { from, to, departMin }`.

**Tests:** water never flows uphill; total volume = inflow − pumped (within rounding); a higher pump rate never makes the cut-off earlier; a neighborhood on high ground is never cut off.

---

## 6. Swapline: room swaps and bed sharing

**Modules:** `core/ttc.ts`, `core/hopcroftKarp.ts`, `web/console/FloorPlan.tsx`.

**Inputs:** households (size, room, sleep interval, needs, consent flags), rooms (area, level, step-free, distance to clinic).

**Fit score:** `fit(h, room) = min(1, room.areaM2 / (h.people × 4.5)) + needsBonus(h, room)`. A household ranks only the rooms with a higher fit than its own room (so no one is worse off).

**Top Trading Cycles (Shapley and Scarf housing market):**

```ts
function ttc(prefs: Map<Id, Id[]>, owner: Map<Id /*room*/, Id /*hh*/>, fixed: Set<Id>) {
  const active = new Set(prefs.keys()); const result = new Map<Id, Id>();
  while (active.size) {
    // every household points to the owner of its best room that is still active
    const next = new Map<Id, Id>();
    for (const h of active) {
      const top = fixed.has(h) ? roomOf(h)
                : prefs.get(h)!.find(r => active.has(owner.get(r)!)) ?? roomOf(h);
      next.set(h, owner.get(top)!);
    }
    // out-degree is 1, so there is at least one cycle: walk until a node repeats
    for (const cycle of findCycles(next)) {
      for (const h of cycle) { result.set(h, roomOf(next.get(h)!)); active.delete(h); }
    }
  }
  return result;   // household -> new room (its own room if it does not move)
}
```

- Properties (known results): no household is worse off, no household gains by lying about its ranking, and no group could all do better by trading only among themselves (the core).
- **Reject:** a household that rejects is added to `fixed` (it points to its own room), and TTC runs again. The new loops appear in under 10 ms.

**Bed sharing (opt-in only):** split the people who opted in into day sleepers and night sleepers. Add an edge when the two sleep intervals do not overlap (with a 1-hour gap, using circular minutes). Run **Hopcroft-Karp** for a maximum matching.

**Metric:** mean m² per person, and the number of rooms below 4.5 m² per person.

**API:** `POST /api/swap/run` → `{ cycles: Id[][], moves, metricBefore, metricAfter }`; `POST /api/swap/respond { householdId, accept }`; `GET /api/swap/beds`.

**Tests:** nobody's fit goes down; a cycle is applied only when every member accepts; a fixed household never moves; matching size equals a brute-force answer on small fixtures.

---

## 7. Lantern: messages with no network

**Modules:** `web/lantern/transport-sound.ts` (`ggwave`), `transport-qr.ts` (`qrcode` + `jsqr`), `store.ts` (IndexedDB), `crypto.ts`, `relay.ts`. **No server is needed.**

**Message format (compact binary, because sound is slow):**

```
byte 0       version (1)
byte 1       kind: 0 help, 1 notice, 2 chat, 3 checkin
bytes 2-5    timestamp (seconds, uint32)
bytes 6-13   sender key id (first 8 bytes of SHA-256(public key))
byte 14      ttl in hours
byte 15      body length L (max 40)
bytes 16..   body (UTF-8, L bytes)
last 64      Ed25519 signature over all bytes above
```

- The message id is the first 8 bytes of SHA-256(message without signature). Phones use it to drop duplicates.
- **Size check:** 16 + 40 + 64 = 120 bytes at most. `ggwave` allows up to 140 bytes in one transmission, so a short alert fits. The signature is the largest part; we cannot shorten it safely.
- **Speed:** sound sends only a few bytes per second, so one message takes several seconds. **Measure this on day 1** on the phones we will film with. Anything longer than 40 bytes, and bulk sync, goes by QR code (one QR holds about 2 KB).
- **Path:** the hop list is not part of the signed bytes. Each relay adds its key id to a side list, so the path is a display aid, not proof.

**Keys:** each phone makes an Ed25519 key pair with Web Crypto (`crypto.subtle.generateKey({ name: 'Ed25519' }, …)`) or, if the browser lacks Ed25519, with `@noble/ed25519`. Before the demo, all phones share their public keys once by QR (a "key book"). A message from a key not in the book shows as "unverified". A message whose signature fails is rejected.

**Relay loop:**

```ts
// listening runs all the time on the relay screen (ggwave decoder on mic input)
onReceive(bytes => {
  const m = decode(bytes); if (store.has(m.id) || expired(m)) return;
  if (!verify(m, keyBook)) return ui.rejected(m);
  store.put(m); ui.show(m);
});
// sending: every few seconds, broadcast the next stored message, by priority then age
setInterval(() => { const m = store.nextToBroadcast(); if (m) ggwave.send(encode(m)); }, SLOT_MS);
```

- Sound is a broadcast, so there is no handshake: every phone that hears it keeps it. That is simple and works well for a few phones.
- **Encryption (stretch goal):** X25519 key agreement + AES-GCM for private messages. The minimum version signs only; notices and help calls are public anyway.
- **Back online:** when `navigator.onLine` becomes true, upload stored messages to `POST /api/lantern/sync`; the server drops duplicates by id.

**Tests:** encode/decode round trip; a changed byte fails verification; duplicates are dropped; a full 40-byte message is ≤ 140 bytes; an automated loopback test (play the sound to a decoder in the same page).

**Risks:** sound needs a quiet room and about 1 m distance. The QR path is the fallback and must be demo-ready too.

---

## 8. Kin: family check-ins during a blackout

**Modules:** reuses project 7's transport, store, and crypto; adds `web/kin/FamilyCards.tsx`, `beacon.ts`, `registry.ts`.

**Family registry:** created once with the network on: `{ familyId, members: { name, keyId, level }[] }`. It is shared as a QR code and saved on every member's phone and on each beacon.

**Check-in = a Lantern message of kind 3.** Body (4–40 bytes): `status (0 OK, 1 help, 2 moving) | place code | optional short note`.

**Status per member = last-writer-wins register:**

```ts
function status(member, now, timeoutMs) {
  const m = store.latestFrom(member.keyId, 'checkin');       // highest timestamp wins
  if (!m) return { color: 'grey', last: null };
  if (m.status === 1) return { color: 'red', last: m };
  return now - m.ts * 1000 > timeoutMs ? { color: 'grey', last: m } : { color: 'green', last: m };
}
```

- Phone clocks can be a little off. That is fine for a timeout of minutes (60 s in the demo).

**Beacon mode:** the same app with `?beacon=1`. It listens all the time, keeps only the newest check-in per member, and broadcasts those in turn (round robin). So a check-in made on Level 9 reaches a phone on Level 3 if the two phones pass the same stairwell beacon at different times.

**Responder list:** every member in the registries the responder holds whose color is grey or red, sorted red first, then by time since the last check-in.

**Tests:** a newer check-in wins; timeout turns green to grey; red is shown even after the timeout; a beacon passes on a check-in it heard earlier.

---

## 9. Truthcount: the real outbreak

**Modules:** `core/capture.ts`, `core/allocate.ts`, `server/routes/truth.ts`, `web/console/Curves.tsx`.

**The key problem: capture-recapture needs to know who is on both lists, but the reports are anonymous.** Solution: each resident's app holds a random secret `s`. A self-report carries `token = SHA-256(s ‖ week)`. When the person visits a clinic, the clinic scans a QR code from the app that shows the same token. The server can count overlaps without knowing who anyone is. The token changes every week, so reports cannot be linked over a long time.

**Anti-spam:**
- Each device key signs its reports. Limit: 3 reports per key per day.
- Making a new key needs a small proof of work (find a nonce so that SHA-256(key ‖ nonce) starts with 18 zero bits; about 1 s on a phone). One bot can still make keys, but slowly, and the rate limit stays.

**Estimate of the real number (Chapman's version of Lincoln-Petersen, a standard method):**

```ts
// n1 = people on the self-report list, n2 = people on the clinic list, m = people on both
const N  = (n1 + 1) * (n2 + 1) / (m + 1) - 1;
const v  = (n1 + 1) * (n2 + 1) * (n1 - m) * (n2 - m) / ((m + 1) ** 2 * (m + 2));
const ci = [N - 1.96 * Math.sqrt(v), N + 1.96 * Math.sqrt(v)];
```

- Computed per sector and per rolling 7-day window. That gives the "estimate" curve and its band.
- **Assumption:** the two lists are independent (being on one does not change the chance of being on the other). Say this on screen.

**Method check (honest):** the CDC flu data does not contain two overlapping lists, so we **cannot** use it to test this method. Instead, the method check is a simulation: make a population with a known number of cases, draw two lists with known probabilities, and show that the 95% band contains the true number in about 95% of 1,000 runs. Capture-recapture is also a long-used method for counting under-reported diseases, which we can cite.

**Supply allocation:** split integer units in proportion to `N̂_s × severity_s`, after a minimum per sector, using the **largest remainder method** (deterministic, and the total is exact).

**API:** `POST /api/truth/report { token, sector, symptoms, sick, keyId, sig, pow }`; `POST /api/truth/clinic { token, sector }`; `GET /api/truth/estimate` → `{ day, official, est, lo, hi }[]`; `POST /api/truth/allocate { masks, oxygen }`.

**Tests:** with m = n1 = n2 the estimate equals n; the coverage test passes in simulation; 200 reports from one key → 197 dropped; allocation totals are exact.

---

## 10. Runner: care and medicine delivery

**Modules:** `core/triage.ts` + `data/imci-tree.json`, `core/hungarian.ts`, `core/stock.ts`, `web/phone/Triage.tsx`, `web/clinician/Queue.tsx`, `web/runner/Job.tsx`.

**Triage = a fixed decision tree in JSON (not a chatbot):**

```json
{ "id": "danger", "q": "Can the child drink or breastfeed?", "opts": [
    { "label": "No", "result": "urgent" },
    { "label": "Yes", "next": "vomit" } ] }
```

- The rules come from the WHO IMCI "general danger signs": not able to drink or breastfeed, vomits everything, convulsions, very sleepy or unconscious → urgent referral. **Fast breathing:** 50 or more breaths per minute for a child aged 2–12 months, 40 or more for a child aged 1–5 years → treat as pneumonia. Each result screen shows the rule it used and the source.
- The tree is data. A clinician can check it without reading code.

**Nearest stock:** Dijkstra on `walk` from the patient's room. Skip a clinic without the drug. If Floodline (project 5) has a projection, give flooded tunnels infinite weight.

**Runner assignment:** cost[i][j] = time for runner i to reach the clinic plus time from the clinic to patient j. Solve with the **Hungarian algorithm** (O(n³); n ≤ 10), so the total time is the lowest.

**Pickup code:** `token = HMAC-SHA256(serverSecret, jobId)`, shown as a QR on the runner's phone. The clinic scans it, the server checks the HMAC, lowers the stock, and marks the job "picked up".

**Stock forecast:**

```ts
const use = ewma(clinic.dailyUseHistory[drug], 0.3);
const daysLeft = clinic.stock[drug] / use;
// transfer: from the clinic with the most days left to the one with the fewest,
// with an amount that makes their days-left equal
```

**Flow:** triage result → `POST /api/runner/case` → the case appears in the clinician queue (WebSocket role `clinician`) → `POST /api/runner/approve` → assignment → `alert` to the runner → scan → `POST /api/runner/pickup { token }` → `POST /api/runner/delivered`.

**Tests:** every path through the tree ends in a result; the danger signs always give "urgent"; Hungarian matches brute force on 4 × 4; an invalid token is refused; stock never goes below 0.

---

## 11. Dawnline: sleep, mood, and light

**Modules:** `core/circadian.ts`, `core/lamps.ts`, `web/phone/CheckIn.tsx`, `web/console/LightStrip.tsx`.

**Drift:** mid-sleep time per day = the middle of bedtime and wake time. Times cross midnight, so convert them to minutes and **unwrap** (if a value jumps by more than 12 h from the day before, add or subtract 24 h). Then fit a line:

```ts
const { slope, r2 } = ols(days, midSleepMin);   // minutes per day
const drifting = slope > 15 && r2 > 0.5;
```

**Mood:** PHQ-2 (two questions, each 0–3, total 0–6). A total of 3 or more is the standard cut-off for a positive screen. Show that this is a screening tool, not a diagnosis.

**Lamp booking:** slots = lamps × morning hours × days. Priority = `slope/15 + phq2/3`. Assign greedily: the highest priority gets the earliest free morning slot, at most one slot per person per day.

**Level light plan:** 24 values `b[h] ∈ [0, 1]` (brightness) and a color temperature per hour, from a target curve (bright and cool from 07:00 to 10:00, warm and dim after 20:00). Power = Σ `b[h]` × lamp watts. If it is over budget, lower the hours in the order evening → midday → morning, until it fits.

**API:** `POST /api/dawn/checkin { householdId, bed, wake, phq2, energy }`; `GET /api/dawn/person/:id`; `POST /api/dawn/plan { budgetWh }`.

**Tests:** unwrap handles a bedtime that moves past midnight; the booking never double-books a slot; the light plan never goes over budget; morning hours are cut last.

---

## 12. Larder: food runway and grow plan

**Modules:** `core/runway.ts`, `core/growlp.ts` (uses `javascript-lp-solver`), `data/crops.json`, `data/foods.json`, `web/console/Runway.tsx`.

**Data (real, collected and cited before the demo):**
- `foods.json`: about 50 common pantry items → kcal and protein per unit (from USDA FoodData Central).
- `crops.json`: `{ crop, daysToFirstHarvest, kcalPerM2PerDay, proteinPerM2PerDay, needsLight, lampWPerM2, waterLPerM2PerDay }` for about 8 crops (oyster mushrooms, microgreens, sprouts, radish, lettuce, potato, beans, sweet potato), from public growing guides.

**Pantry parsing:** free text → the LLM returns `{ item, qty, unit }[]` → match with `foods.json` (fuzzy) → kcal. A form is the fallback.

**Runway with the pantry only:** `days = Σ kcal / (Σ people × kcalPerPersonDay)`, with lower needs for children.

**Grow plan, the core trick:** "the most days" is not linear, so we use **binary search on D**, and for each D we solve a linear **feasibility** problem:

```
variables: a[s][c] >= 0   (m^2 of crop c in space s)
for each day t = 1..D:      pantryKcal + Σ_{s,c} a[s][c] * kcal_c * max(0, t - h_c)  >=  needKcal * t
space:     Σ_c a[s][c] <= area_s                       for each s
light:     a[s][c] = 0  if needsLight_c and not lit_s
power:     Σ_{s,c} a[s][c] * lampW_c * lampHours <= budgetWh
water:     Σ_{s,c} a[s][c] * water_c <= waterL
(the same day constraint for protein)
```

- This treats each crop as producing every day after its first harvest (a simplification for cut-and-come-again crops; say so).
- Binary search D in [0, 120] needs about 7 LP solves, each with about 50 variables. Well under a second.
- The output `a[s][c]` becomes the planting list and the harvest calendar.

**Sharing:** daily ration per person = (pantry + harvest that day) ÷ people, with child weights, using the same method as project 2.

**API:** `POST /api/larder/pantry { householdId, text | items }`; `POST /api/larder/plan { powerWh, waterL }` → `{ runwayBefore, runwayAfter, plan, calendar, ration }`.

**Tests:** with no crops, the runway equals the pantry-only formula; more power never lowers the runway; dark spaces never get light crops; binary search agrees with a slow linear scan.

---

## 13. Witness: signed surface readings

**Modules:** `core/chain.ts`, `core/verdict.ts`, `data/limits.json`, `web/verify/Chain.tsx`, `web/console/Verdict.tsx`. Ed25519 as in project 7.

**Reading and chain:**

```ts
interface Reading { i: number; ts: number; place: string;
  o2Pct: number; co2Ppm: number; coPpm: number; pm25: number; doseUSvH: number; tempC: number;
  prev: string /*hex hash of reading i-1*/; sig: string /*Ed25519 over hash_i*/ }

const hash_i = sha256(canon(omit(r, 'sig')));       // includes prev, so the chain links
// verify: for each i: recompute hash, check r.prev == hash_{i-1}, check sig with the probe's public key
```

- If someone changes reading #214, its hash changes, so its signature fails, and the `prev` of #215 no longer matches. An attacker cannot fix this without the probe's private key.
- **Copies:** each of three devices keeps its own copy of the log and the head hash. Each device verifies on its own. The tamper button changes the server copy; when the devices re-fetch, they compare it with their saved copy and show the first index that differs.

**Verdict engine:** `limits.json` holds each limit with its source:

| Measure | Limit (check each against its source before the demo) |
| --- | --- |
| O₂ | at least 19.5% (OSHA) |
| CO₂ | 5,000 ppm over 8 h (OSHA PEL) |
| CO | 50 ppm over 8 h (OSHA PEL) |
| PM2.5 | 15 µg/m³ over 24 h (WHO 2021 guideline) |
| Radiation | 20 mSv per year average for workers (ICRP), turned into allowed hours per day |

```ts
// protection options with OSHA assigned protection factors (APF) for particles and gases
const OPTIONS = [{ name: 'none', apf: 1 }, { name: 'half mask', apf: 10 },
                 { name: 'full face', apf: 50 }, { name: 'supplied air suit', apf: 10000, ownAir: true },
                 { name: 'sealed dome', apf: Infinity, ownAir: true }];
// inside level = outside / apf; O2 and CO2 do not apply if the option brings its own air;
// radiation: allowed hours = dailyDoseBudget / (doseRate / shielding_option); respirators give no shielding
```

- Output per option: safe or not safe, allowed hours, and the limiting factor ("fine particles: 6 times the limit").

**API:** `GET /api/witness/log`, `POST /api/witness/tamper { i, field, value }` (demo only), and `/verify` runs everything in the browser.

**Tests:** a clean chain verifies; changing any field fails at that index; a re-signed reading with the wrong key fails; the verdict for a safe fixture is "safe" for every option.

---

## 14. Vanguard: which option, and who goes first

**Modules:** `core/montecarlo.ts` (Web Worker), `core/tornado.ts`, `core/crew.ts` (`javascript-lp-solver` with integers), `web/console/Vanguard.tsx`.

**Mission simulation (one run):**

```ts
function mission(opt: Option, cond: Conditions, rng: Rng): boolean {
  let dose = 0, supplies = opt.reserveDays;
  for (let day = 0; day < 30; day++) {
    if (day < opt.buildDays) dose += cond.doseUSvH * 24 / opt.tempShielding;   // waiting in temporary shelter
    else dose += cond.doseUSvH * opt.hoursOutside                                  // outside: no shielding
              + cond.doseUSvH * (24 - opt.hoursOutside) / opt.shielding;          // inside the option
    if (rng() < opt.pBreach * cond.stormFactor) { if (rng() > opt.pRepair) return false; }
    if (rng() < cond.pMachine * opt.exposure)     { if (rng() > opt.pEscape) return false; }
    if (rng() < cond.pSupplyDelay) supplies -= 1; if (supplies < 0) return false;
    if (dose > DOSE_LIMIT_30D) return false;
  }
  return true;
}
// success rate = mean over 10,000 seeded runs; 95% interval from the binomial (Wilson interval)
```

- 3 options × 10,000 runs × 30 days ≈ 900,000 steps. Under 100 ms in a worker.
- **All rates are invented for the story.** The screen says so. The value of the tool is the method: it shows what matters most.

**What changes the answer (tornado chart):** for each input, run 2,000 missions at −20% and +20% and plot the change in success rate. Sort by size.

**Crew picker (small integer program):**

```
minimize   Σ_i risk_i * x_i
subject to Σ_{i has skill k} x_i >= need_k     for every skill k
           Σ_i x_i = 12
           x_i = 0  if not consent_i, or (youngChildren_i and not optIn_i)
           x_i ∈ {0, 1}
```

200 binary variables is small for `javascript-lp-solver`. Fallback: greedy set cover (pick the person who covers the most missing skills per unit of risk).

**Reason per pick:** "covers medic and pilot; risk rank 14 of 200".

**API:** none needed; it all runs in the browser. Optional `POST /api/vanguard/save` for sharing.

**Tests:** the same seed gives the same success rate; a higher dose rate never raises success; the crew covers every skill; nobody without consent is ever picked.

---

## 15. Exodus: plan the move

**Modules:** `core/dinic.ts`, `core/exodus.ts` (Web Worker), `web/console/ExodusFlow.tsx`.

**Units:** 1 unit = 100,000 people, so 2 billion people = 20,000 units. Families get a ticket by their position inside their level's unit.

**Monthly model:** for each month m, build a small flow network and run **Dinic's max-flow algorithm**:

```
source -> level L        capacity = people from L still waiting, in the order of the priority rule
level L -> shaft S       capacity = infinite if L connects to S
shaft S -> surface       capacity = lifts_S * tripsPerMonth * peoplePerTrip
surface -> site K        capacity = beds built at K by month m - beds already used
site K -> sink           infinite
```

- About 25 nodes per month and about 100 months: tiny.
- **Priority rule:** "deep levels first" or "sick first" sets which levels fill the source edges first: we solve with the top-priority levels only, then add the next group to use the capacity that is left (a lexicographic max-flow).
- **Bottleneck:** after each month's max-flow, the **minimum cut** (the edges that are full and separate source from sink) names the limit: a shaft's lifts, or a site's beds. The UI turns that edge red and reports the share of months in which it limits the plan ("shaft 3 limits 41% of months").
- **What each investment saves:** re-run the whole timeline with one more lift in each shaft, and with one more build crew at each site. Sort by months saved.
- **Ticket:** the month in which the family's unit moves, and the site from the flow on that unit's path.

**API:** runs in the browser; `POST /api/exodus/ticket { level, householdIndex }` for the judge's family, if we want it shared.

**Tests:** flow ≤ every capacity; people are never created or lost (total moved = total population); one more lift never makes the timeline longer; the min cut value equals the max flow (a standard check).

---

## Summary: the core algorithm of each project

| # | Project | Core algorithm | Runs on | Hardest part to build |
| --- | --- | --- | --- | --- |
| 1 | Flicker | Logistic risk score + cascade BFS; coefficients fitted on generated data and tested on held-out seeds | Server | An honest training and test setup |
| 2 | Fair Share | Water-filling (max-min fairness), greedy rotating cuts, SHA-256 receipts | Server **and** browser | Same result in every browser (determinism) |
| 3 | Draft | Min-cost flow (SPFA) over every fan on/off set; Stull wet-bulb | Server | Building the flow network correctly |
| 4 | Snow | Downstream bitsets, log-likelihood ratio, permutation test, multi-source BFS | Server | Clear trace animation |
| 5 | Floodline | Explicit time-step water flow, BFS cut-off, greedy pump search, time-dependent Dijkstra | Web Worker | Stable water steps |
| 6 | Swapline | Top Trading Cycles; Hopcroft-Karp matching | Server | The loop animation |
| 7 | Lantern | Compact signed binary messages over `ggwave` sound / QR; store and carry | Browser only | Sound reliability and speed |
| 8 | Kin | Last-writer-wins status, timeout, beacon rebroadcast | Browser only | Depends on project 7 |
| 9 | Truthcount | Chapman capture-recapture with anonymous weekly tokens; proof of work; largest remainder | Server | Explaining the method simply |
| 10 | Runner | JSON decision tree (WHO IMCI), Dijkstra, Hungarian assignment, HMAC pickup codes | Server | Three screens in one flow |
| 11 | Dawnline | Unwrapped linear regression, PHQ-2 cut-off, greedy lamp booking | Server | Low wow |
| 12 | Larder | Binary search on days + LP feasibility | Server | Collecting real crop data |
| 13 | Witness | Ed25519 + hash chain; APF-based verdict | Browser | Checking every limit against its source |
| 14 | Vanguard | Monte Carlo (seeded), tornado chart, integer program for the crew | Web Worker | Making invented rates look honest |
| 15 | Exodus | Monthly Dinic max-flow, min cut as the bottleneck, lexicographic priority | Web Worker | Turning flows into family tickets |

**Corrections that this technical check found** (also fixed in `projects-1-15.md`):
- **Truthcount:** CDC flu data cannot test capture-recapture (it has no two overlapping lists). The method check is now a simulation coverage test.
- **Lantern:** a signed message must stay under about 120 bytes to fit one sound transmission, and sound is slow (several seconds per message). Long messages and bulk sync go by QR.
