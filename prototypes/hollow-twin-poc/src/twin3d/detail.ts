// Per-day detail for the workstation panels (#/demo). Every value here is read from the sim run (frames, events,
// totals, residents' observations, the read-only engine probe) or from Blackout Warning's own daily log and outputs.
// Nothing is estimated or invented. The film page does not collect it.
import { LEVELS, SECTION_COUNT, type Frame, type Output } from '../sim/types.ts';
import type { Run } from '../product/run.ts';
import type { ProductLog } from '../product/types.ts';
import { ENGINE_CONSTANTS, twinProbe } from '../sim/engine.ts';

export const PLANTS = 6;
const BLACKOUT = 0.5;

export type EventType = 'trip' | 'alert' | 'level' | 'end' | 'other';
export interface SimEvent { day: number; hour: number; type: EventType; text: string }
export interface AlertSent { id: string; action: string; from: number; to: number; hours: number; amount: number | null; text: string }
export interface ObsDay {
  total: number;
  byKind: Record<string, number>;
  outageDark: number; // residents' outage reports: power lost
  outageBack: number; // residents' outage reports: power back
  reports: Record<string, number>; // resident reports by topic (count of reports)
  selfPeople: number; // residents' own head count, all sections
  censusPeople: number; // the Directorate's census, all sections
}

export interface SideDetail {
  days: number;
  worstHour: Int8Array; // (D+1)
  airDeaths: number[]; // cumulative
  plantsMin: Int8Array; // plants online, lowest hour of the day (from the 24 frames)
  plantsMax: Int8Array;
  plantHours: Float32Array; // (D+1): plant-hours offline that day (6 × 24 − Σ online), from frames
  capacity: Float32Array; // (D+1): available capacity at the day's last hour ÷ normal demand (probe)
  demand: Float32Array; // (D+1): full demand at the day's last hour ÷ normal demand (probe)
  served: Float32Array; // (D+1) × 24: hourly share of demand served, weighted by the census demand of each section
  plant: Float32Array; // (D+1) × 6 × 3: health, scenario loss factor (share left), online (1/0) at the day's end
  plantUntil: Int32Array; // (D+1) × 6: absolute hour the plant is back online
  plantTrips: Int16Array; // (D+1) × 6: trips so far
  plantOff: Float32Array; // (D+1) × 6: offline hours so far (trip hour to repair end, from events + engine state)
  levelDark: Float32Array; // (D+1) × 50: dark-hour equivalents on each level that day (engine's darkLevel, daily diff)
  people: Float32Array; // (D+1) × 400: residents at the day's end
  ls: Float32Array; // (D+1) × 400: life-support power share at the worst hour
  power: Float32Array; // (D+1) × 400: power share at the worst hour
  co2: Float32Array; // (D+1) × 400: highest CO2 of the day (ppm)
  darkH: Float32Array; // (D+1) × 400: hours so far with life support under half (from the hourly frames)
  warned: Uint8Array; // (D+1) × 400: alerts Blackout Warning sent to the section's level that day (bits: 1 = blackout warning "prepare", 2 = save-power request, 4 = other)
  startPeople: Float32Array; // 400
  blackoutPH: number[]; // cumulative person-hours in a blackout
  warnedPH: number[]; // of those, person-hours warned and prepared
  events: SimEvent[];
  obs: (ObsDay | null)[];
  log: (NonNullable<ProductLog['blackoutWarning']> | null)[];
  seen: (Record<string, number> | null)[]; // observation counts the module read
  alerts: AlertSent[][];
  frames: number; // hourly frames read
}

export function createDetail(D: number): SideDetail {
  const N = SECTION_COUNT;
  return {
    days: D,
    worstHour: new Int8Array(D + 1), airDeaths: [], plantsMin: new Int8Array(D + 1), plantsMax: new Int8Array(D + 1),
    plantHours: new Float32Array(D + 1), capacity: new Float32Array(D + 1), demand: new Float32Array(D + 1),
    served: new Float32Array((D + 1) * 24), plant: new Float32Array((D + 1) * PLANTS * 3), plantUntil: new Int32Array((D + 1) * PLANTS),
    plantTrips: new Int16Array((D + 1) * PLANTS), plantOff: new Float32Array((D + 1) * PLANTS), levelDark: new Float32Array((D + 1) * LEVELS),
    people: new Float32Array((D + 1) * N), ls: new Float32Array((D + 1) * N), power: new Float32Array((D + 1) * N),
    co2: new Float32Array((D + 1) * N), darkH: new Float32Array((D + 1) * N), warned: new Uint8Array((D + 1) * N),
    startPeople: new Float32Array(N), blackoutPH: [], warnedPH: [], events: [], obs: [], log: [], seen: [], alerts: [], frames: 0,
  };
}

