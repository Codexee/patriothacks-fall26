// REBUILD, problem #2 — Fair Share.
// "The Directorate decides who keeps power; the deep levels always lose. Share power fairly in a shortage."
//
// Inputs (the same as Blackout Warning): residents' outage reports (which levels were dark yesterday, and for how
// long), the census ration and the residents' own head count. No new data.
//
// What it does: Blackout Warning asks every level to switch off the same share of its non-essential power. Fair
// Share keeps the TOTAL saving the same (so the plants are protected just as much) but shares it by what each level
// already lost: a level that was dark yesterday is asked for less, the levels that kept their power are asked for
// more. Residents do this themselves; nothing here assumes control of the Directorate's power dispatch.
import { LEVELS, SECTIONS_PER_LEVEL, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';
import { EASE } from './earlyWarning.ts';

export const FAIR = {
  darkRelief: 0.6, // a level dark all of yesterday gets (1 − 0.6) = 40% of the weight of a level that kept power
};

type Shed = Extract<Output, { kind: 'alert' }>;

export function fairShare(m: ProductMemory, day: number, shed: Shed | null):
  { outputs: Output[]; log: NonNullable<ProductLog['fairShare']> } | null {
  if (!shed || !shed.amount || !m.lines.length || !m.census.demand.length) return null;
  const y = m.lines[m.lines.length - 1];

  // Non-essential power per level (census ration, scaled by the residents' own count).
  const non = new Array<number>(LEVELS).fill(0);
  for (let i = 0; i < m.census.demand.length; i++) {
    const p = m.census.people[i] || 0;
    const ratio = p > 0 && m.selfCount[i] > 0 ? m.selfCount[i] / p : 1;
    non[Math.floor(i / SECTIONS_PER_LEVEL)] += Math.max(0, (m.census.demand[i] || 0) - (m.census.critical[i] || 0)) * ratio;
  }
  // How much of yesterday each level spent dark (deep-first blackouts only; a whole-Hollow trip hit everyone).
  const darkShare = new Array<number>(LEVELS).fill(0);
  for (let h = 0; h < 24; h++) {
    if (y.hollowDark[h]) continue;
    for (let l = y.line[h]; l < LEVELS; l++) darkShare[l] += 1 / 24;
  }
  const w = darkShare.map((d) => 1 - FAIR.darkRelief * d);

  // Same total: find k so that Σ min(max, k·w_l)·N_l = request × ΣN_l.
  const total = shed.amount * non.reduce((a, b) => a + b, 0);
  const used = (k: number) => non.reduce((s, n, l) => s + Math.min(EASE.maxShed, k * w[l]) * n, 0);
  let lo = 0, hi = 10;
  for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (used(mid) < total) lo = mid; else hi = mid; }
  const amount = w.map((wl) => Math.round(Math.min(EASE.maxShed, hi * wl) * 100) / 100);

  // One alert per run of levels with the same request.
  const outputs: Output[] = [];
  for (let l = 0; l < LEVELS;) {
    let e = l;
    while (e + 1 < LEVELS && amount[e + 1] === amount[l]) e++;
    const a = amount[l];
    const relieved = darkShare[l] > 0;
    outputs.push({
      kind: 'alert', id: `fs-${day}-${l + 1}`, module: 'fairShare', action: 'shed', from: l + 1, to: e + 1, hours: 24, amount: a,
      text: `Fair share for levels ${l + 1 === e + 1 ? l + 1 : `${l + 1}–${e + 1}`} today: switch off ${Math.round(a * 100)}% of non-essential load (the Hollow-wide request is ${Math.round(shed.amount * 100)}%). ${relieved ? 'You lost power yesterday, so you are asked for less.' : 'Levels that lost power yesterday are asked for less, so you are asked for a little more.'}`,
      evidence: [
        `The total saving is the same as Blackout Warning's request: ${Math.round(shed.amount * 100)}% of all non-essential load`,
        `From yesterday's outage reports, these levels were dark for about ${Math.round(darkShare[l] * 24)} h`,
        `A level dark all day is asked for ${Math.round((1 - FAIR.darkRelief) * 100)}% of what a level that kept power is asked for`,
      ],
    });
    l = e + 1;
  }
  const top = amount[0], deep = amount[LEVELS - 1];
  return { outputs, log: { request: shed.amount, amount, darkShare, top, deep } };
}
