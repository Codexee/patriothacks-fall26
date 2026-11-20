// The section inspector card: one section on the shown day, both runs side by side, plus its real counties.
import { SECTION_COUNT } from '../../sim/types.ts';
import { sections as realSections } from '../../data/real/index.ts';
import type { TwinData } from '../compute.ts';
import type { Pick } from '../Scene.tsx';
import { Tag, fmtNum } from './charts.tsx';
import { SIDES, SIDE_COLOR, SIDE_SHORT, det, pct } from './model.ts';

export function SectionCard({ data, day, pick, onClose }: { data: TwinData; day: number; pick: Pick; onClose: () => void }) {
  const i = pick.index;
  const level = Math.floor(i / 8) + 1, col = i % 8;
  const N = SECTION_COUNT;
  const real = realSections?.rows[i];
  const row = (label: string, f: (side: 'without' | 'with') => string, bad?: (side: 'without' | 'with') => boolean) => (
    <tr>
      <th scope="row">{label}</th>
      {SIDES.map((s) => <td key={s} className={`num ${bad?.(s) ? 'bad' : ''}`}>{f(s)}</td>)}
    </tr>
  );
  const v = (s: 'without' | 'with') => det(data, s);
  return (
    <aside className="ws-card" aria-label={`Section level ${level}, column ${col}`}>
      <header>
        <span>Level {level} · column {col} <span className="ws-dim">(#{i}, day {day})</span></span>
        <button type="button" onClick={onClose} aria-label="Close the section card">×</button>
      </header>
      <table className="ws-kv ws-cardt">
        <thead><tr><th scope="col"><Tag kind="sim" /></th>{SIDES.map((s) => <th key={s} scope="col" style={{ color: SIDE_COLOR[s] }}>{SIDE_SHORT[s]}</th>)}</tr></thead>
        <tbody>
          {row('Residents now', (s) => fmtNum(v(s).people[day * N + i]))}
          {row('Residents at start', (s) => fmtNum(v(s).startPeople[i]))}
          {row('Life-support power', (s) => pct(v(s).ls[day * N + i]), (s) => v(s).ls[day * N + i] < 0.5)}
          {row('Power served', (s) => pct(v(s).power[day * N + i]))}
          {row('CO₂, day max', (s) => `${fmtNum(v(s).co2[day * N + i])} ppm`, (s) => v(s).co2[day * N + i] >= 5000)}
          {row('Dark hours so far', (s) => fmtNum(v(s).darkH[day * N + i]))}
          {row('Alerts to its level today', (s) => { const w = v(s).warned[day * N + i]; return [w & 1 ? 'blackout warning' : '', w & 2 ? 'save power' : ''].filter(Boolean).join(', ') || 'none'; })}
        </tbody>
      </table>
      {real && (
        <div className="ws-card-real">
          <p className="ws-sub">Real counties in this section <Tag kind="real" /></p>
          <table className="ws-kv">
            <tbody>
              <tr><th scope="row">Mean SVI (CDC 2022)</th><td className="num">{real.svi.toFixed(3)}</td></tr>
              <tr><th scope="row">Power-dependent (emPOWER)</th><td className="num">{fmtNum(real.dme)}</td></tr>
              <tr><th scope="row">Growth per year (Census)</th><td className="num">{(real.growthPerYear * 100).toFixed(2)}%</td></tr>
              <tr><th scope="row">Share of the Hollow</th><td className="num">{(real.share * 100).toFixed(3)}%</td></tr>
              <tr><th scope="row">County parts</th><td className="num">{real.countyCount ?? real.counties.length}</td></tr>
            </tbody>
          </table>
          <table className="ws-table">
            <thead><tr><th scope="col">County</th><th scope="col">FIPS</th><th scope="col">SVI</th><th scope="col">Pop. in section</th></tr></thead>
            <tbody>
              {real.counties.map((c) => <tr key={c.fips + c.pop}><td>{c.name}, {c.state}</td><td className="num">{c.fips}</td><td className="num">{c.svi.toFixed(3)}</td><td className="num">{fmtNum(c.pop)}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </aside>
  );
}
