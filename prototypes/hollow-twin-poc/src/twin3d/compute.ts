// The 3D twin's data: one disaster on one seed, run twice (without and with Blackout Warning), reduced to one
// snapshot per day. Pure: the Web Worker (worker.ts) calls it, and so can Node.
// Per day, the section snapshot is the day's worst hour (the hour with the most dark sections), the same line
// src/sim/results.ts uses for its dark-section counts; CO2 is the day's highest; deaths and "lost" are at the day's end.
// A run that ends before day D (stable or lost) keeps its last day.
import { BUILT } from '../product/names.ts';
import { NO_TOOLS, SECTION_COUNT, type Frame, type ToolSet } from '../sim/types.ts';
import { createRun, stepRun } from '../product/run.ts';
import { plantStatus } from '../sim/engine.ts';
import { sectionColor, plantColor, STATE } from './palette.ts';
import { carryDetail, collectDay, createDetail, finishDetail, type SideDetail } from './detail.ts';

export const BLACKOUT = 0.5; // the engine's blackout line for life support
export const AIR_DANGER = 5000; // ppm, the engine's air danger line (OSHA PEL / NIOSH REL)
export const PLANTS = 6;
/** Every built module, the same set the results file (src/sim/gate.ts) calls "with". */
export const WITH_TOOLS: ToolSet = { ...NO_TOOLS, ...Object.fromEntries(BUILT.map((k) => [k, true])) };

/** Days shown per disaster: 30, or 60 for the slow ones that cannot end before day 60. */
export function daysFor(id: string): number {
  return id === 'aging' || id === 'crowding' ? 60 : 30;
}

export interface SideData {
  /** (D+1) × SECTION_COUNT × 3, linear-ish RGB 0..1 per section per day. */
  color: Float32Array;
  /** (D+1) × SECTION_COUNT, 1 when the air is unsafe (pulses red). */
  pulse: Float32Array;
  /** (D+1) × SECTION_COUNT, the state code (STATE.*). */
  state: Uint8Array;
  /** (D+1) × PLANTS × 3, plant colors. */
  plant: Float32Array;
  /** (D+1) × PLANTS, 1 = online at the day's end and no trip that day. */
  plantOn: Uint8Array;
  deaths: number[]; // cumulative, length D+1 (day 0 = 0)
  dark: number[]; // dark sections at the day's worst hour (not counting lost sections), length D+1
  endDay: number | null; // the day the run ended (stable or lost), if within D
  endKind: 'stable' | 'lost' | null;
  /** Workstation detail (#/demo only; the film does not collect it). */
  detail?: SideDetail;
}

export interface TwinData {
  id: string;
  seed: number;
  days: number;
  without: SideData;
  with: SideData;
  ms: number;
}

function darkCount(f: Frame): number {
  let n = 0;
  for (const s of f.sections) if (!s.lost && s.lifeSupport < BLACKOUT) n++;
  return n;
}

