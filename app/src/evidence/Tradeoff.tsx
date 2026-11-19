// Comparison at equal false-alarm rates: share of events warned 12 h ahead (or people-weighted)
// against false alarms per area per year. Curves and points come from metrics.json "curves";
// each model's frozen (pre-registered) threshold is marked from metrics.json "models" /
// "realForecast". Rules are single points at their frozen thresholds.
import { useState } from 'react';
import { fmtInt } from '../brief/shared.tsx';
import type { MetricsV2 } from './metrics.ts';

export interface CurvePoint {
  falsePerBaYear: number;
  recall12h: number;
  peopleRecall12h?: number | null;
  medianLeadHours?: number | null;
  threshold?: number;
}

type Metric = 'events' | 'people';

interface CurveSpec { key: string; label: string; sub: string; color: string; dashed?: boolean; frozen: { fa: number; events: number; people: number | null } | null }

// Rule labels sit in the empty lower-right corner of the plot, joined to their point by a thin line.
const RULES: [string, string][] = [
  ['rule_hand', 'Rule: our earlier hand rule'],
  ['rule_forecast_error', 'Rule: demand above its forecast'],
  ['rule_record', "Rule: forecast above month's record"],
];

const W = 960, H = 440, L = 64, R = 250, T = 18, B = 52;
const X_MAX = 14;

export function curvesOf(m: MetricsV2): Record<string, CurvePoint[]> {
  return ((m as unknown as { curves?: Record<string, CurvePoint[]> }).curves ?? {});
}

