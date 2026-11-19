// Elliott scenario: baseline demand, plus Plant 4 losing output in the real shape of the TVA coal generation loss
// during Winter Storm Elliott, Dec 23–26, 2022 (EIA-930). No storm and no demand surge: only the shape is used.
import type { Scenario } from '../sim/types.ts';
import { baseDemand } from './baseline.ts';
import { lossShape } from './lossShapes.ts';
import { flat, RUN_DAYS } from './shape.ts';

const PLANT = 3; // Plant 4 (index 3), on level 34
const START_DAY = 5;
const tva = lossShape('elliottTva');

export const elliott: Scenario = {
  id: 'elliott',
  name: 'Plant 4 loss shaped like the real TVA coal loss of Dec 23–26, 2022 (no storm, no demand surge)',
  summary:
    'Normal demand. From day 5, Plant 4 loses output hour by hour in the same shape as the coal output the Tennessee ' +
    'Valley Authority lost in Winter Storm Elliott, while its demand set a record. At the worst hour the whole plant ' +
    'is offline. After 4 days it returns.',
  days: RUN_DAYS,
  supply: flat(1),
  demand: baseDemand,
  plantLoss: { plant: PLANT, startHour: (START_DAY - 1) * 24, loss: tva.loss },
  source: tva.source,
};
