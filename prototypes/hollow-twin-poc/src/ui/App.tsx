// PROTOTYPE: the playable day loop. Each day the residents' system (src/product/) reads yesterday's observations
// and sends outputs; the sim (the test world) applies them. A person can inject world events and type reports.
import { useCallback, useEffect, useRef, useState } from 'react';
import { sim } from '../sim/index.ts';
import { LEVELS, NO_TOOLS, SECTIONS_PER_LEVEL, type Action, type Frame, type ToolKey, type ToolSet, type WorldEvent } from '../sim/types.ts';
import { BUILT } from '../product/names.ts';
import { createRun, stepRun, type Run } from '../product/run.ts';
import { World } from '../world/index.tsx';
import { FlatWorld, blackoutLine } from '../world/FlatWorld.tsx';
import { Panel } from './Panel.tsx';
import { ProductView } from './ProductView.tsx';
import { CompareCard, DemoBar, EndBanner } from './DemoBar.tsx';
import { ModulesPanel } from './ModulesPanel.tsx';
import { MAX_DAYS, attribution, compareRuns, type Attribution, type RunResult } from './compare.ts';
import './styles.css';

/** Baseline is the default: the calm run before any disaster. Pick a disaster in the Test World panel (T). */
const DEFAULT_SCENARIO = sim.scenarios.find((x) => x.id === 'baseline')?.id ?? sim.scenarios[0].id;
/** Every built module starts switched on (switch them off in the Modules panel, or press S). */
const ALL_ON: ToolSet = { ...NO_TOOLS, ...Object.fromEntries(BUILT.map((k) => [k, true])) };
const FRAME_MS = 170; // 24 frames ≈ 4 s per day
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
/** ?pixel in the URL shows the old pixel-art cutaway instead of the flat one. */
const PIXEL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('pixel');

