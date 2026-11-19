// SAMPLE DATA. Used only when public/results/scenarios.json cannot be fetched; the site then shows a "sample data"
// banner. The shape follows ScenariosFile exactly. The values are generated to look like the Step 2 test-set results
// in REBUILD.md (about 275,000–356,000 deaths per run without the module, a few hundred or fewer with it), but they
// are not measured. Three of the scenarios (elliott, caiso2020, spp2021) are placeholders for workstream A's new ones.
import type { DailyPoint, Interval, RunStats, ScenarioResult, ScenariosFile } from '../contracts.ts';
import { tInterval } from '../stats.ts';

const SEEDS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const DAYS = 120;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Spec {
  id: string;
  name: string;
  summary: string;
  kind: ScenarioResult['kind'];
  realData: string;
  source: ScenarioResult['source'];
  without: number; // mean deaths per run
  with: number; // mean deaths per run
  start: number; // day the failure starts to bite
  withEnd: number; // typical stable day with the module
  minEnd?: number;
}

const SPECS: Spec[] = [
  {
    id: 'cascade', kind: 'plant-loss', start: 5, withEnd: 16, without: 318_400, with: 96,
    name: 'Cascade: Plant 2 loses output like ERCOT in Feb 2021',
    summary: 'Plant 2 loses output in the shape of the real ERCOT generation loss of Feb 15–18, 2021 (peak 32% below Feb 14), from day 5. No storm, no demand surge.',
    realData: 'ERCOT net generation, Feb 14–18, 2021 (EIA-930)',
    source: { label: 'EIA-930 Hourly Electric Grid Monitor', detail: 'ERCOT net generation by hour, Feb 14–18, 2021. Peak loss 19.5 GW below Feb 14.', url: 'https://www.eia.gov/electricity/gridmonitor/' },
  },
  {
    id: 'baseline', kind: 'baseline', start: 9, withEnd: 16, without: 279_100, with: 41,
    name: 'Baseline: the real demand week, no extra failure',
    summary: 'Normal plants. Demand follows the real hourly and weekly cycle of calm ERCOT weeks in 2023. Plants still age, and the Hollow runs close to its limit, so overloaded plants can still trip.',
    realData: 'ERCOT hourly demand, 36 calm weeks of 2023 (EIA-930)',
    source: { label: 'EIA-930 Hourly Electric Grid Monitor', detail: 'ERCOT hourly demand, 36 calm weeks of 2023, as a 168-hour week (0.82–1.17 × mean).', url: 'https://www.eia.gov/electricity/gridmonitor/' },
  },
  {
    id: 'aging', kind: 'aging', start: 12, withEnd: 67, minEnd: 60, without: 352_600, with: 148,
    name: 'Aging: plants lose output like The Geysers after its peak',
    summary: 'Every plant loses output at the real rate of The Geysers after its peak: about 10% a year. Four real years are played in the 120-day run.',
    realData: 'The Geysers geothermal output decline, about 10% a year (Foulger et al. 1997)',
    source: { label: 'Foulger et al. 1997, Geophysical Research Letters', detail: 'Post-peak decline of steam production at The Geysers, California.', url: 'https://doi.org/10.1029/97GL00151' },
  },
  {
    id: 'crowding', kind: 'crowding', start: 10, withEnd: 73, minEnd: 60, without: 290_800, with: 77,
    name: 'Crowding: sections grow like their real counties',
    summary: 'Each section grows at its real counties’ 2020–2024 rate. Four real years are played in the 120-day run.',
    realData: 'US Census county population estimates, 2020–2024',
    source: { label: 'US Census Bureau, county population totals 2020–2024', detail: 'Vintage 2024 county estimates, mapped to sections by CDC SVI level.', url: 'https://www.census.gov/data/tables/time-series/demo/popest/2020s-counties-total.html' },
  },
  {
    id: 'elliott', kind: 'plant-loss', start: 6, withEnd: 18, without: 331_200, with: 122,
    name: 'Freeze trip: plants lose output like TVA in Dec 2022',
    summary: 'Two plants lose output in the shape of the real TVA generation loss during Winter Storm Elliott, Dec 23–24, 2022, from day 6. No storm, no demand surge.',
    realData: 'TVA net generation, Dec 22–25, 2022 (EIA-930)',
    source: { label: 'EIA-930 Hourly Electric Grid Monitor', detail: 'TVA net generation by hour, Dec 22–25, 2022.', url: 'https://www.eia.gov/electricity/gridmonitor/' },
  },
  {
    id: 'caiso2020', kind: 'plant-loss', start: 7, withEnd: 17, without: 301_500, with: 63,
    name: 'Short fall: supply drops like CAISO in Aug 2020',
    summary: 'Plant 3 loses output in the shape of the real CAISO supply shortfall of Aug 14–15, 2020, from day 7.',
    realData: 'CAISO net generation and imports, Aug 13–16, 2020 (EIA-930)',
    source: { label: 'EIA-930 Hourly Electric Grid Monitor', detail: 'CAISO net generation and interchange by hour, Aug 13–16, 2020.', url: 'https://www.eia.gov/electricity/gridmonitor/' },
  },
  {
    id: 'spp2021', kind: 'plant-loss', start: 5, withEnd: 19, without: 339_900, with: 135,
    name: 'Long loss: plants lose output like SPP in Feb 2021',
    summary: 'Plants 1 and 4 lose output in the shape of the real SPP generation loss of Feb 15–16, 2021, from day 5.',
    realData: 'SPP net generation, Feb 14–17, 2021 (EIA-930)',
    source: { label: 'EIA-930 Hourly Electric Grid Monitor', detail: 'SPP net generation by hour, Feb 14–17, 2021.', url: 'https://www.eia.gov/electricity/gridmonitor/' },
  },
];

