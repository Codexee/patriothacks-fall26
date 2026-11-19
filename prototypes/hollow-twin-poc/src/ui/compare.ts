// PROTOTYPE: batch runs (Compare, Attribution) and Shapley values. Each run is the residents' system + the sim.
import { sim } from '../sim/index.ts';
import { NO_TOOLS, type EndState, type Score, type ToolKey, type ToolSet } from '../sim/types.ts';
import { createRun, stepRun, type Run } from '../product/run.ts';
import { BUILT, MODULE_NAMES } from '../product/names.ts';

/** REBUILD: only the features built so far appear on screen. */
export const TOOL_KEYS: ToolKey[] = BUILT;
export const TOOL_LABELS: Record<ToolKey, string> = MODULE_NAMES;
/** The track's problem numbers each module answers. */
export const TOOL_PROBLEMS: Record<ToolKey, string> = {
  earlyWarning: '1', fairShare: '2', ledger: '9', snow: '4', lantern: '7', kin: '8', layout: '3', larder: '12, 2', witness: '13',
};
export const TOOL_HINTS: Record<ToolKey, string> = {
  lantern: 'When the Directorate cuts the network, carries every alert and report phone to phone; places battery relays to bridge dark levels.',
  kin: 'Family check-ins across levels; sends neighbors to check on sections whose families go quiet.',
  layout: 'Moves fans from cool upper levels to the hottest deep levels, from the sensor boxes.',
  larder: 'Tracks each level\'s food runway; carries food from surplus levels and builds grow-lamp farms where it runs out.',
  witness: 'Verifies signed surface probe readings, rejects fakes, and broadcasts whether the surface is safe.',
  earlyWarning: 'Forecasts the power coming (plant meters × the public outlook) against the power needed, works out which levels will go dark and when, and warns them ahead, including when their air turns unsafe.',
  fairShare: 'Plans power from the census: life support in every section first, then the same share for all, more for hot levels and farms.',
  ledger: 'Checks Directorate claims against residents\' own data (including the real outbreak count) and publishes them in a record nobody can quietly change.',
  snow: 'Traces water complaints and tap readings to the failing recycler, warns only the levels it serves, sends a repair crew.',
};

/** Safety cap so a run that never ends cannot hang the page. */
export const MAX_DAYS = 365;

export interface RunResult {
  tools: ToolSet;
  days: number; // days survived (the day the run ended, or the cap)
  end: EndState | null; // null when the cap was reached first
  deaths: number;
  airDeaths: number;
  warnedPct: number; // share of blackout person-hours residents were warned about ahead
  blackoutHours: number; // person-hours without life support
  score: Score;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Steps a run to its end (or the cap) with no animation. */
export function finishRun(start: Run, tools: ToolSet): Run {
  let run = start;
  while (!run.sim.end && run.sim.day < MAX_DAYS) run = stepRun(run, tools).run;
  return run;
}

export function runToEnd(scenarioId: string, seed: number, tools: ToolSet): RunResult {
  const end = finishRun(createRun(scenarioId, seed, tools), tools).sim;
  return {
    tools,
    days: end.end ? end.end.day : end.day,
    end: end.end,
    deaths: end.totals.deaths,
    airDeaths: end.totals.airDeaths,
    blackoutHours: end.totals.blackoutPersonHours,
    warnedPct: end.totals.blackoutPersonHours > 0 ? Math.round((end.totals.warnedPersonHours / end.totals.blackoutPersonHours) * 100) : 0,
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

/** Orderings sampled for the Shapley estimate. 9 modules have 512 subsets; exact values would need 512 runs. */
export const ORDERINGS = 6;

export interface Attribution {
  runs: Map<number, RunResult>; // by bitmask over TOOL_KEYS (only the subsets the sampled orderings needed)
  phi: Record<ToolKey, number>;
  orderings: number;
}

/**
 * Shapley values by sampled orderings (Castro et al. 2009): add the modules one by one in a random order and
 * credit each with the lives saved when it joins; average over the orderings. Each subset runs only once.
 * Value = lives saved (−deaths): days survived misleads, because a stable run ends early.
 */
export async function attribution(
  scenarioId: string, seed: number, onProgress: (done: number, total: number) => void,
): Promise<Attribution> {
  const n = TOOL_KEYS.length;
  const runs = new Map<number, RunResult>();
  const value = async (mask: number) => {
    if (!runs.has(mask)) { runs.set(mask, runToEnd(scenarioId, seed, toolsFromMask(mask))); await tick(); }
    return -runs.get(mask)!.deaths;
  };
  let rng = 0x5eed ^ seed;
  const rand = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
  const phi = Object.fromEntries(TOOL_KEYS.map((k) => [k, 0])) as Record<ToolKey, number>;
  const total = ORDERINGS * n;
  let done = 0;
  for (let o = 0; o < ORDERINGS; o++) {
    const order = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    let mask = 0;
    let prev = await value(0);
    for (const i of order) {
      mask |= 1 << i;
      const v = await value(mask);
      phi[TOOL_KEYS[i]] += (v - prev) / ORDERINGS;
      prev = v;
      onProgress(++done, total);
    }
  }
  return { runs, phi, orderings: ORDERINGS };
}
