import { describe, expect, it } from 'vitest';
import type { ModelFile } from '../contracts.ts';
import fixture from '../model/fixtures/fixture_binary.json';
import parity from '../model/fixtures/features_parity.json';
import { featuresAt } from '../model/features.ts';
import { scoreSeries, toHourRows, type EiaPayload } from './data.ts';
import sample from './sample/eia-ERCO.json';

describe('live data', () => {
  const rows = toHourRows(sample as EiaPayload);

  it('turns the saved /api/eia sample into one row per hour, oldest first', () => {
    expect(rows.length).toBe(31 * 24);
    for (let i = 1; i < rows.length; i++) expect(rows[i].t - rows[i - 1].t).toBe(3_600_000);
    expect(new Date(rows[rows.length - 1].t).toISOString()).toBe('2026-11-18T05:00:00.000Z');
    expect(rows[rows.length - 1].demand).toBe(47872);
  });

  it('gives the same features as the Python table for the same hours', () => {
    // The sample and the second parity window are both ERCO, Nov 2026.
    const w = parity.windows[1];
    const e = w.expected[w.expected.length - 1] as Record<string, number | null>;
    expect(w.rows.t[e.i as number]).toBe(rows[rows.length - 1].t);
    const f = featuresAt(rows, rows.length - 1);
    for (const k of ['fc_err', 'demand_vs_30d_peak', 'import_share', 'gas_share', 'netgen_chg_6h', 'gas_chg_6h', 'fc_err_max_24h', 'hod', 'doy', 'month']) {
      if (e[k] == null) expect(f[k], k).toBeNull();
      else expect(f[k], k).toBeCloseTo(e[k] as number, 9);
    }
  });

  it('scores the last 7 days with a model', () => {
    const s = scoreSeries(fixture as ModelFile, rows, 168);
    expect(s.length).toBe(168);
    for (const pt of s) expect(pt.p > 0 && pt.p < 1).toBe(true);
  });

  it('reads numbers and strings, skips unknown codes, drops trailing hours with no demand', () => {
    const r = toHourRows({
      region: [
        { period: '2026-01-01T01', type: 'D', value: '100' },
        { period: '2026-01-01T01', type: 'DF', value: 90 },
        { period: '2026-01-01T01', type: 'XX', value: 1 },
        { period: '2026-01-01T02', type: 'DF', value: '95' },
      ],
      fuel: [{ period: '2026-01-01T01', fueltype: 'NG', value: '40' }, { period: '2026-01-01T01', fueltype: 'WAT', value: '5' }],
    });
    expect(r).toEqual([{ t: Date.UTC(2026, 0, 1, 0), demand: 100, forecast: 90, netgen: null, interchange: null, gen_gas: 40, gen_coal: null, gen_nuclear: null, gen_wind: null, gen_solar: null }]);
  });
});
