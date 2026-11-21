// REBUILD, problem #3 — Cooling (key `layout`).
// "Plants age, the deep levels get hotter, and cooling falls behind. Keep the lower levels livable."
//
// Inputs (only what residents have): residents' "it is too hot" reports in the app, per level, over the last 2 days,
// the residents' own head count, and the census, which lists the sections with a fan. No temperature sensors.
//
// What it does each day: finds the levels with the most heat reports per 1,000 residents, and sends a residents' crew
// to move a fan there from a cool level (a level with fans and no heat reports), at most 2 moves a day. A level that
// received a fan never gives one away. The thresholds (1 report per 1,000 in 2 days, 2 moves a day) are design choices.
import { LEVELS, SECTIONS_PER_LEVEL, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

const HOT_PER_1000 = 1; // heat reports per 1,000 residents in 2 days: this level is overheating
const MOVES = 2; // fan moves a day (crews)
const TARGET_COL = 3;

export function cooling(m: ProductMemory, day: number): { outputs: Output[]; log: NonNullable<ProductLog['cooling']> } | null {
  const days = m.hotReports ?? [];
  if (!days.length || !m.census.people.length) return null;
  const people = (l: number) => { let s = 0; for (let c = 0; c < SECTIONS_PER_LEVEL; c++) { const i = (l - 1) * SECTIONS_PER_LEVEL + c; s += m.selfCount[i] || m.census.people[i] || 0; } return s; };
  const rate = (l: number) => { const r = days.reduce((a, d) => a + (d.perLevel[l - 1] || 0), 0); const p = people(l); return p > 0 ? (r / p) * 1000 : 0; };
  m.fanReceivers ??= [];
  const rows = Array.from({ length: LEVELS }, (_, k) => ({ level: k + 1, per1000: rate(k + 1) }));
  const hot = rows.filter((r) => r.per1000 >= HOT_PER_1000).sort((a, b) => b.per1000 - a.per1000);
  // Donors: levels with no heat reports that still have a fan, the top (coolest) levels first.
  const donors: { level: number; i: number }[] = [];
  for (const r of rows) {
    if (r.per1000 > 0 || m.fanReceivers.includes(r.level)) continue;
    for (let c = 0; c < SECTIONS_PER_LEVEL; c++) {
      const i = (r.level - 1) * SECTIONS_PER_LEVEL + c;
      if ((m.fanCount?.[i] ?? 0) > 0) { donors.push({ level: r.level, i }); break; }
    }
  }
  const outputs: Output[] = [];
  const moves: { from: number; to: number }[] = [];
  for (const h of hot) {
    if (moves.length >= MOVES || !donors.length) break;
    const to = (h.level - 1) * SECTIONS_PER_LEVEL + TARGET_COL;
    if ((m.fanCount?.[to] ?? 0) >= 3) continue;
    const d = donors.shift()!;
    outputs.push({
      kind: 'moveFan', module: 'layout', from: d.i, to,
      text: `Move a fan from level ${d.level} (no heat reports) to level ${h.level} (${h.per1000.toFixed(1)} heat reports per 1,000 residents in 2 days).`,
    });
    moves.push({ from: d.level, to: h.level });
    if (!m.fanReceivers.includes(h.level)) m.fanReceivers.push(h.level);
  }
  void day;
  return { outputs, log: { hot: hot.slice(0, 6), moves, received: m.fanReceivers.length } };
}
