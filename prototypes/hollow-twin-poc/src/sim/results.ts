// RESULTS EXPORT (spec: .plans/results-site-spec.md, workstream A): `npm run results`.
// Runs every scenario on the held-out test seeds 11–20, with and without Blackout Warning (the same run loop as
// the gate, src/sim/gate.ts), and writes public/results/scenarios.json in the ScenariosFile shape
// (src/site/contracts.ts). The TUNE constants are frozen: this script never changes them.
//
// Statistics:
// - Interval: mean and 95% interval over the 10 seeds, Student t with df = n − 1 (t = 2.262 for n = 10).
//   For counts that cannot be negative (deaths, trips, dark person-hours, end day) the lower end is cut at 0.
//   Lives saved is the per-seed difference (without − with, same seed), then the interval; it is not cut.
// - warnedPct: warned ÷ blackout person-hours, all seeds pooled, in percent; null when there were no blackouts.
// - daily: for each day 1..120, the mean over seeds of cumulative deaths and of the number of sections whose air
//   and fans had less than half of their power (lifeSupport < 0.5, the engine's blackout line) at the day's worst
//   hour. Sections that are lost (everyone dead or gone) are not counted. Runs that end early carry their last
//   value forward.
// - Order: scenarios with the most convincing comparison first = the largest lower end of the lives-saved interval.
import { NO_TOOLS, type Frame, type ToolSet } from './types.ts';
import { sim } from './index.ts';
import { createRun, stepRun, type Run as ProductRun } from '../product/run.ts';
import { TUNE } from '../product/earlyWarning.ts';
import { BUILT } from '../product/names.ts';
import type { Interval, RunStats, ScenarioResult, ScenariosFile } from '../site/contracts.ts';

const SEEDS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const DAYS = 120;
const BLACKOUT = 0.5; // same line as the engine's BLACKOUT
const HOLLOW_PEOPLE = 2_000_000_000;
// "With" = every module built so far (Blackout Warning, Family Check-In).
const WITH: ToolSet = { ...NO_TOOLS, ...Object.fromEntries(BUILT.map((k) => [k, true])) };

/** What the site says about each scenario: its kind and the one-line real data behind it. */
const META: Record<string, { kind: ScenarioResult['kind']; realData: string }> = {
  cascade: { kind: 'plant-loss', realData: 'ERCOT net generation, Feb 15–18, 2021 (EIA-930)' },
  elliott: { kind: 'plant-loss', realData: 'TVA coal net generation, Winter Storm Elliott, Dec 23–26, 2022 (EIA-930)' },
  twoplants: { kind: 'plant-loss', realData: 'TVA and Duke Energy Progress East coal net generation, Dec 23–26, 2022 (EIA-930)' },
  slowloss: { kind: 'plant-loss', realData: 'Southwest Power Pool wind net generation, Feb 6–19, 2021 (EIA-930)' },
  baseline: { kind: 'baseline', realData: 'ERCOT hourly demand, 36 calm weeks of 2023 (EIA-930)' },
  aging: { kind: 'aging', realData: 'The Geysers geothermal output decline, about 10% a year (Foulger et al. 1997)' },
  crowding: { kind: 'crowding', realData: 'US county population growth, 2020–2024 (Census Bureau estimates)' },
};

interface One {
  seed: number; deaths: number; trips: number; darkMh: number; blackoutMh: number; warnedMh: number;
  stable: boolean; endDay: number; cumDeaths: number[]; darkSections: number[]; noNewsPerNight: number;
}

function darkAtWorstHour(frames: Frame[]): number {
  let worst = 0;
  for (const f of frames) {
    let n = 0;
    for (const s of f.sections) if (!s.lost && s.lifeSupport < BLACKOUT) n++;
    if (n > worst) worst = n;
  }
  return worst;
}

function runOnce(scenarioId: string, seed: number, tools: ToolSet): One {
  let r: ProductRun = createRun(scenarioId, seed, tools);
  let trips = 0;
  const cumDeaths: number[] = [];
  const darkSections: number[] = [];
  while (!r.sim.end) {
    const d = stepRun(r, tools);
    r = d.run;
    trips += d.events.filter((e) => e.includes('tripped')).length;
    cumDeaths.push(r.sim.totals.deaths);
    darkSections.push(darkAtWorstHour(d.frames));
  }
  while (cumDeaths.length < DAYS) { cumDeaths.push(cumDeaths[cumDeaths.length - 1] ?? 0); darkSections.push(darkSections[darkSections.length - 1] ?? 0); }
  const t = r.sim.totals;
  return {
    seed, deaths: t.deaths, trips, darkMh: t.blackoutPersonHours / 1e6, blackoutMh: t.blackoutPersonHours / 1e6,
    warnedMh: t.warnedPersonHours / 1e6, stable: r.sim.end!.kind === 'stable', endDay: r.sim.end!.day, cumDeaths, darkSections,
    noNewsPerNight: (t.familyNightsNoNews ?? 0) / Math.max(1, r.sim.end!.day),
  };
}

