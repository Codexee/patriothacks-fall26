// REBUILD, problem #8 — Family Check-In.
// "Families split across levels can't check on each other in a blackout. Reconnect them."
//
// Inputs (only what this app collects, or residents already report):
//  - the daily check-ins in the app: per section, how many split families were expected to check in and how many did;
//  - residents' outage reports (which sections were dark at the end of the day).
// The phone-to-phone relay itself is part of the app: check-ins from a dark level hop up to the first level with
// power (ASSUMPTION: phones on adjacent levels can reach each other). If the whole Hollow is dark, they wait.
//
// What it does each day: finds SILENT sections (dark at the end of yesterday, and fewer than 70% of their families
// checked in). If a household nearby (the same or the next level) checked in OK, it asks them to knock on the door.
import { LEVELS, SECTIONS_PER_LEVEL, SECTION_COUNT, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

export const SILENT = 0.7; // under this share of expected check-ins = silent

export function familyCheckIn(m: ProductMemory, day: number): { outputs: Output[]; log: NonNullable<ProductLog['familyCheckIn']> } | null {
  const c = m.checkins;
  if (!c || !c.some((x) => x && x.day === day - 1)) return null;
  const ratio = (i: number) => { const x = c[i]; return x && x.day === day - 1 && x.expected > 0 ? x.received / x.expected : null; };
  let expected = 0, received = 0, relayed = 0, darkSections = 0;
  const okLevel = new Array<boolean>(LEVELS).fill(false); // some household on this level checked in OK
  for (let i = 0; i < SECTION_COUNT; i++) {
    const x = c[i];
    if (!x || x.day !== day - 1) continue;
    expected += x.expected; received += x.received;
    if (m.outDark[i]) { darkSections++; relayed += x.received; }
    const r = ratio(i);
    if (r !== null && r >= SILENT) okLevel[Math.floor(i / SECTIONS_PER_LEVEL)] = true;
  }
  const silent: number[] = [], checks: number[] = [];
  for (let i = 0; i < SECTION_COUNT; i++) {
    const r = ratio(i);
    if (r === null || !m.outDark[i] || r >= SILENT) continue;
    silent.push(i);
    const l = Math.floor(i / SECTIONS_PER_LEVEL);
    if (okLevel[l] || (l > 0 && okLevel[l - 1]) || (l < LEVELS - 1 && okLevel[l + 1])) checks.push(i);
  }
  const levels = [...new Set(checks.map((i) => Math.floor(i / SECTIONS_PER_LEVEL) + 1))].sort((a, b) => a - b);
  const outputs: Output[] = checks.length ? [{
    kind: 'welfare', module: 'kin', sections: checks,
    text: `${checks.length} section${checks.length === 1 ? '' : 's'} went silent in the dark (level${levels.length === 1 ? '' : 's'} ${levels.slice(0, 8).join(', ')}${levels.length > 8 ? '…' : ''}). A household nearby that checked in OK was asked to knock on their door.`,
  }] : [];
  return {
    outputs,
    log: { expected, received, noNews: Math.max(0, expected - received), relayed, darkSections, silent, checks },
  };
}
