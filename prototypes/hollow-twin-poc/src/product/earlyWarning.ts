// REBUILD, problem #1 — Blackout Warning.
// "Blackouts in the deep levels now last for days, and no one knows when the next one will hit.
//  How would you warn people before the power or air cuts out?"
//
// Inputs (only what residents have, or what this app collects):
//  - residents' outage reports in the app (when their air and fans lose power, and when it comes back);
//  - residents' own head count in the app, and the Directorate's census (which undercounts);
//  - the rule everyone knows from the brief: the deep levels lose power first.
// No plant meters, no weather or grid forecast, no sensor boxes.
//
// What it does each day:
//  1. From yesterday's outage reports, finds the BLACKOUT LINE for each hour: how many levels from the top had power.
//  2. Because power goes to the upper levels first, the line shows how much power the plants made at that hour:
//     the power needs of every level above the line (from residents' head count).
//  3. Compares the line with the day before: is it moving up (less power each day) or down?
//  4. Predicts today's line hour by hour (yesterday's line + the trend), so it can say which levels go dark, at
//     what time, and for how long.
//  5. Asks everyone to switch off enough non-essential load that the plants stop running at their limit. Plants at
//     their limit trip and black out the whole Hollow, not only the deep levels.
import { LEVELS, SECTIONS_PER_LEVEL, type Output } from '../sim/types.ts';
import type { PredictedBlackout, ProductLog, ProductMemory } from './types.ts';

/** The 4 guessed constants that the gate tunes (npm run gate -- --set safeLoad=0.9). Defaults = first guesses. */
export const TUNE = {
  safeLoad: 0.82, // keep the plants below this share of their output (first guess 0.88; tuned Nov 19, REBUILD.md Step 2)
  assumedCompliance: 0.75, // share of residents expected to follow a save-power request (first guess 0.85; tuned Nov 19)
  maxTrend: 0.1, // the supply trend is capped at ±10% a day
  tripStep: 0.15, // after a Hollow-wide blackout with no other clue, ask for this much more saving
};
export const TRIP_ZONE = 0.95; // above this, plants are close to tripping
// Easing off, carefully. Residents cannot see the plants, so one quiet day is no proof the power is back (easing
// 15% a day made the plants trip again). The request comes down only after several quiet days in a row, a small
// step at a time, and never to the level where trouble last started (that memory fades after a while).
export const EASE = {
  afterQuietDays: 5, // quiet days in a row before each step down (tested: 3 days caused extra trips)
  step: 0.05, // how much each step lowers the request
  floorMargin: 0.05, // stay this far above the request that was in effect the last time there was trouble
  floorDays: 7, // forget that trouble level after this many quiet days
};
const HOURS = 24;

const sum = (a: number[]) => a.reduce((s, v) => s + (v || 0), 0);

