// Scenario packs. The hidden world has no weather: every scenario has normal supply and the real ERCOT demand week.
// Texas 2021 and Chicago 1995 (storm and heat wave) were removed; they are in git history.
import type { Scenario } from '../sim/types.ts';
import { baseline } from './baseline.ts';
import { aging } from './aging.ts';
import { crowding } from './crowding.ts';
import { cascade } from './cascade.ts';

export const scenarios: Scenario[] = [cascade, baseline, aging, crowding];

/** Extra wet-bulb heat (°C) for an absolute hour of a scenario. Always 0: no scenario has weather. */
export function heatOffsetFor(_scenarioId: string, _hour: number): number {
  return 0;
}
