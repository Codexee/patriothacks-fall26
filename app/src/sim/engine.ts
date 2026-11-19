// PROTOTYPE engine for Hollow Twin. Deterministic, seeded, hourly ticks over 50 levels × 8 sections.
// Rough on purpose: it proves the core loop (grounded models + the lies of the Directorate).
// Runs under Vite and plain Node type-stripping: relative .ts imports, no enums, no parameter properties.
//
// PRODUCT BRANCH: the engine is now the TEST WORLD. It contains no tool logic. It
//   1. applies the Outputs of the residents' system (alerts, a power plan, findings, repairs), and
//   2. produces Observations: the noisy, partial data residents could really have.
// The residents' system (src/product/) reads only Observations. It never reads SimState.internal.
import {
  HOURS_PER_DAY, HUB, LEVELS, SECTIONS_PER_LEVEL, SECTION_COUNT, sectionIndex,
  type Action, type AlertAction, type Bulletin, type DayResult, type Frame, type Lie, type LieId, type Observation,
  type Output, type ReportTopic, type Scenario, type Score, type SectionView, type SimState, type StructureKind,
  type ToolSet, type WorldEvent,
} from './types.ts';
import { mulberry32 } from './rng.ts';
import { probeSig } from './sign.ts';
import { heatOffsetFor } from '../data/index.ts';

// ---------- Tunable constants ----------
const MAX_DAYS = 120;
const STABLE_DAYS = 14;
const PLANT_LEVELS = [8, 18, 27, 34, 41, 47];
const PLANT3 = 2; // index into plants: the plant on level 27
const CAPACITY_MARGIN = 1.1; // nominal capacity ÷ normal demand
const TOOL_POWER_COST = 0.005; // the sensor network of Early Warning and of the Ledger each use 0.5% of capacity
const LOAD: Record<StructureKind, number> = { plant: 0, fan: 300, recycler: 600, farm: 1500, clinic: 200 };
const SPACE_LOAD = 4000; // every section has the same floor space; deep levels are just more crowded
const CRITICAL_RES_SHARE = 0.25; // share of residential load that is life support (air handling)

const CO2_OUT = 420; // ppm
const CO2_GEN = 0.0052e-3; // m³/s per person (Persily & de Jonge 2017: ≈0.0052 L/s)
const VOL_PER_PERSON = 62; // m³ of air per resident (scaled): ≈300 ppm/h rise with fans off
const FAN_BOOST = 0.3; // each extra fan adds 30% ventilation in its section
const Q_QUANTA = 25; // quanta/h (Rudnick–Milton range 20–40)
const EXPOSURE_SHARE = 0.008; // share of the time a resident shares air with a given infector's room
const RECOVERY_H = 240; // ≈10 days
const BASE_CFR = 0.08;
const HEAT_DEATH = 0.001; // hourly death share per °C above the wet-bulb limit
const WETBULB_LIMIT = 31; // °C (Vecellio et al. 2022)
const LIE_DELAY_H = 14 * 24; // without published evidence, residents learn the truth 14 days late
const STRESS_TRIP = 0.004; // hourly trip chance per plant when the Directorate runs the plants at ≥99% load
const PLANT3_DECAY = 0.1; // health lost per day by Plant 3 from day 4 (hidden by the lie)
const AGING_PER_DAY = 0.002; // all plants
const LOST_SHARE = 0.25; // a section is lost (cannot function) when fewer than 25% of its residents remain
const REPAIR_H = 48; // a residents' crew needs 2 days to repair a recycler
const FAN_COOL = 0.7; // °C of wet-bulb removed by each fan, when it has power
const DIVERT_H = 11 * 24; // day 12: the Directorate diverts the farms of levels 40–50 to the upper levels
const DIVERT_SHARE = 0.3; // a diverted farm feeds its neighborhood only 30% as well
const RETALIATION_H = 48; // after a lie is exposed, the Directorate cuts the network for 48 h, starting next day
const FAMILY_SIZE = 40; // residents per family with members on other levels
const WELFARE_CUT = 0.25; // a welfare check cuts heat, air and sickness deaths in a section by 25% for a day
const SURFACE_TOX = 2.2; // the truth: survivable for about 2 h with a filter mask (the Directorate says ≥ 10)
const CLIMB_RATE = 0.0004; // daily share of rumor believers who try the closed way up (and die)
const PROBE_KEYS: Record<string, string> = { 'vent-A': 'k7f2', 'vent-B': 'q91x', 'vent-C': 'z3m8' }; // council probes
const RUMOR_DEVICES = ['healed-1', 'truth-seeker'];

// Observation noise and reporting rates (what the residents' system can see).
const SENSOR_COLS = [1, 5]; // 2 sensor boxes per level
const REPORT_RATE: Record<ReportTopic, number> = { cough: 0.01, water: 0.004, dark: 0.0008, hot: 0.0006, surface: 0.0005 };
const FALSE_REPORTS = 0.03; // background reports per section, topic and day that are not true
const CLINIC_SHARE = 0.05; // share of the sick within ±2 levels that a clinic sees each day
const OFFICIAL_SHARE_LYING = 0.12; // the Directorate's public case count while it denies the outbreak

type Problem = 'power' | 'outbreak' | 'water';
const LIE_FOR: Record<Problem, LieId> = { power: 'plantFine', outbreak: 'noOutbreak', water: 'waterSafe' };
const PROBLEM_FOR: Record<LieId, Problem | 'surface'> = { plantFine: 'power', noOutbreak: 'outbreak', waterSafe: 'water', surfaceDeadly: 'surface' };
const ONSET_H: Record<Problem, number> = { outbreak: 2 * 24, power: 3 * 24, water: 5 * 24 }; // day 3, 4, 6
const FAILED_RECYCLER_LEVEL = 38;

const REPORT_TEXT: Record<ReportTopic, string> = {
  cough: 'Neighbors have been coughing for days, and two children cannot catch their breath.',
  water: 'The tap water smells like metal, and people on our corridor are getting sick.',
  dark: 'The power has been off for most of the day.',
  hot: 'It is too hot to sleep, and the fans barely move the air.',
  surface: 'My cousin says the surface has healed and the Directorate is hiding it. People are going up.',
};

interface Plant {
  level: number;
  nominal: number; // capacity units
  health: number; // 0..1 (aging, Plant 3 degradation)
  offlineUntil: number; // absolute hour; online when hour >= offlineUntil
}

interface ActiveAlert { action: AlertAction; from: number; to: number; until: number; amount: number; reach: number[] }

interface Internal {
  rng: number;
  obsRng: number; // separate stream: observations never change what happens in the world
  hour: number; // absolute hours simulated
  startPeople: number[];
  people: number[];
  infected: number[];
  co2: number[];
  wet: number[];
  waterQ: number[]; // recycler quality, per section (only meaningful where a recycler stands)
  recyclerBroken: boolean[];
  food: number[];
  power: number[];
  lost: boolean[];
  structures: StructureKind[][];
  qBase: number[]; // m³/s at full fan power
  plants: Plant[];
  darkLevel: number[]; // cumulative dark-hour equivalents per level
  respStart: Record<Problem, number>; // absolute hour the residents' general response began, -1 if not yet
  capPrev: number; // capacity the Directorate dispatched against last hour
  loadPrev: number; // served ÷ capacity last hour
  stableStreak: number;
  prevInfected: number;
  prevMinFood: number;
  levelLost: boolean[];
  // Outputs of the residents' system that are in force.
  alerts: ActiveAlert[];
  plan: { crit: number[]; non: number[]; reach: number[] } | null; // today's power plan (Fair Share), cleared each day
  repairs: { i: number; at: number }[];
  userReports: { level: number; col: number; text: string }[];
  // Network and mesh (problems 7, 8).
  netDownFrom: number;
  netDownUntil: number;
  pendingFindings: Output[]; // findings that could not reach residents while the network was down
  relays: number[]; // sections with a Lantern battery relay
  critPow: number[]; // share of life-support power each section got last hour (phones charge on it)
  welfareUntil: number[];
  // Food (problem 12).
  diversions: { from: number; to: number; start: number; farms: number[] }[]; // farms: the Directorate's farms at that moment
  // Surface (problem 13).
  surfaceTox: number;
  belief: number;
  verdictReach: number; // share of residents the latest correct verdict reached (today)
}

