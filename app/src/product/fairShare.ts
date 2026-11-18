// PROTOTYPE module: Fair Share (problem 2). Plans tomorrow's power from the census and the capacity forecast:
// life-critical load (air, recyclers, clinics) in every section first, then the same share of the rest for everyone,
// with extra cooling for the levels whose sensors read hot. The plan replaces the Directorate's "upper levels first".
import { LEVELS, SECTIONS_PER_LEVEL, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

const SAFE_LOAD = 0.88; // same margin as Early Warning
const HOT_WETBULB = 29; // °C: give these levels more cooling
const HOT_BOOST = 1.5;

export function fairShare(m: ProductMemory, day: number, capForecast: number | null, peakFactor: number | null):
  { output: Output; log: NonNullable<ProductLog['fairShare']> } | null {
  if (!m.census.demand.length) return null;
  // The census is taken at the end of the day, when load is low. Plan for the daily peak: from Early Warning's
  // demand forecast, or else from yesterday's highest load on the switchyard meter.
  let pf = peakFactor;
  if (pf === null) {
    const last = m.feederDemand.slice(-24);
    pf = last.length ? Math.max(...last) / Math.max(1, last[last.length - 1]) : 1;
  }
  const demand = m.census.demand.map((v) => (v || 0) * pf!);
  const critical = m.census.critical.map((v) => (v || 0) * pf!);
  // Without Early Warning: plan for the median plant output of the last 24 h (react, do not forecast).
  let cap = capForecast;
  if (cap === null || !Number.isFinite(cap)) {
    const hours = m.plantOut[0]?.length ?? 0;
    if (hours === 0) return null;
    const sums: number[] = [];
    for (let h = Math.max(0, hours - 24); h < hours; h++) {
      let sum = 0;
      for (const series of m.plantOut) sum += series[h] ?? 0;
      sums.push(sum);
    }
    sums.sort((a, b) => a - b);
    cap = sums[Math.floor(sums.length / 2)];
  }
  const available = SAFE_LOAD * cap;
  const n = demand.length;
  const C = critical.reduce((s, v) => s + (v || 0), 0);
  const N = demand.reduce((s, v, i) => s + Math.max(0, (v || 0) - (critical[i] || 0)), 0);
  const cf = C > 0 ? Math.min(1, available / C) : 1;
  let left = Math.max(0, available - cf * C);

  // Weighted max-min: hot levels get HOT_BOOST × the base share (capped at 1).
  const hotLevels: number[] = [];
  const w = new Array<number>(n).fill(1);
  for (let l = 1; l <= LEVELS; l++) {
    const wet = m.sensorWet[l - 1];
    if (wet !== null && wet > HOT_WETBULB) {
      hotLevels.push(l);
      for (let c = 0; c < SECTIONS_PER_LEVEL; c++) w[(l - 1) * SECTIONS_PER_LEVEL + c] = HOT_BOOST;
    }
  }
  // Farms: their lamps are non-critical in a day, but critical over weeks (food). Give farm sections full power
  // first, then share what is left.
  const farm = m.census.facilities.map((f) => f.includes('farm'));
  const farmNeed = demand.reduce((s, v, i) => s + (farm[i] ? Math.max(0, v - critical[i]) : 0), 0);
  left = Math.max(0, left - farmNeed);
  const nonDemand = demand.map((v, i) => (farm[i] ? 0 : Math.max(0, (v || 0) - (critical[i] || 0))));
  // Find the base share r so that Σ min(1, r·w_i)·N_i = left (bisection).
  let lo = 0, hi = 1;
  const used = (r: number) => nonDemand.reduce((s, d, i) => s + Math.min(1, r * w[i]) * d, 0);
  if (used(1 * Math.max(...w)) <= left) { lo = hi = Math.max(...w); } else {
    for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (used(mid) > left) hi = mid; else lo = mid; }
  }
  const r = lo;
  // Every section always asks for all of its life support. If there is not enough, the sim shares the shortfall
  // equally across sections (never "upper levels first"); a plan of 0% would switch off air even after plants return.
  const crit = new Array<number>(n).fill(1);
  const non = w.map((wi, i) => (farm[i] ? 1 : Math.min(1, r * wi)));
  const share = N > 0 ? Math.min(1, left / N) : 1;
  return {
    output: {
      kind: 'allocation', module: 'fairShare', crit, non,
      text: `Day ${day} plan: life support ${Math.round(cf * 100)}% in every section; ${Math.round(share * 100)}% of other power for everyone${hotLevels.length ? `, more cooling on ${hotLevels.length} hot levels` : ''}.`,
    },
    log: { available, critical: C, nonCriticalShare: share, criticalShare: cf, hotLevels },
  };
}
