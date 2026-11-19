// REBUILD: the Residents' System. One call per day:
//   observations of yesterday (from the test world) + memory → outputs for today + a log for the console.
// It reads nothing else from the sim. Step 1: one feature, Blackout Warning (problem #1).
import { LEVELS, type Observation, type Output, type ToolSet } from '../sim/types.ts';
import type { ProductLog, ProductMemory, ProductStep } from './types.ts';
import { blackoutWarning } from './earlyWarning.ts';

const HISTORY_H = 96;

export function createMemory(): ProductMemory {
  return {
    day: 0,
    plantOut: [],
    plantHours: [],
    feederDemand: [],
    outlook: null,
    outlookPrev: null,
    census: { people: [], demand: [], critical: [] },
    selfCount: [],
    sensorPower: new Array(LEVELS).fill(null),
    sensorCo2: new Array(LEVELS).fill(null),
    darkReports: new Array(LEVELS).fill(0),
    userReports: [],
  };
}

/** Folds one day of observations into memory. Sections not heard from keep their last known values. */
function ingest(m: ProductMemory, obs: Observation[]): Record<string, number> {
  const seen: Record<string, number> = {};
  const hours = new Map<number, (number | null)[]>();
  const pow: number[][] = Array.from({ length: LEVELS }, () => []);
  const co2: number[][] = Array.from({ length: LEVELS }, () => []);
  const dark = new Array<number>(LEVELS).fill(0);
  let plantCount = 0;
  for (const o of obs) {
    seen[o.kind] = (seen[o.kind] ?? 0) + 1;
    if (o.kind === 'plantMeter') {
      plantCount = Math.max(plantCount, o.plant + 1);
      if (!hours.has(o.hour)) hours.set(o.hour, []);
      hours.get(o.hour)![o.plant] = o.output;
    } else if (o.kind === 'feeder') {
      m.feederDemand.push(o.demand);
      if (!hours.has(o.hour)) hours.set(o.hour, []);
    } else if (o.kind === 'outlook') {
      m.outlookPrev = m.outlook;
      m.outlook = { fromHour: o.fromHour, supply: o.supply.slice(), demand: o.demand.slice() };
    } else if (o.kind === 'census') {
      const i = (o.level - 1) * 8 + o.col;
      m.census.people[i] = o.people;
      m.census.demand[i] = o.demand;
      m.census.critical[i] = o.critical;
    } else if (o.kind === 'selfCount') {
      m.selfCount[(o.level - 1) * 8 + o.col] = o.people;
    } else if (o.kind === 'sensor') {
      pow[o.level - 1].push(o.lifeSupport); // the air-and-fans circuit: off = a real blackout
      co2[o.level - 1].push(o.co2);
    } else if (o.kind === 'reports') {
      if (o.topic === 'dark') dark[o.level - 1] += o.count;
      if (o.byUser) m.userReports.push({ day: o.day, level: o.level, col: o.col, text: o.text });
    }
  }
  while (m.plantOut.length < plantCount) m.plantOut.push([]);
  for (const h of [...hours.keys()].sort((a, b) => a - b)) {
    const row = hours.get(h)!;
    for (let k = 0; k < m.plantOut.length; k++) m.plantOut[k].push(row[k] ?? null);
    m.plantHours.push(h);
  }
  for (const k of m.plantOut) if (k.length > HISTORY_H) k.splice(0, k.length - HISTORY_H);
  if (m.plantHours.length > HISTORY_H) m.plantHours.splice(0, m.plantHours.length - HISTORY_H);
  if (m.feederDemand.length > HISTORY_H) m.feederDemand.splice(0, m.feederDemand.length - HISTORY_H);
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  for (let l = 0; l < LEVELS; l++) {
    m.sensorPower[l] = mean(pow[l]) ?? m.sensorPower[l];
    m.sensorCo2[l] = mean(co2[l]) ?? m.sensorCo2[l];
  }
  m.darkReports = dark;
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
    if (bw) { outputs.push(...bw.outputs); log.blackoutWarning = bw.log; }
  }
  return { outputs, memory: m, log };
}
