// Number formatting for the site. Thousands separators everywhere; intervals as "1,234 (95% interval 900–1,600)".
import type { Interval } from './contracts.ts';

const MINUS = '−';

export function num(x: number, digits = 0): string {
  if (!Number.isFinite(x)) return 'n/a';
  const s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (x < 0 && s.replace(/[0.,]/g, '') !== '' ? MINUS : '') + s;
}

/** Rounds to a count; counts cannot be negative, so the lower bound is cut at 0 when `count` is set. */
export function bounds(x: Interval, digits = 0, count = true): [string, string, string] {
  const lo = count ? Math.max(0, x.lo) : x.lo;
  const hi = count ? Math.max(0, x.hi) : x.hi;
  return [num(x.mean, digits), num(lo, digits), num(hi, digits)];
}

/** "1,234 (95% interval 900–1,600)". A negative bound uses "to" so the minus sign stays readable. */
export function interval(x: Interval, digits = 0, count = true): string {
  const [m, lo, hi] = bounds(x, digits, count);
  return `${m} (95% interval ${rangeText(lo, hi)})`;
}

export function rangeText(lo: string, hi: string): string {
  return lo.startsWith(MINUS) || hi.startsWith(MINUS) ? `${lo} to ${hi}` : `${lo}–${hi}`;
}

export function pct(x: number | null, digits = 0): string {
  return x == null || !Number.isFinite(x) ? 'n/a' : `${(x * 100).toFixed(digits)}%`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Compact axis labels: 12,000 → "12k", 1,500,000 → "1.5M". */
export function compact(x: number): string {
  const a = Math.abs(x);
  if (a >= 1e6) return `${+(x / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${+(x / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return num(x, a < 10 && a % 1 ? 1 : 0);
}
