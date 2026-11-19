// The inputs that move the current risk most. For each input the model has a value for, we run the
// model again with that input missing and keep the change in risk. This is a simple test of one
// input at a time; it is not an explanation of the model.
import type { ModelFile } from '../contracts.ts';
import { FEATURE_LABEL } from '../evidence/metrics.ts';
import { predict } from '../model/evaluate.ts';
import { featureVector, type FeatureMap } from '../model/features.ts';

export interface InputEffect {
  feature: string;
  label: string;
  value: string;
  effect: number; // risk with the input minus risk without it (probability, -1..1)
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatInput(feature: string, v: number): string {
  if (feature === 'month') return MONTHS[Math.round(v) - 1] ?? String(v);
  if (feature === 'hod') return `${String(Math.round(v)).padStart(2, '0')}:00 UTC`;
  if (feature === 'doy') return `day ${Math.round(v)}`;
  if (/^(fc_err|netgen_chg|gas_chg)/.test(feature)) return `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
  if (/(share|_vs_)/.test(feature)) {
    const pct = v * 100;
    const txt = Math.abs(pct) < 10 ? pct.toFixed(1) : pct.toFixed(0);
    return `${Number(txt) === 0 ? '0' : txt}%`;
  }
  return v.toFixed(2);
}

export function topInputs(model: ModelFile, f: FeatureMap, n = 3): InputEffect[] {
  const x = featureVector(model.features, f);
  const p = predict(model, x);
  const out: InputEffect[] = [];
  model.features.forEach((name, k) => {
    const v = x[k];
    if (v == null) return;
    const without = [...x];
    without[k] = null;
    out.push({ feature: name, label: capital(FEATURE_LABEL[name] ?? name), value: formatInput(name, v), effect: p - predict(model, without) });
  });
  return out.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).slice(0, n);
}
