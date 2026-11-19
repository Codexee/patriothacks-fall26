import { describe, expect, it } from 'vitest';
import type { ModelFile } from '../contracts.ts';
import { isModelFile, parityError, predict } from './evaluate.ts';
import { featureVector, featuresAt, latestFeatures, missingFeatureNames, prepareRows, type HourRow } from './features.ts';
import featuresParity from './fixtures/features_parity.json';
import recordsParity from './fixtures/features_records_parity.json';

// Real model files (written by the models workstream) and the fixtures in this directory.
// The fixtures were trained with LightGBM 4.7 on made-up data, so the test has work to do before
// the real files exist. Together they cover missing_type None, NaN and Zero.
const real = import.meta.glob('../../public/models/*.json', { eager: true, import: 'default' });
const fixtures = import.meta.glob('./fixtures/fixture_*.json', { eager: true, import: 'default' });
const models = Object.entries({ ...fixtures, ...real }).filter(([, m]) => isModelFile(m)) as [string, ModelFile][];

describe('tree evaluator: parity with LightGBM', () => {
  it('finds at least the two fixture models', () => {
    expect(models.length).toBeGreaterThanOrEqual(2);
  });

  it.each(models)('%s: every parity row within 1e-6', (_path, model) => {
    expect(model.parity.length).toBeGreaterThan(0);
    for (const row of model.parity) {
      expect(row.x.length).toBe(model.features.length);
      expect(Math.abs(predict(model, row.x) - row.p)).toBeLessThanOrEqual(1e-6);
    }
    expect(parityError(model).maxAbsDiff).toBeLessThanOrEqual(1e-6);
  });

  it('covers missing inputs and all three missing types', () => {
    const seen = new Set<string>();
    const walk = (n: any) => {
      if (n.left_child) { seen.add(n.missing_type); walk(n.left_child); walk(n.right_child); }
    };
    for (const [path, m] of models) {
      if (!path.includes('fixture_')) continue;
      for (const t of m.trees as any[]) walk(t.tree_structure);
      expect(m.parity.some((r) => r.x.includes(null))).toBe(true);
      expect(m.parity.some((r) => r.x.every((v) => v === null))).toBe(true);
    }
    expect([...seen].sort()).toEqual(['NaN', 'None', 'Zero']);
  });

  it('rejects a split type it does not support', () => {
    const bad = { ...models[0][1], trees: [{ tree_structure: { split_feature: 0, threshold: 0, decision_type: '==', default_left: true, missing_type: 'None', left_child: { leaf_value: 1 }, right_child: { leaf_value: 2 } } }] };
    expect(() => predict(bad, [1, 1, 1, 1, 1])).toThrow();
  });
});

type Cols = Record<string, (number | null)[]>;
const toRows = (c: Cols): HourRow[] =>
  c.t.map((t, i) => ({
    t: t as number, demand: c.demand[i], forecast: c.forecast[i], netgen: c.netgen[i], interchange: c.interchange[i],
    gen_gas: c.gen_gas[i], gen_coal: c.gen_coal[i], gen_nuclear: c.gen_nuclear[i], gen_wind: c.gen_wind[i], gen_solar: c.gen_solar[i],
  }));

describe('features: parity with data/build/features_ba_hour.py', () => {
  // Each window holds real rows of the Python feature table: the inputs, and the features Python
  // computed for the last 72 hours. The windows start more than 30 days before those hours.
  it.each(featuresParity.windows.map((w) => [`${w.ba} ${w.from}`, w] as const))('%s', (_name, w) => {
    const rows = prepareRows(toRows(w.rows as Cols));
    expect(rows.length).toBe(w.rows.t.length);
    let compared = 0;
    for (const e of w.expected as Record<string, number | null>[]) {
      const f = featuresAt(rows, e.i as number);
      for (const [k, want] of Object.entries(e)) {
        if (k === 'i') continue;
        const got = f[k];
        if (want == null) expect(got, `${k} at row ${e.i}`).toBeNull();
        else {
          expect(got, `${k} at row ${e.i}`).not.toBeNull();
          expect(Math.abs((got as number) - want), `${k} at row ${e.i}`).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(want)));
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(400);
  });

  it('v2 adequacy features match Python (ERCO from its first hour, 13 months)', () => {
    const rows = prepareRows(toRows(recordsParity.rows as Cols));
    expect(rows.length).toBe(recordsParity.rows.t.length);
    let compared = 0;
    for (const e of recordsParity.expected as Record<string, number | null>[]) {
      const f = featuresAt(rows, e.i as number, { longHistory: true });
      for (const [k, want] of Object.entries(e)) {
        if (k === 'i') continue;
        const got = f[k];
        if (want == null) expect(got, `${k} at row ${e.i}`).toBeNull();
        else {
          expect(got, `${k} at row ${e.i}`).not.toBeNull();
          expect(Math.abs((got as number) - want), `${k} at row ${e.i}`).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(want)));
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(250);
  });

  it('without long history the record features are null and listed as missing', () => {
    const rows = prepareRows(toRows(recordsParity.rows as Cols));
    const f = featuresAt(rows, 800);
    expect(f.demand_vs_record).toBeNull();
    expect(f.fc12_vs_month_record_max_72h).toBeNull();
    expect(f.fc12_vs_30d_peak).not.toBeNull();
    expect(missingFeatureNames(['fc12_vs_record', 'fc12_vs_30d_peak', 'hod'])).toEqual(['fc12_vs_record']);
  });

  it('gives null for names it cannot compute and keeps the model order', () => {
    const rows = toRows(featuresParity.windows[0].rows as Cols);
    const f = latestFeatures(rows)!;
    const names = ['hod', 'temp_min_24h', 'fc_err', 'not_a_feature'];
    const x = featureVector(names, f);
    expect(x[0]).toBe(f.hod);
    expect(x[1]).toBeNull();
    expect(x[2]).toBe(f.fc_err);
    expect(x[3]).toBeNull();
    expect(missingFeatureNames(names)).toEqual(['temp_min_24h', 'not_a_feature']);
  });

  it('follows the SQL rules for missing values and zero divisors', () => {
    const base = { netgen: null, interchange: 5, gen_gas: 1, gen_coal: null, gen_nuclear: null, gen_wind: null, gen_solar: null };
    const f = featuresAt([{ t: 0, demand: 10, forecast: 0, ...base }], 0);
    expect(f.fc_err).toBeNull();          // forecast is 0
    expect(f.fc_err_max_24h).toBeNull();  // no value in the window
    expect(f.gas_share).toBeNull();       // netgen is missing
    expect(f.netgen_chg_6h).toBeNull();   // no row 6 hours back
    expect(f.import_share).toBe(0.5);
    expect(f.demand_vs_30d_peak).toBe(1);
  });
});
