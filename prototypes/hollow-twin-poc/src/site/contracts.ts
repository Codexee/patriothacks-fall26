// Contract between the results site and the two data producers (spec: .plans/results-site-spec.md).
// Producers write JSON into public/results/. The site fetches it at run time and never imports sim code for numbers.
//   public/results/scenarios.json  ← `npm run results` (src/sim/results.ts): the sim's disasters, with and without
//   public/results/checkfirst.json ← `uv run python models/export_residents.py`: the residents-only real-data model
// Every number on the site comes from one of these files. Each file says where its numbers come from.

export interface Source { label: string; detail: string; url: string }

/** Mean and 95% interval over seeds (Student t on the per-seed values). */
export interface Interval { mean: number; lo: number; hi: number }

export interface RunStats {
  deaths: Interval; // deaths per run (sim scale: about 1.6 M simulated people)
  trips: Interval; // plant trips per run
  darkMh: Interval; // million person-hours without air and fans
  stableShare: number; // share of runs that reached a stable Hollow (0..1)
  endDay: Interval; // day the run ended (stable or the 120-day cap)
  warnedPct: number | null; // warned ÷ blackout person-hours, all seeds pooled; null when there were no blackouts
  noNewsPerNight?: Interval; // #8: split families with no news of their relatives at the end of a night, mean per night of the run
}

export interface DailyPoint {
  day: number; // 1..120
  withoutDeaths: number; // cumulative deaths, mean over seeds
  withDeaths: number;
  withoutDarkSections: number; // sections without air and fans at the day's worst hour, mean over seeds
  withDarkSections: number;
}

export interface ScenarioResult {
  id: string; // e.g. 'cascade'
  name: string;
  summary: string;
  kind: 'plant-loss' | 'aging' | 'crowding' | 'baseline';
  realData: string; // one line: the real data behind it, e.g. "ERCOT net generation, Feb 15–18, 2021 (EIA-930)"
  source: Source;
  without: RunStats;
  with: RunStats;
  livesSaved: Interval; // without.deaths − with.deaths, per seed, then the interval
  daily: DailyPoint[]; // for the line chart; runs that end early carry their last value forward
  perSeed: { seed: number; withoutDeaths: number; withDeaths: number; withStable: boolean }[];
}

export interface ScenariosFile {
  generated: string; // ISO time
  set: 'test'; // only held-out seeds are published
  seeds: number[];
  module: string; // 'Blackout Warning'
  tune: Record<string, number>; // the frozen constants
  scale: { simPeople: number; hollowPeople: number }; // ~1.6 M simulated people stand for 2 billion
  scenarios: ScenarioResult[];
}

export interface MetricRow {
  metric: string; // e.g. "Top-10 overlap (share of the 10 longest-dark areas the model ranks in its top 10)"
  model: number;
  history: number | null; // baseline: each area's past mean
  chance: number | null;
  better: 'higher' | 'lower';
}

export interface CheckFirstFile {
  generated: string;
  name: string; // e.g. 'Check-first model (residents-only)'
  task: string; // one plain sentence: what it predicts and for whom
  method: string; // e.g. 'LightGBM regression on log1p(hours), 300 trees'
  inputs: { name: string; plain: string; hollowEquivalent: string }[]; // every feature, with its in-world source
  excluded: string[]; // what we removed because residents don't have it (weather, grid-operator data)
  periods: { train: string; dev: string; test: string };
  test: { events: number; areaEvents: number; rows: MetricRow[] };
  dev: { events: number; areaEvents: number; rows: MetricRow[] };
  comparison?: { label: string; rows: MetricRow[] }; // the same model WITH weather/grid inputs, for reference
  importance: { feature: string; share: number }[]; // top features, share of gain
  example?: { event: string; date: string; topAreas: { name: string; predictedHours: number; actualHours: number }[] };
  limits: string[];
  source: Source;
}
