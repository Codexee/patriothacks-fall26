// PROTOTYPE module: Layout (problem 3). The deep levels get hotter, and the fans are in the wrong places.
// From the sensor boxes, Layout finds the hottest levels and the coolest levels that have a fan, and sends a crew
// to move a fan from cool to hot (at most 2 moves a day). A level that received a fan never gives one away.
import { LEVELS, SECTIONS_PER_LEVEL, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

const HOT = 29.5; // °C wet-bulb: getting dangerous (the limit is 31)
const COOL = 26; // °C: this level can spare a fan
const MOVES = 2;
const TARGET_COL = 3;

export function layout(m: ProductMemory, day: number): { outputs: Output[]; log: NonNullable<ProductLog['layout']> } {
  const hot: { level: number; wet: number }[] = [];
  const donors: { level: number; wet: number; i: number }[] = [];
  for (let l = 1; l <= LEVELS; l++) {
    const wet = m.sensorWet[l - 1];
    if (wet === null) continue;
    if (wet > HOT) hot.push({ level: l, wet });
    if (wet < COOL && !m.fanReceivers.includes(l)) {
      for (let c = 0; c < SECTIONS_PER_LEVEL; c++) {
        const i = (l - 1) * SECTIONS_PER_LEVEL + c;
        if (m.census.facilities[i]?.includes('fan')) { donors.push({ level: l, wet, i }); break; }
      }
    }
  }
  hot.sort((a, b) => b.wet - a.wet);
  donors.sort((a, b) => a.wet - b.wet);
  const outputs: Output[] = [];
  const moves: { from: number; to: number }[] = [];
  for (const h of hot) {
    if (moves.length >= MOVES || !donors.length) break;
    const to = (h.level - 1) * SECTIONS_PER_LEVEL + TARGET_COL;
    const fans = (m.census.facilities[to] ?? []).filter((f) => f === 'fan').length;
    if (fans >= 3) continue;
    const d = donors.shift()!;
    outputs.push({
      kind: 'moveFan', module: 'layout', from: d.i, to,
      text: `Move a fan from level ${d.level} (${d.wet.toFixed(1)} °C) to level ${h.level} (${h.wet.toFixed(1)} °C).`,
    });
    moves.push({ from: d.level, to: h.level });
    if (!m.fanReceivers.includes(h.level)) m.fanReceivers.push(h.level);
  }
  void day;
  return { outputs, log: { moves, hotLevels: hot.map((h) => h.level) } };
}