const DEFAULT_LIES: Lie[] = [
  { id: 'plantFine', bulletin: 'Plant 3 is operating normally', truth: 'Plant 3 is losing capacity every day', active: true, exposed: false },
  { id: 'noOutbreak', bulletin: 'There is no outbreak', truth: 'A lung sickness is spreading in levels 44–48', active: true, exposed: false },
  { id: 'waterSafe', bulletin: 'The water is safe', truth: `The recycler on level ${FAILED_RECYCLER_LEVEL} is failing`, active: true, exposed: false },
  { id: 'surfaceDeadly', bulletin: 'The surface air would kill you in minutes', truth: 'Surface air is survivable for about 2 hours with a filter mask (not safe, not deadly in minutes)', active: true, exposed: false },
];

// ---------- Small helpers ----------
const lvl = (i: number) => Math.floor(i / SECTIONS_PER_LEVEL) + 1;
const depthOf = (level: number) => (level - 1) / (LEVELS - 1);
const baseWet = (level: number) => 22 + 9 * depthOf(level);
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const pad = (n: number) => String(n).padStart(2, '0');
function stamp(hour: number): string {
  return `Day ${Math.floor(hour / 24) + 1} ${pad(hour % 24)}:00`;
}
function scenarioAt(arr: number[], hour: number): number {
  if (hour < arr.length) return arr[hour];
  // After the data ends, repeat the last day.
  const lastDay = arr.length - 24;
  return lastDay >= 0 ? arr[lastDay + (hour % 24)] : arr[arr.length - 1];
}
function count(list: StructureKind[], k: StructureKind): number {
  let n = 0;
  for (const s of list) if (s === k) n++;
  return n;
}
function nearestDistance(level: number, levels: number[]): number {
  let d = 99;
  for (const l of levels) d = Math.min(d, Math.abs(l - level));
  return d;
}

// Observation randomness (its own stream).
function urand(s: Internal): number {
  let r: number;
  [r, s.obsRng] = mulberry32(s.obsRng);
  return r;
}
function gauss(s: Internal): number {
  const u = Math.max(1e-9, urand(s));
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * urand(s));
}
function poisson(s: Internal, lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss(s)));
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= urand(s); } while (p > L);
  return k - 1;
}
function topicOf(text: string): ReportTopic {
  const t = text.toLowerCase();
  if (/water|tap|taste|metal|smell|drink/.test(t)) return 'water';
  if (/cough|breath|fever|sick|lung/.test(t)) return 'cough';
  if (/dark|power|light|blackout/.test(t)) return 'dark';
  return 'hot';
}

/** Residential load: 15% scales with residents, 85% with the section's space (cooling, air, pumps, light). */
function resLoad(people: number): number {
  return 0.15 * people + 0.85 * SPACE_LOAD;
}

// ---------- Creation ----------
export function createState(scenario: Scenario, seed: number, tools: ToolSet): SimState {
  const n = SECTION_COUNT;
  const startPeople: number[] = [];
  const structures: StructureKind[][] = [];
  const qBase: number[] = [];
  const co2: number[] = [];
  const wet: number[] = [];
  for (let i = 0; i < n; i++) {
    const level = lvl(i);
    const col = i % SECTIONS_PER_LEVEL;
    const d = depthOf(level);
    const people = Math.round(2000 + 4000 * d);
    startPeople.push(people);
    const s: StructureKind[] = [];
    if (col === 0 && PLANT_LEVELS.includes(level)) s.push('plant');
    if (col === 3 && level % 3 === 0) s.push('fan');
    if (col === 4 && level % 5 === 3) s.push('recycler');
    if (col === 5 && level % 10 === 5) s.push('clinic');
    if (col === 6 && level % 4 === 0) s.push('farm');
    structures.push(s);
    const qpp = (9 - 2 * d) * 1e-3; // m³/s per person: deep levels are more crowded per fan
    qBase.push(people * qpp);
    co2.push(CO2_OUT + (CO2_GEN * 1e6) / qpp / (1 + FAN_BOOST * count(s, 'fan')));
    wet.push(baseWet(level) - 6);
  }
  // Normal demand sets the nominal plant capacity.
  let normal = 0;
  for (let i = 0; i < n; i++) normal += resLoad(startPeople[i]) + structures[i].reduce((a, k) => a + LOAD[k], 0);
  const plants: Plant[] = PLANT_LEVELS.map((level) => ({
    level, nominal: (normal * CAPACITY_MARGIN) / PLANT_LEVELS.length, health: 1, offlineUntil: 0,
  }));
  const infected = startPeople.map((p) => p * 0.0005);
  const internal: Internal = {
    rng: seed >>> 0,
    obsRng: (seed ^ 0x9e3779b9) >>> 0,
    hour: 0,
    startPeople,
    people: startPeople.slice(),
    infected,
    co2,
    wet,
    waterQ: new Array(n).fill(1),
    recyclerBroken: new Array(n).fill(false),
    food: new Array(n).fill(20),
    power: new Array(n).fill(1),
    lost: new Array(n).fill(false),
    structures,
    qBase,
    plants,
    darkLevel: new Array(LEVELS).fill(0),
    respStart: { power: -1, outbreak: -1, water: -1 },
    capPrev: normal * CAPACITY_MARGIN,
    loadPrev: 0.9,
    stableStreak: 0,
    prevInfected: infected.reduce((a, b) => a + b, 0),
    prevMinFood: 20,
    levelLost: new Array(LEVELS).fill(false),
    alerts: [],
    plan: null,
    repairs: [],
    userReports: [],
    netDownFrom: -1,
    netDownUntil: -1,
    pendingFindings: [],
    relays: [],
    critPow: new Array(n).fill(1),
    welfareUntil: new Array(n).fill(-1),
    diversions: [],
    surfaceTox: SURFACE_TOX,
    belief: 0.03,
    verdictReach: 0,
  };
  const startPopulation = startPeople.reduce((a, b) => a + b, 0);
  const state: SimState = {
    seed, scenario, day: 0, tools: { ...tools }, trust: 0.7, systemTrust: 0.7, observations: [],
    lies: DEFAULT_LIES.map((l) => ({ ...l })),
    totals: {
      population: startPopulation, startPopulation, deaths: 0, sectionsLost: 0, hoursDarkDeepest: 0,
      networkUp: true, familiesNoNews: 0, surfaceBelief: 0.03, climbersLost: 0, hungerDeaths: 0,
    },
    bulletin: { directorate: [], measured: [] },
    end: null,
    lastFrame: makeFrame(internal, 0, 0),
    internal,
  };
  state.bulletin = makeBulletin(state, internal);
  state.observations = warmupObservations(state, internal);
  return state;
}

/**
 * The residents' system was already running the day before the scenario starts. This gives it that day's
 * observations (normal conditions: supply and demand as in the first hours of the scenario), so it can plan day 1.
 */
function warmupObservations(state: SimState, s: Internal): Observation[] {
  const obs: Observation[] = [];
  const fullC = new Array<number>(SECTION_COUNT), fullN = new Array<number>(SECTION_COUNT);
  const sumPow = new Array<number>(SECTION_COUNT).fill(HOURS_PER_DAY);
  const sumWet = s.wet.map((w) => w * HOURS_PER_DAY);
  const sumCo2 = s.co2.map((c) => c * HOURS_PER_DAY);
  const sumInf = s.infected.map((x) => x * HOURS_PER_DAY);
  const costF = 1 - TOOL_POWER_COST * ((state.tools.earlyWarning ? 1 : 0) + (state.tools.ledger ? 1 : 0));
  for (let h = 0; h < HOURS_PER_DAY; h++) {
    const mult = scenarioAt(state.scenario.demand, h);
    let D = 0;
    for (let i = 0; i < SECTION_COUNT; i++) {
      const res = resLoad(s.people[i]);
      let c = res * CRITICAL_RES_SHARE, nc = res * (1 - CRITICAL_RES_SHARE);
      for (const k of s.structures[i]) { if (k === 'farm') nc += LOAD.farm; else c += LOAD[k]; }
      fullC[i] = c * mult; fullN[i] = nc * mult; D += fullC[i] + fullN[i];
    }
    let cap = 0;
    for (let k = 0; k < s.plants.length; k++) {
      const p = s.plants[k];
      const out = p.nominal * scenarioAt(state.scenario.supply, h) * costF;
      cap += out;
      if (urand(s) < 0.05) continue;
      obs.push({ kind: 'plantMeter', plant: k, level: p.level, hour: h - HOURS_PER_DAY, output: Math.round(out * (1 + 0.03 * gauss(s))) });
    }
    obs.push({ kind: 'feeder', hour: h - HOURS_PER_DAY, served: Math.round(Math.min(D, cap) * (1 + 0.02 * gauss(s))), demand: Math.round(D * (1 + 0.02 * gauss(s))) });
  }
  let I = 0;
  for (const x of s.infected) I += x;
  const expected = s.people.map((p) => Math.round(p / FAMILY_SIZE));
  dailyObservations(state, s, 0, obs, { sumPow, sumWet, sumCo2, sumInf }, I, fullC, fullN, null, expected, expected);
  return obs;
}

