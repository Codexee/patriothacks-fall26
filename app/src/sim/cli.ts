// PROTOTYPE CLI: `npm run sim`. Runs a scenario with the residents' system: no modules, each module alone, all modules.
import { ALL_TOOLS, NO_TOOLS, type Score, type SimState, type ToolSet } from './types.ts';
import { sim } from './index.ts';
import { MAX_DAYS, score as engineScore } from './engine.ts';
import { createRun, stepRun, type Run as ProductRun } from '../product/run.ts';

// Node globals without @types/node (the project only ships browser types).
const proc = (globalThis as unknown as { process: { argv: string[]; exit(code: number): never } }).process;

const scenarioId = proc.argv[2] ?? 'texas2021';
const seed = Number(proc.argv[3] ?? 1);
const verbose = proc.argv.includes('-v');
const checks = proc.argv.includes('--checks');

interface Run { name: string; end: string; day: number; deaths: number; score: Score; msPerDay: number; events: string[]; climbers: number; hunger: number; noNews: number }

function run(name: string, tools: ToolSet, runScenario = scenarioId, runSeed = seed): Run {
  let r: ProductRun = createRun(runScenario, runSeed, tools);
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
    deaths: state.totals.deaths,
    score: sc,
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
const selected = (name: string) => !only || only.split(',').includes(name);
// --only controls the table; --checks always covers every module configuration.
const measured = all.filter(([name]) => checks || selected(name)).map(([name, tools]) => run(name, tools));
const runs = measured.filter((r) => selected(r.name));

console.log(`Scenario ${scenarioId}, seed ${seed}`);
if (measured.length) console.log(`Baseline deaths (no modules): ${Math.round(measured[0].score.baselineDeaths).toLocaleString('en-US')}`);
console.table(runs.map((r) => ({
  run: r.name, endDay: r.day, end: r.end.slice(0, 32), deaths: Math.round(r.deaths), climbers: r.climbers, hunger: r.hunger,
  livesSaved: r.score.livesSaved, fairness: r.score.fairness, score: Number(r.score.total.toFixed(5)), ms: Math.round(r.msPerDay),
})));

if (checks) {
  const a = measured.find((r) => r.name === 'ALL_MODULES')!;
  const b = run('ALL_MODULES', ALL_TOOLS);
  const same = JSON.stringify(a.score) === JSON.stringify(b.score) && a.deaths === b.deaths && a.day === b.day && a.events.join('\n') === b.events.join('\n');
  console.log(`Determinism: ${same ? 'PASS' : 'FAIL'} (score ${a.score.total} vs ${b.score.total})`);

  // Purity: advancing a run and scoring it must leave the input and its RNG state unchanged.
  let p = createRun(scenarioId, seed, ALL_TOOLS);
  for (let d = 0; d < 5; d++) p = stepRun(p, ALL_TOOLS).run;
  const before = JSON.stringify(p);
  stepRun(p, ALL_TOOLS, [{ type: 'event', event: { type: 'breakRecycler', level: 20 } }]);
  const scoreBefore = sim.score(p.sim);
  const scoreAfter = sim.score(p.sim);
  const cold = createRun(scenarioId, seed + 104_729, ALL_TOOLS);
  const coldBefore = JSON.stringify(cold);
  sim.score(cold.sim);
  const pure = JSON.stringify(p) === before && JSON.stringify(scoreBefore) === JSON.stringify(scoreAfter)
    && JSON.stringify(cold) === coldBefore;
  console.log(`Purity: ${pure ? 'PASS' : 'FAIL'} (stepRun and cold/cached score leave their inputs unchanged)`);

  const baseline = measured.find((r) => r.name === 'NO_MODULES')!;
  const baselineMatches = (r: Run) => r.score.baselineDeaths === r.deaths && r.score.livesSaved === 0;
  // Exercise cache keys in the same process, so a cache shared across seeds or scenarios fails here.
  const otherSeed = run('OTHER_SEED_BASELINE', NO_TOOLS, scenarioId, seed + 1);
  const otherScenario = sim.scenarios.find((s) => s.id !== p.sim.scenario.id);
  const scenarioBaseline = otherScenario ? run('OTHER_SCENARIO_BASELINE', NO_TOOLS, otherScenario.id, seed) : null;
  const baselineCorrect = baselineMatches(baseline) && baselineMatches(otherSeed)
    && (!scenarioBaseline || baselineMatches(scenarioBaseline))
    && measured.every((r) => r.score.baselineDeaths === baseline.deaths
      && r.score.livesSaved === Math.round(baseline.deaths) - Math.round(r.deaths));
  console.log(`Baseline: ${baselineCorrect ? 'PASS' : 'FAIL'} (no-module replay, seed/scenario separation, lives-saved arithmetic)`);

  let pairs = 0;
  const scoreInvariant = measured.every((a) => measured.every((b) => {
    if (a.deaths - b.deaths < 1_000) return true;
    pairs++;
    return a.score.total < b.score.total;
  }));

  // Test the boundary with the largest possible secondary reward on the run with more deaths.
  const synthetic = (deaths: number, bestSecondary: boolean): SimState => {
    const state = structuredClone(p.sim);
    state.day = bestSecondary ? MAX_DAYS : 0;
    state.end = bestSecondary ? { kind: 'stable', day: MAX_DAYS } : { kind: 'lost', day: 0, reason: 'Score boundary check' };
    state.totals.deaths = deaths;
    state.totals.population = state.totals.startPopulation - deaths;
    const internal = state.internal as { hour: number; darkLevel: number[] };
    internal.hour = 24;
    internal.darkLevel = internal.darkLevel.map((_, i) => bestSecondary || i === 0 ? 0 : 24);
    return state;
  };
  const worst = engineScore(synthetic(10_000, false), baseline.deaths);
  const thousandMore = engineScore(synthetic(11_000, true), baseline.deaths);
  const oneMore = engineScore(synthetic(10_001, true), baseline.deaths);
  const secondaryBound = thousandMore.total < worst.total && oneMore.total < worst.total;

  const moreFair = synthetic(10_000, false);
  const moreFairInternal = moreFair.internal as { darkLevel: number[] };
  moreFairInternal.darkLevel = moreFairInternal.darkLevel.map((_, i) => i === 0 ? 0 : 24 * 0.999);
  const lessFairBestSurvival = synthetic(10_000, false);
  lessFairBestSurvival.day = MAX_DAYS;
  lessFairBestSurvival.end = { kind: 'stable', day: MAX_DAYS };
  const moreDays = synthetic(10_000, false);
  moreDays.day = 1;
  moreDays.end = { kind: 'lost', day: 1, reason: 'Score boundary check' };
  const stableSameDay = structuredClone(moreDays);
  stableSameDay.end = { kind: 'stable', day: 1 };
  const fairScore = engineScore(moreFair, baseline.deaths);
  const daysScore = engineScore(moreDays, baseline.deaths);
  const secondaryOrdering = fairScore.fairness === 0.1
    && fairScore.total > engineScore(lessFairBestSurvival, baseline.deaths).total
    && daysScore.total > worst.total && engineScore(stableSameDay, baseline.deaths).total > daysScore.total;
  const loss = engineScore(synthetic(Math.round(baseline.deaths) + 1, false), baseline.deaths);
  const negativeLoss = loss.livesSaved === -1 && loss.total < 0;
  console.log(`Score ordering: ${secondaryOrdering && negativeLoss ? 'PASS' : 'FAIL'} (fairness before days/stability; excess deaths remain negative)`);
  console.log(`Score invariant: ${scoreInvariant && secondaryBound ? 'PASS' : 'FAIL'} (${pairs} pairs with at least 1,000 more deaths; worst-case bonuses at 1 and 1,000 lives)`);
  if (!same || !pure || !baselineCorrect || !scoreInvariant || !secondaryBound || !secondaryOrdering || !negativeLoss) proc.exit(1);
}

if (verbose) for (const r of runs) { console.log(`\n--- ${r.name} ---`); console.log(r.events.slice(0, 120).join('\n')); }
