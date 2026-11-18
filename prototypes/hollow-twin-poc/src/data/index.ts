// PROTOTYPE scenario packs. Texas first: it is the demo scenario.
import type { Scenario } from '../sim/types.ts';
import { texas2021 } from './texas2021.ts';
import { chicago1995, chicago1995Heat } from './chicago1995.ts';
import { baseline } from './baseline.ts';

export const scenarios: Scenario[] = [texas2021, chicago1995, baseline];

const heat: Record<string, number[]> = { chicago1995: chicago1995Heat };

/** Extra wet-bulb heat (°C) for an absolute hour of a scenario. 0 when the scenario has no heat data. */
export function heatOffsetFor(scenarioId: string, hour: number): number {
  const arr = heat[scenarioId];
  if (!arr || hour >= arr.length) return 0;
  return arr[hour];
}
