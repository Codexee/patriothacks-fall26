// PROTOTYPE: the playable day loop around the cutaway. Uses only SimApi from ../sim/index.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { sim } from '../sim/index.ts';
import { LEVELS, NO_TOOLS, SECTIONS_PER_LEVEL, type Action, type DayResult, type Frame, type SimState, type ToolKey, type ToolSet } from '../sim/types.ts';
import { World } from '../world/index.tsx';
import { Panel } from './Panel.tsx';
import { MAX_DAYS, attribution, compareRuns, type Attribution, type RunResult } from './compare.ts';
import './styles.css';

const FRAME_MS = 170; // 24 frames ≈ 4 s per day
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const sameTools = (a: ToolSet, b: ToolSet) => (Object.keys(a) as ToolKey[]).every((k) => a[k] === b[k]);
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

export function App() {
  const [scenarioId, setScenarioId] = useState(sim.scenarios[0].id);
  const [seed, setSeed] = useState(1);
  const [pendingTools, setPendingTools] = useState<ToolSet>(NO_TOOLS);
  const [state, setState] = useState<SimState>(() => sim.createState(sim.scenarios[0].id, 1, NO_TOOLS));
  const [frame, setFrame] = useState<Frame>(state.lastFrame);
  const [events, setEvents] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [hover, setHover] = useState<{ level: number; col: number } | null>(null);
  const [compare, setCompare] = useState<{ without: RunResult; withTools: RunResult } | null>(null);
  const [attr, setAttr] = useState<Attribution | null>(null);
  const [attrProgress, setAttrProgress] = useState<{ done: number; total: number } | null>(null);
  const skipRef = useRef(false);

  const reset = useCallback((id: string, s: number, tools: ToolSet) => {
    const fresh = sim.createState(id, s, tools);
    setState(fresh);
    setFrame(fresh.lastFrame);
    setEvents([]);
    setCompare(null);
    setAttr(null);
    setAttrProgress(null);
  }, []);

  const actionsFor = (st: SimState, tools: ToolSet): Action[] =>
    sameTools(st.tools, tools) ? [] : [{ type: 'setTools', tools }];

  const apply = (r: DayResult) => {
    setState(r.state);
    setFrame(r.state.lastFrame);
    setEvents((prev) => [...[...r.events].reverse(), ...prev]);
  };

  /** Runs the remaining days with no animation. */
  const fastForward = async (from: SimState, tools: ToolSet) => {
    setBusy('Skipping to the end…');
    let st = from;
    let acts = actionsFor(st, tools);
    const collected: string[] = [];
    while (!st.end && st.day < MAX_DAYS) {
      const r = sim.stepDay(st, acts);
      acts = [];
      st = r.state;
      collected.push(...r.events);
      if (st.day % 10 === 0) await sleep(0);
    }
    setState(st);
    setFrame(st.lastFrame);
    setEvents((prev) => [...collected.reverse(), ...prev]);
    setBusy(null);
  };

  const nextDay = async () => {
    if (playing || state.end) return;
    const r = sim.stepDay(state, actionsFor(state, pendingTools));
    setPlaying(true);
    skipRef.current = false;
    for (const f of r.frames) {
      if (skipRef.current) break;
      setFrame(f);
      await sleep(FRAME_MS);
    }
    apply(r);
    setPlaying(false);
    if (skipRef.current) {
      skipRef.current = false;
      await fastForward(r.state, pendingTools);
    }
  };

  const skipToEnd = () => {
    if (playing) { skipRef.current = true; return; } // nextDay finishes the day, then fast-forwards
    void fastForward(state, pendingTools);
  };

  const runCompare = async () => {
    setBusy('Running both versions…');
    await sleep(0);
    setCompare(await compareRuns(scenarioId, seed, pendingTools));
    setBusy(null);
  };

  const runAttribution = async () => {
    setBusy('Running all 16 tool combinations…');
    setAttr(null);
    setAttrProgress({ done: 0, total: 16 });
    await sleep(0);
    const a = await attribution(scenarioId, seed, (done, total) => setAttrProgress({ done, total }));
    setAttr(a);
    setBusy(null);
  };

  // Keep the hover card alive after the pointer leaves, so its source buttons stay clickable.
  const onHover = useCallback((t: { level: number; col: number } | null) => { if (t) setHover(t); }, []);
  useEffect(() => { document.title = `Day ${state.day} · Hollow Twin`; }, [state.day]);

  return (
    <div className="app">
      <main className="world-col">
        <World frame={frame} onHover={onHover} selected={hover} />
        {DEBUG && <DebugHover onHover={onHover} />}
      </main>
      <Panel
        state={state} frame={frame} scenarioId={scenarioId} seed={seed} pendingTools={pendingTools}
        playing={playing} busy={busy} events={events} score={sim.score(state)} hover={hover}
        compare={compare} attr={attr} attrProgress={attrProgress}
        onScenario={(id) => { setScenarioId(id); reset(id, seed, pendingTools); }}
        onSeed={(s) => { setSeed(s); reset(scenarioId, s, pendingTools); }}
        onReset={() => reset(scenarioId, seed, pendingTools)}
        onToggleTool={(k) => setPendingTools((t) => ({ ...t, [k]: !t[k] }))}
        onNextDay={nextDay}
        onSkipToEnd={skipToEnd}
        onCompare={runCompare}
        onAttribution={runAttribution}
      />
    </div>
  );
}

/** Temporary debug control (?debug in the URL): fires onHover without the real cutaway. */
function DebugHover({ onHover }: { onHover: (t: { level: number; col: number } | null) => void }) {
  const [level, setLevel] = useState(45);
  const [col, setCol] = useState(0);
  return (
    <div className="debug">
      debug hover: level <input type="number" min={1} max={LEVELS} value={level} onChange={(e) => setLevel(+e.target.value)} />
      col <input type="number" min={0} max={SECTIONS_PER_LEVEL - 1} value={col} onChange={(e) => setCol(+e.target.value)} />
      <button onClick={() => onHover({ level, col })}>hover</button>
    </div>
  );
}
