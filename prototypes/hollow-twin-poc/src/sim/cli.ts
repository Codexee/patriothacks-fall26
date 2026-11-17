// PROTOTYPE CLI: `npm run sim`. Runs Texas, seed 1, with each tool combination that matters for the demo.
import { ALL_TOOLS, NO_TOOLS, type SimState, type ToolSet } from './types.ts';
import { sim } from './index.ts';

// Node globals without @types/node (the project only ships browser types).
const proc = (globalThis as unknown as { process: { argv: string[]; exit(code: number): never } }).process;

const scenarioId = proc.argv[2] ?? 'texas2021';
const seed = Number(proc.argv[3] ?? 1);
const verbose = proc.argv.includes('-v');

interface Run { name: string; end: string; day: number; deaths: number; alive: number; score: number; fairness: number; msPerDay: number; events: string[] }

function run(name: string, tools: ToolSet): Run {
  let state: SimState = sim.createState(scenarioId, seed, tools);
  const events: string[] = [];
  const t0 = performance.now();
  while (!state.end) {
    const r = sim.stepDay(state, []);
    state = r.state;
    events.push(...r.events);
  }
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
  };
}

const one = (k: keyof ToolSet): ToolSet => ({ ...NO_TOOLS, [k]: true });
const runs: Run[] = [
  run('NO_TOOLS', NO_TOOLS),
  run('earlyWarning', one('earlyWarning')),
  run('fairShare', one('fairShare')),
  run('ledger', one('ledger')),
  run('layout', one('layout')),
  run('ALL_TOOLS', ALL_TOOLS),
];

console.log(`Scenario ${scenarioId}, seed ${seed}`);
console.table(runs.map((r) => ({
  run: r.name, endDay: r.day, end: r.end, deaths: r.deaths, alivePct: r.alive, fairness: r.fairness, score: r.score, msPerDay: Number(r.msPerDay.toFixed(1)),
})));

const a = run('ALL_TOOLS', ALL_TOOLS);
const b = run('ALL_TOOLS', ALL_TOOLS);
const same = a.score === b.score && a.deaths === b.deaths && a.day === b.day && a.events.join('\n') === b.events.join('\n');
console.log(`Determinism: ${same ? 'PASS' : 'FAIL'} (score ${a.score} vs ${b.score})`);

// Purity: stepDay must not mutate its input.
let p = sim.createState(scenarioId, seed, ALL_TOOLS);
for (let d = 0; d < 5; d++) p = sim.stepDay(p, []).state;
const before = JSON.stringify(p);
sim.stepDay(p, [{ type: 'build', kind: 'fan', level: 40, col: 2 }]);
const pure = JSON.stringify(p) === before;
console.log(`Purity: ${pure ? 'PASS' : 'FAIL'} (stepDay leaves its input unchanged)`);

if (verbose) for (const r of runs) { console.log(`\n--- ${r.name} ---`); console.log(r.events.slice(0, 60).join('\n')); }
if (!same || !pure) proc.exit(1);