const STAMP = /^Day (\d+) (\d\d):00 · (.*)$/;
function typeOf(text: string): EventType {
  if (/tripped/.test(text)) return 'trip';
  if (/ → L\d/.test(text)) return 'alert'; // any module's alert: "Water Safety → L36–40: …"
  if (/Level \d+ lost/.test(text)) return 'level';
  return 'other';
}

function obsOf(run: Run): ObsDay {
  const o: ObsDay = { total: 0, byKind: {}, outageDark: 0, outageBack: 0, reports: {}, selfPeople: 0, censusPeople: 0 };
  for (const x of run.sim.observations) {
    o.total++;
    o.byKind[x.kind] = (o.byKind[x.kind] ?? 0) + 1;
    if (x.kind === 'outage') { if (x.dark) o.outageDark++; else o.outageBack++; }
    else if (x.kind === 'reports') o.reports[x.topic] = (o.reports[x.topic] ?? 0) + x.count;
    else if (x.kind === 'selfCount') o.selfPeople += x.people;
    else if (x.kind === 'census') o.censusPeople += x.people;
  }
  return o;
}

/** Records day d. `frames` is null for day 0 (the starting state, with its last frame as the snapshot). */
export function collectDay(det: SideDetail, d: number, run: Run, frames: Frame[] | null, worst: Frame, worstHour: number, events: string[]): void {
  const N = SECTION_COUNT;
  const p = twinProbe(run.sim);
  const t = run.sim.totals;
  if (d === 0) det.startPeople.set(p.startPeople);
  det.worstHour[d] = worstHour;
  det.airDeaths.push(t.airDeaths);
  det.blackoutPH.push(t.blackoutPersonHours);
  det.warnedPH.push(t.warnedPersonHours);
  det.capacity[d] = p.capacity / p.normal;
  det.demand[d] = p.demand / p.normal;

  // Census demand per section (residents can see it); the weights for the hourly served share.
  const w = new Float64Array(N);
  let haveCensus = false;
  for (const x of run.sim.observations) if (x.kind === 'census') { w[(x.level - 1) * 8 + x.col] = x.demand; haveCensus = true; }
  if (!haveCensus) for (let i = 0; i < N; i++) w[i] = p.people[i];

  const prevDark = d > 0 ? det.darkH.subarray((d - 1) * N, d * N) : null;
  const darkNow = det.darkH.subarray(d * N, (d + 1) * N);
  if (prevDark) darkNow.set(prevDark);
  const hours = frames ?? [worst];
  let pmin = 99, pmax = -1, online = 0;
  for (let hh = 0; hh < hours.length; hh++) {
    const f = hours[hh];
    pmin = Math.min(pmin, f.plantsOnline); pmax = Math.max(pmax, f.plantsOnline); online += f.plantsOnline;
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) {
      const s = f.sections[i];
      if (s.lost) continue;
      a += s.power * w[i]; b += w[i];
      if (frames && s.lifeSupport < BLACKOUT) darkNow[i] += 1;
    }
    if (frames) det.served[d * 24 + f.hour] = b > 0 ? a / b : 0;
  }
  if (!frames) det.served.fill(1, 0, 24);
  det.frames += frames ? frames.length : 0;
  det.plantsMin[d] = pmin; det.plantsMax[d] = pmax;
  det.plantHours[d] = frames ? PLANTS * frames.length - online : 0;

  for (let i = 0; i < N; i++) {
    const s = worst.sections[i];
    det.people[d * N + i] = p.people[i];
    det.ls[d * N + i] = s.lifeSupport;
    det.power[d * N + i] = s.power;
    let co = s.co2;
    if (frames) for (const f of frames) if (f.sections[i].co2 > co) co = f.sections[i].co2;
    det.co2[d * N + i] = co;
  }

  // Events of the day, with their hour.
  const tripsToday: { k: number; hour: number }[] = [];
  for (const e of events) {
    const m = STAMP.exec(e);
    const ev: SimEvent = m ? { day: Number(m[1]), hour: Number(m[2]), type: typeOf(m[3]), text: m[3] } : { day: d, hour: 0, type: 'other', text: e };
    det.events.push(ev);
    const tm = /Plant (\d) tripped/.exec(ev.text);
    if (tm) tripsToday.push({ k: Number(tm[1]) - 1, hour: (ev.day - 1) * 24 + ev.hour });
  }
  if (run.sim.end && run.sim.end.day === d) {
    det.events.push({ day: d, hour: 23, type: 'end', text: run.sim.end.kind === 'stable' ? `Run ended: the Hollow is stable (${ENGINE_CONSTANTS.stableDays} days in a row without a blackout)` : `Run ended: ${run.sim.end.reason}` });
  }

  // Plants: state at the day's end; trips and offline hours so far.
  const dayStart = (d - 1) * 24, dayEnd = d * 24;
  for (let k = 0; k < PLANTS; k++) {
    const pl = p.plants[k];
    det.plant.set([pl.health, pl.loss, pl.online ? 1 : 0], (d * PLANTS + k) * 3);
    det.plantUntil[d * PLANTS + k] = pl.offlineUntil;
    const prevT = d > 0 ? det.plantTrips[(d - 1) * PLANTS + k] : 0;
    const prevO = d > 0 ? det.plantOff[(d - 1) * PLANTS + k] : 0;
    const mine = tripsToday.filter((x) => x.k === k).sort((a, b) => a.hour - b.hour);
    det.plantTrips[d * PLANTS + k] = prevT + mine.length;
    let off = 0;
    if (d > 0) {
      // Offline at the start of the day from an earlier trip: until its repair end (or the first trip today).
      const before = det.plantUntil[(d - 1) * PLANTS + k];
      if (before > dayStart) off += Math.min(before, mine[0]?.hour ?? dayEnd, dayEnd) - dayStart;
      for (let j = 0; j < mine.length; j++) {
        const until = j === mine.length - 1 ? Math.min(pl.offlineUntil, dayEnd) : mine[j + 1].hour;
        off += Math.max(0, until - mine[j].hour);
      }
    }
    det.plantOff[d * PLANTS + k] = prevO + off;
  }

  // Dark-hour equivalents per level today (engine's darkLevel is cumulative).
  for (let l = 0; l < LEVELS; l++) det.levelDark[d * LEVELS + l] = p.darkLevel[l];

  // Residents' observations of the day, and the module's own log and alerts.
  det.obs.push(frames ? obsOf(run) : null);
  det.log.push(frames ? run.log?.blackoutWarning ?? null : null);
  det.seen.push(frames ? run.log?.seen ?? null : null);
  const sent: AlertSent[] = [];
  for (const o of (frames ? run.outputs : []) as Output[]) {
    if (o.kind !== 'alert') continue;
    sent.push({ id: o.id, action: o.action, from: o.from, to: o.to, hours: o.hours, amount: o.amount ?? null, text: o.text });
    const bit = o.action === 'prepare' ? 1 : o.action === 'shed' ? 2 : 4;
    for (let l = o.from; l <= o.to; l++) for (let c = 0; c < 8; c++) det.warned[d * N + (l - 1) * 8 + c] |= bit;
  }
  det.alerts.push(sent);
}

