// IMPACT EXPORT: `npm run impact`. What each app adds, measured by leaving it out.
// For every disaster and held-out test seed 11–20, it runs HollowGuard with all built apps, then once more for each
// app with that one app switched off (every other app on). The app's impact is the difference, summed over the
// 70 runs (or averaged, for per-night and per-run measures). Same run loop as src/sim/results.ts; TUNE is frozen.
// Writes public/results/impact.json (ImpactFile in src/site/contracts.ts).
import { NO_TOOLS, type ToolKey, type ToolSet } from './types.ts';
import { sim } from './index.ts';
import { createRun, stepRun } from '../product/run.ts';
import { BUILT, PROBLEMS, moduleName } from '../product/names.ts';
import type { ImpactFile, ImpactRow } from '../site/contracts.ts';

const SEEDS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const ALL: ToolSet = { ...NO_TOOLS, ...Object.fromEntries(BUILT.map((k) => [k, true])) };

interface Sum { deaths: number; trips: number; darkMh: number; noNewsNights: number; nights: number; runs: number }

function runSet(tools: ToolSet): Sum {
  const s: Sum = { deaths: 0, trips: 0, darkMh: 0, noNewsNights: 0, nights: 0, runs: 0 };
  for (const sc of sim.scenarios) {
    for (const seed of SEEDS) {
      let r = createRun(sc.id, seed, tools);
      while (!r.sim.end) {
        const d = stepRun(r, tools);
        r = d.run;
        s.trips += d.events.filter((e) => e.includes('tripped')).length;
      }
      const t = r.sim.totals;
      s.deaths += Math.round(t.deaths); // rounded per run, as scenarios.json's perSeed, so the totals match the site
      s.darkMh += t.blackoutPersonHours / 1e6;
      s.noNewsNights += (t.familyNightsNoNews ?? 0) / Math.max(1, r.sim.end!.day); // per-run mean per night, as scenarios.json
      s.nights += 1;
      s.runs += 1;
    }
  }
  return s;
}

const t0 = Date.now();
const all = runSet(ALL);
console.log(`all apps: ${Math.round(all.deaths)} deaths (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

const row = (key: ToolKey, off: Sum): ImpactRow => ({
  key,
  name: moduleName(key),
  problem: PROBLEMS.find((p) => p.feature === key)?.n ?? 0,
  deathsWithoutApp: Math.round(off.deaths),
  deathsAvoided: Math.round(off.deaths - all.deaths),
  tripsAvoidedPerRun: Math.round(((off.trips - all.trips) / all.runs) * 10) / 10,
  darkMhAvoidedPerRun: Math.round(((off.darkMh - all.darkMh) / all.runs) * 100) / 100,
  noNewsPerNightWithoutApp: Math.round(off.noNewsNights / Math.max(1, off.nights)),
});

const rows: ImpactRow[] = [];
for (const key of BUILT) {
  const t = Date.now();
  const off = runSet({ ...ALL, [key]: false });
  rows.push(row(key, off));
  console.log(`without ${key}: ${Math.round(off.deaths)} deaths (${((Date.now() - t) / 1000).toFixed(0)} s)`);
}

const file: ImpactFile = {
  generated: new Date().toISOString(),
  set: 'test',
  seeds: SEEDS,
  runs: all.runs,
  all: { deaths: Math.round(all.deaths), noNewsPerNight: Math.round(all.noNewsNights / Math.max(1, all.nights)) },
  apps: rows,
};
const fs = (await import('node:fs' as string)) as { writeFileSync(p: URL, d: string): void };
fs.writeFileSync(new URL('../../public/results/impact.json', import.meta.url), JSON.stringify(file, null, 2) + '\n');
console.log(`wrote public/results/impact.json in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
