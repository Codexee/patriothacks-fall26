import { createMemory, stepProduct } from '../product/index.ts';
import { NO_TOOLS, type Observation } from '../sim/types.ts';
import type { ProductLog } from '../product/types.ts';

export interface EiaHour { time: string; D: number | null; DF: number | null; NG: number | null }
export interface EiaDataset { respondent: string; rows: EiaHour[] }
export interface AdapterParameters {
  /** Assumed available-output / observed-dispatch ratio. This is not measured reserve capacity. */
  generationMultiplier: number;
  /** Trailing peak dispatch window; 1 uses the raw hourly generation reading. */
  trailingPeakHours: number;
}
export const UNTUNED: AdapterParameters = { generationMultiplier: 1, trailingPeakHours: 1 };
export type Timing = 'meter-time' | 'public-delay';
export interface HourResult {
  issueTime: string;
  meterTime: string | null;
  alert: boolean;
  log: NonNullable<ProductLog['earlyWarning']> | null;
}
const HOUR = 3_600_000;
const MODULES = { ...NO_TOOLS, earlyWarning: true };
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const easternHour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' });
const releaseCache = new Map<string, number>();

function localDate(time: number, timezone: string): string {
  let formatter = dateFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dateFormatters.set(timezone, formatter);
  }
  return formatter.format(time);
}
function baZone(respondent: string): string {
  return respondent === 'DUK' ? 'America/New_York' : 'America/Chicago';
}
function eastern11(date: string): number {
  const cached = releaseCache.get(date);
  if (cached !== undefined) return cached;
  const utcNoon = Date.parse(date + 'T12:00:00Z');
  const hour = Number(easternHour.format(utcNoon));
  const release = utcNoon + (11 - hour) * HOUR;
  releaseCache.set(date, release);
  return release;
}
/** NG for a BA operating day: conservative release at 11 ET the following day. */
function generationRelease(time: number, zone: string): number {
  const operatingDate = localDate(time - 1, zone); // hour ending midnight belongs to the preceding day
  const tomorrow = new Date(Date.parse(operatingDate + 'T12:00:00Z') + 24 * HOUR).toISOString().slice(0, 10);
  return eastern11(tomorrow);
}
/** DF target-day release: EIA current-day 11 ET, or ideal operator day-ahead access. */
function forecastRelease(time: number, zone: string, timing: Timing): number {
  const operatingDate = localDate(time - 1, zone);
  const date = timing === 'meter-time'
    ? new Date(Date.parse(operatingDate + 'T12:00:00Z') - 24 * HOUR).toISOString().slice(0, 10)
    : operatingDate;
  return eastern11(date);
}
const valid = (value: number | null): value is number => value !== null && Number.isFinite(value) && value > 0;
const validGeneration = (value: number | null): value is number => value !== null && Number.isFinite(value) && value >= 0;

/**
 * Replay one aggregate BA as one plant; fuel groups are never claimed to be individual plants.
 * Only the four public Observation kinds cross into the unchanged product runner.
 * Meter-time assumes immediate readings and operator day-ahead forecasts, not EIA publication timing.
 * Public-delay withholds generation and forecasts according to EIA's documented daily schedule.
 * Both modes use today's revised historical values, not archived original releases.
 */
export function replay(dataset: EiaDataset, parameters: AdapterParameters, timing: Timing = 'meter-time'): HourResult[] {
  if (!Number.isFinite(parameters.generationMultiplier) || parameters.generationMultiplier < 1 || parameters.trailingPeakHours < 1 || !Number.isInteger(parameters.trailingPeakHours)) {
    throw new Error('Invalid adapter parameters');
  }
  const rows = dataset.rows;
  const times = rows.map(r => Date.parse(r.time));
  if (!rows.length || times.some((t, i) => !Number.isFinite(t) || !/^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/.test(rows[i].time) || t % HOUR !== 0 || (i > 0 && t <= times[i - 1]))) {
    throw new Error('EIA hours must be unique, sorted UTC hour endings');
  }
  const zone = baZone(dataset.respondent);
  const releases = times.map(t => timing === 'meter-time' ? t : generationRelease(t, zone));
  const forecastReleases = times.map(t => forecastRelease(t, zone, timing));
  const byTime = new Map(times.map((t, i) => [t, i]));
  const base = rows.find(r => valid(r.D))?.D;
  if (!valid(base ?? null)) throw new Error('No valid demand');
  const reference = base!;
  let memory = createMemory(), cursor = -1, lastMeter = -1;
  const results: HourResult[] = [];
  for (let issue = 0; issue < rows.length; issue++) {
    const now = times[issue];
    const obs: Observation[] = [];
    while (cursor + 1 < rows.length && releases[cursor + 1] <= now) {
      cursor++;
      const r = rows[cursor];
      // Reset instead of inventing a zero-output outage or interpolating missing meter hours.
      if (!valid(r.D) || !validGeneration(r.NG) || (lastMeter >= 0 && times[cursor] - times[lastMeter] !== HOUR)) {
        memory = createMemory();
        lastMeter = -1;
        obs.length = 0;
        if (!valid(r.D) || !validGeneration(r.NG)) continue;
      }
      let output = r.NG!;
      for (let back = 1; back < parameters.trailingPeakHours; back++) {
        const previous = rows[cursor - back];
        if (!previous || !validGeneration(previous.NG) || times[cursor] - times[cursor - back] !== back * HOUR) break;
        output = Math.max(output, previous.NG);
      }
      const hour = Math.round(times[cursor] / HOUR);
      obs.push({ kind: 'plantMeter', plant: 0, level: 1, hour, output: output * parameters.generationMultiplier });
      obs.push({ kind: 'feeder', hour, served: r.D!, demand: r.D! });
      lastMeter = cursor;
    }
    if (lastMeter >= 0) {
      const meter = rows[lastMeter];
      const meterHour = Math.round(times[lastMeter] / HOUR);
      // Constant normalization reference avoids re-scaling past outlooks as each new hour arrives.
      // For unavailable future DF, persist last measured demand. Never use future realized D or NG.
      const demand = Array.from({ length: 73 }, (_, j) => {
        const target = times[lastMeter] + (j - 24) * HOUR;
        const k = byTime.get(target);
        const forecast = k !== undefined && forecastReleases[k] <= now ? rows[k].DF : null;
        return (valid(forecast) ? forecast : meter.D!) / reference;
      });
      obs.push({ kind: 'outlook', fromHour: meterHour - 24, supply: new Array(73).fill(1), demand });
      obs.push({ kind: 'census', level: 1, col: 0, day: issue + 1,
        people: 1, demand: meter.D!, critical: meter.D! * 0.25, facilities: [], food: 0 });
    }
    const step = stepProduct(obs, memory, MODULES, issue + 1);
    memory = step.memory;
    results.push({ issueTime: rows[issue].time, meterTime: lastMeter >= 0 ? rows[lastMeter].time : null,
      alert: step.outputs.some(o => o.kind === 'alert' && o.action === 'shed'), log: step.log.earlyWarning ?? null });
  }
  return results;
}