// ---------- Frames and bulletins ----------
function makeFrame(s: Internal, day: number, hour: number): Frame {
  const sections: SectionView[] = new Array(SECTION_COUNT);
  for (let i = 0; i < SECTION_COUNT; i++) {
    const n = s.people[i];
    sections[i] = {
      level: lvl(i), col: i % SECTIONS_PER_LEVEL,
      people: Math.round(n),
      power: Math.round(s.power[i] * 1000) / 1000,
      co2: Math.round(s.co2[i]),
      wetBulb: Math.round(s.wet[i] * 10) / 10,
      infected: n > 0 ? Math.round((s.infected[i] / n) * 10000) / 10000 : 0,
      water: Math.round(sectionWater(s, i) * 1000) / 1000,
      food: Math.round(s.food[i] * 10) / 10,
      lost: s.lost[i],
      structures: s.structures[i].slice(),
    };
  }
  let online = 0;
  for (const p of s.plants) if (s.hour >= p.offlineUntil) online++;
  return { day, hour, sections, plantsOnline: online, plantsTotal: s.plants.length };
}

function makeBulletin(state: SimState, s: Internal): Bulletin {
  const directorate = state.lies.filter((l) => l.active).map((l) => l.bulletin);
  directorate.push('All levels nominal');
  const measured: string[] = [];
  let online = 0;
  for (const p of s.plants) if (s.hour >= p.offlineUntil) online++;
  measured.push(`Plants online ${online}/${s.plants.length}`);
  measured.push(`Plant 3 at ${Math.round(s.plants[PLANT3].health * 100)}% capacity`);
  let deepPow = 0, deepN = 0;
  for (let i = sectionIndex(41, 0); i < SECTION_COUNT; i++) { deepPow += s.power[i]; deepN++; }
  measured.push(`Levels 41–50: power ${Math.round((deepPow / deepN) * 100)}%`);
  let I = 0, N = 0, Id = 0, Nd = 0;
  for (let i = 0; i < SECTION_COUNT; i++) {
    I += s.infected[i]; N += s.people[i];
    if (lvl(i) >= 41) { Id += s.infected[i]; Nd += s.people[i]; }
  }
  measured.push(`Infected ${((I / Math.max(1, N)) * 100).toFixed(1)}% (levels 41–50: ${((Id / Math.max(1, Nd)) * 100).toFixed(1)}%)`);
  const broken: number[] = [];
  for (let i = 0; i < SECTION_COUNT; i++) if (s.recyclerBroken[i]) broken.push(lvl(i));
  measured.push(broken.length ? `Recyclers failing: L${broken.join(', L')}` : 'All recyclers working');
  measured.push(`Deaths ${Math.round(state.totals.deaths).toLocaleString('en-US')}`);
  measured.push(networkUp(s, Math.max(0, s.hour - 1)) ? 'Network up' : `Network CUT (until day ${Math.floor(s.netDownUntil / 24) + 1})`);
  measured.push(`Surface air ${s.surfaceTox.toFixed(1)} (deadly ≥ 10; survivable with a mask 1–5)`);
  measured.push(`Believe "surface healed": ${(s.belief * 100).toFixed(1)}%; climbers lost ${Math.round(state.totals.climbersLost)}`);
  if (s.diversions.some((d) => s.hour >= d.start)) measured.push(`Farms diverted: L${s.diversions.map((d) => `${d.from}–${d.to}`).join(', L')}`);
  return { directorate, measured };
}

// ---------- Derived per-section values ----------
function sectionWater(s: Internal, i: number): number {
  const level = lvl(i);
  let best = 0.4; // no recycler in reach: hauled water
  for (let l = Math.max(1, level - 2); l <= Math.min(LEVELS, level + 2); l++) {
    for (let c = 0; c < SECTIONS_PER_LEVEL; c++) {
      const j = sectionIndex(l, c);
      if (s.structures[j].includes('recycler') && s.waterQ[j] > best) best = s.waterQ[j];
    }
  }
  return best;
}

/** Is the problem behind a Directorate lie really happening now? Used to judge a published finding. */
function problemIsReal(s: Internal, p: Problem): boolean {
  if (p === 'power') return s.plants[PLANT3].health < 0.97 || s.plants.some((pl) => s.hour < pl.offlineUntil);
  if (p === 'water') return s.recyclerBroken.some((b) => b);
  let I = 0, N = 0;
  for (let i = 0; i < SECTION_COUNT; i++) { I += s.infected[i]; N += s.people[i]; }
  return I / Math.max(1, N) > 0.002;
}

