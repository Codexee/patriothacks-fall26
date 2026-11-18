// PROTOTYPE module: Kin (problem 8). Families split across levels check in once a day. With the network up,
// the check-ins go over the network; with it cut, only over the Lantern mesh. A section whose families go
// quiet is either unreachable or in trouble (heat, bad air, sickness, a dark section). Kin sends neighbors to
// check on the quietest sections it can still reach.
import { SECTIONS_PER_LEVEL, SECTION_COUNT, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

const QUIET = 0.75; // fewer than 75% of expected check-ins
const MAX_CHECKS = 40; // welfare checks a day (volunteers)

export function kin(m: ProductMemory, day: number): { output: Output | null; log: NonNullable<ProductLog['kin']> } {
  let expected = 0, received = 0, unheard = 0;
  const quiet: { i: number; ratio: number }[] = [];
  for (let i = 0; i < SECTION_COUNT; i++) {
    const c = m.checkins[i];
    const people = m.census.people[i] ?? 0;
    if (people <= 0) continue;
    if (!c || c.day < day - 1) { // nothing heard from this section yesterday
      unheard++;
      expected += Math.round(people / 40);
      continue;
    }
    expected += c.expected;
    received += c.received;
    const ratio = c.expected > 0 ? c.received / c.expected : 1;
    if (ratio < QUIET) quiet.push({ i, ratio });
  }
  quiet.sort((a, b) => a.ratio - b.ratio || a.i - b.i);
  const flagged = quiet.slice(0, MAX_CHECKS).map((q) => q.i);
  const levels = [...new Set(flagged.map((i) => Math.floor(i / SECTIONS_PER_LEVEL) + 1))].sort((a, b) => a - b);
  return {
    output: flagged.length ? {
      kind: 'welfare', module: 'kin', sections: flagged,
      text: `${flagged.length} sections went quiet (levels ${levels.slice(0, 8).join(', ')}${levels.length > 8 ? '…' : ''}). Neighbors sent to check on them.`,
    } : null,
    log: { expected, received, unheardSections: unheard, flagged },
  };
}
