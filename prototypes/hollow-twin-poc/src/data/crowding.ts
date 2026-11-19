// Crowding scenario: baseline demand, plus 4 real years of county population growth (workstream 3,
// SectionRow.growthPerYear) played in the 120-day run. The engine ignores growthYears until sections.ts has data.
import type { Scenario } from '../sim/types.ts';
import { sections } from './real/index.ts';
import { baseDemand } from './baseline.ts';
import { flat, RUN_DAYS } from './shape.ts';

export const crowding: Scenario = {
  id: 'crowding',
  name: 'Crowding (4 years of real county growth, played in 120 days)',
  summary: sections
    ? 'Normal plants and demand. Each section grows at the real 2020–2024 rate of its counties. Four real years are played in the 120-day run, so one day here is about 12 real days.'
    : 'Normal plants and demand. Real county growth is not loaded yet, so this run is the same as Baseline.',
  days: RUN_DAYS,
  supply: flat(1),
  demand: baseDemand,
  growthYears: 4,
  minDays: 60, // 2 real years of growth before the run may end as stable (same choice as Aging)
  source: sections
    ? sections.source
    : {
        label: 'US Census Bureau county population estimates, 2020–2024 (not loaded yet)',
        detail: 'Section growth comes from the real growth of its counties (workstream 3). Until that data is built, the sections do not grow.',
        url: 'https://www.census.gov/programs-surveys/popest.html',
      },
};
