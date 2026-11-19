// Frozen shared types. See contracts/README.md. Coordinator-owned: do not edit in a workstream.

export interface County {
  fips: string;            // 5 digits
  name: string;            // "Harris"
  state: string;           // "TX"
  pop: number | null;
  svi: number | null;      // CDC SVI 2022 overall percentile, 0..1 (1 = most vulnerable)
  level: number | null;    // Hollow level 1..50 (50 = deepest = most vulnerable)
  customers: number | null; // electric customers (EAGLE-I modeled count)
  dme: number | null;      // Medicare users of electricity-dependent medical equipment (HHS emPOWER)
  medicare: number | null;
  ba: string | null;       // primary balancing area code, e.g. "ERCO"
}

export type HeroSlug = 'texas2021' | 'elliott2022' | 'irma2017';

export interface EventRow {
  id: string;              // "<BA>-<YYYYMMDDHH>" (UTC start)
  ba: string;
  start: string;           // "YYYY-MM-DD HH:MM:SS" UTC
  stop: string;
  hoursAbove: number;      // hours with >= 1% of the BA's customers out
  peakFrac: number;        // 0..1
  peakCustomersOut: number;
  split: 'train' | 'test'; // test = started 2021-01-01 or later
  hero: HeroSlug | null;
  title: string | null;
  hasReplay: boolean;
  firstAlert: string | null; // first hour in the 72 h before start with p >= threshold
  leadHours: number | null;  // start - firstAlert, in hours; null = not warned (or stub). Model: EventLibrary.warnModel
  leadHoursNoForecast?: number | null; // the same for warn_full (no weather forecast)
}

export interface EventLibrary {
  rule: { threshold_share_of_ba_customers: number; min_hours: number; merge_gap_hours: number };
  years: [number, number];
  trainEnd: string;
  count: number;
  stub: boolean;           // true until model outputs are in
  warnModel?: string;      // "warn_fcst": which model produced firstAlert, leadHours and the replay risk line
  warnNote?: string;       // the caveat to show wherever a lead time is shown
  events: EventRow[];
}

export interface EventReplay {
  id: string;
  ba: string;
  t0: string;              // UTC time of index 0
  hours: number;           // length of every hourly array
  eventStartIndex: number; // index of the event's first hour (72)
  risk: (number | null)[] | null; // model probability per hour for the BA; null while stub
  alertThreshold: number | null;
  warnModel?: string;
  firstAlertIndex?: number | null; // index of the first alert hour in the hourly arrays
  // Values of plain-language model inputs at the first alert hour ("what the model saw"). Not SHAP.
  alertInputs?: { feature: string; label: string; unit: 'ratio' | 'share' | 'sigma' | 'm/s' | 'mm'; value: number }[] | null;
  counties: {
    fips: string;
    out: number[];         // percent of customers out, 0..100, per hour
    darkHours: number;     // hours with >= 10% out
    predDarkHours: number | null;
  }[];
  stub: boolean;
}

export interface Metrics {
  generated: string;
  trainYears: [number, number];
  testYears: [number, number];
  models: Record<string, {      // "warn_grid" | "warn_full" | "rule_forecast_error" | "rule_hand"
    testEvents: number;
    warned12h: number;          // events with an alert at least 12 h before start
    recall12h: number;
    medianLeadHours: number | null;
    falseAlarmsPerBaYear: number;
    aucPr: number | null;
  }>;
  dark: { testCountyEvents: number; maeHours: number; baselineMaeHours: number; spearman: number } | null;
  equity: { quartile: 1 | 2 | 3 | 4; meanDarkHours: number; lo: number; hi: number }[] | null; // by SVI quartile
}

export interface ModelFile {
  name: string;
  version: string;
  objective: 'binary' | 'regression';
  features: string[];
  threshold: number | null;
  trees: unknown[];        // LightGBM dump_model()["tree_info"]
  parity: { x: (number | null)[]; p: number }[];
}

export const earthName = (c: County) => `${c.name} County, ${c.state}`;
export const hollowName = (c: County) => (c.level == null ? 'Level unknown' : `Level ${c.level}`);
export const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/v1/${path}`;
export const modelUrl = (name: string) => `${import.meta.env.BASE_URL}models/${name}.json`;
