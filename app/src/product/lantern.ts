// PROTOTYPE module: Lantern (problem 7). When the Directorate cuts the network, residents' phones still pass
// messages from section to section (Bluetooth / Wi-Fi Direct range), but only through sections whose phones
// are charged. Lantern predicts which levels will be dark (from the sensor boxes) and places a limited number
// of battery relays so the mesh still reaches every level from the council's base. The plan is placed daily,
// before any shutdown, because nobody can coordinate once the network is gone.
import { HUB, LEVELS, SECTIONS_PER_LEVEL, SECTION_COUNT, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

const BUDGET = 40; // battery relays the council owns
// A level whose sensors read less total power than this is probably in a real blackout (life support off too),
// so phones there cannot charge. Rationed levels read about 0.3–0.6 and still have life-support power.
const DARK = 0.2;
const STAIR = 3; // the stairwell column, where messages go up and down

const idx = (level: number, col: number) => (level - 1) * SECTIONS_PER_LEVEL + col;

function neighbors(i: number): number[] {
  const l = Math.floor(i / SECTIONS_PER_LEVEL) + 1, c = i % SECTIONS_PER_LEVEL, out: number[] = [];
  if (c > 0) out.push(i - 1);
  if (c < SECTIONS_PER_LEVEL - 1) out.push(i + 1);
  if (l > 1) out.push(i - SECTIONS_PER_LEVEL);
  if (l < LEVELS) out.push(i + SECTIONS_PER_LEVEL);
  return out;
}

/** Sections the mesh would reach, given which sections can relay. Same rule the world uses. */
export function meshReach(capable: boolean[], alive: boolean[]): boolean[] {
  const hub = idx(HUB.level, HUB.col);
  const reach = new Array<boolean>(SECTION_COUNT).fill(false);
  const seen = new Array<boolean>(SECTION_COUNT).fill(false);
  const q = [hub];
  seen[hub] = true;
  while (q.length) {
    const i = q.shift()!;
    reach[i] = true;
    for (const j of neighbors(i)) {
      if (alive[j]) reach[j] = true;
      if (!seen[j] && capable[j]) { seen[j] = true; q.push(j); }
    }
  }
  return reach;
}

export function lantern(m: ProductMemory, day: number): { output: Output; log: NonNullable<ProductLog['lantern']> } {
  const alive = Array.from({ length: SECTION_COUNT }, (_, i) => (m.census.people[i] ?? 1) > 0);
  const darkLevels: number[] = [];
  for (let l = 1; l <= LEVELS; l++) { const p = m.sensorPower[l - 1]; if (p !== null && p < DARK) darkLevels.push(l); }
  const capable = Array.from({ length: SECTION_COUNT }, (_, i) => alive[i] && !darkLevels.includes(Math.floor(i / SECTIONS_PER_LEVEL) + 1));
  const relays: number[] = [];
  const add = (i: number) => { if (relays.length < BUDGET && alive[i] && !capable[i]) { capable[i] = true; relays.push(i); } };

  // Greedy: walk outward from the hub level. For each level the mesh misses, bridge the stairwell to it, then
  // put relays on columns 1, 3, 5 and 6 so every section on that level is next to a relay.
  const order = Array.from({ length: LEVELS }, (_, k) => k + 1).sort((a, b) => Math.abs(a - HUB.level) - Math.abs(b - HUB.level));
  for (const l of order) {
    let reach = meshReach(capable, alive);
    const missing = Array.from({ length: SECTIONS_PER_LEVEL }, (_, c) => idx(l, c)).filter((i) => alive[i] && !reach[i]);
    if (!missing.length) continue;
    const step = l > HUB.level ? -1 : 1;
    for (let k = l; k !== HUB.level; k += step) add(idx(k, STAIR)); // the stairwell back toward the hub
    reach = meshReach(capable, alive);
    for (const c of [1, 3, 5, 6]) if (!reach[idx(l, c)] || !capable[idx(l, c)]) add(idx(l, c));
    if (relays.length >= BUDGET) break;
  }
  const reach = meshReach(capable, alive);
  const predictedReach = reach.filter(Boolean).length / SECTION_COUNT;
  return {
    output: {
      kind: 'relays', module: 'lantern', sections: relays,
      text: `Day ${day}: ${relays.length} battery relays placed; if the network is cut, the mesh should reach ${Math.round(predictedReach * 100)}% of sections.`,
    },
    log: { relays: relays.length, predictedReach, darkLevels, networkDownHours: m.networkDownHours },
  };
}
