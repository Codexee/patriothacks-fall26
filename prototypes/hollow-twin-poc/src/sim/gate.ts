// GATE (spec: .plans/hollow-real-data-spec.md): `npm run gate [-- --test] [--set name=value ...] [--json file]`.
// Runs every scenario on fixed seed sets, with and without Blackout Warning:
//   tune  = seeds 1–5   (choose the module's TUNE constants here)
//   check = seeds 6–10  (a change is kept only if this set is no worse)
//   test  = seeds 11–20 (run once, at the end, with everything frozen; needs --test)
import { NO_TOOLS, type ToolSet } from './types.ts';
import { sim } from './index.ts';
import { createRun, stepRun, type Run as ProductRun } from '../product/run.ts';
import { TUNE } from '../product/earlyWarning.ts';
import { BUILT } from '../product/names.ts';

interface Proc { argv: string[]; exit(code: number): never }
const proc = (globalThis as unknown as { process: Proc }).process;
const argv = proc.argv.slice(2);

// --set safeLoad=0.9 changes a TUNE constant for this run only.
for (let i = 0; i < argv.length; i++) {
  if (argv[i] !== '--set') continue;
  const [k, v] = (argv[i + 1] ?? '').split('=');
  if (!(k in TUNE) || Number.isNaN(Number(v))) { console.error(`Unknown --set ${argv[i + 1]}. Names: ${Object.keys(TUNE).join(', ')}`); proc.exit(2); }
  (TUNE as Record<string, number>)[k] = Number(v);
}
const jsonAt = argv.indexOf('--json');
const jsonFile = jsonAt >= 0 ? argv[jsonAt + 1] : null;

const SETS: Record<string, number[]> = {
  tune: [1, 2, 3, 4, 5],
  check: [6, 7, 8, 9, 10],
  ...(argv.includes('--test') ? { test: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] } : {}),
};

interface One { deaths: number; trips: number; blackoutMh: number; warnedMh: number; stable: boolean; endDay: number; noNews: number }

function runOnce(scenarioId: string, seed: number, tools: ToolSet): One {
  let r: ProductRun = createRun(scenarioId, seed, tools);
  let trips = 0;
  while (!r.sim.end) {
    const d = stepRun(r, tools);
    r = d.run;
    trips += d.events.filter((e) => e.includes('tripped')).length;
  }
  const t = r.sim.totals;
  return {
    deaths: t.deaths, trips, blackoutMh: t.blackoutPersonHours / 1e6, warnedMh: t.warnedPersonHours / 1e6,
    stable: r.sim.end!.kind === 'stable', endDay: r.sim.end!.day,
    noNews: (t.familyNightsNoNews ?? 0) / Math.max(1, r.sim.end!.day),
  };
}

interface Row { set: string; scenario: string; run: string; deaths: number; trips: number; 'warned%': number; stable: string; meanEndDay: number; 'noNews/night': number }
const rows: Row[] = [];
// "With" = every module built so far (Blackout Warning, Family Check-In).
const WITH = { ...NO_TOOLS, ...Object.fromEntries(BUILT.map((k) => [k, true])) };

for (const [set, seeds] of Object.entries(SETS)) {
  for (const sc of sim.scenarios) {
    for (const [name, tools] of [['without', NO_TOOLS], ['with', WITH]] as const) {
      const all = seeds.map((seed) => runOnce(sc.id, seed, tools));
      const b = all.reduce((a, x) => a + x.blackoutMh, 0);
      const w = all.reduce((a, x) => a + x.warnedMh, 0);
      rows.push({
        set, scenario: sc.id, run: name,
        deaths: Math.round(all.reduce((a, x) => a + x.deaths, 0)),
        trips: all.reduce((a, x) => a + x.trips, 0),
        'warned%': b > 0 ? Math.round((w / b) * 100) : 0,
        stable: `${all.filter((x) => x.stable).length}/${all.length}`,
        meanEndDay: Math.round(all.reduce((a, x) => a + x.endDay, 0) / all.length),
        'noNews/night': Math.round(all.reduce((a, x) => a + x.noNews, 0) / all.length),
      });
    }
  }
}

console.log(`TUNE ${JSON.stringify(TUNE)}`);
console.log(`Totals over each seed set (deaths and trips are sums; warned% = warned ÷ blackout person-hours; noNews/night = split families with no news at the end of a night, mean per night). "with" = every built module: ${BUILT.join(', ')}.`);
console.table(rows);
for (const set of Object.keys(SETS)) {
  const w = rows.filter((r) => r.set === set && r.run === 'with');
  console.log(`${set}: with Blackout Warning, all scenarios: ${w.reduce((a, r) => a + r.deaths, 0)} deaths, ${w.reduce((a, r) => a + r.trips, 0)} trips`);
}
if (jsonFile) {
  const fs = (await import('node:fs' as string)) as { writeFileSync(p: string, d: string): void };
  fs.writeFileSync(jsonFile, JSON.stringify({ tune: TUNE, rows }, null, 2));
  console.log(`Wrote ${jsonFile}`);
}