/** Two-sided 95% Student t quantile for df = 1..30 (df > 30: 1.96). */
const T95 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
  2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];

function round(x: number, digits: number): number { const k = 10 ** digits; return Math.round(x * k) / k; }

function interval(xs: number[], digits = 1, nonNegative = true): Interval {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const half = n > 1 ? (T95[n - 2] ?? 1.96) * sd / Math.sqrt(n) : 0;
  const lo = nonNegative ? Math.max(0, mean - half) : mean - half;
  return { mean: round(mean, digits), lo: round(lo, digits), hi: round(mean + half, digits) };
}

function stats(all: One[]): RunStats {
  const b = all.reduce((a, x) => a + x.blackoutMh, 0);
  const w = all.reduce((a, x) => a + x.warnedMh, 0);
  return {
    deaths: interval(all.map((x) => x.deaths), 0),
    trips: interval(all.map((x) => x.trips), 1),
    darkMh: interval(all.map((x) => x.darkMh), 2),
    stableShare: all.filter((x) => x.stable).length / all.length,
    endDay: interval(all.map((x) => x.endDay), 1),
    warnedPct: b > 0 ? round((w / b) * 100, 1) : null,
    noNewsPerNight: interval(all.map((x) => x.noNewsPerNight), 0),
  };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const results: ScenarioResult[] = [];
for (const sc of sim.scenarios) {
  const t0 = Date.now();
  const without = SEEDS.map((s) => runOnce(sc.id, s, NO_TOOLS));
  const withW = SEEDS.map((s) => runOnce(sc.id, s, WITH));
  const meta = META[sc.id] ?? { kind: 'plant-loss' as const, realData: sc.source.label };
  results.push({
    id: sc.id,
    name: sc.name,
    summary: sc.summary,
    kind: meta.kind,
    realData: meta.realData,
    source: sc.source,
    without: stats(without),
    with: stats(withW),
    livesSaved: interval(without.map((x, i) => x.deaths - withW[i].deaths), 0, false),
    daily: Array.from({ length: DAYS }, (_, d) => ({
      day: d + 1,
      withoutDeaths: Math.round(mean(without.map((x) => x.cumDeaths[d]))),
      withDeaths: Math.round(mean(withW.map((x) => x.cumDeaths[d]))),
      withoutDarkSections: round(mean(without.map((x) => x.darkSections[d])), 1),
      withDarkSections: round(mean(withW.map((x) => x.darkSections[d])), 1),
    })),
    perSeed: SEEDS.map((seed, i) => ({
      seed, withoutDeaths: Math.round(without[i].deaths), withDeaths: Math.round(withW[i].deaths), withStable: withW[i].stable,
    })),
  });
  console.log(`${sc.id}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
// Real grid failures first, the hardest (Two Plants) leading; then the slow scenarios; Baseline last.
const ORDER = ['twoplants', 'elliott', 'cascade', 'slowloss', 'aging', 'crowding', 'baseline'];
const rank = (id: string) => (ORDER.indexOf(id) < 0 ? ORDER.length : ORDER.indexOf(id));
results.sort((a, b) => rank(a.id) - rank(b.id));

const simPeople = sim.createState(sim.scenarios[0].id, SEEDS[0], NO_TOOLS).totals.startPopulation;
const file: ScenariosFile = {
  generated: new Date().toISOString(),
  set: 'test',
  seeds: SEEDS,
  module: 'Blackout Warning',
  tune: { ...TUNE },
  scale: { simPeople, hollowPeople: HOLLOW_PEOPLE },
  scenarios: results,
};

const fmt = (i: Interval) => `${i.mean} (${i.lo}–${i.hi})`;
console.table(results.map((r) => ({
  id: r.id, withoutDeaths: fmt(r.without.deaths), withDeaths: fmt(r.with.deaths), livesSaved: fmt(r.livesSaved),
  withoutTrips: r.without.trips.mean, withTrips: fmt(r.with.trips), withStable: r.with.stableShare, 'withWarned%': r.with.warnedPct,
})));

const fs = (await import('node:fs' as string)) as { mkdirSync(p: URL, o: { recursive: boolean }): void; writeFileSync(p: URL, d: string): void };
const dir = new URL('../../public/results/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(new URL('scenarios.json', dir), JSON.stringify(file, null, 1) + '\n');
console.log('Wrote public/results/scenarios.json');
