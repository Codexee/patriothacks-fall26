// REBUILD, problem #7 — Off-Network Messaging (key `lantern`).
// "The Directorate controls the network and can shut it down. Organize, share information and call for help
//  without it."
//
// Inputs (only what residents have, or this app builds): residents' outage reports (which sections were dark at the
// end of yesterday: phones there cannot charge), the app's own record of when the network was down, and the
// council's own battery relays (built by our solution). ASSUMPTION, stated: phones in neighboring sections (on a
// level, and up and down the stairwell) can pass messages to each other when charged. BUDGET (40 relays) is a guess.
//
// What it does each day, before any shutdown (nobody can coordinate once the network is gone): it works out where
// the phone-to-phone mesh would break, and places the battery relays so the mesh from the council's base still
// reaches every level. When the network is cut, the residents' alerts and check-ins travel over that mesh.
import { HUB, LEVELS, SECTIONS_PER_LEVEL, SECTION_COUNT, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

export const BUDGET = 40; // battery relays the council owns (a guess)
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

/** Sections the mesh reaches from the council's base, given which sections can relay. Same rule as the world. */
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

export function offNetwork(m: ProductMemory, day: number): { outputs: Output[]; log: NonNullable<ProductLog['offNetwork']> } | null {
  if (!m.census.people.length) return null;
  const alive = Array.from({ length: SECTION_COUNT }, (_, i) => (m.census.people[i] ?? 1) > 0);
  // A section that was dark at the end of yesterday (outage reports) cannot charge phones: it does not relay.
  const capable = Array.from({ length: SECTION_COUNT }, (_, i) => alive[i] && !m.outDark[i]);
  const before = meshReach(capable, alive).filter(Boolean).length / SECTION_COUNT;
  const relays: number[] = [];
  const add = (i: number) => { if (relays.length < BUDGET && alive[i] && !capable[i]) { capable[i] = true; relays.push(i); } };
  // Walk outward from the base level. For each level the mesh misses, bridge the stairwell back to the base, then
  // put relays on columns 1, 3, 5 and 6 so every section on that level is next to one.
  const order = Array.from({ length: LEVELS }, (_, k) => k + 1).sort((a, b) => Math.abs(a - HUB.level) - Math.abs(b - HUB.level));
  for (const l of order) {
    let reach = meshReach(capable, alive);
    const missing = Array.from({ length: SECTIONS_PER_LEVEL }, (_, c) => idx(l, c)).filter((i) => alive[i] && !reach[i]);
    if (!missing.length) continue;
    const step = l > HUB.level ? -1 : 1;
    for (let k = l; k !== HUB.level; k += step) add(idx(k, STAIR));
    reach = meshReach(capable, alive);
    for (const c of [1, 3, 5, 6]) if (!reach[idx(l, c)] || !capable[idx(l, c)]) add(idx(l, c));
    if (relays.length >= BUDGET) break;
  }
  const reach = meshReach(capable, alive);
  const after = reach.filter(Boolean).length / SECTION_COUNT;
  const darkSections = m.outDark.filter(Boolean).length;
  return {
    outputs: [{
      kind: 'relays', module: 'lantern', sections: relays,
      text: `Day ${day}: ${relays.length} battery relays placed. If the network is cut, the phone mesh reaches ${Math.round(after * 100)}% of sections (${Math.round(before * 100)}% without the relays).`,
    }],
    log: { relays: relays.length, reachBefore: before, reachAfter: after, darkSections, networkDownHours: m.networkDownHours ?? 0, reach: reach.map((r) => (r ? 1 : 0)) },
  };
}
