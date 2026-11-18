// PROTOTYPE module: Early Warning (problem 1). Forecasts plant output against demand 36 h ahead from
//  - the plant feeder meters (each plant's own trend, so a plant that is wearing out is caught), and
//  - the public weather and grid outlook (so a storm is seen before it arrives),
// then asks residents to switch off non-critical load before the plants overload and trip.
import type { Output } from '../sim/types.ts';
import type { Outlook, ProductLog, ProductMemory } from './types.ts';

const HORIZON = 36;
const SAFE_LOAD = 0.88; // keep plants below 88% load: at ≥ 99% they trip from stress, one trip can cascade,
                        // and the forecast can be about 6% wrong
const ASSUMED_COMPLIANCE = 0.85;
const OFFLINE_HOURS = 12; // a tripped plant is assumed to stay off this long

function fit(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  if (n < 2) return { a: ys[0] ?? 0, b: 0 };
  const mx = xs.reduce((p, q) => p + q, 0) / n;
  const my = ys.reduce((p, q) => p + q, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx > 0 ? sxy / sxx : 0;
  return { a: my - b * mx, b };
}

/** Value of an outlook at an absolute hour, or null when the outlook does not cover it. */
function at(o: Outlook | null, key: 'supply' | 'demand', hour: number): number | null {
  if (!o) return null;
  const i = hour - o.fromHour;
  return i >= 0 && i < o[key].length ? o[key][i] : null;
}

/** Capacity forecast for hours 1..HORIZON after the last meter reading. */
export function forecastCapacity(m: ProductMemory): { capAt: (t: number) => number; capNow: number; lastHour: number } | null {
  const hist = m.plantOut;
  if (!hist.length || hist[0].length < 24) return null;
  const hours = m.plantHours.slice(-24);
  const lastHour = hours[hours.length - 1];
  let capNow = 0;
  const perPlant: ((t: number) => number)[] = [];
  for (const series of hist) {
    const last24 = series.slice(-24);
    let lastValid = 0;
    for (const v of last24) if (v !== null) lastValid = v;
    capNow += lastValid;
    // Normalize each reading by the supply the outlook expected that hour: what is left is the plant's own health.
    const xs: number[] = [], ys: number[] = [];
    last24.forEach((v, i) => {
      if (v === null || v <= 0) return;
      const sup = at(m.outlookPrev, 'supply', hours[i]) ?? 1;
      xs.push(i); ys.push(v / Math.max(0.05, sup));
    });
    const meanNorm = ys.length ? ys.reduce((p, q) => p + q, 0) / ys.length : 0;
    const maxNorm = ys.length ? Math.max(...ys) : 0;
    const supNext = (t: number) => at(m.outlook, 'supply', lastHour + t) ?? at(m.outlookPrev, 'supply', lastHour + t) ?? 1;
    if (lastValid === 0) {
      perPlant.push((t) => (t > OFFLINE_HOURS ? meanNorm * supNext(t) : 0));
      continue;
    }
    // A plant's own health (output ÷ supply) never improves by itself: rising output comes from supply, which the
    // outlook already covers. So the health trend may only stay flat or fall, and never exceeds what was measured.
    const { a, b } = fit(xs, ys);
    const slope = Math.min(0, b);
    const level = Math.min(maxNorm, a + b * 23); // health now, from the fit
    perPlant.push((t) => Math.max(0, Math.min(maxNorm, level + slope * t)) * supNext(t));
  }
  return { capAt: (t) => perPlant.reduce((s, f) => s + f(t), 0), capNow, lastHour };
}

export function earlyWarning(m: ProductMemory, day: number, shedSelf: boolean):
  { outputs: Output[]; log: NonNullable<ProductLog['earlyWarning']>; capForecast: number; peakFactor: number } | null {
  const fc = forecastCapacity(m);
  if (!fc || !m.census.demand.length) return null;
  const { capAt, capNow, lastHour } = fc;

  // Demand: the census total, divided by the load multiplier at that hour, times the outlook's multiplier ahead.
  const d0 = m.census.demand.reduce((s, v) => s + (v || 0), 0);
  const crit0 = m.census.critical.reduce((s, v) => s + (v || 0), 0);
  const multNow = at(m.outlookPrev, 'demand', lastHour) ?? at(m.outlook, 'demand', lastHour + 1) ?? 1;
  const demandAt = (t: number) => (d0 / Math.max(0.05, multNow)) * (at(m.outlook, 'demand', lastHour + t) ?? multNow);

  let worst = 0, worstT = 1;
  for (let t = 1; t <= HORIZON; t++) {
    const r = demandAt(t) / Math.max(1, SAFE_LOAD * capAt(t));
    if (r > worst) { worst = r; worstT = t; }
  }
  // For tomorrow's plan: the lowest capacity in the next 24 h. If plants are offline now, plan for the hours after
  // they return; before that there is nothing to share.
  const offlineNow = m.plantOut.some((series) => (series[series.length - 1] ?? 1) === 0);
  let capForecast = Infinity;
  for (let t = offlineNow ? OFFLINE_HOURS + 1 : 1; t <= 24; t++) capForecast = Math.min(capForecast, capAt(t));
  let peak = 0;
  for (let t = 1; t <= 24; t++) peak = Math.max(peak, demandAt(t));
  const peakFactor = peak / Math.max(1, d0);

  const dF = demandAt(worstT), cF = capAt(worstT);
  const critAt = crit0 * (dF / Math.max(1, d0));
  const shed = worst > 1 ? Math.min(0.9, Math.max(0.05, (dF - SAFE_LOAD * cF) / Math.max(1, dF - critAt) / ASSUMED_COMPLIANCE)) : 0;
  const outputs: Output[] = [];
  if (shed > 0 && shedSelf) {
    outputs.push({
      kind: 'alert', id: `ew-${day}`, module: 'earlyWarning', action: 'shed', from: 1, to: 50, hours: 24, amount: shed,
      text: `Power shortfall forecast in about ${worstT} h (${Math.round((worst - 1) * 100)}% short). Switch off ${Math.round(shed * 100)}% of non-essential load now, so the plants do not trip.`,
      evidence: [
        `Plant meters now: ${Math.round(capNow).toLocaleString('en-US')} units; forecast in ${worstT} h: ${Math.round(cF).toLocaleString('en-US')}`,
        `Demand forecast ${Math.round(dF).toLocaleString('en-US')} units (census × public outlook)`,
      ],
    });
  }
  return {
    outputs,
    capForecast,
    peakFactor,
    log: { capNow, capForecast: cF, demandForecast: dF, shortfallPct: Math.max(0, (worst - 1) * 100), inHours: worstT, shed },
  };
}
