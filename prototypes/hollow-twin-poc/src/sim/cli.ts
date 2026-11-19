// REBUILD CLI: `npm run sim [scenario] [seed] [--checks] [-v]`.
// Step 1: the same scenario with and without Blackout Warning (problem #1).
import { NO_TOOLS, type ToolSet } from './types.ts';
import { sim } from './index.ts';
import { createRun, stepRun, type Run as ProductRun } from '../product/run.ts';

// Node globals without @types/node (the project only ships browser types).
const proc = (globalThis as unknown as { process: { argv: string[]; exit(code: number): never } }).process;

const scenarioId = proc.argv[2] && !proc.argv[2].startsWith('-') ? proc.argv[2] : 'baseline';
const seed = Number(proc.argv[3] && !proc.argv[3].startsWith('-') ? proc.argv[3] : 1);
const verbose = proc.argv.includes('-v');

interface Result { name: string; end: string; day: number; deaths: number; air: number; warned: number; darkMh: number; trips: number; events: string[]; score: number }

function run(name: string, tools: ToolSet): Result {
  let r: ProductRun = createRun(scenarioId, seed, tools);
  const events: string[] = [];
  while (!r.sim.end) {
    const d = stepRun(r, tools);
    r = d.run;
    events.push(...d.events);
  }
  const t = r.sim.totals;
  return {
    name,
    end: r.sim.end!.kind === 'stable' ? 'stable' : `lost (${r.sim.end!.reason})`,
    day: r.sim.end!.day,
    deaths: Math.round(t.deaths),
    air: Math.round(t.airDeaths),
    warned: t.blackoutPersonHours > 0 ? Math.round((t.warnedPersonHours / t.blackoutPersonHours) * 100) : 0,
    darkMh: Math.round(t.blackoutPersonHours / 1e6 * 10) / 10,
    trips: events.filter((e) => e.includes('tripped')).length,
    events,
    score: sim.score(r.sim).total,
  };
}

const runs = [run('WITHOUT', NO_TOOLS), run('BLACKOUT_WARNING', { ...NO_TOOLS, earlyWarning: true })];
console.log(`Scenario ${scenarioId}, seed ${seed}`);
console.table(runs.map((r) => ({
  run: r.name, endDay: r.day, end: r.end.slice(0, 30), deaths: r.deaths, badAir: r.air, 'warned%': r.warned, 'darkPersonHours(M)': r.darkMh, plantTrips: r.trips,
})));

if (proc.argv.includes('--checks')) {
  const a = run('A', { ...NO_TOOLS, earlyWarning: true });
  const b = run('B', { ...NO_TOOLS, earlyWarning: true });
  const same = a.score === b.score && a.deaths === b.deaths && a.events.join('\n') === b.events.join('\n');
  console.log(`Determinism: ${same ? 'PASS' : 'FAIL'}`);
  let p = createRun(scenarioId, seed, { ...NO_TOOLS, earlyWarning: true });
  for (let d = 0; d < 5; d++) p = stepRun(p, { ...NO_TOOLS, earlyWarning: true }).run;
  const before = JSON.stringify(p);
  stepRun(p, { ...NO_TOOLS, earlyWarning: true }, [{ type: 'event', event: { type: 'tripPlant', plant: 1 } }]);
  const pure = JSON.stringify(p) === before;
  console.log(`Purity: ${pure ? 'PASS' : 'FAIL'}`);
  if (!same || !pure) proc.exit(1);
}

if (verbose) for (const r of runs) { console.log(`\n--- ${r.name} ---`); console.log(r.events.slice(0, 60).join('\n')); }
