// PROTOTYPE scenario: Chicago heat wave, July 1995 (approximate shape).
import type { Scenario } from '../sim/types.ts';
import { hourlyFromDaily } from './shape.ts';

// Day 1 ≈ July 10. The worst heat was July 12–16 (days 3–7).
const supplyDaily = [1.0, 0.98, 0.95, 0.92, 0.9, 0.92, 0.95, 0.98, 1.0, 1.0];
const demandDaily = [1.0, 1.05, 1.15, 1.22, 1.25, 1.2, 1.12, 1.05, 1.0, 1.0];
/** Extra wet-bulb heat (°C) added to every section. The engine reads it through heatOffsetFor(). */
const heatDaily = [0, 0.5, 2, 3, 3.5, 3, 2, 1, 0, 0];

export const chicago1995Heat: number[] = hourlyFromDaily(heatDaily, 0.15);

export const chicago1995: Scenario = {
  id: 'chicago1995',
  name: 'Chicago, July 1995 (approximate)',
  summary: 'Five days of extreme heat raise cooling demand and add up to 3.5 °C of wet-bulb heat in every section.',
  days: supplyDaily.length,
  supply: hourlyFromDaily(supplyDaily, 0),
  demand: hourlyFromDaily(demandDaily, 0.06),
  source: {
    label: 'Chicago heat wave, July 12–16, 1995 (approximate shape)',
    detail:
      'Approximate shape from public NOAA reports of the July 1995 heat wave; replace with NOAA hourly temperature and humidity data. The heat raises cooling demand and adds a wet-bulb offset in the Hollow.',
    url: 'https://www.ncei.noaa.gov/access/search/data-search/global-hourly',
  },
};