const fixed = (v: number): Interval => ({ mean: v, lo: v, hi: v });

function curve(day: number, start: number, total: number, steep: number) {
  if (day < start) return 0;
  const x = (day - start) / steep;
  return total * (1 - Math.exp(-x * x));
}

function build(spec: Spec, idx: number): ScenarioResult {
  const r = rng(1000 + idx * 97);
  const seeds = SEEDS.map((seed) => {
    const wo = Math.round(spec.without * (0.88 + 0.24 * r()));
    // With the module most seeds end with few deaths; one or two seeds carry most of them.
    const heavy = r() < 0.2;
    const wi = Math.round(spec.with * (heavy ? 2.5 + 2 * r() : 0.2 + 0.9 * r()));
    const end = Math.max(spec.minEnd ?? 0, Math.round(spec.withEnd + (r() - 0.4) * 8));
    return { seed, wo, wi, end, tripsWo: Math.round(180 + 90 * r()), tripsWi: Math.round(r() * 5), darkWo: 1800 + 900 * r(), darkWi: 1 + 6 * r() };
  });
  const daily: DailyPoint[] = [];
  const woMean = seeds.reduce((a, s) => a + s.wo, 0) / seeds.length;
  const wiMean = seeds.reduce((a, s) => a + s.wi, 0) / seeds.length;
  const endMean = seeds.reduce((a, s) => a + s.end, 0) / seeds.length;
  for (let day = 1; day <= DAYS; day++) {
    const woDark = day < spec.start ? 2 * r() : 120 + 140 * Math.min(1, (day - spec.start) / 25) + 30 * (r() - 0.5);
    const wiDark = day < spec.start || day > endMean + 4 ? 0 : 3 * r();
    daily.push({
      day,
      withoutDeaths: Math.round(curve(day, spec.start, woMean, 55)),
      withDeaths: Math.round(curve(day, spec.start, wiMean, Math.max(6, endMean - spec.start))),
      withoutDarkSections: Math.max(0, +woDark.toFixed(1)),
      withDarkSections: +wiDark.toFixed(1),
    });
  }
  daily[DAYS - 1].withoutDeaths = Math.round(woMean);
  daily[DAYS - 1].withDeaths = Math.round(wiMean);
  const without: RunStats = {
    deaths: tInterval(seeds.map((s) => s.wo)),
    trips: tInterval(seeds.map((s) => s.tripsWo)),
    darkMh: tInterval(seeds.map((s) => s.darkWo)),
    stableShare: 0,
    endDay: fixed(DAYS),
    warnedPct: 0,
  };
  const withStats: RunStats = {
    deaths: tInterval(seeds.map((s) => s.wi)),
    trips: tInterval(seeds.map((s) => s.tripsWi)),
    darkMh: tInterval(seeds.map((s) => s.darkWi)),
    stableShare: 1,
    endDay: tInterval(seeds.map((s) => s.end)),
    warnedPct: 0.48 + 0.14 * r(),
  };
  return {
    id: spec.id, name: spec.name, summary: spec.summary, kind: spec.kind, realData: spec.realData, source: spec.source,
    without, with: withStats,
    livesSaved: tInterval(seeds.map((s) => s.wo - s.wi)),
    daily,
    perSeed: seeds.map((s) => ({ seed: s.seed, withoutDeaths: s.wo, withDeaths: s.wi, withStable: true })),
  };
}

export const sampleScenarios: ScenariosFile = {
  generated: '2026-11-19T12:00:00Z',
  set: 'test',
  seeds: SEEDS,
  module: 'Blackout Warning',
  tune: { safeLoad: 0.82, assumedCompliance: 0.75, maxTrend: 0.04, tripStep: 0.05 },
  scale: { simPeople: 1_600_000, hollowPeople: 2_000_000_000 },
  scenarios: SPECS.map(build),
};
