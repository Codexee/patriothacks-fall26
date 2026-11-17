// PROTOTYPE: the fixed right panel. Presentational; App owns the state and the sim calls.
import { useState, type ReactNode } from 'react';
import { sim } from '../sim/index.ts';
import type { Frame, Score, SimState, ToolKey, ToolSet } from '../sim/types.ts';
import { HoverCard, SourceInfo } from './HoverCard.tsx';
import { TOOL_KEYS, TOOL_LABELS, type Attribution, type RunResult } from './compare.ts';

export interface PanelProps {
  state: SimState;
  frame: Frame;
  scenarioId: string;
  seed: number;
  pendingTools: ToolSet;
  playing: boolean;
  busy: string | null; // label of a running batch job
  events: string[];
  score: Score;
  hover: { level: number; col: number } | null;
  compare: { without: RunResult; withTools: RunResult } | null;
  attr: Attribution | null;
  attrProgress: { done: number; total: number } | null;
  onScenario: (id: string) => void;
  onSeed: (seed: number) => void;
  onReset: () => void;
  onToggleTool: (k: ToolKey) => void;
  onNextDay: () => void;
  onSkipToEnd: () => void;
  onCompare: () => void;
  onAttribution: () => void;
}

function Section({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="p-sec">
      <h2>{title}{extra}</h2>
      {children}
    </section>
  );
}

