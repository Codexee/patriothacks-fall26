// SAMPLE DATA. Used only when public/results/checkfirst.json cannot be fetched; the site then shows a "sample data"
// banner. The shape follows CheckFirstFile exactly. The comparison rows copy the v2 "during" model results in
// models/RESULTS.md (with weather and grid inputs); the residents-only rows are placeholders, not measured.
import type { CheckFirstFile } from '../contracts.ts';

export const sampleCheckFirst: CheckFirstFile = {
  generated: '2026-11-19T12:00:00Z',
  name: 'Check-first model (residents-only)',
  task: 'At the start of an outage, rank the areas of the affected grid by how long they will stay dark, so responders check the longest-dark areas first.',
  method: 'LightGBM regression on log1p(dark hours), 300 trees, 7 leaves, at least 50 rows per leaf',
  inputs: [
    { name: 'out_prev1h', plain: 'Share of the area’s customers without power in the hour before the event start', hollowEquivalent: 'Residents’ outage reports from the section in the last hour' },
    { name: 'out_max_prev6h', plain: 'Highest share without power in the 6 hours before', hollowEquivalent: 'Highest share of residents reporting an outage in the last 6 hours' },
    { name: 'pop', plain: 'People in the area (Census)', hollowEquivalent: 'Head count of the section' },
    { name: 'past_dark_share', plain: 'Share of the area’s past events in which it went dark', hollowEquivalent: 'Share of past blackouts that reached the section, from residents’ own log' },
    { name: 'past_mean_hours', plain: 'Mean dark hours of the area in its past events', hollowEquivalent: 'Mean dark hours of the section in past blackouts, from residents’ own log' },
    { name: 'svi', plain: 'CDC Social Vulnerability Index percentile of the area', hollowEquivalent: 'Section level (deeper levels are poorer and more crowded)' },
    { name: 'n_areas_out', plain: 'Number of areas already reporting outages', hollowEquivalent: 'Number of sections already reporting outages' },
    { name: 'month', plain: 'Calendar month of the event start', hollowEquivalent: 'Calendar month (the Hollow keeps the surface calendar)' },
  ],
  excluded: [
    'Weather (temperature, dew point, wind, pressure, precipitation): the Hollow has no weather, and residents have no forecast.',
    'Grid-operator data (demand, forecast error, imports, fuel mix): the Directorate controls the plants and does not publish these.',
  ],
  periods: { train: '2015–2020', dev: '2021–2022', test: '2023–2024 (used once)' },
  test: {
    events: 390,
    areaEvents: 34_877,
    rows: [
      { metric: 'Top-10 overlap (share of the 10 longest-dark areas the model ranks in its top 10)', model: 0.41, history: 0.278, chance: 0.132, better: 'higher' },
      { metric: 'Within-event Spearman correlation (predicted vs actual dark hours)', model: 0.285, history: 0.22, chance: 0, better: 'higher' },
      { metric: 'Mean absolute error (hours)', model: 2.35, history: 3.58, chance: null, better: 'lower' },
    ],
  },
  dev: {
    events: 309,
    areaEvents: 19_708,
    rows: [
      { metric: 'Top-10 overlap (share of the 10 longest-dark areas the model ranks in its top 10)', model: 0.402, history: 0.256, chance: 0.135, better: 'higher' },
      { metric: 'Within-event Spearman correlation (predicted vs actual dark hours)', model: 0.301, history: 0.21, chance: 0, better: 'higher' },
      { metric: 'Mean absolute error (hours)', model: 2.52, history: 4.13, chance: null, better: 'lower' },
    ],
  },
  comparison: {
    label: 'The same model with weather and grid-operator inputs (v2, for reference; residents do not have these inputs)',
    rows: [
      { metric: 'Top-10 overlap (share of the 10 longest-dark areas the model ranks in its top 10)', model: 0.46, history: 0.278, chance: 0.132, better: 'higher' },
      { metric: 'Within-event Spearman correlation (predicted vs actual dark hours)', model: 0.31, history: 0.22, chance: 0, better: 'higher' },
      { metric: 'Mean absolute error (hours)', model: 2.23, history: 3.58, chance: null, better: 'lower' },
    ],
  },
  importance: [
    { feature: 'out_prev1h', share: 0.284 },
    { feature: 'pop', share: 0.121 },
    { feature: 'past_dark_share', share: 0.108 },
    { feature: 'out_max_prev6h', share: 0.097 },
    { feature: 'past_mean_hours', share: 0.083 },
    { feature: 'month', share: 0.071 },
    { feature: 'svi', share: 0.052 },
    { feature: 'n_areas_out', share: 0.044 },
  ],
  example: {
    event: 'Hurricane Beryl, ERCOT Houston area',
    date: '2024-07-08',
    topAreas: [
      { name: 'Harris County, TX', predictedHours: 41.5, actualHours: 52.0 },
      { name: 'Fort Bend County, TX', predictedHours: 36.2, actualHours: 44.5 },
      { name: 'Brazoria County, TX', predictedHours: 33.8, actualHours: 47.25 },
      { name: 'Galveston County, TX', predictedHours: 30.1, actualHours: 38.0 },
      { name: 'Montgomery County, TX', predictedHours: 27.4, actualHours: 21.75 },
    ],
  },
  limits: [
    'The model ranks areas; its hour estimates have a large error. Use the order, not the hours.',
    'Most real US outages come from storm damage to wires. The Hollow’s blackouts come from plant overload and aging. The ranking skill may not transfer in full.',
    'Without weather the model is weaker than the v2 model that had weather inputs.',
    'The test period was used once. Its result is one sample of 390 events.',
  ],
  source: { label: 'EAGLE-I outage records 2015–2024 (Oak Ridge National Laboratory)', detail: 'County-level customers out, every 15 minutes. 1,477 large outage events.', url: 'https://doi.org/10.6084/m9.figshare.24237376' },
};
