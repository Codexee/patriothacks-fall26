// REBUILD: the Residents' System. One call per day:
//   observations of yesterday (from the test world) + memory → outputs for today + a log for the console.
// It reads nothing else from the sim. Step 1: one feature, Blackout Warning (problem #1).
// Inputs are only what the brief gives residents, or what this app collects: the Directorate's census, residents'
// own head count, residents' outage reports, and typed reports.
import { LEVELS, SECTIONS_PER_LEVEL, type Observation, type Output, type ToolSet } from '../sim/types.ts';
import type { ProductLog, ProductMemory, ProductStep } from './types.ts';
import { blackoutWarning } from './earlyWarning.ts';
import { familyCheckIn } from './familyCheckIn.ts';

const HOURS = 24;
const HOLLOW_DARK = 0.9; // share of levels dark at once that means a plant trip, not the usual deep-first cut

export function createMemory(): ProductMemory {
  return {
    day: 0,
    census: { people: [], demand: [], critical: [] },
    selfCount: [],
    outDark: new Array(LEVELS * SECTIONS_PER_LEVEL).fill(false),
    lines: [],
    shed: 0,
    quietDays: 0,
    troubleShed: 0,
    troubleAge: 0,
    userReports: [],
  };
}

/** Levels from the top that have power: a level is dark when at least half its sections report dark. */
function lineOf(dark: boolean[]): { line: number; darkLevels: number } {
  let line = -1, darkLevels = 0;
  for (let l = 0; l < LEVELS; l++) {
    let d = 0;
    for (let c = 0; c < SECTIONS_PER_LEVEL; c++) if (dark[l * SECTIONS_PER_LEVEL + c]) d++;
    if (d >= SECTIONS_PER_LEVEL / 2) { darkLevels++; if (line < 0) line = l; }
  }
  return { line: line < 0 ? LEVELS : line, darkLevels };
}

/** Folds one day of observations into memory. */
function ingest(m: ProductMemory, obs: Observation[]): Record<string, number> {
  const seen: Record<string, number> = {};
  const outages: Extract<Observation, { kind: 'outage' }>[] = [];
  for (const o of obs) {
    seen[o.kind] = (seen[o.kind] ?? 0) + 1;
    if (o.kind === 'census') {
      const i = (o.level - 1) * SECTIONS_PER_LEVEL + o.col;
      m.census.people[i] = o.people;
      m.census.demand[i] = o.demand;
      m.census.critical[i] = o.critical;
    } else if (o.kind === 'checkins') {
      (m.checkins ??= [])[(o.level - 1) * SECTIONS_PER_LEVEL + o.col] = { day: o.day, expected: o.expected, received: o.received };
    } else if (o.kind === 'selfCount') {
      m.selfCount[(o.level - 1) * SECTIONS_PER_LEVEL + o.col] = o.people;
    } else if (o.kind === 'outage') {
      outages.push(o);
    } else if (o.kind === 'reports') {
      if (o.byUser) m.userReports.push({ day: o.day, level: o.level, col: o.col, text: o.text });
    }
  }
  // Replay the outage reports hour by hour to get yesterday's blackout line. The standing census before day 1
  // (day 0) has no yesterday, so it gives no line.
  const standing = obs.every((o) => 'day' in o && o.day === 0);
  if (!standing && (outages.length || m.census.people.length)) {
    outages.sort((a, b) => a.hour - b.hour);
    const dark = m.outDark.slice();
    const line: number[] = [], hollowDark: boolean[] = [];
    let k = 0;
    for (let h = 0; h < HOURS; h++) {
      while (k < outages.length && outages[k].hour % HOURS <= h) {
        const o = outages[k++];
        dark[(o.level - 1) * SECTIONS_PER_LEVEL + o.col] = o.dark;
      }
      const r = lineOf(dark);
      line.push(r.line);
      hollowDark.push(r.darkLevels >= HOLLOW_DARK * LEVELS);
    }
    m.outDark = dark;
    m.lines.push({ line, hollowDark, shed: m.shed });
    if (m.lines.length > 2) m.lines.splice(0, m.lines.length - 2);
  }
  if (m.userReports.length > 20) m.userReports.splice(0, m.userReports.length - 20);
  return seen;
}

/**
 * Runs one day of the Residents' System.
 * @param obs yesterday's observations (SimState.observations)
 * @param day the day about to be simulated (outputs apply to it)
 */
export function stepProduct(obs: Observation[], prev: ProductMemory, modules: ToolSet, day: number): ProductStep {
  const m: ProductMemory = structuredClone(prev);
  const seen = ingest(m, obs);
  m.day = day - 1;
  const outputs: Output[] = [];
  const log: ProductLog = { day, seen };
  if (!obs.length) return { outputs, memory: m, log };
  if (modules.earlyWarning) {
    const bw = blackoutWarning(m, day);
    if (bw) { outputs.push(...bw.outputs); log.blackoutWarning = bw.log; m.shed = bw.log.shed; }
  }
  if (modules.kin) {
    const fc = familyCheckIn(m, day);
    if (fc) { outputs.push(...fc.outputs); log.familyCheckIn = fc.log; }
  }
  return { outputs, memory: m, log };
}
