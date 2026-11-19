// PROTOTYPE: the playable day loop. Each day the residents' system (src/product/) reads yesterday's observations
// and sends outputs; the sim (the test world) applies them. A person can inject world events and type reports.
import { useCallback, useEffect, useRef, useState } from 'react';
import { sim } from '../sim/index.ts';
import { LEVELS, NO_TOOLS, SECTIONS_PER_LEVEL, type Action, type Frame, type ToolSet, type WorldEvent } from '../sim/types.ts';
import { createRun, stepRun, type Run } from '../product/run.ts';
import { World } from '../world/index.tsx';
import { Panel } from './Panel.tsx';
import { ProductView } from './ProductView.tsx';
import { MAX_DAYS, attribution, compareRuns, type Attribution, type RunResult } from './compare.ts';
import './styles.css';

const FRAME_MS = 170; // 24 frames ≈ 4 s per day
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

export function App() {
  const [scenarioId, setScenarioId] = useState(sim.scenarios[0].id);
  const [seed, setSeed] = useState(1);
  const [pendingTools, setPendingTools] = useState<ToolSet>(NO_TOOLS);
  const [run, setRun] = useState<Run>(() => createRun(sim.scenarios[0].id, 1, NO_TOOLS));
  const [frame, setFrame] = useState<Frame>(run.sim.lastFrame);
  const [events, setEvents] = useState<string[]>([]);
  const [queued, setQueued] = useState<Action[]>([]); // a person's events and reports for the next day
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [hover, setHover] = useState<{ level: number; col: number } | null>(null);
  const [phoneSection, setPhoneSection] = useState({ level: 39, col: 2 });
  const [compare, setCompare] = useState<{ without: RunResult; withTools: RunResult } | null>(null);
  const [attr, setAttr] = useState<Attribution | null>(null);
  const [attrProgress, setAttrProgress] = useState<{ done: number; total: number } | null>(null);
  const skipRef = useRef(false);
  const state = run.sim;

  const reset = useCallback((id: string, s: number, tools: ToolSet) => {
    const fresh = createRun(id, s, tools);
    setRun(fresh);
    setFrame(fresh.sim.lastFrame);
    setEvents([]);
    setQueued([]);
    setCompare(null);
    setAttr(null);
    setAttrProgress(null);
  }, []);

  /** Runs the remaining days with no animation. */
  const fastForward = async (from: Run, tools: ToolSet, extra: Action[]) => {
    setBusy('Skipping to the end…');
    let r = from;
    let acts = extra;
    const collected: string[] = [];
    while (!r.sim.end && r.sim.day < MAX_DAYS) {
      const d = stepRun(r, tools, acts);
      acts = [];
      r = d.run;
      collected.push(...d.events);
      if (r.sim.day % 5 === 0) await sleep(0);
    }
    setRun(r);
    setFrame(r.sim.lastFrame);
    setQueued([]);
    setEvents((prev) => [...collected.reverse(), ...prev]);
    setBusy(null);
  };

  const nextDay = async () => {
    if (playing || state.end) return;
    const d = stepRun(run, pendingTools, queued);
    setQueued([]);
    setPlaying(true);
    skipRef.current = false;
    for (const f of d.frames) {
      if (skipRef.current) break;
      setFrame(f);
      await sleep(FRAME_MS);
    }
    setRun(d.run);
    setFrame(d.run.sim.lastFrame);
    setEvents((prev) => [...[...d.events].reverse(), ...prev]);
    setPlaying(false);
    if (skipRef.current) {
      skipRef.current = false;
      await fastForward(d.run, pendingTools, []);
    }
  };

  const skipToEnd = () => {
    if (playing) { skipRef.current = true; return; } // nextDay finishes the day, then fast-forwards
    void fastForward(run, pendingTools, queued);
  };

  const runCompare = async () => {
    setBusy('Running both versions…');
    await sleep(0);
    setCompare(await compareRuns(scenarioId, seed, pendingTools));
    setBusy(null);
  };

  const runAttribution = async () => {
    setBusy('Estimating each feature\'s share…');
    setAttr(null);
    setAttrProgress({ done: 0, total: 1 });
    await sleep(0);
    const a = await attribution(scenarioId, seed, (done, total) => setAttrProgress({ done, total }));
    setAttr(a);
    setBusy(null);
  };

  const queueEvent = (event: WorldEvent) => setQueued((q) => [...q, { type: 'event', event }]);
  const queueReport = (level: number, col: number, text: string) => setQueued((q) => [...q, { type: 'report', level, col, text }]);

  // Hovering the cutaway shows that section's values; it also moves the phone, unless the home is locked.
  const [homeLocked, setHomeLocked] = useState(true);
  const lockRef = useRef(homeLocked);
  lockRef.current = homeLocked;
  const onHover = useCallback((t: { level: number; col: number } | null) => {
    if (t) { setHover(t); if (!lockRef.current) setPhoneSection(t); }
  }, []);
  useEffect(() => { document.title = `Day ${state.day} · Residents' System (rebuild)`; }, [state.day]);

  return (
    <div className="app">
      <main className="world-col">
        <World frame={frame} onHover={onHover} selected={hover ?? phoneSection} />
        {DEBUG && <DebugHover onHover={onHover} />}
      </main>
      <ProductView
        run={run} modules={state.tools} section={phoneSection} onPickSection={setPhoneSection}
        homeLocked={homeLocked} onToggleLock={() => setHomeLocked((v) => !v)}
        onReport={queueReport} queuedReports={queued.filter((a) => a.type === 'report').length}
        locked={playing || busy !== null || !!state.end}
      />
      <Panel
        state={state} frame={frame} scenarioId={scenarioId} seed={seed} pendingTools={pendingTools}
        playing={playing} busy={busy} events={events} score={sim.score(state)} hover={hover}
        compare={compare} attr={attr} attrProgress={attrProgress} queued={queued}
        onScenario={(id) => { setScenarioId(id); reset(id, seed, pendingTools); }}
        onSeed={(s) => { setSeed(s); reset(scenarioId, s, pendingTools); }}
        onReset={() => reset(scenarioId, seed, pendingTools)}
        onToggleTool={(k) => setPendingTools((t) => ({ ...t, [k]: !t[k] }))}
        onEvent={queueEvent}
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
