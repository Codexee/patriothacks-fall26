// PROTOTYPE sim API: the real seeded engine behind the SimApi contract (mock.ts stays as a reference).
import type { MetricKey, SimApi, Source, ToolSet } from './types.ts';
import { scenarios } from '../data/index.ts';
import { createState, score, stepDay } from './engine.ts';
import { sourceFor as sourceForScenario } from './sources.ts';

// sourceFor has no scenario argument, so 'power' and 'scenario' describe the scenario of the last created state.
let current = scenarios[0];

export const sim: SimApi = {
  scenarios,
  createState(scenarioId: string, seed: number, tools: ToolSet) {
    const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
    current = scenario;
    return createState(scenario, seed, tools);
  },
  stepDay,
  score,
  sourceFor(metric: MetricKey | 'directorate' | 'scenario'): Source {
    return sourceForScenario(metric, current);
  },
};
