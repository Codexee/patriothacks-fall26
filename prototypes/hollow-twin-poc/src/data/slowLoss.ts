// Slow-loss scenario: baseline demand, plus Plant 6 losing output over 2 weeks in the real shape of the SPP wind
// generation decline of Feb 6–19, 2021 (frozen turbines in a long cold spell; EIA-930). No weather is applied.
import type { Scenario } from '../sim/types.ts';
import { baseDemand } from './baseline.ts';
import { lossShape } from './lossShapes.ts';
import { flat, RUN_DAYS } from './shape.ts';

const PLANT = 5; // Plant 6 (index 5), on level 47
const START_DAY = 5;
const wind = lossShape('sppWind');

export const slowLoss: Scenario = {
  id: 'slowloss',
  name: 'Plant 6 slow 2-week loss shaped like the real SPP wind decline of Feb 6–19, 2021 (no storm, no demand surge)',
  summary:
    'Normal demand. From day 5, Plant 6 loses output slowly over 14 days, in the same shape as the wind output the ' +
    'Southwest Power Pool lost in the cold spell of Feb 2021 (smoothed over 24 hours). At the worst hour the whole ' +
    'plant is offline. After 2 weeks it returns.',
  days: RUN_DAYS,
  supply: flat(1),
  demand: baseDemand,
  plantLoss: { plant: PLANT, startHour: (START_DAY - 1) * 24, loss: wind.loss },
  source: wind.source,
};
