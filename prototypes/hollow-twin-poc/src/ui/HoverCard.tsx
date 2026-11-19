// PROTOTYPE: values for one section of the current frame, each with its source.
import { useState } from 'react';
import { sim } from '../sim/index.ts';
import { sectionIndex, type Frame, type MetricKey, type Source } from '../sim/types.ts';
import { WORLD } from '../sim/engine.ts';
import { sections as realSections, type SectionRow } from '../data/real/index.ts';

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

/** The real US counties behind one section (workstream 3). Hidden-world data: hover card only, never src/product/. */
function RealCounties({ index }: { index: number }) {
  const row = realSections?.rows[index] as (SectionRow & { countyCount?: number }) | undefined;
  if (!realSections || !row || !row.counties.length) return null;
  const n = row.countyCount ?? row.counties.length;
  const c = row.counties[0];
  const g = row.growthPerYear * 100;
  return (
    <p className="hc-real">
      Built from {n} real {n === 1 ? 'county' : 'counties'}, e.g. {c.name}, {c.state} (SVI {c.svi.toFixed(2)})
      {' · '}{row.dme.toLocaleString()} power-dependent residents in these counties (HHS emPOWER)
      {' · '}growth {g >= 0 ? '+' : '−'}{Math.abs(g).toFixed(1)}%/yr (Census 2020–2024)
      <SourceInfo source={realSections.source} label="Real counties" />
    </p>
  );
}

export function HoverCard({ frame, target }: { frame: Frame; target: { level: number; col: number } | null }) {
  if (!target) return <p className="muted">Hover over a section of the cutaway to see its values.</p>;
  const s = frame.sections[sectionIndex(target.level, target.col)];
  if (!s) return null;
  const rows: { key: MetricKey | null; label: string; value: string; bad?: boolean }[] = [
    { key: null, label: 'People', value: s.people.toLocaleString() },
    { key: 'power', label: 'Power', value: pct(s.power), bad: s.power < 0.5 },
    { key: 'co2', label: 'Air (CO₂)', value: `${Math.round(s.co2)} ppm`, bad: s.co2 > 2000 },
    // REBUILD: show only what exists in the test world so far.
    ...(WORLD.heat ? [{ key: 'wetBulb' as MetricKey, label: 'Wet-bulb', value: `${s.wetBulb.toFixed(1)} °C`, bad: s.wetBulb > 31 }] : []),
    ...(WORLD.sickness ? [{ key: 'infected' as MetricKey, label: 'Infected', value: pct(s.infected), bad: s.infected > 0.1 }] : []),
    ...(WORLD.water ? [{ key: 'water' as MetricKey, label: 'Water quality', value: pct(s.water), bad: s.water < 0.8 }] : []),
    ...(WORLD.food ? [{ key: 'food' as MetricKey, label: 'Food', value: `${s.food.toFixed(1)} days`, bad: s.food < 5 }] : []),
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
      <RealCounties index={sectionIndex(s.level, s.col)} />
    </div>
  );
}