export function App() {
  const [scenarioId, setScenarioId] = useState(DEFAULT_SCENARIO);
  const [seed, setSeed] = useState(1);
  const [pendingTools, setPendingTools] = useState<ToolSet>(ALL_ON);
  const [run, setRun] = useState<Run>(() => createRun(DEFAULT_SCENARIO, 1, ALL_ON));
  // While a day plays, the phone and the Modules panel already show that day's alerts: they arrive in the morning,
  // before the day's blackouts, not after it.
  const [morning, setMorning] = useState<Run | null>(null);
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
  const [panelOpen, setPanelOpen] = useState(false); // the Test World panel starts minimized (demo-ready)
  const [compareOpen, setCompareOpen] = useState(false);
  const [modsOpen, setModsOpen] = useState(false); // the Modules panel starts minimized (M opens it)
  const state = run.sim;

  const reset = useCallback((id: string, s: number, tools: ToolSet) => {
    const fresh = createRun(id, s, tools);
    setRun(fresh);
    setMorning(null);
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
    setMorning(d.run);
    skipRef.current = false;
    for (const f of d.frames) {
      if (skipRef.current) break;
      setFrame(f);
      await sleep(FRAME_MS);
    }
    setRun(d.run);
    setMorning(null);
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

  /** After a stable end: clear the end and keep simulating (stable no longer ends the run; lost and the cap still do). */
  const keepPlaying = () => {
    if (state.end?.kind !== 'stable') return;
    setRun((r) => ({ ...r, sim: { ...r.sim, end: null, keepGoing: true } }));
  };
  /** Solution modules: switch one, or (S) all of them. Changes apply from the next day; Reset starts over with them. */
  const toggleModule = (k: ToolKey) => setPendingTools((t) => ({ ...t, [k]: !t[k] }));
  const toggleSystem = () => setPendingTools((t) => {
    const anyOn = BUILT.some((k) => t[k]);
    const n = { ...t };
    for (const k of BUILT) n[k] = !anyOn;
    return n;
  });
  const openCompare = () => { setCompareOpen(true); if (!compare) void runCompare(); };

  // Keyboard shortcuts for presenting: Space next day, S system, R reset, T panel. Ignored while typing.
  const keys = useRef({ nextDay, toggleSystem, reset: () => reset(scenarioId, seed, pendingTools), panel: () => setPanelOpen((v) => !v), mods: () => setModsOpen((v) => !v) });
  keys.current = { nextDay, toggleSystem, reset: () => reset(scenarioId, seed, pendingTools), panel: () => setPanelOpen((v) => !v), mods: () => setModsOpen((v) => !v) };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (e.ctrlKey || e.metaKey || e.altKey || el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (el?.closest('button') && e.key === ' ') return; // Space on a focused button presses that button
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); void keys.current.nextDay(); }
      else if (k === 's') keys.current.toggleSystem();
      else if (k === 'r') keys.current.reset();
      else if (k === 't') keys.current.panel();
      else if (k === 'm') keys.current.mods();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const queueEvent = (event: WorldEvent) => setQueued((q) => [...q, { type: 'event', event }]);
  const queueReport = (level: number, col: number, text: string) => setQueued((q) => [...q, { type: 'report', level, col, text }]);

  // Hovering the cutaway shows that section's values; it also moves the phone, unless the home is locked.
  const [homeLocked, setHomeLocked] = useState(true);
  const lockRef = useRef(homeLocked);
  lockRef.current = homeLocked;
  const onHover = useCallback((t: { level: number; col: number } | null) => {
    if (t) { setHover(t); if (!lockRef.current) setPhoneSection(t); }
  }, []);
  useEffect(() => { document.title = `Day ${state.day} · HollowGuard (rebuild)`; }, [state.day]);

  return (
    <div className={`app ${panelOpen ? 'panel-open' : 'panel-min'} ${modsOpen ? 'mods-open' : 'mods-min'}`}>
      <main className="world-col">
        <WorldHeader frame={frame} day={state.day} playing={playing} scenario={state.scenario.name} />
        <EndBanner state={state} onKeepPlaying={keepPlaying} onReset={() => reset(scenarioId, seed, pendingTools)} />
        {compareOpen && <CompareCard result={compare} busy={busy} onClose={() => setCompareOpen(false)} />}
        {!panelOpen && (
          <DemoBar
            state={state} hour={frame.hour} playing={playing} busy={busy}
            onNextDay={() => void nextDay()} onSkipToEnd={skipToEnd}
            onReset={() => reset(scenarioId, seed, pendingTools)} onCompare={openCompare} onOpenPanel={() => setPanelOpen(true)}
          />
        )}
        {PIXEL
          ? <World frame={frame} onHover={onHover} selected={hover ?? phoneSection} />
          : <FlatWorld frame={frame} onHover={onHover} selected={phoneSection} />}
        {DEBUG && <DebugHover onHover={onHover} />}
      </main>
      <ModulesPanel
        run={morning ?? run} running={state.tools} pending={pendingTools} locked={playing || busy !== null}
        onToggleModule={toggleModule} onReset={() => reset(scenarioId, seed, pendingTools)}
        open={modsOpen} onToggle={() => setModsOpen((v) => !v)}
      />
      <ProductView
        darkNow={frame.sections.map((s) => !s.lost && s.lifeSupport < 0.5)}
        run={morning ?? run} modules={state.tools} hour={frame.hour} playing={playing} section={phoneSection} onPickSection={setPhoneSection}
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
        onEvent={queueEvent}
        onNextDay={nextDay}
        onSkipToEnd={skipToEnd}
        onCompare={runCompare}
        onAttribution={runAttribution}
        onMinimize={() => setPanelOpen(false)}
        onKeepPlaying={keepPlaying}
      />
    </div>
  );
}

/** Above the cutaway: where and when we are, what is dark right now, and what the colors mean. */
function WorldHeader({ frame, day, playing, scenario }: { frame: Frame; day: number; playing: boolean; scenario: string }) {
  const { line, darkLevels } = blackoutLine(frame);
  const dark = frame.sections.filter((s) => !s.lost && s.lifeSupport < 0.5).length;
  const lit = frame.sections.filter((s) => !s.lost).length - dark;
  const status = darkLevels === 0
    ? 'Every level has air and fans'
    : darkLevels >= 0.9 * LEVELS ? 'Almost the whole Hollow is dark'
      : `Levels ${line + 1}–${LEVELS} are in a blackout`;
  return (
    <header className="world-head">
      <div className="wh-top">
        <h1>The Hollow</h1>
        <span className="wh-clock">Day {day}{playing ? `, ${String(frame.hour).padStart(2, '0')}:00` : ''}</span>
        <span className="wh-scn">{scenario}</span>
      </div>
      <p className={`wh-status ${darkLevels ? 'bad' : 'good'}`}>
        {status}. <span className="wh-counts">{lit} of 400 sections with air and fans, {dark} dark. Plants online: {frame.plantsOnline} of {frame.plantsTotal}.</span>
      </p>
      <ul className="legend" aria-label="Legend">
        <li><i className="sw lit" />Power on</li>
        <li><i className="sw dim" />Saving power</li>
        <li><i className="sw dark" />Blackout: no air or fans</li>
        <li><i className="sw badair" />Blackout, air unsafe</li>
        <li><i className="sw empty" />Everyone died</li>
        <li><i className="sw plant" />Power plant</li>
        <li><i className="sw home" />Your home</li>
      </ul>
    </header>
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