function recyclerNear(s: Internal, level: number): number {
  let best = -1, bestD = 99;
  for (let i = 0; i < SECTION_COUNT; i++) {
    if (!s.structures[i].includes('recycler')) continue;
    const d = Math.abs(lvl(i) - level);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function farmsIn(s: Internal, from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < SECTION_COUNT; i++) if (s.structures[i].includes('farm') && lvl(i) >= from && lvl(i) <= to) out.push(i);
  return out;
}

// ---------- Network and the Lantern mesh ----------
function networkUp(s: Internal, hour: number): boolean {
  return !(hour >= s.netDownFrom && hour < s.netDownUntil);
}

/**
 * Which sections a message from the council's base (HUB) reaches: 1 or 0 per section.
 * Network up: every section. Network down: none, unless Lantern is on. Then phones relay from section to section
 * (neighbors on a level, and up and down the stairwells) through sections where phones can charge (life-support
 * power on, even if other power is rationed), or with a Lantern battery relay. A dark section next to the mesh
 * can still receive.
 */
function computeReach(s: Internal, tools: ToolSet, hour: number): number[] {
  const reach = new Array<number>(SECTION_COUNT).fill(0);
  if (networkUp(s, hour)) return reach.fill(1);
  const hub = sectionIndex(HUB.level, HUB.col);
  reach[hub] = 1;
  if (!tools.lantern) return reach;
  const relay = new Array<boolean>(SECTION_COUNT).fill(false);
  for (const r of s.relays) if (r >= 0 && r < SECTION_COUNT) relay[r] = true;
  const capable = (i: number) => !s.lost[i] && (s.critPow[i] >= 0.3 || relay[i]);
  const seen = new Array<boolean>(SECTION_COUNT).fill(false);
  const queue = [hub];
  seen[hub] = true;
  while (queue.length) {
    const i = queue.shift()!;
    reach[i] = 1;
    for (const j of neighbors(i)) {
      if (!s.lost[j]) reach[j] = 1; // a phone next to the mesh can receive
      if (!seen[j] && capable(j)) { seen[j] = true; queue.push(j); }
    }
  }
  return reach;
}

function neighbors(i: number): number[] {
  const l = lvl(i), c = i % SECTIONS_PER_LEVEL, out: number[] = [];
  if (c > 0) out.push(i - 1);
  if (c < SECTIONS_PER_LEVEL - 1) out.push(i + 1);
  if (l > 1) out.push(i - SECTIONS_PER_LEVEL);
  if (l < LEVELS) out.push(i + SECTIONS_PER_LEVEL);
  return out;
}

const share = (reach: number[]) => reach.reduce((a, b) => a + b, 0) / reach.length;

// ---------- Applying outputs and events ----------
/**
 * Applies the residents' system's outputs at the start of a day. Every output must REACH residents to work:
 * with the network up, it reaches everyone; with it cut, only the sections the Lantern mesh reaches.
 */
function applyOutputs(state: SimState, s: Internal, outputs: Output[], day: number, events: string[]): void {
  const h = s.hour;
  const tools = state.tools;
  // Relays are placed first, so the mesh can carry today's other outputs.
  for (const o of outputs) if (o.kind === 'relays') s.relays = o.sections.slice();
  const reach = computeReach(s, tools, h);
  const reached = share(reach);
  if (!networkUp(s, h)) {
    events.push(`${stamp(h)} · Network is down. ${tools.lantern ? `The Lantern mesh reaches ${Math.round(reached * 100)}% of sections.` : 'Residents\' alerts reach no one.'}`);
  }
  // Findings held back during an earlier shutdown go out now if residents can be reached.
  const all = [...s.pendingFindings, ...outputs];
  s.pendingFindings = [];
  let moves = 0, transfers = 0, grows = 0;
  for (const o of all) {
    if (o.kind === 'alert') {
      s.alerts.push({ action: o.action, from: o.from, to: o.to, until: h + o.hours, amount: o.amount ?? 1, reach: reach.slice() });
    } else if (o.kind === 'allocation') {
      s.plan = { crit: o.crit.slice(), non: o.non.slice(), reach: reach.slice() };
    } else if (o.kind === 'repair') {
      const i = recyclerNear(s, o.level);
      if (i >= 0 && Math.abs(lvl(i) - o.level) <= 1) {
        if (!reach[i]) { events.push(`${stamp(h)} · Repair crew for level ${o.level} could not be reached`); continue; }
        if (!s.repairs.some((r) => r.i === i)) s.repairs.push({ i, at: h + REPAIR_H });
      } else {
        events.push(`${stamp(h)} · Repair crew found no recycler on level ${o.level}`);
      }
    } else if (o.kind === 'finding' && o.lie) {
      const lie = state.lies.find((l) => l.id === o.lie)!;
      if (!lie.active) continue;
      if (reached < 0.5) { s.pendingFindings.push(o); continue; } // most residents cannot hear it yet
      const p = PROBLEM_FOR[o.lie];
      const real = p === 'surface' ? s.surfaceTox < 10 : problemIsReal(s, p);
      if (real) {
        lie.active = false;
        lie.exposed = true;
        state.trust = Math.max(0.1, Math.round((state.trust - 0.15) * 100) / 100);
        state.systemTrust = Math.min(1, Math.round((state.systemTrust + 0.05) * 100) / 100);
        if (p !== 'surface' && s.respStart[p] < 0) s.respStart[p] = h;
        events.push(`${stamp(h)} · Published finding exposed a lie: "${lie.bulletin}". ${o.text}`);
        // The Directorate answers by cutting the network, starting tomorrow.
        if (s.netDownUntil <= h) {
          s.netDownFrom = h + 24;
          s.netDownUntil = h + 24 + RETALIATION_H;
          events.push(`${stamp(h)} · The Directorate announces a network shutdown for tomorrow ("maintenance")`);
        }
      } else {
        state.systemTrust = Math.max(0.1, Math.round((state.systemTrust - 0.1) * 100) / 100);
        events.push(`${stamp(h)} · A published finding turned out wrong; residents trust the system less`);
      }
    } else if (o.kind === 'welfare') {
      let sent = 0;
      for (const i of o.sections) if (reach[i] && !s.lost[i]) { s.welfareUntil[i] = h + 24; sent++; }
      if (sent) events.push(`${stamp(h)} · Neighbors sent to check on ${sent} silent section(s)`);
    } else if (o.kind === 'moveFan') {
      if (moves >= 2 || !reach[o.from] || !reach[o.to]) continue;
      const k = s.structures[o.from].indexOf('fan');
      if (k < 0 || count(s.structures[o.to], 'fan') >= 3) continue;
      s.structures[o.from].splice(k, 1);
      s.structures[o.to].push('fan');
      moves++;
      events.push(`${stamp(h)} · Crew moved a fan from level ${lvl(o.from)} to level ${lvl(o.to)}`);
    } else if (o.kind === 'foodTransfer') {
      if (transfers >= 3) continue;
      const days = clamp(o.days, 0, 1.5);
      const src: number[] = [], dst: number[] = [];
      for (let c = 0; c < SECTIONS_PER_LEVEL; c++) {
        const a = sectionIndex(o.from, c), b = sectionIndex(o.to, c);
        if (!s.lost[a] && reach[a]) src.push(a);
        if (!s.lost[b] && reach[b]) dst.push(b);
      }
      const need = dst.reduce((t, i) => t + days * s.people[i], 0); // resident-days of food
      const have = src.reduce((t, i) => t + Math.max(0, s.food[i] - 5) * s.people[i], 0); // keep 5 days at the source
      const moved = Math.min(need, have);
      if (moved <= 0) continue;
      for (const i of src) s.food[i] -= (moved * (Math.max(0, s.food[i] - 5) * s.people[i] / have)) / Math.max(1, s.people[i]);
      const got = moved / Math.max(1, need);
      for (const i of dst) s.food[i] = Math.min(30, s.food[i] + days * got);
      transfers++;
      events.push(`${stamp(h)} · Food carried from level ${o.from} to level ${o.to} (${(days * got).toFixed(1)} days each)`);
    } else if (o.kind === 'grow') {
      if (grows >= 1) continue;
      const i = sectionIndex(clamp(o.level, 1, LEVELS), SECTIONS_PER_LEVEL - 1);
      if (s.lost[i] || !reach[i] || s.structures[i].includes('farm')) continue;
      s.structures[i].push('farm');
      grows++;
      events.push(`${stamp(h)} · Residents built a grow-lamp farm on level ${lvl(i)}`);
    } else if (o.kind === 'verdict') {
      if (Math.abs(o.value - s.surfaceTox) / s.surfaceTox < 0.3) s.verdictReach = reached;
      else state.systemTrust = Math.max(0.1, Math.round((state.systemTrust - 0.05) * 100) / 100);
    }
  }
  void day;
}

function applyEvent(s: Internal, e: WorldEvent, events: string[]): void {
  const h = s.hour;
  if (e.type === 'breakRecycler') {
    const i = recyclerNear(s, e.level);
    if (i >= 0) { s.recyclerBroken[i] = true; events.push(`${stamp(h)} · EVENT: the recycler on level ${lvl(i)} started failing`); }
  } else if (e.type === 'tripPlant') {
    const p = s.plants[clamp(e.plant, 0, s.plants.length - 1)];
    p.offlineUntil = h + 24;
    events.push(`${stamp(h)} · EVENT: Plant ${e.plant + 1} tripped`);
  } else if (e.type === 'outbreak') {
    const l = clamp(Math.round(e.level), 1, LEVELS);
    for (let c = 0; c < SECTIONS_PER_LEVEL; c++) { const i = sectionIndex(l, c); s.infected[i] += s.people[i] * 0.015; }
    events.push(`${stamp(h)} · EVENT: an outbreak started on level ${l}`);
  } else if (e.type === 'cutNetwork') {
    s.netDownFrom = h;
    s.netDownUntil = Math.max(s.netDownUntil, h + Math.max(1, e.hours));
    events.push(`${stamp(h)} · EVENT: the Directorate cut the network for ${e.hours} h`);
  } else if (e.type === 'divertFarms') {
    const from = clamp(Math.min(e.from, e.to), 1, LEVELS), to = clamp(Math.max(e.from, e.to), 1, LEVELS);
    s.diversions.push({ from, to, start: h, farms: farmsIn(s, from, to) });
    events.push(`${stamp(h)} · EVENT: the Directorate diverted the farms of levels ${from}–${to} to the upper levels`);
  }
}

// ---------- One day ----------
export function stepDay(prev: SimState, actions: Action[]): DayResult {
  const state: SimState = structuredClone(prev);
  const s = state.internal as Internal;
  const events: string[] = [];
  if (state.end) {
    const frames = Array.from({ length: HOURS_PER_DAY }, () => state.lastFrame);
    return { state, frames, events };
  }
  const day = state.day + 1;
  Object.assign(s, { plan: null }); // (not `s.plan = null`: TypeScript would then narrow s.plan to null below)

  // Actions: player builds, the residents' system's outputs, injected events, typed reports.
  let builds = 0;
  for (const a of actions) {
    if (a.type === 'setTools') state.tools = { ...a.tools };
    else if (a.type === 'outputs') applyOutputs(state, s, a.outputs, day, events);
    else if (a.type === 'event') applyEvent(s, a.event, events);
    else if (a.type === 'report') s.userReports.push({ level: a.level, col: a.col, text: a.text });
    else if (a.type === 'build') {
      if (builds >= 2) { events.push(`Day ${day} 00:00 · Build refused: at most 2 parts per day`); continue; }
      const i = sectionIndex(a.level, a.col);
      if (i < 0 || i >= SECTION_COUNT) continue;
      s.structures[i].push(a.kind);
      if (a.kind === 'recycler') { s.waterQ[i] = 1; s.recyclerBroken[i] = false; }
      builds++;
      events.push(`Day ${day} 00:00 · Built a ${a.kind} on level ${a.level}`);
    } else if (a.type === 'remove') {
      const i = sectionIndex(a.level, a.col);
      if (i < 0 || i >= SECTION_COUNT) continue;
      const k = s.structures[i].indexOf(a.kind);
      if (k >= 0) s.structures[i].splice(k, 1);
    }
  }
  const tools = state.tools;

  // Daily stability bookkeeping and the day's observations.
  let maxWet = 0, maxCo2 = 0, shortHours = 0;
  const frames: Frame[] = [];
  const obs: Observation[] = [];
  const fullC = new Array<number>(SECTION_COUNT);
  const fullN = new Array<number>(SECTION_COUNT);
  const reqC = new Array<number>(SECTION_COUNT);
  const reqN = new Array<number>(SECTION_COUNT);
  const critFrac = new Array<number>(SECTION_COUNT);
  const nonFrac = new Array<number>(SECTION_COUNT);
  const shed = new Array<number>(SECTION_COUNT);
  const boilA = new Array<number>(SECTION_COUNT);
  const isoA = new Array<number>(SECTION_COUNT);
  const sumPow = new Array<number>(SECTION_COUNT).fill(0);
  const sumWet = new Array<number>(SECTION_COUNT).fill(0);
  const sumCo2 = new Array<number>(SECTION_COUNT).fill(0);
  const sumInf = new Array<number>(SECTION_COUNT).fill(0);
  const scen = state.scenario;

  for (let hod = 0; hod < HOURS_PER_DAY; hod++) {
    const h = s.hour;

    // --- Directorate lies: without a published finding, residents learn the truth 14 days late ---
    for (const p of ['outbreak', 'power', 'water'] as Problem[]) {
      if (s.respStart[p] >= 0 || h < ONSET_H[p]) continue;
      if (h >= ONSET_H[p] + LIE_DELAY_H) {
        s.respStart[p] = h;
        const lie = state.lies.find((l) => l.id === LIE_FOR[p])!;
        if (lie.active) {
          lie.active = false;
          lie.exposed = true;
          state.trust = Math.max(0.1, Math.round((state.trust - 0.15) * 100) / 100);
          events.push(`${stamp(h)} · After 14 days residents learned: ${lie.truth}`);
        }
      }
    }
    const strength = 0.4 + 0.6 * state.trust;
    const resp = (p: Problem) => (s.respStart[p] >= 0 ? strength : 0);

    // --- Alerts of the residents' system in force this hour ---
    const comply = 0.5 + 0.5 * state.systemTrust; // share of residents who follow the system's alerts
    s.alerts = s.alerts.filter((a) => a.until > h);
    shed.fill(0); boilA.fill(0); isoA.fill(0);
    for (const a of s.alerts) {
      for (let l = Math.max(1, a.from); l <= Math.min(LEVELS, a.to); l++) {
        for (let c = 0; c < SECTIONS_PER_LEVEL; c++) {
          const i = sectionIndex(l, c);
          const got = a.reach[i] * comply; // only sections the alert reached
          if (a.action === 'shed') shed[i] = Math.max(shed[i], clamp(a.amount, 0, 1) * got);
          else if (a.action === 'boilWater') boilA[i] = Math.max(boilA[i], got);
          else isoA[i] = Math.max(isoA[i], got);
        }
      }
    }

    // --- Events that the scenario schedules ---
    if (h === ONSET_H.outbreak) {
      for (let l = 44; l <= 48; l++) for (let c = 0; c < SECTIONS_PER_LEVEL; c++) {
        const i = sectionIndex(l, c);
        s.infected[i] += s.people[i] * 0.015;
      }
    }
    if (h >= ONSET_H.power) {
      const p3 = s.plants[PLANT3];
      p3.health = Math.max(0, p3.health - PLANT3_DECAY / 24);
    }
    if (h === ONSET_H.water) {
      s.recyclerBroken[sectionIndex(FAILED_RECYCLER_LEVEL, 4)] = true;
      events.push(`${stamp(h)} · Recycler on level ${FAILED_RECYCLER_LEVEL} started failing`);
    }
    if (h === DIVERT_H) {
      s.diversions.push({ from: 40, to: 50, start: h, farms: farmsIn(s, 40, 50) });
      events.push(`${stamp(h)} · The Directorate diverted the farms of levels 40–50 to the upper levels`);
    }
    const netUp = networkUp(s, h);
    obs.push({ kind: 'network', hour: h, up: netUp });
    const reachH = netUp ? null : computeReach(s, tools, h);
    for (const p of s.plants) p.health = Math.max(0.2, p.health - AGING_PER_DAY / 24);
    for (const r of s.repairs) {
      if (r.at === h) {
        if (s.recyclerBroken[r.i]) {
          s.recyclerBroken[r.i] = false;
          events.push(`${stamp(h)} · Residents' crew repaired the recycler on level ${lvl(r.i)}`);
        } else events.push(`${stamp(h)} · Repair crew found the recycler on level ${lvl(r.i)} working`);
      }
    }
    s.repairs = s.repairs.filter((r) => r.at > h);

    // --- Power: demand. Full = what the section needs; requested = after the plan and any shedding ---
    const mult = scenarioAt(scen.demand, h) * (1 - 0.2 * resp('power'));
    let D = 0, RC = 0, RN = 0;
    for (let i = 0; i < SECTION_COUNT; i++) {
      if (s.lost[i]) { fullC[i] = fullN[i] = reqC[i] = reqN[i] = 0; continue; }
      const res = resLoad(s.people[i]);
      let c = res * CRITICAL_RES_SHARE, nc = res * (1 - CRITICAL_RES_SHARE);
      for (const k of s.structures[i]) { if (k === 'farm') nc += LOAD.farm; else c += LOAD[k]; }
      fullC[i] = c * mult;
      fullN[i] = nc * mult;
      // A section follows the plan only if the plan reached it; otherwise it draws all it needs.
      const planned = s.plan !== null && s.plan.reach[i] > 0;
      reqC[i] = fullC[i] * (planned ? s.plan!.crit[i] : 1);
      reqN[i] = fullN[i] * (planned ? s.plan!.non[i] : 1) * (1 - shed[i]);
      RC += reqC[i]; RN += reqN[i];
    }
    D = RC + RN;

    // --- Power: capacity, trips, cascade (the Directorate dispatches; the residents cannot) ---
    const supply = scenarioAt(scen.supply, h);
    const costF = 1 - TOOL_POWER_COST * ((tools.earlyWarning ? 1 : 0) + (tools.ledger ? 1 : 0));
    let cap = 0;
    for (const p of s.plants) if (h >= p.offlineUntil) cap += p.nominal * p.health * supply * costF;
    // The Directorate dispatches against last hour's capacity. A sudden drop overloads the plants.
    // While "Plant 3 is operating normally" is believed, dispatch also counts the capacity Plant 3 has lost.
    const p3 = s.plants[PLANT3];
    const plantLie = state.lies.find((l) => l.id === 'plantFine')!.active;
    const lieGap = plantLie && h >= p3.offlineUntil ? p3.nominal * (1 - p3.health) * supply * costF : 0;
    const target = Math.min(D, s.capPrev + lieGap);
    // Plants run at full load are stressed: a small hourly chance that one trips.
    if (s.loadPrev >= 0.99) {
      for (let k = 0; k < s.plants.length; k++) {
        const p = s.plants[k];
        if (h < p.offlineUntil) continue;
        let r: number;
        [r, s.rng] = mulberry32(s.rng);
        if (r < STRESS_TRIP) {
          let r2: number;
          [r2, s.rng] = mulberry32(s.rng);
          p.offlineUntil = h + 12 + Math.floor(r2 * 25);
          events.push(`${stamp(h)} · Plant ${k + 1} tripped (run at full load)`);
          break;
        }
      }
      cap = 0;
      for (const p of s.plants) if (h >= p.offlineUntil) cap += p.nominal * p.health * supply * costF;
    }
    let ratio = target / Math.max(1e-9, cap);
    let guard = 0;
    while (ratio > 1.005 && guard++ < 6) {
      let tripped = false;
      for (let k = 0; k < s.plants.length; k++) {
        const p = s.plants[k];
        if (h < p.offlineUntil) continue;
        let r: number;
        [r, s.rng] = mulberry32(s.rng);
        const pTrip = clamp(8 * (ratio - 1.005), 0, 0.85);
        if (r < pTrip) {
          let r2: number;
          [r2, s.rng] = mulberry32(s.rng);
          p.offlineUntil = h + 12 + Math.floor(r2 * 25); // offline 12–36 h
          events.push(`${stamp(h)} · Plant ${k + 1} tripped (load ${Math.round(ratio * 100)}%)`);
          tripped = true;
          break; // its load shifts to the others: re-check the cascade
        }
      }
      if (!tripped) break;
      cap = 0;
      for (const p of s.plants) if (h >= p.offlineUntil) cap += p.nominal * p.health * supply * costF;
      ratio = target / Math.max(1e-9, cap);
    }
    const served = Math.min(target, cap);
    if (served < 0.99 * D) shortHours++;
    s.capPrev = cap;
    s.loadPrev = served / Math.max(1e-9, cap);
    for (let k = 0; k < s.plants.length; k++) {
      if (s.plants[k].offlineUntil === h + 1) events.push(`${stamp(h + 1)} · Plant ${k + 1} back online`);
    }

    // --- Power: allocation ---
    if (s.plan) {
      // The residents' plan (Fair Share): critical loads everywhere first, then the planned non-critical shares.
      const cf = RC > 0 ? Math.min(1, served / RC) : 1;
      const nf = RN > 0 ? clamp((served - cf * RC) / RN, 0, 1) : 1;
      for (let i = 0; i < SECTION_COUNT; i++) {
        critFrac[i] = fullC[i] > 0 ? (reqC[i] * cf) / fullC[i] : 1;
        nonFrac[i] = fullN[i] > 0 ? (reqN[i] * nf) / fullN[i] : 1;
      }
    } else {
      // Directorate policy "upper levels first": serve top-down until capacity runs out.
      let left = served;
      for (let i = 0; i < SECTION_COUNT; i++) {
        const d = reqC[i] + reqN[i];
        const f = d <= 0 ? 1 : clamp(left / d, 0, 1);
        left -= f * d;
        critFrac[i] = fullC[i] > 0 ? (f * reqC[i]) / fullC[i] : 1;
        nonFrac[i] = fullN[i] > 0 ? (f * reqN[i]) / fullN[i] : 1;
      }
    }

    // --- Observations: meters on plant feeders and the main switchyard ---
    for (let k = 0; k < s.plants.length; k++) {
      if (urand(s) < 0.05) continue; // missing reading
      const p = s.plants[k];
      if (reachH && !reachH[sectionIndex(p.level, 0)]) continue; // network down and no mesh path to this plant
      const out = h >= p.offlineUntil ? p.nominal * p.health * supply * costF * (1 + 0.03 * gauss(s)) : 0;
      obs.push({ kind: 'plantMeter', plant: k, level: p.level, hour: h, output: Math.max(0, Math.round(out)) });
    }
    obs.push({ kind: 'feeder', hour: h, served: Math.round(served * (1 + 0.02 * gauss(s))), demand: Math.round(D * (1 + 0.02 * gauss(s))) });

    // --- Per-section physics ---
    const prevPrev = new Array<number>(LEVELS + 2).fill(0);
    for (let l = 1; l <= LEVELS; l++) {
      let I = 0, N = 0;
      for (let c = 0; c < SECTIONS_PER_LEVEL; c++) { const i = sectionIndex(l, c); I += s.infected[i]; N += s.people[i]; }
      prevPrev[l] = N > 0 ? I / N : 0;
    }
    prevPrev[0] = prevPrev[1]; prevPrev[LEVELS + 1] = prevPrev[LEVELS];
    const heatOff = heatOffsetFor(scen.id, h);
    let deathsHour = 0;

    // Recycler quality.
    for (let i = 0; i < SECTION_COUNT; i++) {
      if (!s.structures[i].includes('recycler')) continue;
      const powered = critFrac[i] >= 0.5 && !s.lost[i];
      const target = !powered ? 0.3 : s.recyclerBroken[i] ? 0.25 : 1 - 0.002 * (h / 24);
      s.waterQ[i] += (target - s.waterQ[i]) * (target < s.waterQ[i] ? 0.02 : 0.05);
    }
    // Farm output per level band.
    const farmPow: number[] = [];
    const farmLevels: number[] = [];
    for (let i = 0; i < SECTION_COUNT; i++) {
      if (!s.structures[i].includes('farm')) continue;
      // A farm the Directorate diverted feeds its own neighborhood only DIVERT_SHARE as well.
      // Grow-lamp farms that residents build later are theirs, not diverted.
      const diverted = s.diversions.some((d) => h >= d.start && d.farms.includes(i));
      farmLevels.push(lvl(i));
      farmPow.push(s.lost[i] ? 0 : nonFrac[i] * count(s.structures[i], 'farm') * (diverted ? DIVERT_SHARE : 1));
    }
    const clinicLevels: number[] = [];
    for (let i = 0; i < SECTION_COUNT; i++) if (s.structures[i].includes('clinic') && !s.lost[i]) clinicLevels.push(lvl(i));

    for (let i = 0; i < SECTION_COUNT; i++) {
      const level = lvl(i);
      const n = s.people[i];
      const fd = fullC[i] + fullN[i];
      const p = fd > 0 ? (critFrac[i] * fullC[i] + nonFrac[i] * fullN[i]) / fd : 0;
      s.power[i] = s.lost[i] ? 0 : p;
      s.critPow[i] = s.lost[i] ? 0 : critFrac[i];
      sumPow[i] += s.power[i];
      if (s.lost[i] || n <= 0) continue;

      // Air: analytic solution of dC/dt = (N·G − Q·v·(C − Cout))/V over one hour.
      const fans = count(s.structures[i], 'fan');
      const v = 0.02 + 0.98 * critFrac[i];
      const Q = s.qBase[i] * (1 + FAN_BOOST * fans) * v;
      const V = n * VOL_PER_PERSON;
      const gen = n * CO2_GEN * 1e6; // ppm·m³/s
      const css = CO2_OUT + gen / Q;
      s.co2[i] = clamp(css + (s.co2[i] - css) * Math.exp((-Q / V) * 3600), CO2_OUT, 10000);

      // Heat: cooling needs power; without it the section drifts toward base + 6.
      // Fans also move hot air out (they are life support, so they run on critical power).
      const target = baseWet(level) + heatOff + 6 - 12 * Math.sqrt(nonFrac[i]) - FAN_COOL * fans * critFrac[i];
      s.wet[i] += (target - s.wet[i]) * 0.1;

      // Water: boiling comes from the general response or from a boil-water alert in this section.
      const water = sectionWater(s, i);
      const boil = 0.35 * Math.max(resp('water'), boilA[i]);
      const wEff = Math.min(1, water + boil);

      // Lung sickness: Wells–Riley with the Rudnick–Milton rebreathed fraction.
      const isolation = 1 - 0.7 * Math.max(resp('outbreak'), isoA[i]);
      const f = Math.max(0, (s.co2[i] - CO2_OUT) / 38000);
      const crowd = Math.pow(n / 4000, 0.3);
      const dark = s.power[i] < 0.5 ? 1.25 : 1;
      const sLocal = s.infected[i] / n;
      const sEff = 0.85 * sLocal + 0.05 * (prevPrev[level - 1] + prevPrev[level] + prevPrev[level + 1]);
      const lambda = f * sEff * Q_QUANTA * EXPOSURE_SHARE * crowd * isolation * dark
        + (wEff < 0.6 ? 0.002 * (0.6 - wEff) / 0.6 : 0);
      const S = Math.max(0, n - s.infected[i]);
      const newInf = S * (1 - Math.exp(-lambda));
      const dist = nearestDistance(level, clinicLevels);
      const mu = (BASE_CFR / RECOVERY_H) * (1 + dist / 4) * (wEff < 0.6 ? 1.5 : 1);
      const helped = s.welfareUntil[i] > h ? 1 - WELFARE_CUT : 1; // neighbors checked on them (Kin)
      const infDeaths = s.infected[i] * mu * helped;
      const recovered = s.infected[i] / RECOVERY_H;

      // Other deaths: heat above the wet-bulb limit, very high CO₂, bad water, starvation.
      let rate = 0;
      if (s.wet[i] > WETBULB_LIMIT) rate += HEAT_DEATH * (s.wet[i] - WETBULB_LIMIT);
      if (s.co2[i] > 5000) rate += 0.0001 * (s.co2[i] - 5000) / 1000;
      if (wEff < 0.6) rate += 0.00005 * (0.6 - wEff) / 0.6;

      // Food.
      let prod = 0, nf = 0;
      for (let k = 0; k < farmLevels.length; k++) if (Math.abs(farmLevels[k] - level) <= 3) { prod += farmPow[k]; nf++; }
      const grow = nf > 0 ? Math.min(1.2, (1.05 * prod) / nf) : 0.9;
      s.food[i] = clamp(s.food[i] + (grow - 1) / 24, 0, 30);
      rate *= helped;
      if (s.food[i] <= 0) { rate += 0.003; state.totals.hungerDeaths += n * 0.003; }

      const other = Math.min(n, n * rate);
      const infShare = s.infected[i] / n;
      s.infected[i] = Math.max(0, s.infected[i] + newInf - recovered - infDeaths - other * infShare);
      s.people[i] = Math.max(0, n - infDeaths - other);
      if (s.infected[i] > s.people[i]) s.infected[i] = s.people[i];
      deathsHour += infDeaths + other;
      sumWet[i] += s.wet[i];
      sumCo2[i] += s.co2[i];
      sumInf[i] += s.infected[i];

      if (s.people[i] < s.startPeople[i] * LOST_SHARE) {
        s.lost[i] = true;
        s.power[i] = 0;
      }
    }
    state.totals.deaths += deathsHour;

    // Dark hours and lost levels.
    let deepDark = 0;
    for (let l = 1; l <= LEVELS; l++) {
      let dk = 0, all = true;
      for (let c = 0; c < SECTIONS_PER_LEVEL; c++) {
        const i = sectionIndex(l, c);
        dk += 1 - s.power[i];
        if (!s.lost[i]) all = false;
      }
      s.darkLevel[l - 1] += dk / SECTIONS_PER_LEVEL;
      if (l >= 41) deepDark += dk / SECTIONS_PER_LEVEL;
      if (all && !s.levelLost[l - 1]) {
        s.levelLost[l - 1] = true;
        events.push(`${stamp(h)} · Level ${l} lost`);
      }
    }
    state.totals.hoursDarkDeepest += deepDark / 10;

    for (let i = 0; i < SECTION_COUNT; i++) {
      if (s.lost[i]) continue;
      if (s.wet[i] > maxWet) maxWet = s.wet[i];
      if (s.co2[i] > maxCo2) maxCo2 = s.co2[i];
    }

    s.hour++;
    frames.push(makeFrame(s, day, hod));
  }

  // --- The surface rumor (problem 13): believers try the closed way up, and the machines and air kill them. ---
  // A correct, signed verdict that reaches residents shrinks the rumor; without one it grows.
  let alive = 0;
  for (let i = 0; i < SECTION_COUNT; i++) alive += s.people[i];
  if (s.verdictReach > 0) s.belief *= 1 - 0.4 * s.verdictReach;
  else s.belief = Math.min(0.3, s.belief + 0.003);
  s.verdictReach = 0;
  s.surfaceTox = Math.max(1.5, s.surfaceTox - 0.002);
  const climbers = alive * s.belief * CLIMB_RATE;
  if (climbers > 0 && alive > 0) {
    for (let i = 0; i < SECTION_COUNT; i++) s.people[i] = Math.max(0, s.people[i] - (climbers * s.people[i]) / alive);
    state.totals.deaths += climbers;
    state.totals.climbersLost += climbers;
  }

  // --- Families split across levels (problem 8): who knows their relatives are okay at the end of the day? ---
  const hEnd = s.hour - 1;
  const netUpEnd = networkUp(s, hEnd);
  const reachEnd = computeReach(s, state.tools, hEnd);
  const known = new Array<number>(SECTION_COUNT).fill(0);
  const expected = new Array<number>(SECTION_COUNT).fill(0);
  let noNews = 0;
  for (let i = 0; i < SECTION_COUNT; i++) {
    if (s.lost[i]) continue;
    expected[i] = Math.round(s.people[i] / FAMILY_SIZE);
    const sick = s.people[i] > 0 ? s.infected[i] / s.people[i] : 0;
    const distress = clamp(Math.max(0, s.wet[i] - 30) / 3 + Math.max(0, s.co2[i] - 2000) / 3000 + sick * 3 + (s.power[i] < 0.2 ? 0.3 : 0), 0, 0.9);
    // Network up: families call each other. Network down: only Kin check-ins over the Lantern mesh get through.
    const path = netUpEnd ? 1 : state.tools.kin && state.tools.lantern ? reachEnd[i] : 0;
    known[i] = expected[i] * (1 - distress) * path;
    noNews += expected[i] - known[i];
  }
  state.totals.familiesNoNews = Math.round(noNews);
  state.totals.networkUp = netUpEnd;
  state.totals.surfaceBelief = Math.round(s.belief * 1000) / 1000;

  // Totals, stability and end states.
  let pop = 0, I = 0, lostSections = 0, lostLevels = 0;
  for (let i = 0; i < SECTION_COUNT; i++) { pop += s.people[i]; I += s.infected[i]; if (s.lost[i]) lostSections++; }
  for (const b of s.levelLost) if (b) lostLevels++;
  state.totals.population = Math.round(pop);
  state.totals.sectionsLost = lostSections;
  state.day = day;
  const falling = I <= s.prevInfected || I / Math.max(1, pop) < 0.001;
  s.prevInfected = I;
  let minFood = Infinity;
  for (let i = 0; i < SECTION_COUNT; i++) if (!s.lost[i]) minFood = Math.min(minFood, s.food[i]);
  const foodOk = minFood >= s.prevMinFood - 0.05 || minFood >= 15;
  s.prevMinFood = minFood;
  // "Stable Hollow" as in the spec: power margin ≥ 0 all day (plants deliver what is asked for, so no unplanned
  // blackout), wet-bulb below the limit, safe CO₂, food reserves not falling, infections falling.
  // (Neil's first version tested power ≥ 95% in every section; that can never hold while residents ration on purpose.)
  const calm = shortHours === 0 && maxWet < WETBULB_LIMIT && maxCo2 < 1500 && falling && foodOk;
  s.stableStreak = calm ? s.stableStreak + 1 : 0;

  if (pop < 0.5 * state.totals.startPopulation) {
    state.end = { kind: 'lost', day, reason: 'More than half of the population died' };
  } else if (lostLevels >= 10) {
    state.end = { kind: 'lost', day, reason: `${lostLevels} levels fully lost` };
  } else if (s.stableStreak >= STABLE_DAYS) {
    state.end = { kind: 'stable', day };
  } else if (day >= MAX_DAYS) {
    // The contract has no "survived" end kind; the reason says the Hollow survived to the cap.
    state.end = { kind: 'lost', day, reason: `Survived to the ${MAX_DAYS}-day cap without 14 stable days` };
  }
  if (state.end) {
    events.push(state.end.kind === 'stable' ? `Day ${day} · Stable Hollow` : `Day ${day} · Hollow lost: ${state.end.reason}`);
  }

  state.lastFrame = frames[frames.length - 1];
  state.bulletin = makeBulletin(state, s);
  dailyObservations(state, s, day, obs, { sumPow, sumWet, sumCo2, sumInf }, I, fullC, fullN, netUpEnd ? null : reachEnd, expected, known);
  state.observations = obs;
  return { state, frames, events };
}

// ---------- Daily observations: what residents' sensors, reports, clinics and councils can see ----------
function dailyObservations(
  state: SimState, s: Internal, day: number, obs: Observation[],
  sums: { sumPow: number[]; sumWet: number[]; sumCo2: number[]; sumInf: number[] },
  totalInfected: number, fullC: number[], fullN: number[],
  reach: number[] | null, expected: number[], known: number[],
): void {
  const H = HOURS_PER_DAY;
  // With the network down, data from a section arrives only if the Lantern mesh reaches it.
  const heard = (i: number) => reach === null || reach[i] > 0;
  for (let i = 0; i < SECTION_COUNT; i++) {
    const level = lvl(i), col = i % SECTIONS_PER_LEVEL;
    const n = s.people[i];
    if (!heard(i)) continue;
    if (!s.lost[i]) {
      // Sensor boxes: 2 per level, about 10% of days missing.
      if (SENSOR_COLS.includes(col) && urand(s) > 0.1) {
        obs.push({
          kind: 'sensor', level, col, day,
          co2: Math.round((sums.sumCo2[i] / H) * (1 + 0.05 * gauss(s))),
          wetBulb: Math.round((sums.sumWet[i] / H + 0.3 * gauss(s)) * 10) / 10,
          power: Math.round(clamp(sums.sumPow[i] / H + 0.03 * gauss(s), 0, 1) * 100) / 100,
          water: Math.round(clamp(sectionWater(s, i) + 0.04 * gauss(s), 0, 1) * 100) / 100,
        });
      }
      // Resident reports: true reports in proportion to the problem, plus a few false ones.
      const water = sectionWater(s, i);
      const lambda: Record<ReportTopic, number> = {
        cough: (sums.sumInf[i] / H) * REPORT_RATE.cough,
        water: n * REPORT_RATE.water * Math.max(0, 0.8 - water),
        dark: n * REPORT_RATE.dark * Math.max(0, 0.6 - sums.sumPow[i] / H),
        hot: n * REPORT_RATE.hot * Math.max(0, sums.sumWet[i] / H - 29),
        surface: n * s.belief * 0.0005,
      };
      for (const t of ['cough', 'water', 'dark', 'hot', 'surface'] as ReportTopic[]) {
        const c = poisson(s, lambda[t] + FALSE_REPORTS);
        if (c > 0) obs.push({ kind: 'reports', level, col, day, topic: t, count: c, text: REPORT_TEXT[t] });
      }
      // Kin check-ins from this section (families with relatives on other levels).
      if (expected[i] > 0) {
        obs.push({ kind: 'checkins', level, col, day, expected: expected[i], received: Math.max(0, Math.round(known[i] * (1 + 0.03 * gauss(s)))) });
      }
    }
    // Section council census (people rounded; power asked for, with ±3% noise).
    obs.push({
      kind: 'census', level, col, day,
      people: Math.round(n / 10) * 10,
      demand: Math.round((fullC[i] + fullN[i]) * (1 + 0.03 * gauss(s))),
      critical: Math.round(fullC[i] * (1 + 0.03 * gauss(s))),
      facilities: s.structures[i].slice(),
      food: Math.round(s.food[i] * (1 + 0.03 * gauss(s)) * 10) / 10,
    });
  }
  // Surface probes: the council's 3 registered vents (signed, ±8% error) plus devices spreading the rumor.
  if (heard(sectionIndex(1, 0))) {
    for (const [device, key] of Object.entries(PROBE_KEYS)) {
      const value = Math.round(s.surfaceTox * (1 + 0.08 * gauss(s)) * 100) / 100;
      obs.push({ kind: 'probe', device, day, value, sig: probeSig(key, device, day, value) });
    }
  }
  for (const device of RUMOR_DEVICES) {
    const value = Math.round((0.2 + 0.2 * urand(s)) * 100) / 100; // "the surface is healed"
    obs.push({ kind: 'probe', device, day, value, sig: probeSig('unknown', device, day, value) });
  }
  for (const r of s.userReports) {
    obs.push({ kind: 'reports', level: r.level, col: r.col, day, topic: topicOf(r.text), count: 1, text: r.text, byUser: true });
  }
  s.userReports = [];
  // Clinics: each sees a small share of the sick within ±2 levels.
  for (let i = 0; i < SECTION_COUNT; i++) {
    if (!s.structures[i].includes('clinic') || s.lost[i] || !heard(i)) continue;
    const L = lvl(i);
    let sick = 0;
    for (let l = Math.max(1, L - 2); l <= Math.min(LEVELS, L + 2); l++) {
      for (let c = 0; c < SECTIONS_PER_LEVEL; c++) sick += s.infected[sectionIndex(l, c)];
    }
    obs.push({ kind: 'clinic', level: L, day, cases: Math.max(0, Math.round(sick * CLINIC_SHARE * (1 + 0.2 * gauss(s)))) });
  }
  // Public weather and grid outlook for the next 48 h: one bias per forecast (±3%, independent for supply and
  // demand) plus ±1.5% hourly error.
  const biasS = 1 + 0.03 * gauss(s), biasD = 1 + 0.03 * gauss(s);
  const supply: number[] = [], demand: number[] = [];
  for (let t = 0; t < 48; t++) {
    supply.push(Math.round(scenarioAt(state.scenario.supply, s.hour + t) * biasS * (1 + 0.015 * gauss(s)) * 1000) / 1000);
    demand.push(Math.round(scenarioAt(state.scenario.demand, s.hour + t) * biasD * (1 + 0.015 * gauss(s)) * 1000) / 1000);
  }
  obs.push({ kind: 'outlook', fromHour: s.hour, supply, demand });
  // The Directorate's bulletin and its public case count.
  const denying = state.lies.find((l) => l.id === 'noOutbreak')!.active;
  obs.push({
    kind: 'bulletin', day, lines: state.bulletin.directorate.slice(),
    claims: state.lies.filter((l) => l.active).map((l) => l.id),
    officialCases: Math.round(totalInfected * (denying ? OFFICIAL_SHARE_LYING : 0.9)),
  });
}

// ---------- Score ----------
/** Pure: the caller supplies the completed no-module run's deaths for this scenario and seed. */
export function score(state: SimState, baselineDeaths: number): Score {
  const s = state.internal as Internal;
  const days = state.day;
  const alivePct = (state.totals.population / state.totals.startPopulation) * 100;
  let mx = -Infinity, mn = Infinity;
  for (const d of s.darkLevel) { if (d > mx) mx = d; if (d < mn) mn = d; }
  const gap = s.hour > 0 ? (mx - mn) / s.hour : 0;
  const fairness = clamp(100 * (1 - gap), 0, 100);
  // Report whole people, as the UI does. One additional whole life saved always beats every secondary term.
  const livesSaved = Math.round(baselineDeaths) - Math.round(state.totals.deaths);
  const fairnessTenths = Math.round(fairness * 10);
  const stable = state.end?.kind === 'stable';
  const survival = clamp(days, 0, MAX_DAYS) + (stable ? MAX_DAYS + 1 : 0);
  // Fairness contributes at most 0.1; survival at most 0.0000241. Even one fairness tenth beats survival.
  // Keep the fractional tie-breakers: rounding the total here would discard them.
  const total = livesSaved + fairnessTenths / 10_000 + survival / 10_000_000;
  return {
    total, days, livesSaved, baselineDeaths,
    alivePct: Math.round(alivePct * 10) / 10,
    fairness: fairnessTenths / 10,
  };
}
