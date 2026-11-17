// PROTOTYPE engine for Hollow Twin. Deterministic, seeded, hourly ticks over 50 levels × 8 sections.
// Rough on purpose: it proves the core loop (grounded models + the lies of the Directorate + 4 tools).
// Runs under Vite and plain Node type-stripping: relative .ts imports, no enums, no parameter properties.
import {
  HOURS_PER_DAY, LEVELS, SECTIONS_PER_LEVEL, SECTION_COUNT, sectionIndex,
  type Action, type Bulletin, type DayResult, type Frame, type Lie, type LieId, type Scenario, type Score,
  type SectionView, type SimState, type StructureKind, type ToolSet,
} from './types.ts';
import { mulberry32 } from './rng.ts';
import { heatOffsetFor } from '../data/index.ts';

// ---------- Tunable constants ----------
const MAX_DAYS = 120;
const STABLE_DAYS = 14;
const PLANT_LEVELS = [8, 18, 27, 34, 41, 47];
const PLANT3 = 2; // index into plants: the plant on level 27
const CAPACITY_MARGIN = 1.1; // nominal capacity ÷ normal demand
const TOOL_POWER_COST = 0.005; // Early Warning and Ledger each use 0.5% of capacity
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
const LIE_DELAY_H = 14 * 24;
const LEDGER_DELAY_H = 24;
const EW_HORIZON_H = 40;
const STRESS_TRIP = 0.004; // hourly trip chance per plant when the Directorate runs the plants at ≥99% load
const PLANT3_DECAY = 0.1; // health lost per day by Plant 3 from day 4 (hidden by the lie)
const AGING_PER_DAY = 0.002; // all plants
const LOST_SHARE = 0.25; // a section is lost (cannot function) when fewer than 25% of its residents remain

type Problem = 'power' | 'outbreak' | 'water';
const LIE_FOR: Record<Problem, LieId> = { power: 'plantFine', outbreak: 'noOutbreak', water: 'waterSafe' };
const ONSET_H: Record<Problem, number> = { outbreak: 2 * 24, power: 3 * 24, water: 5 * 24 }; // day 3, 4, 6
const FAILED_RECYCLER_LEVEL = 38;

interface Plant {
  level: number;
  nominal: number; // capacity units
  health: number; // 0..1 (aging, Plant 3 degradation)
  offlineUntil: number; // absolute hour; online when hour >= offlineUntil
}

interface Internal {
  rng: number;
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
  respStart: Record<Problem, number>; // absolute hour the residents' response began, -1 if not yet
  ewConserveUntil: number;
  ewLastWarn: number;
  capPrev: number; // capacity the Directorate dispatched against last hour
  loadPrev: number; // served ÷ capacity last hour
  stableStreak: number;
  prevInfected: number;
  levelLost: boolean[];
}