/** After a run ends early: keep the last day's values for the remaining days (no new events). */
export function carryDetail(det: SideDetail, last: number): void {
  const N = SECTION_COUNT;
  for (let d = last + 1; d <= det.days; d++) {
    det.worstHour[d] = det.worstHour[last];
    det.airDeaths.push(det.airDeaths[last]);
    det.blackoutPH.push(det.blackoutPH[last]);
    det.warnedPH.push(det.warnedPH[last]);
    det.plantsMin[d] = det.plantsMin[last]; det.plantsMax[d] = det.plantsMax[last];
    det.capacity[d] = det.capacity[last]; det.demand[d] = det.demand[last];
    det.served.copyWithin(d * 24, last * 24, (last + 1) * 24);
    for (const [arr, n] of [[det.plant, PLANTS * 3], [det.plantUntil, PLANTS], [det.plantTrips, PLANTS], [det.plantOff, PLANTS], [det.levelDark, LEVELS],
      [det.people, N], [det.ls, N], [det.power, N], [det.co2, N], [det.darkH, N]] as const) {
      (arr as Float32Array).copyWithin(d * n, last * n, (last + 1) * n);
    }
    det.obs.push(null); det.log.push(null); det.seen.push(null); det.alerts.push([]);
  }
}

/** Converts the cumulative darkLevel to per-day amounts, after all days are collected. */
export function finishDetail(det: SideDetail): void {
  for (let d = det.days; d >= 1; d--) {
    for (let l = 0; l < LEVELS; l++) det.levelDark[d * LEVELS + l] = Math.max(0, det.levelDark[d * LEVELS + l] - det.levelDark[(d - 1) * LEVELS + l]);
  }
  det.levelDark.fill(0, 0, LEVELS);
}

export function detailBuffers(det: SideDetail): ArrayBuffer[] {
  return [det.worstHour, det.plantsMin, det.plantsMax, det.plantHours, det.capacity, det.demand, det.served, det.plant, det.plantUntil,
    det.plantTrips, det.plantOff, det.levelDark, det.people, det.ls, det.power, det.co2, det.darkH, det.warned, det.startPeople]
    .map((a) => a.buffer as ArrayBuffer);
}
