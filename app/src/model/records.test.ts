// Record features from saved area records plus the live window (past hours only).
import { describe, expect, it } from 'vitest';
import { featuresAt, missingFeatureNames, type HourRow, type SavedRecords } from './features.ts';

const HOUR = 3_600_000;
const t0 = Date.UTC(2026, 0, 10); // Jan 10, 2026, 00:00 UTC

// 48 hours in January. Demand 50 except 120 at row 10. Forecast 60 except 75 at rows 20 to 30.
const rows: HourRow[] = Array.from({ length: 48 }, (_, i) => ({
  t: t0 + i * HOUR,
  demand: i === 10 ? 120 : 50,
  forecast: i >= 20 && i <= 30 ? 75 : 60,
  netgen: null, interchange: null, gen_gas: null, gen_coal: null, gen_nuclear: null, gen_wind: null, gen_solar: null,
}));

const saved: SavedRecords = {
  asOf: '2026-01-09 00:00:00',
  record: 100,
  peak365: 90,
  peak30: 80,
  monthRecord: [70, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};

describe('record features with saved records', () => {
  it('uses the saved values when the window has nothing larger', () => {
    const f = featuresAt(rows, 5, { records: saved });
    expect(f.demand_vs_record).toBeCloseTo(50 / 100, 12);
    expect(f.demand_vs_month_record).toBeCloseTo(50 / 70, 12);   // January record
    expect(f.fc12_vs_record).toBeCloseTo(60 / 100, 12);          // forecast rows 6 to 17
    expect(f.fc12_vs_365d_peak).toBeCloseTo(60 / 90, 12);
    expect(f.fc12_vs_month_record).toBeCloseTo(60 / 70, 12);
    expect(f.fc12_vs_30d_peak).toBeCloseTo(60 / 80, 12);         // window is short: saved 30-day peak
    expect(f.demand_vs_30d_peak).toBeCloseTo(50 / 80, 12);
    expect(f.fc12_vs_month_record_max_72h).toBeCloseTo(60 / 70, 12);
  });

  it('uses only hours before the scored hour', () => {
    const f = featuresAt(rows, 10, { records: saved });
    expect(f.demand_vs_record).toBeCloseTo(120 / 100, 12);       // the 120 is the scored hour itself
    expect(f.demand_vs_month_record).toBeCloseTo(120 / 70, 12);
  });

  it('takes the larger of the saved value and the window', () => {
    const f = featuresAt(rows, 15, { records: saved });
    expect(f.demand_vs_record).toBeCloseTo(50 / 120, 12);
    expect(f.demand_vs_month_record).toBeCloseTo(50 / 120, 12);
    expect(f.fc12_vs_record).toBeCloseTo(75 / 120, 12);          // forecast rows 16 to 27 reach 75
    expect(f.fc12_vs_365d_peak).toBeCloseTo(75 / 120, 12);
    expect(f.fc12_vs_30d_peak).toBeCloseTo(75 / 120, 12);
    // max over the last 72 rows (here rows 0 to 15) of fc12 / month record
    expect(f.fc12_vs_month_record_max_72h).toBeCloseTo(75 / 70, 12);
  });

  it('drops the saved 365-day and 30-day peaks when they are too old', () => {
    const old = { ...saved, asOf: '2024-06-01 00:00:00' };
    const f = featuresAt(rows, 5, { records: old });
    expect(f.fc12_vs_365d_peak).toBeCloseTo(60 / 50, 12);        // window only
    expect(f.fc12_vs_30d_peak).toBeCloseTo(60 / 50, 12);
    expect(f.demand_vs_record).toBeCloseTo(50 / 100, 12);        // all-time record still applies
  });

  it('gives null without records and lists the record features as missing', () => {
    const f = featuresAt(rows, 5);
    expect(f.demand_vs_record).toBeNull();
    expect(f.fc12_vs_month_record).toBeNull();
    expect(missingFeatureNames(['demand_vs_record', 'hod'])).toEqual(['demand_vs_record']);
    expect(missingFeatureNames(['demand_vs_record', 'hod'], { records: saved })).toEqual([]);
  });

  it('gives null for a month the saved file has no record for and the window has no hour', () => {
    const f = featuresAt(rows, 0, { records: { ...saved, monthRecord: Array(12).fill(null) } });
    expect(f.demand_vs_month_record).toBeNull();
    expect(f.fc12_vs_month_record).toBeNull();
  });
});
