// PROTOTYPE: values for one section of the current frame, each with its source.
import { useState } from 'react';
import { sim } from '../sim/index.ts';
import { sectionIndex, type Frame, type MetricKey, type Source } from '../sim/types.ts';

export function SourceInfo({ source, label }: { source: Source; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="src">
      <button className="info" aria-label={`Source for ${label ?? source.label}`} aria-expanded={open} onClick={() => setOpen(!open)}>ⓘ</button>
      {open && (
        <span className="src-pop" role="note">
          <strong>{source.label}</strong>
          <span>{source.detail}</span>
          <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a>
        </span>
      )}
    </span>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function HoverCard({ frame, target }: { frame: Frame; target: { level: number; col: number } | null }) {
  if (!target) return <p className="muted">Hover over a section of the cutaway to see its values.</p>;
  const s = frame.sections[sectionIndex(target.level, target.col)];
  if (!s) return null;
  const rows: { key: MetricKey | null; label: string; value: string; bad?: boolean }[] = [
    { key: null, label: 'People', value: s.people.toLocaleString() },
    { key: 'power', label: 'Power', value: pct(s.power), bad: s.power < 0.5 },
    { key: 'co2', label: 'CO₂', value: `${Math.round(s.co2)} ppm`, bad: s.co2 > 2000 },
    { key: 'wetBulb', label: 'Wet-bulb', value: `${s.wetBulb.toFixed(1)} °C`, bad: s.wetBulb > 31 },
    { key: 'infected', label: 'Infected', value: pct(s.infected), bad: s.infected > 0.1 },
    { key: 'water', label: 'Water quality', value: pct(s.water), bad: s.water < 0.8 },
    { key: 'food', label: 'Food', value: `${s.food.toFixed(1)} days`, bad: s.food < 5 },
  ];
  return (
    <div className="hover-card">
      <div className="hc-head">
        Level {s.level} · Section {s.col + 1}
        {s.lost && <span className="tag bad">LOST</span>}
      </div>
      <dl>
        {rows.map((r) => (
          <div key={r.label} className="hc-row">
            <dt>{r.label}{r.key && <SourceInfo source={sim.sourceFor(r.key)} label={r.label} />}</dt>
            <dd className={r.bad ? 'bad' : undefined}>{r.value}</dd>
          </div>
        ))}
        <div className="hc-row">
          <dt>Structures</dt>
          <dd>{s.structures.length ? s.structures.join(', ') : 'none'}</dd>
        </div>
      </dl>
    </div>
  );
}
