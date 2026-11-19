// REBUILD, problem #1 — Blackout Warning.
// "Blackouts in the deep levels now last for days, and no one knows when the next one will hit.
//  How would you warn people before the power or air cuts out?"
//
// What it does each day, from observations only:
//  1. Forecasts plant output 36 h ahead: each plant's own health trend (from its feeder meter, so a plant that is
//     wearing out is caught) × the public weather and grid outlook (so a storm is seen before it arrives).
//  2. Forecasts demand: the section census × the outlook's demand curve.
//  3. Predicts WHO goes dark and WHEN: the Directorate's rule is public — upper levels are served first — so where
//     the forecast is short, it can say which levels lose power, at what time, and for how long.
//  4. Warns those levels ahead of time, including when their air turns unsafe after the fans stop, so residents can
//     prepare (charge lights, store water, plan where the vulnerable go for air).
//  5. If demand will push the plants near their limit, asks everyone to switch off non-essential load, so the plants
//     do not overload and trip — which would black out the whole Hollow, not only the deep levels.
import type { Output } from '../sim/types.ts';
import type { Outlook, PredictedBlackout, ProductLog, ProductMemory } from './types.ts';

const HORIZON = 36; // hours
const SAFE_LOAD = 0.88; // above this load, plants risk tripping (at ≥ 99% they trip from stress)
const ASSUMED_COMPLIANCE = 0.85;
const TRIP_ZONE = 0.95; // load at which plants are close to tripping (they trip from stress at about 99%)
const OFFLINE_HOURS = 12; // a tripped plant is assumed to stay off this long
const DARK = 0.5; // a section is dark when it gets less than half of what it needs
const CO2_RISE = 300; // ppm per hour with the fans off (measured by residents' sensor boxes in past blackouts)
const AIR_UNSAFE = 5000; // ppm
const SECTIONS = 8;

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
    // A plant's own health never improves by itself: the trend may only stay flat or fall.
    const { a, b } = fit(xs, ys);
    const slope = Math.min(0, b);
    const level = Math.min(maxNorm, a + b * 23);
    perPlant.push((t) => Math.max(0, Math.min(maxNorm, level + slope * t)) * supNext(t));
  }
  return { capAt: (t) => perPlant.reduce((s, f) => s + f(t), 0), capNow, lastHour };
}

/** Group levels that go dark at about the same time into ranges, for one alert each. */
function group(firstDark: (number | null)[], hoursDark: number[]): { from: number; to: number; startsIn: number; hours: number }[] {
  const out: { from: number; to: number; startsIn: number; hours: number }[] = [];
  for (let l = 1; l <= firstDark.length; l++) {
    const t0 = firstDark[l - 1];
    if (t0 === null) continue;
    const last = out[out.length - 1];
    if (last && last.to === l - 1 && Math.abs(last.startsIn - t0) <= 2) {
      last.to = l;
      last.startsIn = Math.min(last.startsIn, t0);
      last.hours = Math.max(last.hours, hoursDark[l - 1]);
    } else out.push({ from: l, to: l, startsIn: t0, hours: hoursDark[l - 1] });
  }
  return out;
}

