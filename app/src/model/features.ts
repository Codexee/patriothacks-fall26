// Features for the warn_grid model, computed in the browser from hourly EIA rows.
// Every formula mirrors data/build/features_ba_hour.py (the `win` step). SQL rules that matter:
//   - any arithmetic with a missing value gives a missing value;
//   - x / nullif(y, 0) is missing when y is 0;
//   - max() over a window skips missing values, and is missing when all values are missing;
//   - lag(x, 6) counts ROWS (6 rows back), the 24 h and 30 d windows count TIME.
// Weather features (temp_*, wind_*, precip_*, slp_*, fx_*) need station data that the live page
// does not have. They are returned as null, which the model reads as "missing".

export interface HourRow {
  /** Start of the hour, UTC, in ms since the epoch (EIA "end of hour" minus 1 h). */
  t: number;
  demand: number | null;
  forecast: number | null;
  netgen: number | null;
  interchange: number | null;
  gen_gas: number | null;
  gen_coal: number | null;
  gen_nuclear: number | null;
  gen_wind: number | null;
  gen_solar: number | null;
}

export type FeatureMap = Record<string, number | null>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const ratio = (a: number | null, b: number | null): number | null =>
  a == null || b == null || b === 0 ? null : a / b;

const change = (now: number | null, before: number | null | undefined): number | null =>
  now == null || before == null || before === 0 ? null : (now - before) / before;

const fcErr = (r: HourRow): number | null =>
  r.demand == null || r.forecast == null || r.forecast === 0 ? null : (r.demand - r.forecast) / r.forecast;

function dayOfYear(d: Date): number {
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY) + 1;
}

/** Sort by time and drop repeated hours (keeps the last copy). Call once before `featuresAt`. */
export function prepareRows(rows: HourRow[]): HourRow[] {
  const byT = new Map<number, HourRow>();
  for (const r of rows) byT.set(r.t, r);
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

/** All features for row `i` of `rows` (sorted by time, one row per hour). */
export function featuresAt(rows: HourRow[], i: number): FeatureMap {
  const r = rows[i];
  const lag6 = rows[i - 6];

  // Windows by time, current row included: the last 24 hours (23 h back) and the last 30 days.
  let peak30: number | null = null;
  let fcMax24: number | null = null;
  for (let j = i; j >= 0 && r.t - rows[j].t <= 30 * DAY; j--) {
    const d = rows[j].demand;
    if (d != null && (peak30 == null || d > peak30)) peak30 = d;
    if (r.t - rows[j].t <= 23 * HOUR) {
      const e = fcErr(rows[j]);
      if (e != null && (fcMax24 == null || e > fcMax24)) fcMax24 = e;
    }
  }

  const d = new Date(r.t);
  return {
    forecast: r.forecast,
    demand: r.demand,
    netgen: r.netgen,
    interchange: r.interchange,
    gen_gas: r.gen_gas,
    gen_coal: r.gen_coal,
    gen_nuclear: r.gen_nuclear,
    gen_wind: r.gen_wind,
    gen_solar: r.gen_solar,
    fc_err: fcErr(r),
    demand_vs_30d_peak: ratio(r.demand, peak30),
    import_share: ratio(r.interchange, r.demand),
    gas_share: ratio(r.gen_gas, r.netgen),
    netgen_chg_6h: change(r.netgen, lag6?.netgen),
    gas_chg_6h: change(r.gen_gas, lag6?.gen_gas),
    fc_err_max_24h: fcMax24,
    hod: d.getUTCHours(),
    doy: dayOfYear(d),
    month: d.getUTCMonth() + 1,
  };
}

/** The input vector for a model: one value per name in `names`, null for a name we cannot compute. */
export function featureVector(names: readonly string[], f: FeatureMap): (number | null)[] {
  return names.map((n) => {
    const v = f[n];
    return v == null || Number.isNaN(v) ? null : v;
  });
}

/** Names in `names` that this module cannot compute (they go to the model as missing). */
export function missingFeatureNames(names: readonly string[]): string[] {
  const known = featuresAt([{ t: 0, demand: 1, forecast: 1, netgen: 1, interchange: 1, gen_gas: 1, gen_coal: 1, gen_nuclear: 1, gen_wind: 1, gen_solar: 1 }], 0);
  return names.filter((n) => !(n in known));
}

/** Features for the latest hour in `rows`. */
export function latestFeatures(rows: HourRow[]): FeatureMap | null {
  const sorted = prepareRows(rows);
  return sorted.length ? featuresAt(sorted, sorted.length - 1) : null;
}