const fmt = (n: number) => n.toLocaleString();
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}`;

function RunCol({ title, r }: { title: string; r: RunResult }) {
  return (
    <div className="run-col">
      <h3>{title}</h3>
      <div className={`big ${r.end?.kind === 'stable' ? 'good' : 'bad'}`}>Day {r.days}</div>
      <div>{r.end ? (r.end.kind === 'stable' ? 'Stable Hollow' : `Lost: ${r.end.reason}`) : `Still running at cap`}</div>
      <div>Deaths {fmt(r.deaths)}</div>
      <div>Score {fmt(Math.round(r.score.total))}</div>
    </div>
  );
}

export function Panel(p: PanelProps) {
  const [open, setOpen] = useState(true);
  const { state, frame } = p;
  const locked = p.playing || p.busy !== null;
  const t = state.totals;
  const maxPhi = p.attr ? Math.max(1e-9, ...TOOL_KEYS.map((k) => Math.abs(p.attr!.phi[k]))) : 1;

  return (
    <aside className={`panel ${open ? 'open' : 'closed'}`} aria-label="Control panel">
      <button className="sheet-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        Day {state.day} · {fmt(t.population)} alive {open ? '▾' : '▴'}
      </button>
      <div className="panel-body">
        <header className="p-head">
          <h1>HOLLOW TWIN</h1>
          <span className="muted">prototype</span>
        </header>

        <Section title="Scenario" extra={<SourceInfo source={sim.sourceFor('scenario')} label="scenario" />}>
          <div className="row">
            <select value={p.scenarioId} disabled={locked} onChange={(e) => p.onScenario(e.target.value)} aria-label="Scenario">
              {sim.scenarios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="seed">Seed
              <input type="number" value={p.seed} disabled={locked} onChange={(e) => p.onSeed(Number(e.target.value) || 0)} />
            </label>
            <button disabled={locked} onClick={p.onReset}>Reset</button>
          </div>
          <p className="muted small">{state.scenario.summary}</p>
        </Section>

        {state.end && (
          <div className={`banner ${state.end.kind}`} role="status">
            {state.end.kind === 'lost'
              ? `Hollow lost on day ${state.end.day}: ${state.end.reason}`
              : `Stable Hollow on day ${state.end.day}`}
          </div>
        )}

        <Section title="Status">
          <div className="stats">
            <div><span className="k">Day</span><span className="v">{state.day}{p.playing && ` · ${String(frame.hour).padStart(2, '0')}:00`}</span></div>
            <div><span className="k">Alive</span><span className="v">{fmt(t.population)}</span></div>
            <div><span className="k">Deaths</span><span className="v bad">{fmt(t.deaths)}</span></div>
            <div><span className="k">Plants</span><span className="v">{frame.plantsOnline}/{frame.plantsTotal}</span></div>
          </div>
          <div className="trust">
            <span className="k">Trust</span>
            <div className="bar"><div style={{ width: `${Math.round(state.trust * 100)}%` }} /></div>
            <span className="v">{Math.round(state.trust * 100)}%</span>
          </div>
        </Section>

        <Section title="Bulletin" extra={<SourceInfo source={sim.sourceFor('directorate')} label="Directorate" />}>
          <div className="two-col">
            <div>
              <h3>Directorate says</h3>
              <ul>{state.bulletin.directorate.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </div>
            <div>
              <h3>Measured</h3>
              <ul>{state.bulletin.measured.map((l, i) => <li key={i} className="measured">{l}</li>)}</ul>
            </div>
          </div>
          {state.lies.length > 0 && (
            <ul className="lies">
              {state.lies.map((l) => (
                <li key={l.id}>
                  <span className={`tag ${l.exposed ? 'bad' : l.active ? 'warn' : ''}`}>
                    {l.exposed ? 'EXPOSED' : l.active ? 'ACTIVE' : 'DROPPED'}
                  </span>
                  <span>“{l.bulletin}”</span>
                  <span className="measured">→ {l.truth}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Resident tools">
          <div className="tools">
            {TOOL_KEYS.map((k) => (
              <label key={k} className={`tool ${p.pendingTools[k] ? 'on' : ''}`}>
                <input type="checkbox" checked={p.pendingTools[k]} disabled={locked || !!state.end} onChange={() => p.onToggleTool(k)} />
                {TOOL_LABELS[k]}
              </label>
            ))}
          </div>
          {TOOL_KEYS.some((k) => p.pendingTools[k] !== state.tools[k]) && (
            <p className="muted small">Changes apply on the next day.</p>
          )}
          <div className="row">
            <button className="primary" disabled={locked || !!state.end} onClick={p.onNextDay}>
              {p.playing ? 'Playing…' : 'Next day ▸'}
            </button>
            <button disabled={p.busy !== null || !!state.end} onClick={p.onSkipToEnd}>Skip to end ▸▸</button>
          </div>
        </Section>

        <Section title="Section">
          <HoverCard frame={frame} target={p.hover} />
        </Section>

        <Section title="Score">
          <div className="stats">
            <div><span className="k">Total</span><span className="v">{fmt(Math.round(p.score.total))}</span></div>
            <div><span className="k">Days</span><span className="v">{p.score.days}</span></div>
            <div><span className="k">Alive</span><span className="v">{p.score.alivePct.toFixed(1)}%</span></div>
            <div><span className="k">Fairness</span><span className="v">{p.score.fairness.toFixed(0)}</span></div>
          </div>
        </Section>

        <Section title="Same plants, different decisions">
          <div className="row">
            <button disabled={locked} onClick={p.onCompare}>Compare</button>
            <button disabled={locked} onClick={p.onAttribution}>Attribution</button>
          </div>
          {p.busy && <p className="muted small">{p.busy}</p>}
          {p.compare && (
            <div className="compare">
              <RunCol title="No tools" r={p.compare.without} />
              <RunCol title="Your tools" r={p.compare.withTools} />
            </div>
          )}
          {p.attrProgress && !p.attr && (
            <div className="bar progress"><div style={{ width: `${(p.attrProgress.done / p.attrProgress.total) * 100}%` }} /></div>
          )}
          {p.attr && (
            <div className="attr">
              <p className="muted small">Shapley share of days survived, over 16 runs.</p>
              {[...TOOL_KEYS].sort((a, b) => p.attr!.phi[b] - p.attr!.phi[a]).map((k) => (
                <div key={k} className="attr-row">
                  <span className="name">{TOOL_LABELS[k]}</span>
                  <div className="abar"><div className={p.attr!.phi[k] < 0 ? 'neg' : ''} style={{ width: `${(Math.abs(p.attr!.phi[k]) / maxPhi) * 100}%` }} /></div>
                  <span className="v">{signed(p.attr!.phi[k])} days</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Event log">
          {p.events.length === 0 ? <p className="muted">No events yet.</p> : (
            <ol className="log">{p.events.map((e, i) => <li key={i}>{e}</li>)}</ol>
          )}
        </Section>
      </div>
    </aside>
  );
}
