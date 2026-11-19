// REBUILD: the right panel = the TEST WORLD (Hollow Twin). It is not the product: it runs a simulated Hollow so we
// can show the Residents' System working. Step 1: only blackouts and air exist in the world.
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

function Section({ title, hint, children, extra }: { title: string; hint?: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="p-sec">
      <h2>{title}{extra}</h2>
      {hint && <p className="muted small hint">{hint}</p>}
      {children}
    </section>
  );
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function RunCol({ title, r }: { title: string; r: RunResult }) {
  return (
    <div className="run-col">
      <h3>{title}</h3>
      <div className={`big ${r.end?.kind === 'stable' ? 'good' : 'bad'}`}>{fmt(r.deaths)}</div>
      <div className="muted small">deaths</div>
      <div>{r.end ? (r.end.kind === 'stable' ? `Stable on day ${r.days}` : `Lost on day ${r.days}`) : 'Still running'}</div>
      <div>Bad air: {fmt(r.airDeaths)}</div>
      <div>{r.blackoutHours > 0 ? `Blackouts warned: ${r.warnedPct}%` : 'No blackouts'}</div>
    </div>
  );
}

function describe(a: Action): string {
  if (a.type === 'event' && a.event.type === 'tripPlant') return `Trip Plant ${a.event.plant + 1}`;
  if (a.type === 'report') return `Report from L${a.level} S${a.col + 1}: “${a.text}”`;
  return a.type;
}

export function Panel(p: PanelProps) {
  const [open, setOpen] = useState(true);
  const [plant, setPlant] = useState(0);
  const { state, frame } = p;
  const locked = p.playing || p.busy !== null;
  const t = state.totals;
  const darkNow = frame.sections.filter((s) => !s.lost && s.lifeSupport < 0.5).length; // life support off = blackout

  return (
    <aside className={`panel ${open ? 'open' : 'closed'}`} aria-label="Test world controls">
      <button className="sheet-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        Day {state.day} · {fmt(t.population)} alive {open ? '▾' : '▴'}
      </button>
      <div className="panel-body">
        <header className="p-head">
          <h1>Test world</h1>
          <span className="muted">Hollow Twin</span>
        </header>
        <p className="muted small">A simulated Hollow that proves the Residents' System works. It knows the hidden truth; the system does not. Right now it has one problem: blackouts, and the air that goes bad when the fans stop.</p>

        <Section title="1. Choose a disaster" extra={<SourceInfo source={sim.sourceFor('scenario')} label="scenario" />}>
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
            <p className="muted small">The same seed replays the same disaster, so runs with and without the system are a fair comparison.</p>
          </details>
        </Section>

        <Section title="2. Turn the system on or off" hint="Changes apply from the next day. Press Reset to start over with your choice.">
          <div className="tools one">
            {TOOL_KEYS.map((k) => (
              <label key={k} className={`tool ${p.pendingTools[k] ? 'on' : ''}`} title={TOOL_HINTS[k]}>
                <input type="checkbox" checked={p.pendingTools[k]} disabled={locked || !!state.end} onChange={() => p.onToggleTool(k)} />
                {TOOL_LABELS[k]} <span className="muted small">#{TOOL_PROBLEMS[k]}</span>
              </label>
            ))}
          </div>
          <p className="muted small">{TOOL_HINTS.earlyWarning}</p>
        </Section>

        <Section title="3. Play">
          <div className="row">
            <button className="primary" disabled={locked || !!state.end} onClick={p.onNextDay}>
              {p.playing ? 'Playing…' : 'Next day'}
            </button>
            <button disabled={p.busy !== null || !!state.end} onClick={p.onSkipToEnd}>Skip to the end</button>
          </div>
        </Section>

        {state.end && (
          <div className={`banner ${state.end.kind}`} role="status">
            {state.end.kind === 'lost' ? `Hollow lost on day ${state.end.day}: ${state.end.reason}` : `Stable Hollow on day ${state.end.day}`}
          </div>
        )}

        <Section title="Scoreboard">
          <div className="stats">
            <div><span className="k">Day</span><span className="v">{state.day}{p.playing && ` · ${String(frame.hour).padStart(2, '0')}:00`}</span></div>
            <div><span className="k">Alive</span><span className="v">{fmt(t.population)}</span></div>
            <div><span className="k">Deaths</span><span className="v bad">{fmt(t.deaths)}</span></div>
            <div><span className="k" title="Deaths from bad air while the fans were off">from bad air</span><span className="v bad">{fmt(t.airDeaths)}</span></div>
            <div><span className="k">Plants online</span><span className="v">{frame.plantsOnline}/{frame.plantsTotal}</span></div>
            <div><span className="k" title="Sections whose life support (air, fans) has less than half its power right now. Saving non-essential power does not count.">Dark sections</span><span className={`v ${darkNow ? 'bad' : ''}`}>{darkNow}</span></div>
          </div>
          <div className="trust">
            <span className="k" title="Share of all blackout hours (per person) that residents had been warned about ahead of time">Blackouts warned ahead</span>
            <div className="bar good"><div style={{ width: `${t.blackoutPersonHours > 0 ? pct(t.warnedPersonHours, t.blackoutPersonHours) : 0}%` }} /></div>
            <span className="v">{t.blackoutPersonHours > 0 ? `${pct(t.warnedPersonHours, t.blackoutPersonHours)}%` : 'no blackouts yet'}</span>
          </div>
        </Section>

        <Section title="Same storm: with and without the system">
          <button disabled={locked} onClick={p.onCompare}>Compare</button>
          {p.busy && <p className="muted small">{p.busy}</p>}
          {p.compare && (
            <div className="compare">
              <RunCol title="Without" r={p.compare.without} />
              <RunCol title="With the system" r={p.compare.withTools} />
            </div>
          )}
        </Section>

        <Section title="Break something" hint="Change the world. The system is not told; it has to notice from its data.">
          <div className="row">
            <button disabled={locked || !!state.end} onClick={() => p.onEvent({ type: 'tripPlant', plant })}>Trip a plant</button>
            <select value={plant} onChange={(e) => setPlant(+e.target.value)} aria-label="Plant">
              {[1, 2, 3, 4, 5, 6].map((k) => <option key={k} value={k - 1}>Plant {k}</option>)}
            </select>
          </div>
          {p.queued.length > 0 && <ul className="queued">{p.queued.map((a, i) => <li key={i}>Next day: {describe(a)}</li>)}</ul>}
        </Section>

        <Section title="Hidden truth" hint="Only the test world knows this. The Residents' System never reads it." extra={<SourceInfo source={sim.sourceFor('directorate')} label="Directorate" />}>
          <div className="two-col">
            <div>
              <h3>Directorate says</h3>
              <ul>{state.bulletin.directorate.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </div>
            <div>
              <h3>Really</h3>
              <ul>{state.bulletin.measured.map((l, i) => <li key={i} className="measured">{l}</li>)}</ul>
            </div>
          </div>
        </Section>

        <Section title="Section (hover the cutaway)">
          <HoverCard frame={frame} target={p.hover} />
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