function runSide(id: string, seed: number, tools: ToolSet, withSide: boolean, D: number, withDetail: boolean): SideData {
  const N = SECTION_COUNT;
  const out: SideData = {
    color: new Float32Array((D + 1) * N * 3),
    pulse: new Float32Array((D + 1) * N),
    state: new Uint8Array((D + 1) * N),
    plant: new Float32Array((D + 1) * PLANTS * 3),
    plantOn: new Uint8Array((D + 1) * PLANTS),
    deaths: [],
    dark: [],
    endDay: null,
    endKind: null,
  };
  const det = withDetail ? createDetail(D) : null;
  if (det) out.detail = det;
  let run = createRun(id, seed, tools);
  const rgb: [number, number, number] = [0, 0, 0];

  const write = (d: number, worst: Frame, co2Max: Float32Array, lostEnd: boolean[], tripped: Set<number>) => {
    for (let i = 0; i < N; i++) {
      const s = worst.sections[i];
      const st = sectionColor(s.lifeSupport, s.power, co2Max[i], lostEnd[i], withSide, rgb);
      out.color.set(rgb, (d * N + i) * 3);
      out.state[d * N + i] = st;
      out.pulse[d * N + i] = st === STATE.air ? 1 : 0;
    }
    const ps = plantStatus(run.sim);
    for (let k = 0; k < PLANTS; k++) {
      const on = ps[k].online && !tripped.has(k);
      out.plantOn[d * PLANTS + k] = on ? 1 : 0;
      plantColor(on, ps[k].capacity, rgb);
      out.plant.set(rgb, (d * PLANTS + k) * 3);
    }
    out.deaths.push(run.sim.totals.deaths);
  };

  // Day 0: the starting state.
  const f0 = run.sim.lastFrame;
  const co0 = new Float32Array(N);
  for (let i = 0; i < N; i++) co0[i] = f0.sections[i].co2;
  write(0, f0, co0, f0.sections.map((s) => s.lost), new Set());
  out.dark.push(darkCount(f0));
  if (det) collectDay(det, 0, run, null, f0, f0.hour, []);

  let lastDay = 0;
  for (let d = 1; d <= D && !run.sim.end; d++) {
    const r = stepRun(run, tools);
    run = r.run;
    let worst = r.frames[0];
    let worstN = -1;
    const co2Max = new Float32Array(N);
    for (const f of r.frames) {
      const n = darkCount(f);
      if (n > worstN) { worstN = n; worst = f; }
      for (let i = 0; i < N; i++) if (f.sections[i].co2 > co2Max[i]) co2Max[i] = f.sections[i].co2;
    }
    const tripped = new Set<number>();
    for (const e of r.events) {
      const m = / · (?:EVENT: )?Plant (\d) tripped/.exec(e);
      if (m) tripped.add(Number(m[1]) - 1);
    }
    const end = r.frames[r.frames.length - 1];
    write(d, worst, co2Max, end.sections.map((s) => s.lost), tripped);
    out.dark.push(Math.max(0, worstN));
    if (det) collectDay(det, d, run, r.frames, worst, worst.hour, r.events);
    lastDay = d;
    if (run.sim.end) { out.endDay = run.sim.end.day; out.endKind = run.sim.end.kind; }
  }
  // Carry the last day forward.
  for (let d = lastDay + 1; d <= D; d++) {
    out.color.copyWithin(d * N * 3, lastDay * N * 3, (lastDay + 1) * N * 3);
    out.pulse.copyWithin(d * N, lastDay * N, (lastDay + 1) * N);
    out.state.copyWithin(d * N, lastDay * N, (lastDay + 1) * N);
    out.plant.copyWithin(d * PLANTS * 3, lastDay * PLANTS * 3, (lastDay + 1) * PLANTS * 3);
    out.plantOn.copyWithin(d * PLANTS, lastDay * PLANTS, (lastDay + 1) * PLANTS);
    out.deaths.push(out.deaths[lastDay]);
    // A stable Hollow has no dark sections; a lost run keeps its last count.
    out.dark.push(out.dark[lastDay]);
  }
  if (det) { carryDetail(det, lastDay); finishDetail(det); }
  return out;
}

export function computeTwin(id: string, seed: number, D = daysFor(id), detail = false): TwinData {
  const t0 = Date.now();
  const without = runSide(id, seed, NO_TOOLS, false, D, detail);
  const withSide = runSide(id, seed, WITH_TOOLS, true, D, detail);
  return { id, seed, days: D, without, with: withSide, ms: Date.now() - t0 };
}

/** The held-out test seed whose deaths with Blackout Warning are closest to the mean over the test seeds (ties: lowest seed). */
export function typicalSeed(perSeed: { seed: number; withDeaths: number }[] | undefined, mean: number | undefined): number {
  if (!perSeed?.length || mean === undefined) return 14;
  let best = perSeed[0];
  for (const p of perSeed) {
    const a = Math.abs(p.withDeaths - mean);
    const b = Math.abs(best.withDeaths - mean);
    if (a < b || (a === b && p.seed < best.seed)) best = p;
  }
  return best.seed;
}