const DEFAULT_LIES: Lie[] = [
  { id: 'plantFine', bulletin: 'Plant 3 is operating normally', truth: 'Plant 3 is losing capacity every day', active: true, exposed: false },
  { id: 'noOutbreak', bulletin: 'There is no outbreak', truth: 'A lung sickness is spreading in levels 44–48', active: true, exposed: false },
  { id: 'waterSafe', bulletin: 'The water is safe', truth: `The recycler on level ${FAILED_RECYCLER_LEVEL} is failing`, active: true, exposed: false },
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
    ewConserveUntil: -1,
    ewLastWarn: -999,
    capPrev: normal * CAPACITY_MARGIN,
    loadPrev: 0.9,
    stableStreak: 0,
    prevInfected: infected.reduce((a, b) => a + b, 0),
    levelLost: new Array(LEVELS).fill(false),
  };
  const startPopulation = startPeople.reduce((a, b) => a + b, 0);
  const state: SimState = {
    seed, scenario, day: 0, tools: { ...tools }, trust: 0.7,
    lies: DEFAULT_LIES.map((l) => ({ ...l })),
    totals: { population: startPopulation, startPopulation, deaths: 0, sectionsLost: 0, hoursDarkDeepest: 0 },
    bulletin: { directorate: [], measured: [] },
    end: null,
    lastFrame: makeFrame(internal, 0, 0),
    internal,
  };
  state.bulletin = makeBulletin(state, internal);
  return state;
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
  const r = sectionIndex(FAILED_RECYCLER_LEVEL, 4);
  measured.push(`Recycler L${FAILED_RECYCLER_LEVEL} water quality ${s.waterQ[r].toFixed(2)}`);
  measured.push(`Deaths ${Math.round(state.totals.deaths).toLocaleString('en-US')}`);
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

  // Player actions.
  let builds = 0;
  for (const a of actions) {
    if (a.type === 'setTools') state.tools = { ...a.tools };
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
  if (tools.layout) autoLayout(s, day, events);

  // Daily stability bookkeeping.
  let minPower = 1, maxWet = 0, maxCo2 = 0;
  const frames: Frame[] = [];
  const demand = new Array<number>(SECTION_COUNT);
  const crit = new Array<number>(SECTION_COUNT);
  const critFrac = new Array<number>(SECTION_COUNT);
  const nonFrac = new Array<number>(SECTION_COUNT);
  const scen = state.scenario;

  for (let hod = 0; hod < HOURS_PER_DAY; hod++) {
    const h = s.hour;

    // --- Directorate lies and the residents' response ---
    for (const p of ['outbreak', 'power', 'water'] as Problem[]) {
      if (s.respStart[p] >= 0 || h < ONSET_H[p]) continue;
      const delay = tools.ledger ? LEDGER_DELAY_H : LIE_DELAY_H;
      if (h >= ONSET_H[p] + delay) {
        s.respStart[p] = h;
        const lie = state.lies.find((l) => l.id === LIE_FOR[p])!;
        if (lie.active) {
          lie.active = false;
          lie.exposed = true;
          state.trust = Math.max(0.1, Math.round((state.trust - 0.15) * 100) / 100);
          events.push(tools.ledger
            ? `${stamp(h)} · Ledger exposed a lie: "${lie.bulletin}". Truth: ${lie.truth}`
            : `${stamp(h)} · After 14 days residents learned: ${lie.truth}`);
        }
        events.push(`${stamp(h)} · Residents respond: ${p === 'power' ? 'conserving power' : p === 'outbreak' ? 'isolating the sick' : 'boiling and rationing water'}`);
      }
    }
    const strength = 0.4 + 0.6 * state.trust;
    const resp = (p: Problem) => (s.respStart[p] >= 0 ? strength : 0);

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
    for (const p of s.plants) p.health = Math.max(0.2, p.health - AGING_PER_DAY / 24);

    // --- Power: demand ---
    const conserve = (1 - 0.2 * resp('power')) * (tools.earlyWarning && h < s.ewConserveUntil ? 0.9 : 1);
    const mult = scenarioAt(scen.demand, h) * conserve;
    let D = 0, C = 0;
    for (let i = 0; i < SECTION_COUNT; i++) {
      if (s.lost[i]) { demand[i] = 0; crit[i] = 0; continue; }
      const st = s.structures[i];
      const res = resLoad(s.people[i]);
      let c = res * CRITICAL_RES_SHARE, nc = res * (1 - CRITICAL_RES_SHARE);
      for (const k of st) { if (k === 'farm') nc += LOAD.farm; else c += LOAD[k]; }
      demand[i] = (c + nc) * mult;
      crit[i] = c * mult;
      D += demand[i]; C += crit[i];
    }

    // --- Power: capacity, trips, cascade ---
    const supply = scenarioAt(scen.supply, h);
    const costF = 1 - TOOL_POWER_COST * ((tools.earlyWarning ? 1 : 0) + (tools.ledger ? 1 : 0));
    let cap = 0;
    for (const p of s.plants) if (h >= p.offlineUntil) cap += p.nominal * p.health * supply * costF;
    let served: number;
    if (tools.earlyWarning) {
      // Forecast 40 h ahead from measured plant state and the known load curve.
      const fh = h + EW_HORIZON_H;
      let fcap = 0;
      for (const p of s.plants) if (fh >= p.offlineUntil) fcap += p.nominal * (p.health - PLANT3_DECAY * (fh - h) / 24 * (s.plants.indexOf(p) === PLANT3 && h >= ONSET_H.power ? 1 : 0)) * scenarioAt(scen.supply, fh) * costF;
      const fD = (D / Math.max(1e-9, mult)) * scenarioAt(scen.demand, fh) * (1 - 0.2 * resp('power'));
      if (fD > fcap) {
        s.ewConserveUntil = Math.max(s.ewConserveUntil, h + 24);
        if (h - s.ewLastWarn >= 24) {
          s.ewLastWarn = h;
          events.push(`${stamp(h)} · Early Warning: plant overload forecast in ${EW_HORIZON_H} h; residents conserve`);
        }
      }
      served = Math.min(D, 0.95 * cap); // plants kept below 0.95 load: no overload trips
    } else {
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
      served = Math.min(target, cap);
    }
    s.capPrev = cap;
    s.loadPrev = served / Math.max(1e-9, cap);
    for (let k = 0; k < s.plants.length; k++) {
      if (s.plants[k].offlineUntil === h + 1) events.push(`${stamp(h + 1)} · Plant ${k + 1} back online`);
    }

    // --- Power: allocation ---
    if (tools.fairShare) {
      // Max-min fair: critical loads (air, recyclers, clinics) first, then the same share for everyone.
      const cf = C > 0 ? Math.min(1, served / C) : 1;
      const r = D - C > 0 ? clamp((served - C) / (D - C), 0, 1) : 1;
      for (let i = 0; i < SECTION_COUNT; i++) { critFrac[i] = cf; nonFrac[i] = r; }
    } else {
      // Directorate policy "upper levels first": serve top-down until capacity runs out.
      let left = served;
      for (let i = 0; i < SECTION_COUNT; i++) {
        const d = demand[i];
        const f = d <= 0 ? 1 : clamp(left / d, 0, 1);
        left -= f * d;
        critFrac[i] = f; nonFrac[i] = f;
      }
    }

    // --- Per-section physics ---
    const prevPrev = new Array<number>(LEVELS + 2).fill(0);
    for (let l = 1; l <= LEVELS; l++) {
      let I = 0, N = 0;
      for (let c = 0; c < SECTIONS_PER_LEVEL; c++) { const i = sectionIndex(l, c); I += s.infected[i]; N += s.people[i]; }
      prevPrev[l] = N > 0 ? I / N : 0;
    }
    prevPrev[0] = prevPrev[1]; prevPrev[LEVELS + 1] = prevPrev[LEVELS];
    const heatOff = heatOffsetFor(scen.id, h);
    const isolation = 1 - 0.7 * resp('outbreak');
    const boil = 0.35 * resp('water');
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
    for (let i = 0; i < SECTION_COUNT; i++) if (s.structures[i].includes('farm')) { farmLevels.push(lvl(i)); farmPow.push(s.lost[i] ? 0 : nonFrac[i] * count(s.structures[i], 'farm')); }
    const clinicLevels: number[] = [];
    for (let i = 0; i < SECTION_COUNT; i++) if (s.structures[i].includes('clinic') && !s.lost[i]) clinicLevels.push(lvl(i));

    for (let i = 0; i < SECTION_COUNT; i++) {
      const level = lvl(i);
      const n = s.people[i];
      const p = demand[i] > 0 ? (critFrac[i] * crit[i] + nonFrac[i] * (demand[i] - crit[i])) / demand[i] : 0;
      s.power[i] = s.lost[i] ? 0 : p;
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
      const target = baseWet(level) + heatOff + 6 - 12 * Math.sqrt(nonFrac[i]);
      s.wet[i] += (target - s.wet[i]) * 0.1;

      // Water.
      const water = sectionWater(s, i);
      const wEff = Math.min(1, water + boil);

      // Lung sickness: Wells–Riley with the Rudnick–Milton rebreathed fraction.
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
      const infDeaths = s.infected[i] * mu;
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
      if (s.food[i] <= 0) rate += 0.003;

      const other = Math.min(n, n * rate);
      const infShare = s.infected[i] / n;
      s.infected[i] = Math.max(0, s.infected[i] + newInf - recovered - infDeaths - other * infShare);
      s.people[i] = Math.max(0, n - infDeaths - other);
      if (s.infected[i] > s.people[i]) s.infected[i] = s.people[i];
      deathsHour += infDeaths + other;

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
      if (s.power[i] < minPower) minPower = s.power[i];
      if (s.wet[i] > maxWet) maxWet = s.wet[i];
      if (s.co2[i] > maxCo2) maxCo2 = s.co2[i];
    }

    s.hour++;
    frames.push(makeFrame(s, day, hod));
  }

  // Totals, stability and end states.
  let pop = 0, I = 0, lostSections = 0, lostLevels = 0;
  for (let i = 0; i < SECTION_COUNT; i++) { pop += s.people[i]; I += s.infected[i]; if (s.lost[i]) lostSections++; }
  for (const b of s.levelLost) if (b) lostLevels++;
  state.totals.population = Math.round(pop);
  state.totals.sectionsLost = lostSections;
  state.day = day;
  const falling = I <= s.prevInfected || I / Math.max(1, pop) < 0.001;
  s.prevInfected = I;
  const calm = minPower >= 0.95 && maxWet < WETBULB_LIMIT && maxCo2 < 1500 && falling;
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
  return { state, frames, events };
}