export function blackoutWarning(m: ProductMemory, day: number):
  { outputs: Output[]; log: NonNullable<ProductLog['blackoutWarning']> } | null {
  if (!m.census.demand.length || !m.lines.length) return null;

  // Power needs per section: the census ration, scaled up where residents counted more people than the census.
  const ratio = m.census.people.map((p, i) => (p > 0 && m.selfCount[i] > 0 ? m.selfCount[i] / p : 1));
  const demand = m.census.demand.map((v, i) => (v || 0) * ratio[i]);
  const critical = m.census.critical.map((v, i) => (v || 0) * ratio[i]);
  const levelNeed = (l: number, shed: number) => { // l = 0-based level
    let s = 0;
    for (let c = 0; c < SECTIONS_PER_LEVEL; c++) {
      const i = l * SECTIONS_PER_LEVEL + c;
      s += critical[i] + Math.max(0, demand[i] - critical[i]) * (1 - shed * TUNE.assumedCompliance);
    }
    return s;
  };
  const above = (line: number, shed: number) => { let s = 0; for (let l = 0; l < line; l++) s += levelNeed(l, shed); return s; };
  const D = sum(demand), C = sum(critical);

  // 1–2. Yesterday's line → the power the plants made at each hour (only where the line is informative: some
  // levels dark, but not the whole Hollow at once).
  const supplyOf = (d: { line: number[]; hollowDark: boolean[]; shed: number }) =>
    d.line.map((ln, h) => (ln < LEVELS && !d.hollowDark[h] ? above(ln, d.shed) : null));
  const y = m.lines[m.lines.length - 1];
  const p = m.lines.length > 1 ? m.lines[0] : null;
  const sY = supplyOf(y);
  const sP = p ? supplyOf(p) : null;

  // 3. Trend: change in supply at the same hours, day over day.
  let dS = 0, n = 0, base = 0;
  if (sP) for (let h = 0; h < HOURS; h++) if (sY[h] !== null && sP[h] !== null) { dS += sY[h]! - sP[h]!; base += sY[h]!; n++; }
  dS = n ? Math.max(-TUNE.maxTrend, Math.min(TUNE.maxTrend, dS / Math.max(1, base))) : 0; // as a share of supply
  const sToday = sY.map((v) => (v === null ? null : v * (1 + dS)));
  const lineTrend = (() => {
    if (!p) return 0;
    let a = 0, b = 0, k = 0;
    for (let h = 0; h < HOURS; h++) if (!y.hollowDark[h] && !p.hollowDark[h]) { a += y.line[h]; b += p.line[h]; k++; }
    return k ? Math.round(((a - b) / k) * 10) / 10 : 0;
  })();
  const hollowDarkHours = y.hollowDark.filter(Boolean).length;

  // 5. Save power: keep the plants below TUNE.safeLoad at the worst hour.
  const known = sToday.filter((v): v is number => v !== null);
  const sMin = known.length ? Math.min(...known) : null;
  let shed: number;
  const quiet = sMin === null && hollowDarkHours === 0;
  if (quiet) { m.quietDays = (m.quietDays ?? 0) + 1; m.troubleAge = (m.troubleAge ?? 0) + 1; }
  else { m.quietDays = 0; m.troubleAge = 0; m.troubleShed = y.shed; } // the request that was in effect when trouble came
  if (sMin !== null) {
    shed = Math.max(0, Math.min(0.9, (D - TUNE.safeLoad * sMin) / Math.max(1, D - C) / TUNE.assumedCompliance));
    if (shed > 0) shed = Math.max(0.05, shed);
  } else if (hollowDarkHours > 0) {
    shed = Math.min(0.9, m.shed + TUNE.tripStep); // the plants tripped: they were overloaded, by an unknown amount
  } else {
    shed = m.shed; // no blackouts yesterday: keep the request, and ease it only after several quiet days (see EASE)
    if (EASE.afterQuietDays > 0 && m.quietDays > 0 && m.quietDays % EASE.afterQuietDays === 0) {
      const floor = (m.troubleAge ?? 0) <= EASE.floorDays ? (m.troubleShed ?? 0) + EASE.floorMargin : 0;
      shed = Math.min(m.shed, Math.max(floor, m.shed - EASE.step));
    }
    if (shed < 0.03) shed = 0;
  }

  // 4. Today's predicted blackouts, with today's power saving.
  const firstDark: (number | null)[] = new Array(LEVELS).fill(null);
  const hoursDark = new Array<number>(LEVELS).fill(0);
  for (let h = 0; h < HOURS; h++) {
    const s = sToday[h];
    if (s === null) continue;
    let left = s, lit = 0;
    while (lit < LEVELS && levelNeed(lit, shed) <= left) { left -= levelNeed(lit, shed); lit++; }
    for (let l = lit; l < LEVELS; l++) { if (firstDark[l] === null) firstDark[l] = h; hoursDark[l]++; }
  }
  const afterSaving = C + (D - C) * (1 - shed * TUNE.assumedCompliance);
  const tripRisk = hollowDarkHours > 0 || (sMin !== null && afterSaving > TRIP_ZONE * sMin);

  const darkNow: number[] = [];
  for (let l = 0; l < LEVELS; l++) {
    let d = 0;
    for (let c = 0; c < SECTIONS_PER_LEVEL; c++) if (m.outDark[l * SECTIONS_PER_LEVEL + c]) d++;
    if (d >= SECTIONS_PER_LEVEL / 2) darkNow.push(l + 1);
  }

  const outputs: Output[] = [];
  const fmt = (x: number) => Math.round(x).toLocaleString('en-US');
  const clock = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  let worstH = -1; // the worst hour of the usual deep-first cut (plant-trip hours left out)
  for (let h = 0; h < HOURS; h++) if (!y.hollowDark[h] && (worstH < 0 || y.line[h] < y.line[worstH])) worstH = h;
  if (worstH < 0) worstH = 0;
  const trendText = lineTrend < 0 ? `moving up about ${-lineTrend} levels a day` : lineTrend > 0 ? `moving down about ${lineTrend} levels a day` : 'not moving';

  const blackouts: PredictedBlackout[] = [];
  for (let l = 1; l <= LEVELS; l++) {
    const t0 = firstDark[l - 1];
    if (t0 === null) continue;
    const last = blackouts[blackouts.length - 1];
    if (last && last.to === l - 1 && Math.abs(last.startsIn - t0) <= 2) {
      last.to = l; last.startsIn = Math.min(last.startsIn, t0); last.startClock = last.startsIn; last.hours = Math.max(last.hours, hoursDark[l - 1]);
    } else blackouts.push({ from: l, to: l, startsIn: t0, hours: hoursDark[l - 1], startClock: t0 });
  }
  for (const b of blackouts) {
    const levelsText = b.from === b.to ? `level ${b.from}` : `levels ${b.from}–${b.to}`;
    outputs.push({
      kind: 'alert', id: `bw-${day}-${b.from}`, module: 'earlyWarning', action: 'prepare', from: b.from, to: b.to,
      hours: 24,
      text: `Blackout expected on ${levelsText} today from about ${clock(b.startClock)}, for about ${b.hours} h. The fans stop with the power, so the air will go bad. Get ready now: charge lights, store water, and plan where children, the elderly and the sick will go for air.`,
      evidence: [
        `Residents' outage reports yesterday: at ${clock(worstH)} only the top ${y.line[worstH]} levels had power`,
        `The blackout line is ${trendText}${p ? '' : ' (only one day of reports so far)'}`,
        `Power goes to the upper levels first, so with the same plant output ${levelsText} run out at that hour`,
      ],
    });
  }
  const covered = new Set(blackouts.flatMap((b) => Array.from({ length: b.to - b.from + 1 }, (_, k) => b.from + k)));
  const stillDark = darkNow.filter((l) => !covered.has(l));
  if (stillDark.length) {
    const from = Math.min(...stillDark), to = Math.max(...stillDark);
    outputs.push({
      kind: 'alert', id: `bw-now-${day}`, module: 'earlyWarning', action: 'prepare', from, to, hours: 24,
      text: `Levels ${from}–${to} were still without power for their air and fans at the end of yesterday. Move children, the elderly and the sick to better air now.`,
      evidence: [`Outage reports from these levels: no "power back" report since the power went`],
    });
  }
  if (tripRisk) {
    outputs.push({
      kind: 'alert', id: `bw-trip-${day}`, module: 'earlyWarning', action: 'prepare', from: 1, to: LEVELS, hours: 24,
      text: `The plants are running at their limit. A blackout of the whole Hollow is possible today. Every level: get ready now: charge lights, store water, and plan where children, the elderly and the sick will go for air.`,
      evidence: hollowDarkHours > 0
        ? [`Yesterday, for ${hollowDarkHours} h, almost every level reported a blackout at the same time: a plant tripped from overload`]
        : [`Even with the power saving, demand would be ${Math.round((afterSaving / Math.max(1, sMin!)) * 100)}% of what the plants made at the worst hour yesterday`],
    });
  }
  if (shed > 0) {
    outputs.push({
      kind: 'alert', id: `bw-shed-${day}`, module: 'earlyWarning', action: 'shed', from: 1, to: LEVELS, hours: 24, amount: shed,
      text: `${sMin === null && hollowDarkHours === 0 ? (shed < m.shed - 1e-9 ? `No blackouts for ${m.quietDays} days, so the request is a little smaller today` : 'No blackouts yesterday because everyone saved power. Keep it up') : 'The plants are running at their limit'}. Everyone: switch off ${Math.round(shed * 100)}% of non-essential load today, so the plants do not trip and black out the whole Hollow.`,
      evidence: sMin !== null
        ? [
          `From the blackout line, the plants made about ${fmt(sMin)} units at the worst hour; everyone together needs ${fmt(D)} (residents' own head count)`,
          `Keeping demand under ${Math.round(TUNE.safeLoad * 100)}% of that output leaves room so a plant does not trip`,
        ]
        : hollowDarkHours > 0
          ? [`Yesterday the whole Hollow went dark at once for ${hollowDarkHours} h: the plants tripped from overload`]
          : [`No blackouts yesterday because everyone is saving power. Residents cannot see the plants, so the request stays until the reports show more room`],
    });
  }

  const censusTotal = sum(m.census.people), selfTotal = sum(m.selfCount);
  let c50 = 0, r50 = 0;
  for (let i = (LEVELS - 1) * SECTIONS_PER_LEVEL; i < LEVELS * SECTIONS_PER_LEVEL; i++) { c50 += m.census.people[i] || 0; r50 += m.selfCount[i] || 0; }
  return {
    outputs,
    log: {
      lineWorst: !y.hollowDark[worstH] && y.line[worstH] < LEVELS ? y.line[worstH] : null, lineWorstHour: worstH, trend: lineTrend,
      supplyEstimate: sMin, demand: D, hollowDarkHours, shed, blackouts, darkNow, tripRisk,
      quietDays: m.quietDays ?? 0, eased: shed < m.shed - 1e-9,
      censusPeople: censusTotal, selfPeople: selfTotal, deepRatio: c50 > 0 ? r50 / c50 : 1,
    },
  };
}
