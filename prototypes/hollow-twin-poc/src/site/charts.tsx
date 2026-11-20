// Inline SVG charts. No chart library. Every chart has a text alternative (aria-label or a data table).
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { DailyPoint, MetricRow } from './contracts.ts';
import { compact, num } from './format.ts';
import { metricName, metricNote } from './parts.tsx';

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(+v.toPrecision(12));
  if (out[out.length - 1] < max) out.push(+(out[out.length - 1] + step).toPrecision(12));
  return out;
}

/** Tiny line chart of cumulative deaths, without vs with, on one shared scale. */
export function Sparkline({ daily, label }: { daily: DailyPoint[]; label: string }) {
  const w = 132, h = 36, pad = 2;
  const max = Math.max(1, ...daily.map((d) => Math.max(d.withoutDeaths, d.withDeaths)));
  const n = Math.max(1, daily.length - 1);
  const pts = (k: 'withoutDeaths' | 'withDeaths') =>
    daily.map((d, i) => `${(pad + (i / n) * (w - 2 * pad)).toFixed(1)},${(h - pad - (d[k] / max) * (h - 2 * pad)).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={label}>
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} className="spark-base" />
      <polyline points={pts('withoutDeaths')} className="ln-without" />
      <polyline points={pts('withDeaths')} className="ln-with" />
    </svg>
  );
}

type Key = 'withoutDeaths' | 'withDeaths' | 'withoutDarkSections' | 'withDarkSections';

/** Two-line daily chart (without vs with). `log` plots log10(1 + value) so the small "with" line is visible. */
export function DailyChart({
  daily, keys, unit, log = false, title, height,
}: { daily: DailyPoint[]; keys: [Key, Key]; unit: string; log?: boolean; title: string; height?: number }) {
  const id = useId();
  // The SVG is drawn at the container's own width, so the labels keep their real size on a phone.
  const box = useRef<HTMLElement>(null);
  const [cw, setCw] = useState(680);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCw(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(280, cw), narrow = W < 520;
  const H = narrow ? 240 : (height ?? 300), L = narrow ? 42 : 56, R = narrow ? 64 : 92, T = 14, B = 34;
  const [hover, setHover] = useState<number | null>(null);
  const f = (v: number) => (log ? Math.log10(1 + Math.max(0, v)) : v);
  const maxRaw = Math.max(1, ...daily.map((d) => Math.max(d[keys[0]], d[keys[1]])));
  const yTicks = useMemo(() => {
    if (!log) return niceTicks(maxRaw);
    const top = Math.ceil(Math.log10(1 + maxRaw));
    return Array.from({ length: top + 1 }, (_, i) => (i === 0 ? 0 : 10 ** i));
  }, [log, maxRaw]);
  const yMax = f(yTicks[yTicks.length - 1]) || 1;
  const days = daily.length ? daily[daily.length - 1].day : 120;
  const x = (day: number) => L + ((day - 1) / Math.max(1, days - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - f(v) / yMax) * (H - T - B);
  const path = (k: Key) => daily.map((d, i) => `${i ? 'L' : 'M'}${x(d.day).toFixed(1)},${y(d[k]).toFixed(1)}`).join('');
  const xTicks = (narrow ? [1, 60, 120] : [1, 30, 60, 90, 120]).filter((d) => d <= days);
  const last = daily[daily.length - 1];
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * (W - L - R);
    const i = Math.round((px / (W - L - R)) * (daily.length - 1));
    setHover(Math.max(0, Math.min(daily.length - 1, i)));
  };
  const hp = hover != null ? daily[hover] : null;
  // Keep the two end labels apart when the lines end close together.
  let yA = y(last?.[keys[0]] ?? 0), yB = y(last?.[keys[1]] ?? 0);
  if (Math.abs(yA - yB) < 16) { if (yA <= yB) yB = yA + 16; else yA = yB + 16; }
  return (
    <figure className="chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby={`${id}-t ${id}-d`} className="chart-svg">
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>
          {last ? `On day ${last.day}: without Blackout Warning ${num(last[keys[0]])} ${unit}; with Blackout Warning ${num(last[keys[1]])} ${unit}.` : 'No data.'}
          {log ? ' The vertical scale is logarithmic.' : ''}
        </desc>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 8} y={y(t) + 4} className="tick" textAnchor="end">{compact(t)}</text>
          </g>
        ))}
        {xTicks.map((d) => (
          <text key={d} x={x(d)} y={H - B + 20} className="tick" textAnchor="middle">{d === 1 ? 'Day 1' : d}</text>
        ))}
        <path d={path(keys[0])} className="ln-without" />
        <path d={path(keys[1])} className="ln-with" />
        {last && (
          <>
            <text x={W - R + 8} y={yA + 4} className="end-label without">Without</text>
            <text x={W - R + 8} y={yB + 4} className="end-label with">With</text>
          </>
        )}
        {hp && (
          <g className="hover" pointerEvents="none">
            <line x1={x(hp.day)} x2={x(hp.day)} y1={T} y2={H - B} />
            <circle cx={x(hp.day)} cy={y(hp[keys[0]])} r={3.5} className="dot-without" />
            <circle cx={x(hp.day)} cy={y(hp[keys[1]])} r={3.5} className="dot-with" />
          </g>
        )}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      <figcaption className="chart-readout" aria-live="off">
        {hp ? (
          <>Day {hp.day}: <span className="without">without {num(hp[keys[0]], hp[keys[0]] % 1 ? 1 : 0)}</span>, <span className="with">with {num(hp[keys[1]], hp[keys[1]] % 1 ? 1 : 0)}</span> {unit}</>
        ) : (
          <>Point at the chart to read one day.</>
        )}
      </figcaption>
    </figure>
  );
}

/** One group of bars per metric: the model, the history baseline and chance. Each metric has its own scale. */
export function MetricBars({ rows, labels = ['Model', 'History', 'Chance'] }: { rows: MetricRow[]; labels?: [string, string, string] }) {
  return (
    <div className="metric-bars">
      {rows.map((r) => {
        const vals: [string, number | null, string][] = [
          [labels[0], r.model, 'b-model'], [labels[1], r.history, 'b-history'], [labels[2], r.chance, 'b-chance'],
        ];
        const max = Math.max(1e-9, ...vals.map(([, v]) => Math.abs(v ?? 0)));
        const digits = Math.max(...vals.map(([, v]) => v ?? 0)) > 1.5 ? 2 : 3;
        return (
          <div className="mb-group" key={r.metric}>
            <p className="mb-metric">{metricName(r.metric)} <span className="mb-better">{r.better === 'higher' ? '↑ better' : '↓ better'}</span></p>
            <p className="mb-note">{metricNote(r.metric) ?? ''}</p>
            <dl className="mb-rows">
              {vals.filter(([, v]) => v != null).map(([name, v, cls]) => (
                <div className="mb-row" key={name}>
                  <dt>{name}</dt>
                  <dd>
                    <span className="mb-track"><span className={`mb-bar ${cls}`} style={{ width: `${(Math.abs(v!) / max) * 100}%` }} /></span>
                    <span className="mb-val">{num(v!, digits)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal bars for shares (0..1), for example feature importance. */
export function ShareBars({ items }: { items: { label: string; share: number; note?: string }[] }) {
  const max = Math.max(1e-9, ...items.map((i) => i.share));
  return (
    <dl className="share-bars">
      {items.map((i) => (
        <div className="sb-row" key={i.label}>
          <dt><span className={/\s/.test(i.label) ? 'sb-label' : 'sb-label code'}>{i.label}</span>{i.note && <span className="sb-note">{i.note}</span>}</dt>
          <dd>
            <span className="mb-track"><span className="mb-bar b-model" style={{ width: `${(i.share / max) * 100}%` }} /></span>
            <span className="mb-val">{(i.share * 100).toFixed(1)}%</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One test metric at display size, with the model against its baselines on one scale. */
export function BigMetric({ r, labels = ['Model', 'History', 'Chance'] }: { r: MetricRow; labels?: [string, string, string] }) {
  const vals: [string, number | null, string][] = [[labels[0], r.model, 'b-model'], [labels[1], r.history, 'b-history'], [labels[2], r.chance, 'b-chance']];
  const shown = vals.filter(([, v]) => v != null) as [string, number, string][];
  const max = Math.max(1e-9, ...shown.map(([, v]) => Math.abs(v)));
  const digits = Math.max(...shown.map(([, v]) => v)) > 1.5 ? 2 : 3;
  const note = metricNote(r.metric);
  return (
    <figure className="bm">
      <figcaption>
        <span className="bm-name">{metricName(r.metric)}</span>
        <span className="bm-better">{r.better === 'higher' ? '↑ higher is better' : '↓ lower is better'}</span>
      </figcaption>
      <p className="bm-num">{num(r.model, digits)}</p>
      {note && <p className="bm-note">{note}</p>}
      <dl className="bm-rows">
        {shown.map(([name, v, cls]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd><span className="mb-track"><span className={`mb-bar ${cls}`} style={{ width: `${(Math.abs(v) / max) * 100}%` }} /></span><span className="mb-val">{num(v, digits)}</span></dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
