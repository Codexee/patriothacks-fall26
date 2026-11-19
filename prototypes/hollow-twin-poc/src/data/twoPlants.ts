// Two-plant scenario: baseline demand, plus 2 plants losing output at the same time, in the real shapes of two
// balancing authorities' coal losses in the same event, Winter Storm Elliott, Dec 23–26, 2022 (EIA-930):
// Plant 4 like TVA and Plant 5 like Duke Energy Progress East (CPLE), on one clock so their real timing is kept.
import type { Scenario } from '../sim/types.ts';
import { baseDemand } from './baseline.ts';
import { lossShape } from './lossShapes.ts';
import { flat, RUN_DAYS } from './shape.ts';

const START_DAY = 5;
const tva = lossShape('elliottTva');
const cple = lossShape('elliottCple');

export const twoPlants: Scenario = {
  id: 'twoplants',
  name: 'Plants 4 and 5 lost together, shaped like the real TVA and CPLE coal losses of Dec 23–26, 2022 (no storm, no demand surge)',
  summary:
    'Normal demand. From day 5, two plants lose output at once: Plant 4 in the shape of the TVA coal loss and Plant 5 in ' +
    'the shape of the Duke Energy Progress East (CPLE) coal loss in Winter Storm Elliott, with their real timing. At ' +
    'each worst hour the whole plant is offline; for about a day both are down together. After 4 days they return.',
  days: RUN_DAYS,
  supply: flat(1),
  demand: baseDemand,
  plantLoss: [
    { plant: 3, startHour: (START_DAY - 1) * 24, loss: tva.loss }, // Plant 4, level 34
    { plant: 4, startHour: (START_DAY - 1) * 24, loss: cple.loss }, // Plant 5, level 41
  ],
  source: {
    label: 'EIA-930 hourly grid data: TVA coal and CPLE coal, Winter Storm Elliott',
    detail: `Plant 4: ${tva.source.detail} Plant 5: ${cple.source.detail}`,
    url: tva.source.url,
  },
};
