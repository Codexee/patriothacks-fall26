// PROTOTYPE scenario: Texas winter storm, Feb 2021 (approximate shape, not real hourly data yet).
import type { Scenario } from '../sim/types.ts';
import { hourlyFromDaily } from './shape.ts';

// Day 1 ≈ Feb 10. Generation outages from about Feb 15 to Feb 18 (days 5–9), then recovery.
const supplyDaily = [1.0, 1.0, 1.0, 1.0, 0.95, 0.6, 0.56, 0.6, 0.72, 0.92, 1.0];
// Demand rises with the cold, peaking around Feb 14–16.
const demandDaily = [1.0, 1.0, 1.02, 1.06, 1.15, 1.3, 1.3, 1.22, 1.1, 1.03, 1.0];

export const texas2021: Scenario = {
  id: 'texas2021',
  name: 'Texas, Feb 2021 (approximate)',
  summary: 'A winter storm takes about 40% of generation offline for four days while demand rises 30% in the cold.',
  days: supplyDaily.length,
  supply: hourlyFromDaily(supplyDaily, 0),
  demand: hourlyFromDaily(demandDaily, 0.05),
  source: {
    label: 'ERCOT, Feb 10–20, 2021 (approximate shape)',
    detail:
      'Approximate shape from public ERCOT/EIA reports; replace with EIA-930 hourly data. Supply is the share of normal generation available; demand is a multiplier on normal load. Both are rescaled to the 6 geothermal plants of the Hollow.',
    url: 'https://www.eia.gov/electricity/gridmonitor/',
  },
};
