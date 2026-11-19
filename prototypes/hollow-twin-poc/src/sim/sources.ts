// PROTOTYPE sources for the hover card. Every model in engine.ts names its source here.
import type { MetricKey, Scenario, Source } from './types.ts';

export const SCALE_NOTE =
  'The Hollow holds 2 billion people; the sim uses about 1.6 million (2,000 per section at level 1 to 6,000 at level 50) as a scaled stand-in, so rates and shares transfer, not head counts.';

const fixed: Record<'co2' | 'infected' | 'wetBulb' | 'directorate' | 'water' | 'food', Source> = {
  co2: {
    label: 'CO₂ mass balance (Persily & de Jonge 2017)',
    detail:
      'Per section: dC/dt = (N·G − Q·v·(C − 420 ppm))/V, with a CO₂ generation G ≈ 0.0052 L/s per person. Fans (v) need power; with full power a section settles near 800–1,200 ppm. ' +
      SCALE_NOTE,
    url: 'https://doi.org/10.1111/ina.12383',
  },
  infected: {
    label: 'Wells–Riley with the Rudnick–Milton CO₂ method (2003)',
    detail:
      'Rebreathed fraction f = (C − 420)/38,000. Hourly infection chance P = 1 − exp(−f·I·q/n), with q ≈ 25 quanta/h times a shared-air exposure share, a crowding factor, and isolation when residents respond. Recovery after about 10 days; deaths rise with distance to a clinic.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/12950586/',
  },
  wetBulb: {
    label: 'Wet-bulb limit 31 °C (Vecellio et al. 2022)',
    detail:
      'Rock heat rises with depth: about 22 °C wet-bulb at level 1 to 31 °C at level 50. Cooling needs power; without it a section drifts toward base + 6 °C. Above 31 °C wet-bulb (the measured limit for young healthy adults), hourly mortality rises with the excess.',
    url: 'https://doi.org/10.1152/japplphysiol.00738.2021',
  },
  directorate: {
    label: "The Directorate's census",
    detail:
      "The track brief says 2 billion people live in the Hollow. It says the Directorate's public numbers don't match what people see, but only about the lung-sickness outbreak, not the population. So the census here is accurate. (WORLD.census in the engine can switch on an undercount of the deep levels; that is our assumption, not the brief.) Population is shown at the Hollow's scale: each simulated person stands for about 1,250.",
    url: 'https://www.census.gov/programs-surveys/decennial-census/about/coverage-measurement.html',
  },
  water: {
    label: 'Water recyclers (illustrative model)',
    detail:
      'Illustrative model, not a dataset: about 1 recycler every 5 levels serves ±2 levels. Quality falls when a recycler is unpowered and as it ages. Below 0.6, waterborne sickness and deaths rise. Boiling and rationing raise the effective quality.',
    url: 'https://www.who.int/publications/i/item/9789240045064',
  },
  food: {
    label: 'Farm lamps and reserves (illustrative model)',
    detail:
      'Illustrative model, not a dataset: farms every 4 levels need lamp power to grow food for ±3 levels. Each section starts with 20 days of reserve and uses 1 day per day. With no reserve, residents starve slowly.',
    url: 'https://www.fao.org/state-of-food-security-nutrition',
  },
};

export function sourceFor(metric: MetricKey | 'directorate' | 'scenario', scenario: Scenario): Source {
  if (metric === 'power' || metric === 'scenario') return scenario.source;
  return fixed[metric];
}
