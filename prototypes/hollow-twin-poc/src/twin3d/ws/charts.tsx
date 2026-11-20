// Small charts for the workstation. SVG with a stretched plot area (lines keep 1 px with non-scaling strokes);
// axis values are HTML, so text never stretches. Every chart draws only the values it is given.
import { useEffect, useRef, type ReactNode } from 'react';

export interface Series {
  values: ArrayLike<number>;
  color: string;
  label: string;
  /** Draw points 0..upto (inclusive). Default: all. */
  upto?: number;
  dashed?: boolean;
  step?: boolean;
}

const W = 300;
const H = 64;

export function fmtNum(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '–';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${fmtNum(n / 1e6, 2)} M`;
  if (a >= 1e4) return `${fmtNum(n / 1e3, 1)} k`;
  return fmtNum(n, a < 10 && n % 1 !== 0 ? 2 : 0);
}

/** A multi-series line chart over x = 0..n−1 with a cursor. */
export function LineChart({ series, n, cursor, log = false, yMax, yMin = 0, height = H, marks, unit = '', fmt = compact }: {
  series: Series[]; n: number; cursor?: number; log?: boolean; yMax?: number; yMin?: number; height?: number;
  marks?: { x: number; color: string }[]; unit?: string; fmt?: (v: number) => string;
}) {
  let max = yMax ?? 0;
  if (yMax === undefined) for (const s of series) { const u = Math.min(s.values.length - 1, s.upto ?? s.values.length - 1); for (let i = 0; i <= u; i++) if (s.values[i] > max) max = s.values[i]; }
  if (max <= yMin) max = yMin + 1;
  const ty = (v: number) => {
    const t = log ? Math.log10(1 + Math.max(0, v - yMin)) / Math.log10(1 + (max - yMin)) : (v - yMin) / (max - yMin);
    return height - 2 - Math.max(0, Math.min(1, t)) * (height - 4);
  };
  const tx = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  return (
    <div className="ws-chart" style={{ height }}>
      <span className="ws-chart-max">{fmt(max)}{unit}{log ? ' (log)' : ''}</span>
      <span className="ws-chart-min">{fmt(yMin)}{unit}</span>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <line x1={0} x2={W} y1={height - 2} y2={height - 2} className="ws-axis" vectorEffect="non-scaling-stroke" />
        <line x1={0} x2={W} y1={height / 2} y2={height / 2} className="ws-grid" vectorEffect="non-scaling-stroke" />
        {marks?.map((m, i) => <line key={i} x1={tx(m.x)} x2={tx(m.x)} y1={0} y2={height} stroke={m.color} className="ws-mark" vectorEffect="non-scaling-stroke" />)}
        {series.map((s) => {
          const u = Math.min(s.values.length - 1, s.upto ?? s.values.length - 1);
          if (u < 0) return null;
          let d = '';
          for (let i = 0; i <= u; i++) {
            const x = tx(i), y = ty(s.values[i]);
            if (i === 0) d += `M${x.toFixed(1)},${y.toFixed(1)}`;
            else if (s.step) d += `H${x.toFixed(1)}V${y.toFixed(1)}`;
            else d += `L${x.toFixed(1)},${y.toFixed(1)}`;
          }
          return <path key={s.label} d={d} fill="none" stroke={s.color} strokeWidth={1.4} strokeDasharray={s.dashed ? '3 2' : undefined} vectorEffect="non-scaling-stroke" />;
        })}
        {cursor !== undefined && <line x1={tx(cursor)} x2={tx(cursor)} y1={0} y2={height} className="ws-cursor" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  );
}

/** Vertical bars (for example a histogram), with an optional highlighted range. */
export function Bars({ values, color = 'var(--dust)', height = 44, labels }: { values: number[]; color?: string; height?: number; labels?: [string, string] }) {
  const max = Math.max(1, ...values);
  const bw = W / values.length;
  return (
    <div className="ws-chart" style={{ height: height + (labels ? 14 : 0) }}>
      <span className="ws-chart-max">{fmtNum(max)}</span>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
        {values.map((v, i) => <rect key={i} x={i * bw + 0.5} width={Math.max(0.5, bw - 1)} y={height - (v / max) * (height - 2)} height={(v / max) * (height - 2)} fill={color} />)}
      </svg>
      {labels && <div className="ws-chart-xl"><span>{labels[0]}</span><span>{labels[1]}</span></div>}
    </div>
  );
}

/** A days × levels heat strip on a canvas: column = day, row = level (1 at the top). Days after `upto` are blank. */
export function HeatStrip({ values, days, rows, upto, max, rgb, height = 100 }: {
  values: ArrayLike<number>; days: number; rows: number; upto: number; max: number; rgb: [number, number, number]; height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const img = g.createImageData(days, rows);
    const bg = [23, 26, 30];
    for (let d = 0; d < days; d++) {
      for (let r = 0; r < rows; r++) {
        const o = (r * days + d) * 4;
        const v = d <= upto ? Math.max(0, Math.min(1, values[d * rows + r] / max)) : 0;
        const k = Math.sqrt(v);
        img.data[o] = bg[0] + (rgb[0] - bg[0]) * k;
        img.data[o + 1] = bg[1] + (rgb[1] - bg[1]) * k;
        img.data[o + 2] = bg[2] + (rgb[2] - bg[2]) * k;
        img.data[o + 3] = d <= upto ? 255 : 90;
      }
    }
    g.putImageData(img, 0, 0);
  }, [values, days, rows, upto, max, rgb]);
  return <canvas ref={ref} width={days} height={rows} className="ws-heat" style={{ height }} aria-hidden="true" />;
}

/** A tiny line for a curve given in full (for example a real loss shape). */
export function Curve({ values, color = 'var(--dust)', height = 36, fill = true }: { values: ArrayLike<number>; color?: string; height?: number; fill?: boolean }) {
  let max = 0, min = Infinity;
  for (let i = 0; i < values.length; i++) { max = Math.max(max, values[i]); min = Math.min(min, values[i]); }
  if (min > 0 && min / Math.max(max, 1e-9) > 0.5) { /* keep a 0 baseline only for shapes that reach near zero */ } else min = 0;
  const span = max - min || 1;
  let d = '';
  for (let i = 0; i < values.length; i++) {
    const x = (i / Math.max(1, values.length - 1)) * W;
    const y = height - 1 - ((values[i] - min) / span) * (height - 2);
    d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return (
    <svg className="ws-curve" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      {fill && <path d={`${d}L${W},${height}L0,${height}Z`} fill={color} opacity={0.15} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export type TagKind = 'sim' | 'real' | 'module' | 'guess' | 'cited' | 'tuned' | 'set' | 'derived';
const TAG_TEXT: Record<TagKind, string> = { sim: 'SIM', real: 'REAL DATA', module: 'MODULE', guess: 'GUESS', cited: 'CITED', tuned: 'TUNED', set: 'HAND-SET', derived: 'DERIVED' };
const TAG_TITLE: Record<TagKind, string> = {
  sim: 'Output of the simulation (the hidden test world)',
  real: 'Value from a real dataset',
  module: "Blackout Warning's own output (it reads only residents' data)",
  guess: 'A guessed constant: no published value maps to it',
  cited: 'A constant taken from a published limit',
  tuned: 'Chosen on tuning seeds 1–5, checked on 6–10, then frozen',
  set: 'Set by hand, not tuned',
  derived: 'Computed here from sim output',
};
export function Tag({ kind }: { kind: TagKind }) {
  return <span className={`ws-tag ${kind}`} title={TAG_TITLE[kind]}>{TAG_TEXT[kind]}</span>;
}

/** A titled chart block: title, tags, current values on the right. */
export function ChartBlock({ title, tags, values, children, tools }: { title: string; tags: TagKind[]; values?: ReactNode; children: ReactNode; tools?: ReactNode }) {
  return (
    <figure className="ws-cblock">
      <figcaption>
        <span className="ws-ctitle">{title}</span>
        {tags.map((t) => <Tag key={t} kind={t} />)}
        {tools}
        {values && <span className="ws-cvals">{values}</span>}
      </figcaption>
      {children}
    </figure>
  );
}
