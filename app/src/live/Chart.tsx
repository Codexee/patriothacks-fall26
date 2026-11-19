// A small line chart over time (SVG). Used for the 7-day risk line and the demand lines.
import { useId } from 'react';

export interface Series {
  label: string;
  color: string;            // a CSS color, for example "var(--alert)"
  dashed?: boolean;
  points: { t: number; v: number | null }[];
}

interface Props {
  series: Series[];
  threshold?: number | null;
  thresholdLabel?: string;
  yMin?: number;
  yMax?: number;
  format: (v: number) => string;
  ariaLabel: string;
}

const W = 960, H = 240, L = 58, R = 16, T = 14, B = 30;
const DAY = 86_400_000;
const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

function niceTicks(lo: number, hi: number, n = 4): number[] {
  const span = hi - lo || 1;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

export function LineChart({ series, threshold, thresholdLabel, yMin, yMax, format, ariaLabel }: Props) {
  const clip = useId();
  const all = series.flatMap((s) => s.points);
  const vals = all.map((p) => p.v).filter((v): v is number => v != null);
  if (all.length < 2 || vals.length === 0) return <p className="dim">No data to draw.</p>;
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  let lo = yMin ?? Math.min(...vals);
  let hi = yMax ?? Math.max(...vals, threshold ?? -Infinity);
  if (yMin == null) lo -= (hi - lo) * 0.08;
  if (yMax == null) hi += (hi - lo) * 0.08;
  if (hi === lo) hi = lo + 1;
  const x = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

  const path = (pts: Series['points']) => {
    let d = '';
    let pen = false;
    for (const p of pts) {
      if (p.v == null) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const days: number[] = [];
  for (let d = Math.ceil(t0 / DAY) * DAY; d <= t1; d += DAY) days.push(d);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      <defs>
        <clipPath id={clip}><rect x={L} y={T} width={W - L - R} height={H - T - B} /></clipPath>
      </defs>
      {niceTicks(lo, hi).map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className="tick">{format(v)}</text>
        </g>
      ))}
      {days.map((d) => (
        <g key={d}>
          <line x1={x(d)} x2={x(d)} y1={H - B} y2={H - B + 5} className="grid" />
          <text x={x(d)} y={H - 9} textAnchor="middle" className="tick">{dayFmt.format(d)}</text>
        </g>
      ))}
      {threshold != null && threshold >= lo && threshold <= hi && (
        <g>
          <line x1={L} x2={W - R} y1={y(threshold)} y2={y(threshold)} className="threshold" />
          <text x={W - R - 4} y={y(threshold) - 6} textAnchor="end" className="threshold-label">{thresholdLabel}</text>
        </g>
      )}
      <g clipPath={`url(#${clip})`}>
        {series.map((s) => (
          <path key={s.label} d={path(s.points)} fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.5 : 2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" />
        ))}
      </g>
    </svg>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="legend">
      {series.map((s) => (
        <li key={s.label}>
          <svg width="22" height="8" aria-hidden="true"><line x1="0" x2="22" y1="4" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '5 4' : undefined} /></svg>
          {s.label}
        </li>
      ))}
    </ul>
  );
}
