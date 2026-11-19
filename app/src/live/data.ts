// Live data for one balancing area: fetch /api/eia, turn it into hourly rows, score with warn_grid.
// The brief page also uses `getLiveRisk`.

import { modelUrl, type ModelFile } from '../contracts.ts';
import { isModelFile, predict } from '../model/evaluate.ts';
import { featureVector, featuresAt, prepareRows, type HourRow } from '../model/features.ts';

/** The response of app/api/eia.ts (and the shape of the saved sample). */
export interface EiaPayload {
  ba: string;
  fetchedAt: string;
  source: 'eia' | 'sample';
  note?: string;
  region: { period: string; type: string; value: string | number | null }[];
  fuel: { period: string; fueltype: string; value: string | number | null }[];
}

const REGION_FIELD: Record<string, keyof Omit<HourRow, 't'>> = { D: 'demand', DF: 'forecast', NG: 'netgen', TI: 'interchange' };
// EIA fuel codes for the five fuels the feature table uses.
const FUEL_FIELD: Record<string, keyof Omit<HourRow, 't'>> = { NG: 'gen_gas', COL: 'gen_coal', NUC: 'gen_nuclear', WND: 'gen_wind', SUN: 'gen_solar' };

const HOUR = 3_600_000;

/** "2026-11-18T05" (UTC, end of hour) -> ms at the START of that hour, as in the feature table. */
function periodStart(period: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(period);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4]) - HOUR : null;
}

function num(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** One row per hour, sorted by time. A value EIA did not send stays null (the model reads it as missing). */
export function toHourRows(p: Pick<EiaPayload, 'region' | 'fuel'>): HourRow[] {
  const byT = new Map<number, HourRow>();
  const row = (period: string): HourRow | null => {
    const t = periodStart(String(period));
    if (t == null) return null;
    let r = byT.get(t);
    if (!r) {
      r = { t, demand: null, forecast: null, netgen: null, interchange: null, gen_gas: null, gen_coal: null, gen_nuclear: null, gen_wind: null, gen_solar: null };
      byT.set(t, r);
    }
    return r;
  };
  for (const x of p.region ?? []) {
    const f = REGION_FIELD[x.type];
    const r = f && row(x.period);
    if (r && f) r[f] = num(x.value);
  }
  for (const x of p.fuel ?? []) {
    const f = FUEL_FIELD[x.fueltype];
    const r = f && row(x.period);
    if (r && f) r[f] = num(x.value);
  }
  const rows = prepareRows([...byT.values()]);
  // The newest hours often arrive without demand. "Now" is the latest hour that has it.
  while (rows.length && rows[rows.length - 1].demand == null) rows.pop();
  return rows;
}

function isPayload(v: unknown): v is EiaPayload {
  const p = v as EiaPayload | null;
  return !!p && Array.isArray(p.region) && Array.isArray(p.fuel);
}

/** Fetch live data. Throws an Error with a plain reason when it is not available. */
export async function fetchLive(ba: string): Promise<EiaPayload> {
  let res: Response;
  try {
    res = await fetch(`/api/eia?ba=${encodeURIComponent(ba)}`);
  } catch {
    throw new Error('The live data service did not answer.');
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Not JSON: the function is not deployed here (a static server sends the app page instead).
    throw new Error('The live data service is not set up on this server.');
  }
  if (!res.ok || !isPayload(body)) {
    const msg = (body as { error?: string } | null)?.error;
    throw new Error(msg ? `The live data service reported: ${msg}.` : `The live data service answered ${res.status}.`);
  }
  if (!body.region.length) throw new Error(`EIA has no recent data for ${ba}.`);
  return body;
}

export async function loadSample(): Promise<EiaPayload> {
  return (await import('./sample/eia-ERCO.json')).default as EiaPayload;
}

let modelPromise: Promise<ModelFile | null> | null = null;
/** The warn_grid model, or null when the file is not there yet. */
export function loadWarnModel(): Promise<ModelFile | null> {
  modelPromise ??= fetch(modelUrl('warn_grid'))
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => (isModelFile(m) && m.objective === 'binary' ? m : null))
    .catch(() => null);
  return modelPromise;
}

export interface RiskPoint {
  t: number;       // start of the hour, UTC ms
  p: number;       // model probability that an event starts within 48 h
}

/** Model output for each of the last `hours` rows. */
export function scoreSeries(model: ModelFile, rows: HourRow[], hours = 168): RiskPoint[] {
  const out: RiskPoint[] = [];
  for (let i = Math.max(0, rows.length - hours); i < rows.length; i++) {
    out.push({ t: rows[i].t, p: predict(model, featureVector(model.features, featuresAt(rows, i))) });
  }
  return out;
}

export type LiveRisk =
  | { kind: 'live'; ba: string; p: number; threshold: number | null; t: number; fetchedAt: string }
  | { kind: 'none'; reason: string };

/** Risk now for one balancing area, or a plain reason why there is none. Never throws. */
export async function getLiveRisk(ba: string): Promise<LiveRisk> {
  try {
    const [payload, model] = await Promise.all([fetchLive(ba), loadWarnModel()]);
    if (!model) return { kind: 'none', reason: 'The warning model file is not available yet.' };
    const rows = toHourRows(payload);
    const last = scoreSeries(model, rows, 1)[0];
    if (!last) return { kind: 'none', reason: `EIA has no recent data for ${ba}.` };
    return { kind: 'live', ba, p: last.p, threshold: model.threshold, t: last.t, fetchedAt: payload.fetchedAt };
  } catch (err) {
    return { kind: 'none', reason: err instanceof Error ? err.message : 'Live data is not available.' };
  }
}
