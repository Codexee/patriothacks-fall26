// Features for the warn_grid model, computed in the browser from hourly EIA rows.
// Every formula mirrors data/build/features_ba_hour.py (the `win` step). SQL rules that matter:
//   - any arithmetic with a missing value gives a missing value;
//   - x / nullif(y, 0) is missing when y is 0;
//   - max() over a window skips missing values, and is missing when all values are missing;
//   - lag(x, 6) counts ROWS (6 rows back), the 24 h and 30 d windows count TIME.
// Weather features (temp_*, wind_*, precip_*, slp_*, fx_*) need station data that the live page
// does not have. They are returned as null, which the model reads as "missing".
//
// v2 adequacy features. fc12 = the highest day-ahead demand forecast in the next 12 hours (1 h to
// 12 h after this hour, by time). fc12_vs_30d_peak uses the 30-day window above. The RECORD
// features compare with the BA's own records: all earlier rows (wexp), the 365 days before this hour
// (w365), and all earlier rows in the same calendar month (wmon). They are correct only when `rows`
// start at the first hour of the BA's data (`longHistory`). The live page has 31 days at most, so it
// passes the area's saved records instead (`records`, from data/v1/ba_records.json): each record is
// the larger of the saved value and the largest demand in the rows before the scored hour (past
// only). The month record uses every earlier hour of the same calendar month in all years, as wmon
// does. With neither option the record features are null (missing).

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

/** Features that need the BA's full history (see the note at the top). */
export const RECORD_FEATURES = [
  'demand_vs_record',
  'demand_vs_month_record',
  'fc12_vs_record',
  'fc12_vs_365d_peak',
  'fc12_vs_month_record',
  'fc12_vs_month_record_max_72h',
] as const;

/** One area's saved demand records (BaRecords[ba] in contracts.ts). */
export interface SavedRecords {
  asOf: string;                    // "YYYY-MM-DD HH:MM:SS", UTC
  record: number | null;           // all-time maximum hourly demand
  peak365: number | null;          // maximum in the 365 days before asOf
  peak30: number | null;           // maximum in the 30 days before asOf
  monthRecord: (number | null)[];  // index 0 = January, all years
}

export interface FeatureOptions {
  /** True only when `rows` start at the first hour of the BA's data. Default false. */
  longHistory?: boolean;
  /** Saved records for this area. Used when longHistory is false. */
  records?: SavedRecords | null;
}

const asOfMs = (s: string) => Date.parse(s.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'));

const maxOf = (a: number | null, b: number | null): number | null => (b == null ? a : a == null || b > a ? b : a);

/** max(forecast) over the rows 1 h to 12 h after row i (by time). */
function fc12At(rows: HourRow[], i: number): number | null {
  let m: number | null = null;
  for (let j = i + 1; j < rows.length && rows[j].t - rows[i].t <= 12 * HOUR; j++) m = maxOf(m, rows[j].forecast);
  return m;
}

/** max(demand) over the earlier rows of the same UTC month (any year). */
function monthRecordAt(rows: HourRow[], i: number): number | null {
  const mon = new Date(rows[i].t).getUTCMonth();
  let m: number | null = null;
  for (let j = 0; j < i; j++) if (new Date(rows[j].t).getUTCMonth() === mon) m = maxOf(m, rows[j].demand);
  return m;
}

function recordFeatures(rows: HourRow[], i: number, fc12: number | null, saved: SavedRecords | null): FeatureMap {
  const r = rows[i];
  const asOf = saved ? asOfMs(saved.asOf) : NaN;
  const monRecAt = (j: number) => maxOf(saved?.monthRecord[new Date(rows[j].t).getUTCMonth()] ?? null, monthRecordAt(rows, j));
  let record: number | null = saved?.record ?? null;
  // The saved 365-day peak covers the year before asOf; it still applies while this hour is within a year of it.
  let peak365: number | null = saved && r.t - asOf <= 365 * DAY ? saved.peak365 : null;
  for (let j = 0; j < i; j++) {
    const d = rows[j].demand;
    record = maxOf(record, d);
    if (r.t - rows[j].t <= 365 * DAY) peak365 = maxOf(peak365, d);
  }
  const monRec = monRecAt(i);
  // Trailing 72 rows, current row included (models/common.py: rolling(72, min_periods=1).max()).
  let max72: number | null = null;
  for (let j = Math.max(0, i - 71); j <= i; j++) {
    max72 = maxOf(max72, j === i ? ratio(fc12, monRec) : ratio(fc12At(rows, j), monRecAt(j)));
  }
  return {
    demand_vs_record: ratio(r.demand, record),
    demand_vs_month_record: ratio(r.demand, monRec),
    fc12_vs_record: ratio(fc12, record),
    fc12_vs_365d_peak: ratio(fc12, peak365),
    fc12_vs_month_record: ratio(fc12, monRec),
    fc12_vs_month_record_max_72h: max72,
  };
}

/** All features for row `i` of `rows` (sorted by time, one row per hour). */
export function featuresAt(rows: HourRow[], i: number, opts: FeatureOptions = {}): FeatureMap {
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

  // With a window shorter than 30 days, the saved 30-day peak fills in while it is less than 30 days old.
  const saved = opts.longHistory ? null : opts.records ?? null;
  if (saved && rows[0].t > r.t - 30 * DAY && r.t - asOfMs(saved.asOf) <= 30 * DAY) peak30 = maxOf(peak30, saved.peak30);

  const fc12 = fc12At(rows, i);
  const records: FeatureMap = opts.longHistory || saved
    ? recordFeatures(rows, i, fc12, saved)
    : Object.fromEntries(RECORD_FEATURES.map((n) => [n, null]));

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
    fc12_vs_30d_peak: ratio(fc12, peak30),
    ...records,
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
export function missingFeatureNames(names: readonly string[], opts: FeatureOptions = {}): string[] {
  const known = featuresAt([{ t: 0, demand: 1, forecast: 1, netgen: 1, interchange: 1, gen_gas: 1, gen_coal: 1, gen_nuclear: 1, gen_wind: 1, gen_solar: 1 }], 0);
  const records: readonly string[] = RECORD_FEATURES;
  return names.filter((n) => !(n in known) || (!opts.longHistory && !opts.records && records.includes(n)));
}

/** Features for the latest hour in `rows`. */
export function latestFeatures(rows: HourRow[]): FeatureMap | null {
  const sorted = prepareRows(rows);
  return sorted.length ? featuresAt(sorted, sorted.length - 1) : null;
}
