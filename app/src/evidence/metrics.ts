// metrics.json as the pages read it. contracts.ts holds the frozen base type (Metrics). The models
// workstream adds optional keys (contracts/README.md, change log). Every key below that is not in
// Metrics is optional: a page shows a number only when metrics.json carries it.
import type { Metrics } from '../contracts.ts';

export type ModelResult = Metrics['models'][string] & {
  warned6h?: number;
  warned24h?: number;
  peopleRecall12h?: number | null;        // share of summed peak customers out in events warned >= 12 h
  customerHoursRecall12h?: number | null; // the same share of customer-outage-hours
};

export type DarkResult = NonNullable<Metrics['dark']> & {
  top10Overlap?: number;       // share of the k counties with the most dark hours that are in the model's top k
  top10History?: number;       // the same for "past mean dark hours"
  top10Chance?: number;        // mean k / counties
  withinEventSpearman?: number;
  historySpearman?: number;
  events?: number;
};

/** Results for one group of events (a season, or demand-record events). False alarms may be absent. */
export interface GroupResult {
  label?: string;
  models: Record<string, Partial<ModelResult> & { testEvents: number; warned12h: number }>;
}

export interface Period {
  trainYears: [number, number];
  testYears: [number, number];
  models: Record<string, ModelResult>;
  dark: DarkResult | null;
  seasons?: Record<string, GroupResult>; // for example "winter", "summer", "other"
  groups?: Record<string, GroupResult>;  // for example "demand_record", "other"
}

/** A test with an archived real weather forecast (being computed by the models workstream). */
export interface RealForecast extends Partial<ModelResult> {
  label?: string;
  testYears?: [number, number];
  note?: string;
  models?: Record<string, ModelResult>;
}

export interface MetricsV2 extends Metrics {
  models: Record<string, ModelResult>;
  dark: DarkResult | null;
  seasons?: Record<string, GroupResult>;
  groups?: Record<string, GroupResult>;
  dev?: Period;
  importance?: Record<string, { feature: string; gain: number }[]>;
  split?: { train: [string, string]; dev: [string, string]; test: [string, string] };
  labels?: Record<string, string>;
  realForecast?: RealForecast | null;
}

export const MODEL_LABEL: Record<string, string> = {
  warn_grid: 'Model: grid data only',
  warn_full: 'Model: grid, weather now, outages reported',
  warn_fcst: 'Model: with a weather forecast',
  rule_forecast_error: 'Rule: demand above its forecast',
  rule_hand: 'Rule: our earlier hand rule',
  rule_record: "Rule: tomorrow's forecast above this month's record",
  warn_fcst_real: 'Model with real 2024 weather forecasts',
  warn_fcst_observed: 'Model with the weather that happened (same 2024 hours)',
  warn_fcst_real2024: 'Model with real 2024 weather forecasts',
};

export const GROUP_LABEL: Record<string, string> = {
  demand_record: 'Demand-record events',
  other: 'Other (storm-like) events',
  winter: 'Winter (Dec to Feb)',
  summer: 'Summer (Jun to Aug)',
  other_months: 'Other months',
};

/** The real-forecast result as one ModelResult, or null when metrics.json does not have it yet. */
export function realForecastResult(m: MetricsV2): { r: Partial<ModelResult>; label: string; years?: [number, number]; note?: string } | null {
  const rf = m.realForecast;
  if (!rf) return null;
  const r = rf.warned12h != null ? rf : rf.models ? Object.values(rf.models)[0] : null;
  if (!r || r.warned12h == null) return null;
  return { r, label: 'Model with real archived weather forecasts', years: rf.testYears, note: rf.note };
}

export const pct1 = (x: number | null | undefined) => (x == null ? '' : `${(x * 100).toFixed(1)}%`);
export const pct0 = (x: number | null | undefined) => (x == null ? '' : `${Math.round(x * 100)}%`);

export async function fetchMetrics(): Promise<MetricsV2 | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}models/metrics.json`);
    return r.ok ? ((await r.json()) as MetricsV2) : null;
  } catch {
    return null;
  }
}
