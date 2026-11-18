// PROTOTYPE: the residents' system. One call per day:
//   observations of yesterday (from the sim) + memory → outputs for today (to the sim) + a log for the console.
// It reads nothing else from the sim.
import { LEVELS, type Observation, type Output, type ReportTopic, type ToolSet } from '../sim/types.ts';
import type { ProductLog, ProductMemory, ProductStep } from './types.ts';
import { earlyWarning } from './earlyWarning.ts';
import { fairShare } from './fairShare.ts';
import { ledger } from './ledger.ts';
import { snow } from './snow.ts';

const HISTORY_H = 96;
const TOPICS: ReportTopic[] = ['cough', 'water', 'dark', 'hot'];

export function createMemory(): ProductMemory {
  const perLevel = () => Array.from({ length: LEVELS }, () => [] as number[]);
  return {
    day: 0,
    plantOut: [],
    plantHours: [],
    feederDemand: [],
    outlook: null,
    outlookPrev: null,
    plant3Baseline: null,
    plant3Ratios: [],
    reports: { cough: perLevel(), water: perLevel(), dark: perLevel(), hot: perLevel() },
    clinicCases: [],
    officialCases: 0,
    census: { people: [], demand: [], critical: [], facilities: [], recyclerLevels: [] },
    sensorWater: new Array(LEVELS).fill(null),
    sensorWet: new Array(LEVELS).fill(null),
    ledger: [],
    repairsSent: {},
    userReports: [],
  };
}

/** Folds one day of observations into memory. */
function ingest(m: ProductMemory, obs: Observation[]): Record<string, number> {
  const seen: Record<string, number> = {};
  const hours = new Map<number, (number | null)[]>();
  const todayReports: Record<ReportTopic, number[]> = { cough: [], water: [], dark: [], hot: [] };
  for (const t of TOPICS) todayReports[t] = new Array(LEVELS).fill(0);
  const water: number[][] = Array.from({ length: LEVELS }, () => []);
  const wet: number[][] = Array.from({ length: LEVELS }, () => []);
  const census = { people: [] as number[], demand: [] as number[], critical: [] as number[], facilities: [] as string[][], recyclerLevels: [] as number[] };
  m.clinicCases = [];
  let plantCount = 0;

  for (const o of obs) {
    seen[o.kind] = (seen[o.kind] ?? 0) + 1;
    if (o.kind === 'plantMeter') {
      plantCount = Math.max(plantCount, o.plant + 1);
      if (!hours.has(o.hour)) hours.set(o.hour, []);
      hours.get(o.hour)![o.plant] = o.output;
    } else if (o.kind === 'feeder') {
      m.feederDemand.push(o.demand);
    } else if (o.kind === 'reports') {
      todayReports[o.topic][o.level - 1] += o.count;
      if (o.byUser) m.userReports.push({ day: o.day, level: o.level, col: o.col, text: o.text });
    } else if (o.kind === 'sensor') {
      water[o.level - 1].push(o.water);
      wet[o.level - 1].push(o.wetBulb);
    } else if (o.kind === 'clinic') {
      m.clinicCases.push({ level: o.level, cases: o.cases });
    } else if (o.kind === 'outlook') {
      m.outlookPrev = m.outlook;
      m.outlook = { fromHour: o.fromHour, supply: o.supply.slice(), demand: o.demand.slice() };
    } else if (o.kind === 'bulletin') {
      m.officialCases = o.officialCases;
    } else if (o.kind === 'census') {
      const i = (o.level - 1) * 8 + o.col;
      census.people[i] = o.people;
      census.demand[i] = o.demand;
      census.critical[i] = o.critical;
      census.facilities[i] = o.facilities.slice();
      if (o.facilities.includes('recycler') && !census.recyclerLevels.includes(o.level)) census.recyclerLevels.push(o.level);
    }
  }
  // Plant meters → one row per hour, a missing reading stays null.
  while (m.plantOut.length < plantCount) m.plantOut.push([]);
  for (const h of [...hours.keys()].sort((a, b) => a - b)) {
    const row = hours.get(h)!;
    for (let k = 0; k < plantCount; k++) m.plantOut[k].push(row[k] ?? null);
    m.plantHours.push(h);
  }
  for (const k of m.plantOut) if (k.length > HISTORY_H) k.splice(0, k.length - HISTORY_H);
  if (m.plantHours.length > HISTORY_H) m.plantHours.splice(0, m.plantHours.length - HISTORY_H);
  if (m.feederDemand.length > HISTORY_H) m.feederDemand.splice(0, m.feederDemand.length - HISTORY_H);
  for (const t of TOPICS) {
    for (let l = 0; l < LEVELS; l++) {
      const arr = m.reports[t][l];
      arr.push(todayReports[t][l]);
      if (arr.length > 3) arr.shift();
    }
  }
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  for (let l = 0; l < LEVELS; l++) {
    m.sensorWater[l] = mean(water[l]) ?? m.sensorWater[l];
    m.sensorWet[l] = mean(wet[l]) ?? m.sensorWet[l];
  }
  census.recyclerLevels.sort((a, b) => a - b);
  if (census.people.length) m.census = census;
  if (m.userReports.length > 20) m.userReports.splice(0, m.userReports.length - 20);
  return seen;
}

/**
 * Runs one day of the residents' system.
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

  // Early Warning feeds Fair Share: with a plan in force, the plan sheds load, so Early Warning does not also ask to.
  const ew = modules.earlyWarning ? earlyWarning(m, day, !modules.fairShare) : null;
  if (ew) { outputs.push(...ew.outputs); log.earlyWarning = ew.log; }
  if (modules.fairShare) {
    const fs = fairShare(m, day, ew?.capForecast ?? null, ew?.peakFactor ?? null);
    if (fs) { outputs.push(fs.output); log.fairShare = fs.log; }
  }
  const sn = modules.snow ? snow(m, day) : null;
  if (sn) { outputs.push(...sn.outputs); log.snow = sn.log; }
  // The Ledger publishes findings (its own, Truthcount's and Snow's). Without it, nothing is published,
  // so no Directorate lie is exposed, though Snow's local alerts still go out.
  if (modules.ledger) {
    const lg = ledger(m, day, sn?.findings ?? []);
    outputs.push(...lg.outputs);
    log.ledger = lg.log;
  }
  return { outputs, memory: m, log };
}
