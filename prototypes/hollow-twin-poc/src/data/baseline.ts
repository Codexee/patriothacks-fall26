// Baseline scenario: plant supply 1 and the real weekly demand cycle of calm ERCOT weeks (EIA-930, 2023).
// When src/data/real/grid.ts is null, it falls back to the old illustrative ±5% daily cycle.
import type { Scenario, Source } from '../sim/types.ts';
import { grid } from './real/index.ts';
import { hourlyFromDaily, repeatWeek, flat, RUN_DAYS } from './shape.ts';

/** Fallback week: the old ±5% daily cycle, 7 days. */
const GUESS_WEEK = Array.from({ length: 7 }, () => hourlyFromDaily([1.0], 0.05)).flat();

/** Demand multiplier per hour for every real-data scenario (the real week, repeated over the run). */
export const baseDemand: number[] = repeatWeek(grid ? grid.demandWeek : GUESS_WEEK);

export const demandSource: Source = grid
  ? grid.source
  : {
      label: 'Steady baseline (illustrative)',
      detail: 'Constant plant supply and a ±5% daily demand cycle. It is an illustrative reference, not a dataset.',
      url: 'https://www.eia.gov/electricity/gridmonitor/',
    };

export const baseline: Scenario = {
  id: 'baseline',
  name: 'Baseline (real weekly demand)',
  summary: grid
    ? 'Normal plants. Demand follows the real hourly and weekly cycle of calm ERCOT weeks in 2023. Plants still age, and the Hollow runs close to its limit, so overloaded plants can still trip.'
    : 'Normal supply and demand. Plants still age, and the Hollow runs close to its limit, so overloaded plants can still trip.',
  days: RUN_DAYS,
  supply: flat(1),
  demand: baseDemand,
  source: demandSource,
};