export function Tradeoff({ metrics }: { metrics: MetricsV2 }) {
  const [metric, setMetric] = useState<Metric>('events');
  const curves = curvesOf(metrics);
  const rf = metrics.realForecast?.models;
  const frozenOf = (r?: { falseAlarmsPerBaYear: number; recall12h: number; peopleRecall12h?: number | null }) =>
    r ? { fa: r.falseAlarmsPerBaYear, events: r.recall12h, people: r.peopleRecall12h ?? null } : null;
  const specs: CurveSpec[] = [
    { key: 'warn_fcst', label: 'With a weather forecast', sub: 'observed weather, upper bound', color: 'var(--lit)', dashed: true, frozen: frozenOf(metrics.models.warn_fcst) },
    { key: 'warn_fcst_real2024', label: 'With real weather forecasts', sub: '2024 only', color: 'var(--alert)', frozen: frozenOf(rf?.warn_fcst_real) },
    { key: 'warn_full', label: 'No forecast', sub: 'grid, weather now, outages', color: 'var(--accent)', frozen: frozenOf(metrics.models.warn_full) },
    { key: 'warn_grid', label: 'Grid data only', sub: 'no weather, no outages', color: 'var(--ok)', frozen: frozenOf(metrics.models.warn_grid) },
  ].filter((s) => curves[s.key]?.length);
  if (!specs.length) return null;

  const yOf = (p: { recall12h?: number; peopleRecall12h?: number | null }) => (metric === 'events' ? p.recall12h ?? null : p.peopleRecall12h ?? null);
  const x = (v: number) => L + (Math.min(v, X_MAX) / X_MAX) * (W - L - R);
  const y = (v: number) => T + (1 - v) * (H - T - B);
  const xTicks = [0, 2, 4, 6, 8, 10, 12, 14];
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1];

  // Direct labels at the right edge, at each curve's last point inside the x range, pushed apart.
  const ends = specs.map((s) => {
    const pts = curves[s.key].filter((p) => p.falsePerBaYear <= X_MAX && yOf(p) != null);
    const last = pts[pts.length - 1];
    return { s, ly: last ? y(yOf(last)!) : y(0), lx: last ? x(last.falsePerBaYear) : x(0) };
  }).sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < ends.length; i++) if (ends[i].ly - ends[i - 1].ly < 30) ends[i].ly = ends[i - 1].ly + 30;

  const path = (pts: CurvePoint[]) =>
    pts
      .filter((p) => p.falsePerBaYear <= X_MAX + 0.5 && yOf(p) != null)
      .sort((a, b) => a.falsePerBaYear - b.falsePerBaYear)
      .map((p, i) => `${i ? 'L' : 'M'}${x(p.falsePerBaYear).toFixed(1)},${y(yOf(p)!).toFixed(1)}`)
      .join('');

  const yName = metric === 'events' ? 'Share of events warned 12 h or more ahead' : 'Share of people out in events warned 12 h or more ahead';
  return (
    <figure className="tradeoff">
      <div className="bar">
        <figcaption className="tradeoff-title">{yName}, against false alarms</figcaption>
        <div className="toggle" role="group" aria-label="Measure">
          <button type="button" aria-pressed={metric === 'events'} onClick={() => setMetric('events')}>Events</button>
          <button type="button" aria-pressed={metric === 'people'} onClick={() => setMetric('people')}>People</button>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yName} against false alarms per area per year, for each method.`}>
        <defs>
          <clipPath id="tradeoff-clip"><rect x={L} y={T - 4} width={W - L - R + 4} height={H - T - B + 8} /></clipPath>
        </defs>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="tick">{Math.round(v * 100)}%</text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={H - B} y2={H - B + 5} className="grid" />
            <text x={x(v)} y={H - B + 20} textAnchor="middle" className="tick">{v}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" className="axis-name">False alarms per area per year</text>

        <g clipPath="url(#tradeoff-clip)">
          {specs.map((s) => (
            <path key={s.key} d={path(curves[s.key])} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dashed ? '7 5' : undefined} strokeLinejoin="round" />
          ))}
          {specs.map((s) => {
            const f = s.frozen;
            const fy = f ? (metric === 'events' ? f.events : f.people) : null;
            if (!f || fy == null || f.fa > X_MAX) return null;
            return (
              <g key={`f-${s.key}`}>
                <circle cx={x(f.fa)} cy={y(fy)} r={s.key === 'warn_full' ? 11 : 7} fill={s.key === 'warn_full' ? 'none' : 'var(--bg)'} stroke={s.color} strokeWidth={2.5} />
                <circle cx={x(f.fa)} cy={y(fy)} r={2.5} fill={s.color} />
              </g>
            );
          })}
        </g>

        {RULES.map(([k, label], i) => {
          const p = curves[k]?.[0];
          const v = p ? yOf(p) : null;
          if (!p || v == null) return null;
          const lx = x(8.6);
          const ly = y(0) - 46 + i * 18;
          return (
            <g key={k}>
              <line x1={x(p.falsePerBaYear)} y1={y(v)} x2={lx - 4} y2={ly - 4} className="rule-lead" />
              <rect x={x(p.falsePerBaYear) - 5} y={y(v) - 5} width={10} height={10} className="rule-pt" />
              <text x={lx} y={ly} className="rule-label">{label}</text>
            </g>
          );
        })}

        {ends.map(({ s, ly, lx }) => (
          <g key={`l-${s.key}`}>
            <line x1={lx} x2={W - R + 8} y1={ly} y2={ly} stroke={s.color} strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
            <text x={W - R + 12} y={ly + 4} className="curve-label" fill={s.color}>
              <tspan x={W - R + 12}>{s.label}</tspan>
              <tspan x={W - R + 12} dy={15} className="curve-sub">{s.sub}</tspan>
            </text>
          </g>
        ))}
      </svg>
      <p className="dim small">
        Each line shows one model at every alert threshold. These operating points are read from the test period to compare methods at equal false-alarm rates. The ringed point on each
        line is the threshold fixed before the test. Squares are the rules at their fixed thresholds. Final test {metrics.testYears[0]} to {metrics.testYears[1]}
        {metrics.realForecast?.models?.warn_fcst_real && <>; the real-forecast line covers only 2024 ({fmtInt(metrics.realForecast.models.warn_fcst_real.testEvents)} events)</>}.
        The x axis stops at {X_MAX} false alarms per area per year.
      </p>
    </figure>
  );
}

type Matched = Record<string, Record<string, Record<string, CurvePoint & { warned12h?: number; testEvents?: number }>>>;

/** One sentence: the real-forecast model at the forecast-error rule's false-alarm rate, against the rule. */
export function MatchedSentence({ metrics }: { metrics: MetricsV2 }) {
  const rf = metrics.realForecast?.models;
  const rule = rf?.rule_forecast_error;
  const model = rf?.warn_fcst_real;
  if (!rule || !model) return null;
  const matched = (metrics as unknown as { matched?: Matched }).matched;
  let pt: (CurvePoint & { warned12h?: number; testEvents?: number }) | undefined = matched?.real2024?.warn_fcst_real?.rule_forecast_error;
  if (!pt) {
    // Nearest curve point at or below the rule's rate.
    const c = curvesOf(metrics).warn_fcst_real2024 ?? [];
    pt = c.filter((p) => p.falsePerBaYear <= rule.falseAlarmsPerBaYear).sort((a, b) => b.falsePerBaYear - a.falsePerBaYear)[0];
  }
  if (!pt) return null;
  const n = pt.testEvents ?? model.testEvents;
  const warned = pt.warned12h ?? Math.round(pt.recall12h * n);
  const p0 = (v: number | null | undefined) => (v == null ? '' : `${Math.round(v * 100)}%`);
  return (
    <p className="matched">
      With real 2024 weather forecasts, at or below the false-alarm rate of the rule "demand above its forecast" ({pt.falsePerBaYear.toFixed(2)} against{' '}
      {rule.falseAlarmsPerBaYear.toFixed(2)} per area per year), the model warned <strong>{warned} of {n} events</strong> 12 h or more ahead
      {pt.peopleRecall12h != null && <>, covering <strong>{p0(pt.peopleRecall12h)}</strong> of the people out</>}. The rule warned {rule.warned12h} of {rule.testEvents}
      {rule.peopleRecall12h != null && <> ({p0(rule.peopleRecall12h)} of the people out)</>}.
    </p>
  );
}