export function blackoutWarning(m: ProductMemory, day: number):
  { outputs: Output[]; log: NonNullable<ProductLog['blackoutWarning']> } | null {
  const fc = forecastCapacity(m);
  const { demand, critical } = m.census;
  if (!fc || !demand.length) return null;
  const { capAt, capNow, lastHour } = fc;
  const levels = Math.ceil(demand.length / SECTIONS);

  // Demand forecast: the census total, divided by the load multiplier at that hour, times the outlook's multiplier.
  const d0 = demand.reduce((s, v) => s + (v || 0), 0);
  const crit0 = critical.reduce((s, v) => s + (v || 0), 0);
  const multNow = at(m.outlookPrev, 'demand', lastHour) ?? at(m.outlook, 'demand', lastHour + 1) ?? 1;
  const scaleAt = (t: number) => (at(m.outlook, 'demand', lastHour + t) ?? multNow) / Math.max(0.05, multNow);

  // 5. Overload risk: ask everyone to cut non-essential load before the plants run near their limit.
  let worst = 0, worstT = 1;
  for (let t = 1; t <= HORIZON; t++) {
    const r = (d0 * scaleAt(t)) / Math.max(1, SAFE_LOAD * capAt(t));
    if (r > worst) { worst = r; worstT = t; }
  }
  const dF = d0 * scaleAt(worstT), cF = capAt(worstT);
  const critAt = crit0 * scaleAt(worstT);
  const shed = worst > 1 ? Math.min(0.9, Math.max(0.05, (dF - SAFE_LOAD * cF) / Math.max(1, dF - critAt) / ASSUMED_COMPLIANCE)) : 0;

  // 3. Who goes dark, and when: replay the Directorate's "upper levels first" rule on the forecast, hour by hour,
  // with the load residents will switch off.
  const firstDark: (number | null)[] = new Array(levels).fill(null);
  const hoursDark = new Array<number>(levels).fill(0);
  for (let t = 1; t <= HORIZON; t++) {
    let left = capAt(t);
    const k = scaleAt(t);
    const darkSections = new Array<number>(levels).fill(0);
    for (let i = 0; i < demand.length; i++) {
      const c = (critical[i] || 0) * k;
      const need = c + Math.max(0, (demand[i] || 0) * k - c) * (1 - shed * ASSUMED_COMPLIANCE);
      if (need <= 0) continue;
      const got = Math.min(1, Math.max(0, left / need));
      left -= got * need;
      if (got < DARK) darkSections[Math.floor(i / SECTIONS)]++;
    }
    for (let l = 0; l < levels; l++) {
      if (darkSections[l] >= SECTIONS / 2) {
        if (firstDark[l] === null) firstDark[l] = t;
        hoursDark[l]++;
      }
    }
  }
  const darkNow: number[] = [];
  for (let l = 1; l <= levels; l++) { const p = m.sensorPower[l - 1]; if (p !== null && p < DARK) darkNow.push(l); }

  const outputs: Output[] = [];
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const clock = (t: number) => `${String((lastHour + t + 24) % 24).padStart(2, '0')}:00`;
  const airHours = (from: number, to: number) => {
    let co2 = 0, k = 0;
    for (let l = from; l <= to; l++) { const v = m.sensorCo2[l - 1]; if (v !== null) { co2 += v; k++; } }
    return Math.max(1, Math.round((AIR_UNSAFE - (k ? co2 / k : 1000)) / CO2_RISE));
  };

  // 4. One "prepare" warning per group of levels expected to go dark.
  const blackouts: PredictedBlackout[] = group(firstDark, hoursDark).map((g) => ({ ...g, startClock: (lastHour + g.startsIn + 24) % 24 }));
  for (const b of blackouts) {
    const air = airHours(b.from, b.to);
    const levelsText = b.from === b.to ? `level ${b.from}` : `levels ${b.from}–${b.to}`;
    outputs.push({
      kind: 'alert', id: `bw-${day}-${b.from}`, module: 'earlyWarning', action: 'prepare', from: b.from, to: b.to,
      hours: Math.min(48, b.startsIn + b.hours + 6),
      text: `Blackout expected on ${levelsText} in about ${b.startsIn} h (around ${clock(b.startsIn)}), lasting about ${b.hours} h. Without fans, the air becomes unsafe about ${air} h after the power goes. Get ready now: charge lights, store water, and plan where children, the elderly and the sick will go for air.`,
      evidence: [
        `Plant output forecast at ${clock(b.startsIn)}: ${fmt(capAt(b.startsIn))} units, against demand of ${fmt(d0 * scaleAt(b.startsIn))} units`,
        `The Directorate serves the upper levels first, so with this shortfall the power runs out at ${levelsText}`,
        `Residents' sensors: air rises about ${CO2_RISE} ppm per hour with the fans off; unsafe at ${fmt(AIR_UNSAFE)} ppm`,
      ],
    });
  }
  // Levels that were dark yesterday and are not covered above: their air is the urgent risk.
  const covered = new Set(blackouts.flatMap((b) => Array.from({ length: b.to - b.from + 1 }, (_, k) => b.from + k)));
  const stillDark = darkNow.filter((l) => !covered.has(l));
  if (stillDark.length) {
    const from = Math.min(...stillDark), to = Math.max(...stillDark);
    outputs.push({
      kind: 'alert', id: `bw-now-${day}`, module: 'earlyWarning', action: 'prepare', from, to, hours: 24,
      text: `Levels ${from}–${to} had their air and fans cut yesterday. If the fans are still off, move children, the elderly and the sick to better air now.`,
      evidence: [`Sensor boxes on the air-and-fans circuit of these levels averaged under ${Math.round(DARK * 100)}% power yesterday`],
    });
  }
  // Even with everyone saving power, will the plants still run in their trip zone? Then a blackout of the WHOLE
  // Hollow is possible: plants that trip shift their load to the others, which trip too. Warn every level.
  const afterSaving = critAt + (dF - critAt) * (1 - shed * ASSUMED_COMPLIANCE);
  const tripRisk = afterSaving > TRIP_ZONE * cF;
  if (tripRisk) {
    outputs.push({
      kind: 'alert', id: `bw-trip-${day}`, module: 'earlyWarning', action: 'prepare', from: 1, to: levels, hours: Math.min(48, worstT + 24),
      text: `Even if everyone saves power, the plants will run close to tripping in about ${worstT} h (around ${clock(worstT)}). A blackout of the whole Hollow is possible. Every level: get ready now: charge lights, store water, and plan where children, the elderly and the sick will go for air.`,
      evidence: [
        `Forecast in ${worstT} h: ${fmt(cF)} units of plant output; demand even after saving: ${fmt(afterSaving)} units (${Math.round((afterSaving / Math.max(1, cF)) * 100)}% of output)`,
        `Plants trip from overload above about ${Math.round(TRIP_ZONE * 100)}% load, and one trip pushes its load onto the others`,
      ],
    });
  }
  if (shed > 0) {
    outputs.push({
      kind: 'alert', id: `bw-shed-${day}`, module: 'earlyWarning', action: 'shed', from: 1, to: levels, hours: 24, amount: shed,
      text: `The plants will run near their limit in about ${worstT} h. Everyone: switch off ${Math.round(shed * 100)}% of non-essential load now, so the plants do not trip and black out the whole Hollow.`,
      evidence: [
        `Plant meters now: ${fmt(capNow)} units; forecast in ${worstT} h: ${fmt(cF)}`,
        `Demand forecast ${fmt(dF)} units (census × public outlook); plants trip above about ${Math.round(SAFE_LOAD * 100)}% load`,
      ],
    });
  }
  return {
    outputs,
    log: {
      capNow, capForecast: cF, demandForecast: dF, shortfallPct: Math.max(0, (worst - 1) * 100), inHours: worstT, shed,
      blackouts, darkNow, tripRisk,
    },
  };
}
