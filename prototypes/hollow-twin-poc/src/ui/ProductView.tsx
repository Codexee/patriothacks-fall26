// PROTOTYPE: the product view. What the residents' system shows: a resident's phone for one section, and the
// council console with every module's reasoning. Everything here comes from the system's own outputs, memory and
// log; none of it comes from the sim's hidden state.
import { useState } from 'react';
import { SECTIONS_PER_LEVEL, type Output, type ToolSet } from '../sim/types.ts';
import type { Run } from '../product/run.ts';
import { label } from '../product/run.ts';

export interface ProductViewProps {
  run: Run;
  modules: ToolSet;
  section: { level: number; col: number };
  onPickSection: (s: { level: number; col: number }) => void;
  onReport: (level: number, col: number, text: string) => void;
  queuedReports: number;
  locked: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function Evidence({ items }: { items: string[] }) {
  return (
    <details className="evidence">
      <summary>Evidence ({items.length})</summary>
      <ul>{items.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </details>
  );
}

export function ProductView(p: ProductViewProps) {
  const { run, section } = p;
  const [text, setText] = useState('The tap water tastes like metal.');
  const day = run.sim.day;
  const anyOn = Object.values(p.modules).some(Boolean);
  const alerts = run.outputs.filter((o): o is Extract<Output, { kind: 'alert' }> =>
    o.kind === 'alert' && section.level >= o.from && section.level <= o.to);
  const plan = run.outputs.find((o): o is Extract<Output, { kind: 'allocation' }> => o.kind === 'allocation');
  const idx = (section.level - 1) * SECTIONS_PER_LEVEL + section.col;
  const log = run.log;
  const ledger = run.memory.ledger;

  return (
    <aside className="product" aria-label="Residents' system">
      <header className="pv-head">
        <h1>RESIDENTS' SYSTEM</h1>
        <p className="muted small">What residents see. It reads only reports, meters and bulletins, never the sim's hidden truth.</p>
      </header>

      {/* ---------- The resident's phone ---------- */}
      <div className="phone" role="region" aria-label="A resident's phone">
        <div className="phone-bar">
          <span>Level</span>
          <input type="number" min={1} max={50} value={section.level} aria-label="Level"
            onChange={(e) => p.onPickSection({ level: Math.min(50, Math.max(1, +e.target.value || 1)), col: section.col })} />
          <span>Section</span>
          <input type="number" min={1} max={8} value={section.col + 1} aria-label="Section"
            onChange={(e) => p.onPickSection({ level: section.level, col: Math.min(7, Math.max(0, (+e.target.value || 1) - 1)) })} />
          <span className="muted">Day {day}</span>
        </div>

        {!anyOn && <p className="phone-empty">No modules are on. Residents have only the Directorate's bulletin.</p>}

        <h3>Alerts for your level</h3>
        {alerts.length === 0 ? <p className="muted">No alerts today.</p> : (
          <ul className="alerts">
            {alerts.map((a) => (
              <li key={a.id} className={`alert ${a.action}`}>
                <span className="tag">{label(a.module)}</span>
                <span>{a.text}</span>
                <Evidence items={a.evidence} />
              </li>
            ))}
          </ul>
        )}

        <h3>Your power today</h3>
        {plan ? (
          <p>Life support <b>{Math.round(plan.crit[idx] * 100)}%</b> · other power <b>{Math.round(plan.non[idx] * 100)}%</b>
            <span className="muted small block">From Fair Share's plan for all 400 sections.</span></p>
        ) : <p className="muted">No residents' plan. The Directorate decides: upper levels first.</p>}

        <h3>Send a report</h3>
        <form className="report" onSubmit={(e) => { e.preventDefault(); if (text.trim()) p.onReport(section.level, section.col, text.trim()); }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="Report text" />
          <button type="submit" disabled={p.locked || !text.trim()}>Send report</button>
        </form>
        <p className="muted small">{p.queuedReports > 0 ? `${p.queuedReports} report(s) queued. They reach the system with tomorrow's data.` : 'Reports reach the system with tomorrow\'s data.'}</p>
      </div>

      {/* ---------- Council console ---------- */}
      <section className="console">
        <h2>Council console</h2>

        {log?.seen && (
          <p className="muted small">Data received today: {Object.entries(log.seen).map(([k, v]) => `${v} ${k}`).join(' · ')}</p>
        )}

        {p.modules.earlyWarning && log?.earlyWarning && (
          <div className="mod">
            <h3>Early Warning</h3>
            <p>Plant output now {fmt(log.earlyWarning.capNow)}; forecast {fmt(log.earlyWarning.capForecast)} in {log.earlyWarning.inHours} h against demand {fmt(log.earlyWarning.demandForecast)}.</p>
            <p className={log.earlyWarning.shortfallPct > 0 ? 'bad' : 'good'}>
              {log.earlyWarning.shortfallPct > 0 ? `At the worst hour, full demand is ${Math.round(log.earlyWarning.shortfallPct)}% more than the plants can safely give.` : 'No shortfall forecast.'}
              {log.earlyWarning.shed > 0 && !p.modules.fairShare ? ` Asked residents to cut ${Math.round(log.earlyWarning.shed * 100)}% of non-essential load.` : ''}
              {log.earlyWarning.shortfallPct > 0 && p.modules.fairShare ? ' Forecast sent to Fair Share.' : ''}
            </p>
          </div>
        )}

        {p.modules.fairShare && log?.fairShare && (
          <div className="mod">
            <h3>Fair Share</h3>
            <p>Plans for {fmt(log.fairShare.available)} units (88% of the forecast, as a margin). Life support {Math.round(log.fairShare.criticalShare * 100)}% everywhere; other power {Math.round(log.fairShare.nonCriticalShare * 100)}% for everyone; farms in full.</p>
            {log.fairShare.hotLevels.length > 0 && <p className="muted small">More cooling on hot levels: {log.fairShare.hotLevels.join(', ')}</p>}
          </div>
        )}

        {p.modules.snow && log?.snow && (
          <div className="mod">
            <h3>Snow</h3>
            {log.snow.suspects.length === 0 ? <p className="muted">No recycler stands out. Typical: {log.snow.baseline.toFixed(2)} complaints per 1,000.</p> : (
              <ul>{log.snow.suspects.map((s) => (
                <li key={s.level} className="bad">Recycler L{s.level}: {s.reports} complaints ({s.reportsPer1000.toFixed(2)}/1,000 vs {log.snow!.baseline.toFixed(2)}){s.tap !== null ? `, tap ${s.tap.toFixed(2)}` : ''}</li>
              ))}</ul>
            )}
          </div>
        )}

        {p.modules.ledger && log?.ledger && (
          <div className="mod">
            <h3>Ledger · Truthcount</h3>
            <div className="truth">
              <div><span className="k">Official cases</span><span className="v">{fmt(log.ledger.official)}</span></div>
              <div><span className="k">Estimated</span><span className={`v ${log.ledger.estimated > 2.5 * Math.max(1, log.ledger.official) ? 'bad' : ''}`}>{fmt(log.ledger.estimated)}</span></div>
            </div>
            {log.ledger.plant3Share !== null && log.ledger.plant3Baseline !== null && (
              <p className="small">Plant 3 share of output: {(log.ledger.plant3Share / log.ledger.plant3Baseline * 100).toFixed(0)}% of normal</p>
            )}
          </div>
        )}

        {p.modules.ledger && (
          <div className="mod">
            <h3>Published findings</h3>
            {ledger.length === 0 ? <p className="muted">Nothing published yet.</p> : (
              <ol className="chain">
                {[...ledger].reverse().map((r) => (
                  <li key={r.id}>
                    <div className="chain-head"><span className="hash">#{r.hash}</span><span className="muted small">day {r.day} · {r.module} · prev #{r.prevHash}</span></div>
                    <div>{r.text}</div>
                    {r.lie && <span className="tag bad">contradicts the Directorate</span>}
                    <Evidence items={r.evidence} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </section>
    </aside>
  );
}
