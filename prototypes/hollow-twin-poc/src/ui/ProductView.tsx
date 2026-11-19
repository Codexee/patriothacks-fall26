// REBUILD: the product view — the Residents' System. A resident's phone for one section, and the council console
// with the reasoning of each feature. Everything here comes from the system's own outputs, memory and log; none of
// it comes from the test world's hidden state. Step 1: Blackout Warning (problem #1).
import { useState } from 'react';
import { type Output, type ToolSet } from '../sim/types.ts';
import type { Run } from '../product/run.ts';
import { BUILT, PROBLEMS, moduleName } from '../product/names.ts';
import { Info } from './Info.tsx';

export interface ProductViewProps {
  run: Run;
  modules: ToolSet;
  section: { level: number; col: number };
  onPickSection: (s: { level: number; col: number }) => void;
  homeLocked: boolean;
  onToggleLock: () => void;
  onReport: (level: number, col: number, text: string) => void;
  queuedReports: number;
  locked: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function Evidence({ items }: { items: string[] }) {
  return (
    <details className="evidence">
      <summary>Why? ({items.length})</summary>
      <ul>{items.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </details>
  );
}

export function ProductView(p: ProductViewProps) {
  const { run, section } = p;
  const [text, setText] = useState('The power has been off for hours on our level.');
  const day = run.sim.day;
  const on = p.modules.earlyWarning;
  const alerts = run.outputs.filter((o): o is Extract<Output, { kind: 'alert' }> =>
    o.kind === 'alert' && section.level >= o.from && section.level <= o.to);
  const bw = run.log?.blackoutWarning;
  const mine = bw?.blackouts.find((b) => section.level >= b.from && section.level <= b.to) ?? null;
  const clock = (h: number) => `${String(h).padStart(2, '0')}:00`;

  return (
    <aside className="product" aria-label="Residents' System">
      <header className="pv-head">
        <h1>Residents' System <Info label="About the Residents' System">The app residents run for themselves. It sees only what residents have: their outage reports, their own head count and the Directorate's census. Never the hidden truth.</Info></h1>
        <div className="progress" aria-label="Progress through the 15 problems">
          {PROBLEMS.map((pr) => (
            <span key={pr.n} className={`dot ${pr.feature && BUILT.includes(pr.feature) ? 'done' : ''}`} title={`#${pr.n} ${pr.title}${pr.feature ? ` — ${moduleName(pr.feature)}` : ' — not built yet'}`}>{pr.n}</span>
          ))}
        </div>
        <p className="muted small">Step 1 of 15 · Problem #1: warn people before the power or air cuts out.</p>
      </header>

      {/* ---------- The resident's phone ---------- */}
      <div className="phone" role="region" aria-label="A resident's phone">
        <div className="phone-bar">
          <span>Home: level</span>
          <input type="number" min={1} max={50} value={section.level} aria-label="Level"
            onChange={(e) => p.onPickSection({ level: Math.min(50, Math.max(1, +e.target.value || 1)), col: section.col })} />
          <span>section</span>
          <input type="number" min={1} max={8} value={section.col + 1} aria-label="Section"
            onChange={(e) => p.onPickSection({ level: section.level, col: Math.min(7, Math.max(0, (+e.target.value || 1) - 1)) })} />
          <button className={`lock ${p.homeLocked ? 'on' : ''}`} onClick={p.onToggleLock} aria-pressed={p.homeLocked}
            title={p.homeLocked ? 'Locked: hovering the cutaway does not change your home' : 'Unlocked: hovering the cutaway changes your home'}>
            {p.homeLocked ? 'Home locked' : 'Lock home'}
          </button>
        </div>
        <p className="muted small">Day {day}</p>

        {!on && <p className="phone-empty">Blackout Warning is off. Like everyone in the Hollow today, you find out about a blackout when the lights go out.</p>}

        {on && (
          <>
            <h3>Next blackout on your level</h3>
            {mine ? (
              <p className="big-line bad">Today from about {clock(mine.startClock)}, lasting about {mine.hours} h.</p>
            ) : bw ? (
              <p className="big-line good">None expected today.</p>
            ) : <p className="muted">Gathering data. The first forecast comes tomorrow.</p>}
          </>
        )}

        <h3>Alerts for your level</h3>
        {alerts.length === 0 ? <p className="muted">No alerts today.</p> : (
          <ul className="alerts">
            {alerts.map((a) => (
              <li key={a.id} className={`alert ${a.action}`}>
                <span className="tag">{a.action === 'prepare' ? 'Blackout coming' : 'Save power'}</span>
                <span>{a.text}</span>
                <Evidence items={a.evidence} />
              </li>
            ))}
          </ul>
        )}

        <h3>Report a problem <Info>Optional. Residents report outages on their own; your report joins tomorrow's data.</Info></h3>
        <form className="report" onSubmit={(e) => { e.preventDefault(); if (text.trim()) p.onReport(section.level, section.col, text.trim()); }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="Report text" />
          <button type="submit" disabled={p.locked || !text.trim()}>Send report</button>
        </form>
        {p.queuedReports > 0 && <p className="muted small">{p.queuedReports} report(s) queued for tomorrow's data.</p>}
      </div>

      {/* ---------- Council console ---------- */}
      <section className="console">
        <h2>Council console</h2>
        {!on && <p className="muted">Turn on Blackout Warning (right panel) to see its forecast here.</p>}
        {on && bw && (
          <div className="mod">
            <h3>{moduleName('earlyWarning')} <span className="muted small">#1</span> <Info label="How it predicts">Power goes to the upper levels first, so the line where residents report blackouts shows how much power the plants make. Yesterday's line, and how it moved since the day before, predicts today's. Power needs come from residents' own head count. No plant meters, no forecast.</Info></h3>
            <p>Head count: the Directorate's census says <b>{fmt(bw.censusPeople)}</b>; residents counted <b>{fmt(bw.selfPeople)}</b> in the app
              {bw.selfPeople > bw.censusPeople && <> (<b className="bad">+{Math.round((bw.selfPeople / Math.max(1, bw.censusPeople) - 1) * 100)}%</b>, +{Math.round((bw.deepRatio - 1) * 100)}% on level 50)</>}. Power needs use the residents' count.</p>
            <p>Blackout line yesterday: {bw.lineWorst === null
              ? <b>no level lost power</b>
              : <>at {clock(bw.lineWorstHour)} only the top <b>{bw.lineWorst}</b> levels had power ({bw.trend < 0 ? `moving up ${-bw.trend} levels a day` : bw.trend > 0 ? `moving down ${bw.trend} levels a day` : 'not moving'})</>}.
              {bw.hollowDarkHours > 0 && <> The whole Hollow went dark for <b className="bad">{bw.hollowDarkHours} h</b> (plants tripped).</>}</p>
            {bw.supplyEstimate !== null && <p>So the plants made about <b>{fmt(bw.supplyEstimate)}</b> units at the worst hour, for a need of <b>{fmt(bw.demand)}</b>.</p>}
            {bw.shed > 0
              ? <p className="warn-text">{bw.lineWorst === null && bw.hollowDarkHours === 0 ? 'Keeping the request (residents cannot see the plants, so a quiet day is no proof the power is back):' : 'Plants are running at their limit.'} Asked everyone to switch off {Math.round(bw.shed * 100)}% of non-essential load today.</p>
              : <p className="good">No blackouts yesterday: no power saving needed.</p>}
            <h4>Blackouts predicted (today)</h4>
            {bw.blackouts.length === 0 ? <p className="muted">None.</p> : (
              <table className="bo-table">
                <thead><tr><th>Levels</th><th>Starts</th><th>Lasts</th></tr></thead>
                <tbody>
                  {bw.blackouts.map((b) => (
                    <tr key={b.from}><td>{b.from === b.to ? b.from : `${b.from}–${b.to}`}</td><td>about {clock(b.startClock)}</td><td>{b.hours} h</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {bw.darkNow.length > 0 && <p className="small bad">Still without power at the end of yesterday (outage reports): levels {bw.darkNow.join(', ')}</p>}
          </div>
        )}
        {run.log?.seen && (
          <p className="muted small">Data received today: {Object.entries(run.log.seen).map(([k, v]) => `${v} ${k}`).join(' · ')}</p>
        )}
      </section>
    </aside>
  );
}
