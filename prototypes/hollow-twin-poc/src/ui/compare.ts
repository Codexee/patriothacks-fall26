// PROTOTYPE: batch runs (Compare, Attribution) and Shapley values. Uses only SimApi.
import { sim } from '../sim/index.ts';
import { NO_TOOLS, type EndState, type Score, type SimState, type ToolKey, type ToolSet } from '../sim/types.ts';

export const TOOL_KEYS: ToolKey[] = ['earlyWarning', 'fairShare', 'ledger', 'layout'];
export const TOOL_LABELS: Record<ToolKey, string> = {
  earlyWarning: 'Early Warning',
  fairShare: 'Fair Share',
  ledger: 'Ledger',
  layout: 'Layout',
};

/** Safety cap so a run that never ends cannot hang the page. */
export const MAX_DAYS = 365;

export interface RunResult {
  tools: ToolSet;
  days: number; // days survived (the day the run ended, or the cap)
  end: EndState | null; // null when the cap was reached first
  deaths: number;
  score: Score;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Steps one state to its end (or the cap) with no animation. */
export function finishRun(start: SimState, tools: ToolSet): SimState {
  let state = start;
  let first = true;
  while (!state.end && state.day < MAX_DAYS) {
    state = sim.stepDay(state, first ? [{ type: 'setTools', tools }] : []).state;
    first = false;
  }
  return state;
}

export function runToEnd(scenarioId: string, seed: number, tools: ToolSet): RunResult {
  const end = finishRun(sim.createState(scenarioId, seed, tools), tools);
  return {
    tools,
    days: end.end ? end.end.day : end.day,
    end: end.end,
    deaths: end.totals.deaths,
    score: sim.score(end),
  };
}

export async function compareRuns(scenarioId: string, seed: number, tools: ToolSet) {
  const without = runToEnd(scenarioId, seed, NO_TOOLS);
  await tick();
  const withTools = runToEnd(scenarioId, seed, tools);
  return { without, withTools };
}

function toolsFromMask(mask: number): ToolSet {
  const t = { ...NO_TOOLS };
  TOOL_KEYS.forEach((k, i) => { t[k] = (mask & (1 << i)) !== 0; });
  return t;
}

const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const popcount = (m: number) => TOOL_KEYS.reduce((c, _, i) => c + ((m >> i) & 1), 0);

/** φ_i = Σ_{S ⊆ N\{i}} |S|!(n−|S|−1)!/n! × (v(S∪{i}) − v(S)) */
export function shapley(v: number[]): Record<ToolKey, number> {
  const n = TOOL_KEYS.length;
  const out = {} as Record<ToolKey, number>;
  TOOL_KEYS.forEach((k, i) => {
    let phi = 0;
    for (let s = 0; s < 1 << n; s++) {
      if (s & (1 << i)) continue;
      const size = popcount(s);
      phi += (fact(size) * fact(n - size - 1)) / fact(n) * (v[s | (1 << i)] - v[s]);
    }
    out[k] = phi;
  });
  return out;
}

export interface Attribution {
  runs: RunResult[]; // indexed by bitmask over TOOL_KEYS
  phi: Record<ToolKey, number>;
}

export async function attribution(
  scenarioId: string, seed: number, onProgress: (done: number, total: number) => void,
): Promise<Attribution> {
  const total = 1 << TOOL_KEYS.length;
  const runs: RunResult[] = [];
  for (let mask = 0; mask < total; mask++) {
    runs.push(runToEnd(scenarioId, seed, toolsFromMask(mask)));
    onProgress(mask + 1, total);
    await tick(); // let the browser paint the progress bar
  }
  return { runs, phi: shapley(runs.map((r) => r.days)) };
}
