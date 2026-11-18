// PROTOTYPE CLI: `npm run sim`. Runs a scenario with the residents' system: no modules, each module alone, all modules.
import { ALL_TOOLS, NO_TOOLS, type ToolSet } from './types.ts';
import { sim } from './index.ts';
import { createRun, stepRun, type Run as ProductRun } from '../product/run.ts';

// Node globals without @types/node (the project only ships browser types).
const proc = (globalThis as unknown as { process: { argv: string[]; exit(code: number): never } }).process;

const scenarioId = proc.argv[2] ?? 'texas2021';
const seed = Number(proc.argv[3] ?? 1);
const verbose = proc.argv.includes('-v');

interface Run { name: string; end: string; day: number; deaths: number; alive: number; score: number; fairness: number; msPerDay: number; events: string[]; climbers: number; hunger: number; noNews: number }

function run(name: string, tools: ToolSet): Run {
  let r: ProductRun = createRun(scenarioId, seed, tools);
  const events: string[] = [];
  const t0 = performance.now();
  while (!r.sim.end) {
    const d = stepRun(r, tools);
    r = d.run;
    events.push(...d.events);
  }
  const state = r.sim;
  const ms = (performance.now() - t0) / state.day;
  const sc = sim.score(state);
  const end = state.end!;
  return {
    name,
    end: end.kind === 'stable' ? 'stable' : `lost (${end.reason})`,
    day: end.day,
    deaths: Math.round(state.totals.deaths),
    alive: sc.alivePct,
    score: sc.total,
    fairness: sc.fairness,
    msPerDay: ms,
    events,
    climbers: Math.round(state.totals.climbersLost),
    hunger: Math.round(state.totals.hungerDeaths),
    noNews: state.totals.familiesNoNews,
  };
}

const one = (k: keyof ToolSet): ToolSet => ({ ...NO_TOOLS, [k]: true });
const only = proc.argv.find((a) => a.startsWith('--only='))?.slice(7);
const without = (k: keyof ToolSet): ToolSet => ({ ...ALL_TOOLS, [k]: false });
const FIRST4: ToolSet = { ...NO_TOOLS, earlyWarning: true, fairShare: true, ledger: true, snow: true };
const all: [string, ToolSet][] = [
  ['NO_MODULES', NO_TOOLS],
  ['fairShare', one('fairShare')],
  ['EW+fairShare', { ...NO_TOOLS, earlyWarning: true, fairShare: true }],
  ['FIRST_4', FIRST4],
  ['ALL_MODULES', ALL_TOOLS],
  ['ALL-lantern', without('lantern')],
  ['ALL-kin', without('kin')],
  ['ALL-layout', without('layout')],
  ['ALL-larder', without('larder')],
  ['ALL-witness', without('witness')],
];
const runs: Run[] = all.filter(([n]) => !only || only.split(',').includes(n)).map(([n, t]) => run(n, t));

console.log(`Scenario ${scenarioId}, seed ${seed}`);
console.table(runs.map((r) => ({
  run: r.name, endDay: r.day, end: r.end.slice(0, 32), deaths: r.deaths, climbers: r.climbers, hunger: r.hunger, score: r.score, ms: Math.round(r.msPerDay),
})));

if (proc.argv.includes('--checks')) {
  const a = run('ALL_MODULES', ALL_TOOLS);
  const b = run('ALL_MODULES', ALL_TOOLS);
  const same = a.score === b.score && a.deaths === b.deaths && a.day === b.day && a.events.join('\n') === b.events.join('\n');
  console.log(`Determinism: ${same ? 'PASS' : 'FAIL'} (score ${a.score} vs ${b.score})`);

  // Purity: stepRun must not mutate its input.
  let p = createRun(scenarioId, seed, ALL_TOOLS);
  for (let d = 0; d < 5; d++) p = stepRun(p, ALL_TOOLS).run;
  const before = JSON.stringify(p);
  stepRun(p, ALL_TOOLS, [{ type: 'event', event: { type: 'breakRecycler', level: 20 } }]);
  const pure = JSON.stringify(p) === before;
  console.log(`Purity: ${pure ? 'PASS' : 'FAIL'} (stepRun leaves its input unchanged)`);
  if (!same || !pure) proc.exit(1);
}

if (verbose) for (const r of runs) { console.log(`\n--- ${r.name} ---`); console.log(r.events.slice(0, 120).join('\n')); }
