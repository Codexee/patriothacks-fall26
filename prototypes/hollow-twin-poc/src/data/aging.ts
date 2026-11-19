// Aging scenario: baseline demand, plus plants that lose output at the real post-peak rate of The Geysers,
// the largest geothermal field in the world. 4 real years are played in the 120-day run.
import type { Scenario } from '../sim/types.ts';
import { baseDemand } from './baseline.ts';
import { flat, RUN_DAYS } from './shape.ts';

/** The Geysers: output fell about 10% per year after its late-1980s peak (Foulger et al. 1997, citing Barker et al. 1992). */
const DECLINE_PER_YEAR = 0.1;
const REAL_YEARS = 4;
/** Share of output lost after 4 real years, compounded: 1 - 0.9^4 = 0.344. */
const LOST = 1 - (1 - DECLINE_PER_YEAR) ** REAL_YEARS;

export const aging: Scenario = {
  id: 'aging',
  name: 'Aging plants (4 years of real geothermal decline, played in 120 days)',
  summary:
    'Normal demand. Every plant loses output at the real rate of The Geysers after its peak: about 10% a year. ' +
    'Four real years (34% of output) are played in the 120-day run, so one day here is about 12 real days.',
  days: RUN_DAYS,
  supply: flat(1),
  demand: baseDemand,
  agingPerDay: LOST / RUN_DAYS, // 0.00287 health a day (the guess for every other scenario is 0.002)
  // 60 days = 2 real years. By then the plants have lost about 17% (below the 10% capacity margin from day ~32),
  // so the decline has at least 4 weeks to show its effect before the run may end as stable.
  minDays: 60,
  source: {
    label: 'The Geysers geothermal field: output decline after the 1987 peak (Foulger et al. 1997)',
    detail:
      'Foulger, Grant, Ross and Julian, Geophysical Research Letters 24(2), 1997, doi:10.1029/96GL03152: production peaked in the ' +
      'late 1980s at about 1,800 MW and then fell by about 10% per year (Barker et al. 1992) because reservoir pressure fell. ' +
      'Here: 1 - 0.9^4 = 34% lost over 4 years, spread evenly over the 120-day run (0.29% of plant health a day). Demand: EIA-930 ERCOT calm weeks.',
    url: 'https://doi.org/10.1029/96GL03152',
  },
};
