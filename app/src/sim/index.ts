// PROTOTYPE sim API: the real seeded engine behind the SimApi contract (mock.ts stays as a reference).
import { NO_TOOLS, type MetricKey, type SimApi, type SimState, type Source, type ToolSet } from './types.ts';
import { scenarios } from '../data/index.ts';
import { createState, score, stepDay } from './engine.ts';
import { sourceFor as sourceForScenario } from './sources.ts';

// sourceFor has no scenario argument, so 'power' and 'scenario' describe the scenario of the last created state.
let current = scenarios[0];

// Memoization belongs at the API boundary; the engine scorer and day step stay pure.
// stepDay clones scenarios, so use their contents rather than object identity (or only their id).
const baselineCache = new Map<string, number>();
function baselineDeathsFor(state: SimState): number {
  const key = JSON.stringify([state.seed, state.scenario]);
  const cached = baselineCache.get(key);
  if (cached !== undefined) return cached;
  let baseline = createState(state.scenario, state.seed, NO_TOOLS);
  while (!baseline.end) baseline = stepDay(baseline, [{ type: 'outputs', outputs: [] }]).state;
  const deaths = baseline.totals.deaths;
  baselineCache.set(key, deaths);
  return deaths;
}

export const sim: SimApi = {
  scenarios,
  createState(scenarioId: string, seed: number, tools: ToolSet) {
    const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
    current = scenario;
    return createState(scenario, seed, tools);
  },
  stepDay,
  score(state) {
    return score(state, baselineDeathsFor(state));
  },
  sourceFor(metric: MetricKey | 'directorate' | 'scenario'): Source {
    return sourceForScenario(metric, current);
  },
};
