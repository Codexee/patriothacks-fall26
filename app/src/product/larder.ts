// PROTOTYPE module: Larder (problems 12 and 2). Tracks each level's food runway (days of food in store, from the
// census) and its trend. When a neighborhood is cut off from its farms, Larder carries food from levels with a
// surplus to the levels that are running out, and turns spare space into grow-lamp farms where the runway is
// shortest. (Water is shared through the recyclers and Snow; this prototype does not model water quantity.)
import { LEVELS, SECTIONS_PER_LEVEL, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

const LOW = 18; // days: a level below this and falling needs help
const CRITICAL = 10;
const SURPLUS = 20; // days: a level above this and not falling can give
const TRANSFERS = 3;
const DAYS_PER_TRANSFER = 1.2;

export function larder(m: ProductMemory, day: number): { outputs: Output[]; log: NonNullable<ProductLog['larder']> } {
  const rows: { level: number; runway: number; trend: number }[] = [];
  for (let l = 1; l <= LEVELS; l++) {
    const h = m.runway[l - 1];
    if (!h.length) continue;
    const runway = h[h.length - 1];
    const trend = h.length > 1 ? (runway - h[0]) / (h.length - 1) : 0;
    rows.push({ level: l, runway, trend });
  }
  const needy = rows.filter((r) => (r.runway < LOW && r.trend < -0.05) || r.runway < CRITICAL)
    .sort((a, b) => a.runway - b.runway);
  const donors = rows.filter((r) => r.runway > SURPLUS && r.trend > -0.02).sort((a, b) => b.runway - a.runway);
  const outputs: Output[] = [];
  const transfers: { from: number; to: number; days: number }[] = [];
  for (const n of needy) {
    if (transfers.length >= TRANSFERS || !donors.length) break;
    const d = donors.shift()!;
    outputs.push({
      kind: 'foodTransfer', module: 'larder', from: d.level, to: n.level, days: DAYS_PER_TRANSFER,
      text: `Carry ${DAYS_PER_TRANSFER} days of food from level ${d.level} (${d.runway.toFixed(1)} days in store) to level ${n.level} (${n.runway.toFixed(1)} days, ${n.trend.toFixed(2)}/day).`,
    });
    transfers.push({ from: d.level, to: n.level, days: DAYS_PER_TRANSFER });
  }
  // Grow: the needy level with the shortest time to empty and no grow-lamp farm yet.
  let grow: number | null = null;
  const toEmpty = (r: { runway: number; trend: number }) => (r.trend < 0 ? r.runway / -r.trend : Infinity);
  for (const n of [...needy].sort((a, b) => toEmpty(a) - toEmpty(b))) {
    const i = (n.level - 1) * SECTIONS_PER_LEVEL + (SECTIONS_PER_LEVEL - 1);
    if (m.census.facilities[i]?.includes('farm')) continue;
    grow = n.level;
    outputs.push({ kind: 'grow', module: 'larder', level: n.level, text: `Build a grow-lamp farm on level ${n.level} (empty in about ${Math.round(toEmpty(n))} days).` });
    break;
  }
  void day;
  return {
    outputs,
    log: { lowest: [...rows].sort((a, b) => a.runway - b.runway).slice(0, 5), transfers, grow },
  };
}