// ---------- Layout planner ----------
function autoLayout(s: Internal, day: number, events: string[]): void {
  type Cand = { i: number; kind: 'fan' | 'recycler' | 'clinic'; bad: number };
  const cands: Cand[] = [];
  const clinicLevels: number[] = [];
  for (let i = 0; i < SECTION_COUNT; i++) if (s.structures[i].includes('clinic') && !s.lost[i]) clinicLevels.push(lvl(i));
  for (let i = 0; i < SECTION_COUNT; i++) {
    if (s.lost[i]) continue;
    const w = sectionWater(s, i);
    if (w < 0.7) cands.push({ i, kind: 'recycler', bad: (0.7 - w) * 10 });
    // Fans only help where the air is bad although the power is on (dark sections need power, not fans).
    // More air also cuts lung-sickness spread (Wells–Riley), so sick sections rank higher.
    const sick = s.people[i] > 0 ? s.infected[i] / s.people[i] : 0;
    if (s.power[i] >= 0.9 && (s.co2[i] > 1300 || sick > 0.01)) cands.push({ i, kind: 'fan', bad: (s.co2[i] - 1000) / 300 + sick * 20 });
    // A field clinic where many are sick and the nearest clinic is 3 or more levels away.
    const dist = nearestDistance(lvl(i), clinicLevels);
    if (sick > 0.03 && dist >= 3) cands.push({ i, kind: 'clinic', bad: sick * 20 * dist / 2 });
  }
  cands.sort((a, b) => b.bad - a.bad || a.i - b.i);
  let placed = 0;
  const recyclerLevels: number[] = [];
  for (const c of cands) {
    if (placed >= 2) break;
    const level = lvl(c.i);
    if (c.kind === 'clinic') {
      if (nearestDistance(level, clinicLevels) < 3) continue;
      clinicLevels.push(level);
    } else if (c.kind === 'recycler') {
      if (recyclerLevels.some((l) => Math.abs(l - level) <= 4)) continue;
      recyclerLevels.push(level);
      s.waterQ[c.i] = 1;
      s.recyclerBroken[c.i] = false;
    } else if (count(s.structures[c.i], 'fan') >= 3) continue;
    s.structures[c.i].push(c.kind);
    placed++;
    events.push(`Day ${day} 00:00 · Layout placed a spare ${c.kind} on level ${level}`);
  }
}

// ---------- Score ----------
export function score(state: SimState): Score {
  const s = state.internal as Internal;
  const days = state.day;
  const alivePct = (state.totals.population / state.totals.startPopulation) * 100;
  let mx = -Infinity, mn = Infinity;
  for (const d of s.darkLevel) { if (d > mx) mx = d; if (d < mn) mn = d; }
  const gap = s.hour > 0 ? (mx - mn) / s.hour : 0;
  const fairness = clamp(100 * (1 - gap), 0, 100);
  // A stable Hollow would survive to the cap, so it is credited with MAX_DAYS (else an early stable scores less).
  const stable = state.end?.kind === 'stable';
  const total = Math.round((stable ? MAX_DAYS : days) * 100 + alivePct * 20 + fairness * 10 + (stable ? 500 : 0));
  return {
    total, days,
    alivePct: Math.round(alivePct * 10) / 10,
    fairness: Math.round(fairness * 10) / 10,
  };
}
