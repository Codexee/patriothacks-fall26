// REBUILD, problem #12 — Food Sharing (key `larder`).
// "A neighborhood cut off from the farms has days of food. Grow and share food locally."
//
// Inputs (only what residents have): the section councils' census, which counts the days of food in store in each
// section, and how that number moved over the last days. Nothing about the farms themselves.
//
// What it does each day: finds levels whose food is running out (under 18 days and falling, or under 10 days), and
// asks levels with a surplus (over 20 days and not falling) to carry food to them, up to 3 deliveries a day. It also
// turns spare space into a grow-lamp farm on the level that would run out first. The numbers 18, 10, 20 and 3 are
// design choices, not measured values.
import { LEVELS, SECTIONS_PER_LEVEL, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

const LOW = 18; // days: a level below this and falling needs help
const CRITICAL = 10;
const SURPLUS = 20; // days: a level above this and not falling can give
const TRANSFERS = 3; // deliveries a day (carried by residents)
const DAYS_PER_TRANSFER = 1.2;

export function foodSharing(m: ProductMemory, day: number): { outputs: Output[]; log: NonNullable<ProductLog['foodSharing']> } | null {
  const hist = m.runway ?? [];
  if (!hist.length) return null;
  const rows: { level: number; runway: number; trend: number }[] = [];
  for (let l = 1; l <= LEVELS; l++) {
    const h = hist[l - 1];
    if (!h || !h.length) continue;
    const runway = h[h.length - 1];
    const trend = h.length > 1 ? (runway - h[0]) / (h.length - 1) : 0;
    rows.push({ level: l, runway, trend });
  }
  const needy = rows.filter((r) => (r.runway < LOW && r.trend < -0.05) || r.runway < CRITICAL).sort((a, b) => a.runway - b.runway);
  const donors = rows.filter((r) => r.runway > SURPLUS && r.trend > -0.02).sort((a, b) => b.runway - a.runway);
  const outputs: Output[] = [];
  const transfers: { from: number; to: number; days: number }[] = [];
  for (const n of needy) {
    if (transfers.length >= TRANSFERS || !donors.length) break;
    const d = donors.shift()!;
    outputs.push({
      kind: 'foodTransfer', module: 'larder', from: d.level, to: n.level, days: DAYS_PER_TRANSFER,
      text: `Carry ${DAYS_PER_TRANSFER} days of food from level ${d.level} (${d.runway.toFixed(1)} days in store) to level ${n.level} (${n.runway.toFixed(1)} days, falling ${(-n.trend).toFixed(2)} a day).`,
    });
    transfers.push({ from: d.level, to: n.level, days: DAYS_PER_TRANSFER });
  }
  // Grow: the needy level that would run out first, if it has no grow-lamp farm yet.
  let grow: number | null = null;
  const toEmpty = (r: { runway: number; trend: number }) => (r.trend < 0 ? r.runway / -r.trend : Infinity);
  for (const n of [...needy].sort((a, b) => toEmpty(a) - toEmpty(b))) {
    const i = (n.level - 1) * SECTIONS_PER_LEVEL + (SECTIONS_PER_LEVEL - 1);
    if (m.farmSections?.includes(i)) continue;
    grow = n.level;
    outputs.push({ kind: 'grow', module: 'larder', level: n.level, text: `Build a grow-lamp farm on level ${n.level} (it runs out in about ${Math.round(toEmpty(n))} days).` });
    break;
  }
  void day;
  return { outputs, log: { lowest: [...rows].sort((a, b) => a.runway - b.runway).slice(0, 5), transfers, grow, needy: needy.length } };
}
