// PROTOTYPE: the fixed right panel. Presentational; App owns the state and the sim calls.
import { useState, type ReactNode } from 'react';
import { sim } from '../sim/index.ts';
import type { Action, Frame, Score, SimState, ToolKey, ToolSet, WorldEvent } from '../sim/types.ts';
import { HoverCard, SourceInfo } from './HoverCard.tsx';
import { TOOL_HINTS, TOOL_KEYS, TOOL_LABELS, TOOL_PROBLEMS, type Attribution, type RunResult } from './compare.ts';

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
  queued: Action[];
  onEvent: (e: WorldEvent) => void;
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

const fmt = (n: number) => Math.round(n).toLocaleString();
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.round(Math.abs(n)).toLocaleString()}`;

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

function describe(a: Action): string {
  if (a.type === 'event') {
    const e = a.event;
    if (e.type === 'breakRecycler') return `Break the recycler near L${e.level}`;
    if (e.type === 'tripPlant') return `Trip Plant ${e.plant + 1}`;
    if (e.type === 'outbreak') return `Outbreak on L${e.level}`;
    if (e.type === 'cutNetwork') return `Directorate cuts the network for ${e.hours} h`;
    return `Directorate diverts the farms of L${e.from}–${e.to}`;
  }
  if (a.type === 'report') return `Report from L${a.level} S${a.col + 1}: “${a.text}”`;
  return a.type;
}

function WorldEvents({ onEvent, disabled }: { onEvent: (e: WorldEvent) => void; disabled: boolean }) {
  const [recycler, setRecycler] = useState(18);
  const [plant, setPlant] = useState(0);
  const [outbreak, setOutbreak] = useState(30);
  const [divert, setDivert] = useState(30);
  return (
    <div className="events">
      <div className="row">
        <button disabled={disabled} onClick={() => onEvent({ type: 'breakRecycler', level: recycler })}>Break recycler</button>
        <select value={recycler} onChange={(e) => setRecycler(+e.target.value)} aria-label="Recycler level">
          {[3, 8, 13, 18, 23, 28, 33, 38, 43, 48].map((l) => <option key={l} value={l}>L{l}</option>)}
        </select>
      </div>
      <div className="row">
        <button disabled={disabled} onClick={() => onEvent({ type: 'tripPlant', plant })}>Trip plant</button>
        <select value={plant} onChange={(e) => setPlant(+e.target.value)} aria-label="Plant">
          {[1, 2, 3, 4, 5, 6].map((k) => <option key={k} value={k - 1}>Plant {k}</option>)}
        </select>
      </div>
      <div className="row">
        <button disabled={disabled} onClick={() => onEvent({ type: 'outbreak', level: outbreak })}>Start outbreak</button>
        <input type="number" min={1} max={50} value={outbreak} onChange={(e) => setOutbreak(+e.target.value || 1)} aria-label="Outbreak level" />
      </div>
      <div className="row">
        <button disabled={disabled} onClick={() => onEvent({ type: 'cutNetwork', hours: 48 })}>Cut network 48 h</button>
      </div>
      <div className="row">
        <button disabled={disabled} onClick={() => onEvent({ type: 'divertFarms', from: Math.max(1, divert - 4), to: Math.min(50, divert + 4) })}>Divert farms</button>
        <span className="muted">around L</span>
        <input type="number" min={1} max={50} value={divert} onChange={(e) => setDivert(+e.target.value || 1)} aria-label="Farm diversion level" />
      </div>
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
            <button disabled={locked} onClick={p.onReset}>Reset</button>
          </div>
          <p className="muted small">{state.scenario.summary}</p>
          <details className="advanced">
            <summary>Advanced / replay</summary>
            <label className="seed">Seed
              <input type="number" value={p.seed} disabled={locked} onChange={(e) => p.onSeed(Number(e.target.value) || 0)} />
            </label>
            <p className="muted small">The same seed replays the same disaster, so runs with and without modules are a fair comparison.</p>
          </details>
        </Section>

        <Section title="World events">
          <p className="muted small">Change the world. The residents' system is not told; it must notice from its data.</p>
          <WorldEvents onEvent={p.onEvent} disabled={locked || !!state.end} />
          {p.queued.length > 0 && (
            <ul className="queued">{p.queued.map((a, i) => <li key={i}>Next day: {describe(a)}</li>)}</ul>
          )}
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
            <div><span className="k">Network</span><span className={`v ${t.networkUp ? 'good' : 'bad'}`}>{t.networkUp ? 'up' : 'CUT'}</span></div>
            <div><span className="k" title="Families with relatives on other levels who do not know if they are okay">No news</span><span className="v">{fmt(t.familiesNoNews)}</span></div>
            <div><span className="k" title="Residents who went up the closed way, believing the surface has healed">Climbers lost</span><span className="v">{fmt(t.climbersLost)}</span></div>
            <div><span className="k">Hunger deaths</span><span className="v">{fmt(t.hungerDeaths)}</span></div>
          </div>
          <div className="trust">
            <span className="k" title="Residents' trust in the Directorate. Each exposed lie lowers it.">Trust in Directorate</span>
            <div className="bar"><div style={{ width: `${Math.round(state.trust * 100)}%` }} /></div>
            <span className="v">{Math.round(state.trust * 100)}%</span>
          </div>
          <div className="trust">
            <span className="k" title="Residents' trust in their own system. It sets how many follow its alerts. Right findings raise it; wrong ones lower it.">Trust in system</span>
            <div className="bar good"><div style={{ width: `${Math.round(state.systemTrust * 100)}%` }} /></div>
            <span className="v">{Math.round(state.systemTrust * 100)}%</span>
          </div>
        </Section>

        <Section title="Bulletin" extra={<SourceInfo source={sim.sourceFor('directorate')} label="Directorate" />}>
          <div className="two-col">
            <div>
              <h3>Directorate says</h3>
              <ul>{state.bulletin.directorate.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </div>
            <div>
              <h3 title="Only the sim knows this. The residents' system never reads it.">Hidden truth (sim only)</h3>
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

        <Section title="Residents' system: modules">
          <div className="tools">
            {TOOL_KEYS.map((k) => (
              <label key={k} className={`tool ${p.pendingTools[k] ? 'on' : ''}`} title={TOOL_HINTS[k]}>
                <input type="checkbox" checked={p.pendingTools[k]} disabled={locked || !!state.end} onChange={() => p.onToggleTool(k)} />
                {TOOL_LABELS[k]} <span className="muted small">#{TOOL_PROBLEMS[k]}</span>
              </label>
            ))}
          </div>
          <div className="row">
            <button disabled={locked || !!state.end} onClick={() => TOOL_KEYS.forEach((k) => { if (!p.pendingTools[k]) p.onToggleTool(k); })}>All on</button>
            <button disabled={locked || !!state.end} onClick={() => TOOL_KEYS.forEach((k) => { if (p.pendingTools[k]) p.onToggleTool(k); })}>All off</button>
            <span className="muted small">#n = the track's problem number</span>
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
            <div><span className="k">Lives saved</span><span className="v">{fmt(p.score.livesSaved)}</span></div>
            <div><span className="k">Days</span><span className="v">{p.score.days}</span></div>
            <div><span className="k">Alive</span><span className="v">{p.score.alivePct.toFixed(1)}%</span></div>
            <div><span className="k">Fairness</span><span className="v">{p.score.fairness.toFixed(0)}</span></div>
          </div>
          <p className="muted small">Baseline: {fmt(Math.round(p.score.baselineDeaths))} deaths without modules, same scenario and seed. {state.end ? 'Final comparison.' : 'Final comparison at run end.'}</p>
        </Section>

        <Section title="Same plants, different decisions">
          <div className="row">
            <button disabled={locked} onClick={p.onCompare}>Compare</button>
            <button disabled={locked} onClick={p.onAttribution}>Attribution</button>
          </div>
          {p.busy && <p className="muted small">{p.busy}</p>}
          {p.compare && (
            <div className="compare">
              <RunCol title="No modules" r={p.compare.without} />
              <RunCol title="Your modules" r={p.compare.withTools} />
            </div>
          )}
          {p.attrProgress && !p.attr && (
            <div className="bar progress"><div style={{ width: `${(p.attrProgress.done / p.attrProgress.total) * 100}%` }} /></div>
          )}
          {p.attr && (
            <div className="attr">
              <p className="muted small">Shapley share of lives saved, estimated from {p.attr.orderings} random orderings ({p.attr.runs.size} runs).</p>
              {[...TOOL_KEYS].sort((a, b) => p.attr!.phi[b] - p.attr!.phi[a]).map((k) => (
                <div key={k} className="attr-row">
                  <span className="name">{TOOL_LABELS[k]}</span>
                  <div className="abar"><div className={p.attr!.phi[k] < 0 ? 'neg' : ''} style={{ width: `${(Math.abs(p.attr!.phi[k]) / maxPhi) * 100}%` }} /></div>
                  <span className="v">{signed(p.attr!.phi[k])} lives</span>
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
