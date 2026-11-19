// Cascade scenario: baseline demand, plus Plant 2 losing output in the real shape of the ERCOT net generation
// loss of Feb 15–18, 2021 (EIA-930). There is no storm and no demand surge: only the shape of the loss is used.
import type { Scenario } from '../sim/types.ts';
import { grid } from './real/index.ts';
import { baseDemand } from './baseline.ts';
import { flat, hourlyFromDaily, RUN_DAYS } from './shape.ts';

const PLANT = 1; // Plant 2 (index 1), on level 18
const START_DAY = 5;

/** Fallback when grid.ts is null: the old approximate Texas supply shape (days 5–11), as a share of one plant lost. */
const GUESS_LOSS = hourlyFromDaily([0.05, 0.4, 0.44, 0.4, 0.28, 0.08, 0], 0).map((v) => Math.round((v / 0.44) * 1000) / 1000);

export const cascade: Scenario = {
  id: 'cascade',
  name: 'Plant 2 loss shaped like the real ERCOT generation loss of Feb 2021 (no storm, no demand surge)',
  summary:
    'Normal demand. From day 5, Plant 2 loses output hour by hour in the same shape as the net generation ERCOT lost ' +
    'in the rotating outages of Feb 15–18, 2021. At the worst hour the whole plant is offline. After 4 days it returns.',
  days: RUN_DAYS,
  supply: flat(1),
  demand: baseDemand,
  plantLoss: { plant: PLANT, startHour: (START_DAY - 1) * 24, loss: grid ? grid.cascadeLoss : GUESS_LOSS },
  source: grid
    ? grid.source
    : {
        label: 'ERCOT, Feb 2021 (approximate shape)',
        detail: 'Approximate shape from public ERCOT/EIA reports, used until the EIA-930 data is built. Peak = one whole plant lost.',
        url: 'https://www.eia.gov/electricity/gridmonitor/',
      },
};
