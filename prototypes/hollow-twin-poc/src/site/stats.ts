// Small statistics helpers for the site. The producers already give intervals per scenario; the site only
// combines per-seed values (for the all-disasters total) with the same method: Student t on per-seed values.
import type { Interval } from './contracts.ts';

/** Two-sided 95% Student t critical values for df = 1..30; above 30 the normal value is close enough. */
const T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
  2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];

export function tCrit(df: number): number {
  if (df < 1) return NaN;
  return df <= 30 ? T975[df - 1] : 1.96;
}

/** Mean and 95% interval of a list of per-seed values. */
export function tInterval(values: number[]): Interval {
  const n = values.length;
  const mean = n ? values.reduce((a, b) => a + b, 0) / n : 0;
  if (n < 2) return { mean, lo: mean, hi: mean };
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1));
  const h = tCrit(n - 1) * (sd / Math.sqrt(n));
  return { mean, lo: mean - h, hi: mean + h };
}

export function scaleInterval(x: Interval, k: number): Interval {
  return { mean: x.mean * k, lo: x.lo * k, hi: x.hi * k };
}
