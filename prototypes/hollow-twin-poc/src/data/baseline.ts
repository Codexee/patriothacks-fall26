// PROTOTYPE scenario: steady conditions with a normal daily cycle.
import type { Scenario } from '../sim/types.ts';
import { hourlyFromDaily } from './shape.ts';

export const baseline: Scenario = {
  id: 'baseline',
  name: 'Baseline (steady)',
  summary: 'Normal supply and demand. Only aging, the lies of the Directorate and the outbreak cause trouble.',
  days: 1,
  supply: hourlyFromDaily([1.0], 0),
  demand: hourlyFromDaily([1.0], 0.05),
  source: {
    label: 'Steady baseline (illustrative)',
    detail: 'Constant plant supply and a ±5% daily demand cycle. It is an illustrative reference, not a dataset.',
    url: 'https://www.eia.gov/electricity/gridmonitor/',
  },
};
