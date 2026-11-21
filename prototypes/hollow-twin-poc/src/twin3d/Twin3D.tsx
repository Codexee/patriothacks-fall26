// #/demo — the modeling workstation: the 3D twin of the same disaster on the same seed, run without and with
// Blackout Warning, with docked panels around it. Every number, chart and log line comes from the sim run, the
// module's own output, or the real data files. The day frames are computed once per disaster and seed in a Web
// Worker and played back here (React state changes once per day, never per animation frame).
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { SiteData } from '../site/data.ts';
import type { ScenariosFile } from '../site/contracts.ts';
import { displayName } from '../site/parts.tsx';
import { href } from '../site/router.ts';
import { sim } from '../sim/index.ts';
import { SECTION_COUNT } from '../sim/types.ts';
import { loadResults, useTwinDetail } from './data.ts';
import { typicalSeed, type TwinData } from './compute.ts';
import { PhoneDock } from './ws/PhoneDock.tsx';
import { TwinScene, type Clock, type Pick, type SideKey } from './Scene.tsx';
import { COLORS } from './palette.ts';
import { Inspector } from './ws/Inspector.tsx';
import { Telemetry } from './ws/Telemetry.tsx';
import { BottomDock } from './ws/BottomDock.tsx';
import { SectionCard } from './ws/SectionCard.tsx';
import { fmtNum } from './ws/charts.tsx';
import { SET_TEXT, SIDE_COLOR, SIDE_NAME, det, firstDark, pad2, plantLosses, seedSet, tripsPerDay } from './ws/model.ts';
import './twin3d.css';
import './workstation.css';

const DEFAULT = 'twoplants';
const SPEEDS = [0.5, 1, 2, 4];
type View = 'both' | SideKey;

function useReducedMotion(): boolean {
  const [r, setR] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

/** The snapshot hour of a day, or "no dark hour" when no section was dark that day. */
const worstText = (data: TwinData, side: SideKey, day: number) => (data[side].dark[day] > 0 ? `${pad2(det(data, side).worstHour[day])}:00` : 'none dark');

const finePointer = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches;

export default function Twin3D({ data: site, scenario }: { data: SiteData | null; scenario: string | null }) {
  const order = useMemo(() => {
    const ids = site?.scenarios.data.scenarios.map((s) => s.id) ?? [];
    const known = new Set(sim.scenarios.map((s) => s.id));
    const list = ids.filter((id) => known.has(id));
    for (const s of sim.scenarios) if (!list.includes(s.id)) list.push(s.id);
    return list;
  }, [site]);
  const nameOf = (id: string) => displayName(sim.scenarios.find((s) => s.id === id) ?? { id, name: id });

  const initial = scenario && sim.scenarios.some((s) => s.id === scenario) ? scenario : DEFAULT;
  const [id, setId] = useState(initial);
  useEffect(() => { if (scenario && sim.scenarios.some((s) => s.id === scenario)) setId(scenario); }, [scenario]);

  // Results file: typical seed per disaster, per-seed totals for a cross-check, and its generated time.
  const [results, setResults] = useState<ScenariosFile | null>(null);
  useEffect(() => { loadResults().then(setResults); }, []);
  const resultRow = results?.scenarios.find((s) => s.id === id);
  const typical = results ? typicalSeed(resultRow?.perSeed, resultRow?.with.deaths.mean) : null;
  const [seedChoice, setSeedChoice] = useState<{ id: string; seed: number } | null>(null);
  const seed = seedChoice?.id === id ? seedChoice.seed : typical;

  const { data, error } = useTwinDetail(id, seed);
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [view, setView] = useState<View>('both');
  const [day, setDay] = useState(0);
  const [selected, setSelected] = useState<Pick | null>(null);
  const [leftTab, setLeftTab] = useState<'phone' | 'model'>('phone');
  const clock = useRef<Clock>({ day: 0, pulseT: 0, pulse: !reduced, hold: 0.85 });
  const invalidateRef = useRef<(() => void) | null>(null);
  clock.current.pulse = !reduced;

  // Full viewport under the site Nav: widen the site's main column and size the workstation to the window.
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    document.documentElement.classList.add('ws-mode');
    const set = () => { if (root.current) root.current.style.setProperty('--ws-top', `${root.current.getBoundingClientRect().top + window.scrollY}px`); };
    set();
    window.addEventListener('resize', set);
    return () => { document.documentElement.classList.remove('ws-mode'); window.removeEventListener('resize', set); };
  }, []);

  // New data (disaster or seed): back to day 0 and play (not with reduced motion).
  useEffect(() => {
    if (!data) return;
    clock.current.day = 0;
    setDay(0);
    setPlaying(!reduced);
    invalidateRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const D = data?.days ?? 30;

  useEffect(() => {
    const air = !!data && !reduced;
    if (!playing && !air) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const c = clock.current;
      c.pulseT += dt;
      if (playing) {
        c.day = Math.min(D, c.day + dt * speed);
        const whole = Math.floor(c.day);
        setDay((d) => (d === whole ? d : whole));
        if (c.day >= D) setPlaying(false);
      }
      invalidateRef.current?.();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, D, data, reduced]);

  const seek = useCallback((d: number) => {
    clock.current.day = d;
    setDay(Math.floor(d));
    invalidateRef.current?.();
  }, []);
  const togglePlay = () => { if (!playing && clock.current.day >= D) seek(0); setPlaying((p) => !p); };
  const stepDay = () => { setPlaying(false); seek(Math.min(D, Math.floor(clock.current.day) + 1)); };
  const shown = Math.min(D, day);
  const onSelect = useCallback((p: Pick) => setSelected(p), []);

  const scen = sim.scenarios.find((s) => s.id === id) ?? sim.scenarios[0];
  const set = seed !== null ? seedSet(seed) : null;
  const perSeed = resultRow?.perSeed.find((p) => p.seed === seed);
  const seedNote = data && seed !== null && (
    <>Seed {seed} ({SET_TEXT[seedSet(seed)]}{seed === typical ? ', the typical held-out seed: its deaths with HollowGuard are closest to the mean of seeds 11–20' : ''}).
      {' '}This run, day {data.days}: without {fmtNum(data.without.deaths[data.days])}, with {fmtNum(data.with.deaths[data.days])} deaths.
      {perSeed ? <> The results file (120 days) has without {fmtNum(perSeed.withoutDeaths)}, with {fmtNum(perSeed.withDeaths)}.</> : null}</>
  );

  return (
    <section className="ws" ref={root} aria-labelledby="ws-h">
      <h1 id="ws-h" className="sr-only" tabIndex={-1}>Watch it run: modeling workstation</h1>
      <Toolbar
        order={order} nameOf={nameOf} id={id} onId={(v) => { setPlaying(false); setSelected(null); setId(v); }}
        seed={seed} typical={typical} onSeed={(s) => { setPlaying(false); setSeedChoice({ id, seed: s }); }}
        playing={playing} ready={!!data} atEnd={clock.current.day >= D} onPlay={togglePlay} onStep={stepDay}
        onRestart={() => { seek(0); setPlaying(!reduced); }} speed={speed} onSpeed={setSpeed} view={view} onView={setView}
        day={shown} D={D} onSeek={(d) => { setPlaying(false); seek(d); }} data={data}
      />
      <div className="ws-main">
        <aside className="ws-dock ws-left" aria-label={leftTab === 'phone' ? "Resident's phone" : 'Model inspector'}>
          <div className="ws-dock-h ws-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={leftTab === 'phone'} onClick={() => setLeftTab('phone')}>Resident’s phone</button>
            <button type="button" role="tab" aria-selected={leftTab === 'model'} onClick={() => setLeftTab('model')}>Model inspector</button>
          </div>
          {leftTab === 'phone'
            ? <PhoneDock id={id} seed={seed} day={shown} pick={selected ? selected.index : null} />
            : <Inspector scenario={scen} seedNote={seedNote} />}
        </aside>
        <div className="ws-view">
          {data ? (
            <Viewport data={data} clock={clock} invalidateRef={invalidateRef} view={view} day={shown} seed={seed!} selected={selected}
              onSelect={onSelect} onClose={() => setSelected(null)} />
          ) : (
            <p className="ws-loading" role="status">{error ? `The simulation did not run: ${error}` : `Running ${nameOf(id)}${seed !== null ? `, seed ${seed}` : ''}: ${D} days, twice (without and with HollowGuard)…`}</p>
          )}
        </div>
        <aside className="ws-dock ws-right" aria-label="Telemetry">
          <h2 className="ws-dock-h">Telemetry <span className="ws-dim">· to day {shown}</span></h2>
          {data && <Telemetry data={data} day={shown} />}
        </aside>
      </div>
      <div className="ws-bottomwrap">{data && <BottomDock data={data} day={shown} onSelect={onSelect} />}</div>
      <footer className="ws-status" aria-label="Status">
        <span>scenario <b>{id}</b></span>
        <span>seed <b>{seed ?? '…'}</b>{set ? ` · ${SET_TEXT[set]}` : ''}</span>
        <span>day <b>{shown}</b>/{D}{data ? ` · worst hour ${worstText(data, 'without', shown)} / ${worstText(data, 'with', shown)}` : ''}</span>
        <span>frames <b>{data ? fmtNum(det(data, 'without').frames + det(data, 'with').frames) : '…'}</b></span>
        <span>compute <b>{data ? `${fmtNum(data.ms)} ms` : '…'}</b> (worker)</span>
        <span>scenarios.json {results ? new Date(results.generated).toISOString().slice(0, 16).replace('T', ' ') : '–'} UTC</span>
        <span>build {__BUILD_COMMIT__}</span>
        <span className="ws-status-claim">Same disaster, same seed. The only difference is HollowGuard.</span>
        <a className="ws-status-link" href={href.demoClassic(id)}>2D cutaway</a>
      </footer>
    </section>
  );
}

function Toolbar(p: {
  order: string[]; nameOf: (id: string) => string; id: string; onId: (id: string) => void;
  seed: number | null; typical: number | null; onSeed: (s: number) => void;
  playing: boolean; ready: boolean; atEnd: boolean; onPlay: () => void; onStep: () => void; onRestart: () => void;
  speed: number; onSpeed: (s: number) => void; view: View; onView: (v: View) => void;
  day: number; D: number; onSeek: (d: number) => void; data: TwinData | null;
}) {
  const seeds = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => from + k);
  return (
    <div className="ws-toolbar" role="toolbar" aria-label="Run controls">
      <label className="ws-f"><span>Disaster</span>
        <select value={p.id} onChange={(e) => p.onId(e.target.value)}>{p.order.map((s) => <option key={s} value={s}>{p.nameOf(s)}</option>)}</select>
      </label>
      <label className="ws-f"><span>Seed</span>
        <select value={p.seed ?? ''} onChange={(e) => p.onSeed(Number(e.target.value))} disabled={p.seed === null}>
          <optgroup label="Held-out test seeds">{seeds(11, 20).map((s) => <option key={s} value={s}>{s}{s === p.typical ? ' (typical)' : ''}</option>)}</optgroup>
          <optgroup label="Tuning seeds">{seeds(1, 5).map((s) => <option key={s} value={s}>{s} · tuning seed</option>)}</optgroup>
          <optgroup label="Check seeds">{seeds(6, 10).map((s) => <option key={s} value={s}>{s} · check seed</option>)}</optgroup>
        </select>
      </label>
      <div className="ws-btns" role="group" aria-label="Playback">
        <button type="button" className="ws-btn primary" onClick={p.onPlay} disabled={!p.ready} aria-pressed={p.playing}>{p.playing ? 'Pause' : p.atEnd ? 'Run again' : 'Run'}</button>
        <button type="button" className="ws-btn" onClick={p.onStep} disabled={!p.ready || p.day >= p.D}>Step day</button>
        <button type="button" className="ws-btn" onClick={p.onRestart} disabled={!p.ready}>Restart</button>
      </div>
      <label className="ws-f"><span>Speed</span>
        <select value={p.speed} onChange={(e) => p.onSpeed(Number(e.target.value))}>{SPEEDS.map((s) => <option key={s} value={s}>{s} d/s</option>)}</select>
      </label>
      <label className="ws-f"><span>View</span>
        <select value={p.view} onChange={(e) => p.onView(e.target.value as View)}>
          <option value="both">Side by side</option><option value="without">Without only</option><option value="with">With only</option>
        </select>
      </label>
      <Scrubber day={p.day} D={p.D} onSeek={p.onSeek} data={p.data} scenId={p.id} />
    </div>
  );
}

const Scrubber = memo(function Scrubber({ day, D, onSeek, data, scenId }: { day: number; D: number; onSeek: (d: number) => void; data: TwinData | null; scenId: string }) {
  const ticks = useMemo(() => {
    if (!data) return [];
    const out: { day: number; color: string; kind: string; label: string; row: number }[] = [];
    const scen = sim.scenarios.find((s) => s.id === scenId);
    for (const l of scen ? plantLosses(scen) : []) if (l.startDay <= D) out.push({ day: l.startDay, color: '#f5b041', kind: 'loss', label: `Plant ${l.plant + 1} loss starts`, row: 0 });
    (['without', 'with'] as SideKey[]).forEach((side, r) => {
      const t = tripsPerDay(det(data, side));
      t.forEach((n, d) => { if (n > 0) out.push({ day: d, color: SIDE_COLOR[side], kind: 'trip', label: `${n} plant trip${n > 1 ? 's' : ''} (${side})`, row: r + 1 }); });
      const fd = firstDark(data, side);
      if (fd) out.push({ day: fd, color: SIDE_COLOR[side], kind: 'dark', label: `First blackout (${side})`, row: r + 1 });
    });
    if (data.with.endKind === 'stable' && data.with.endDay && data.with.endDay <= D) out.push({ day: data.with.endDay, color: '#8fd3b0', kind: 'stable', label: 'Stable (with)', row: 0 });
    return out;
  }, [data, D, scenId]);
  return (
    <div className="ws-scrub">
      <label className="ws-f ws-scrub-l"><span>Day <b>{day}</b> / {D}</span>
        <input type="range" min={0} max={D} step={1} value={day} disabled={!data} aria-valuetext={`Day ${day} of ${D}`} onChange={(e) => onSeek(Number(e.target.value))} />
      </label>
      <svg className="ws-ticks" viewBox={`0 0 ${D} 12`} preserveAspectRatio="none" aria-hidden="true">
        {ticks.map((t, i) => (
          <line key={i} x1={t.day} x2={t.day} y1={t.row * 4} y2={t.row * 4 + (t.kind === 'trip' ? 3 : 4)} stroke={t.color}
            strokeWidth={t.kind === 'trip' ? 1 : 2} vectorEffect="non-scaling-stroke"><title>{`Day ${t.day}: ${t.label}`}</title></line>
        ))}
      </svg>
      <div className="ws-tick-legend" aria-hidden="true"><i style={{ background: '#f5b041' }} />loss <i style={{ background: SIDE_COLOR.without }} />trips/blackout W/O <i style={{ background: SIDE_COLOR.with }} />with <i style={{ background: '#8fd3b0' }} />stable</div>
    </div>
  );
});

function Viewport({ data, clock, invalidateRef, view, day, seed, selected, onSelect, onClose }: {
  data: TwinData; clock: React.MutableRefObject<Clock>; invalidateRef: React.MutableRefObject<(() => void) | null>;
  view: View; day: number; seed: number; selected: Pick | null; onSelect: (p: Pick) => void; onClose: () => void;
}) {
  const [hovered, setHovered] = useState<Pick | null>(null);
  const onPick = useCallback((p: Pick | null, kind: 'hover' | 'click') => {
    if (kind === 'click') { if (p) onSelect(p); return; }
    setHovered((h) => (h?.side === p?.side && h?.index === p?.index ? h : p));
  }, [onSelect]);
  useEffect(() => { invalidateRef.current?.(); }, [hovered, selected, view, invalidateRef]);
  const label = (side: SideKey) => (
    <div className={`twin-label ws-label ${side}`}>
      <p className="twin-label-title">{side === 'without' ? 'RUN A' : 'RUN B'} · {SIDE_NAME[side]}</p>
      <p className="twin-label-num"><span>{fmtNum(data[side].deaths[day])}</span> deaths</p>
      <p className="twin-label-sub">{data[side].dark[day]}/{SECTION_COUNT} dark · {det(data, side).plantsMin[day]}/6 plants min</p>
    </div>
  );
  const hv = hovered ?? null;
  return (
    <>
      <Canvas
        frameloop="demand" dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ fov: 28, position: [0, 0, 60] }}
        onCreated={(s) => { invalidateRef.current = s.invalidate; }} onPointerMissed={() => setHovered(null)}
        aria-label={`3D view of the Hollow shafts on day ${day}`} role="img"
      >
        <TwinScene data={data} clock={clock} labels={{ without: label('without'), with: label('with') }} controls={finePointer()}
          view={view} onPick={onPick} selected={selected} hovered={hovered} ruler />
      </Canvas>
      <div className="ws-hud tl" aria-hidden="true">
        <b>DAY {pad2(day)}</b> / {data.days} · snapshot = worst hour ({worstText(data, 'without', day)} / {worstText(data, 'with', day)})
        <br />seed {seed} · {SET_TEXT[seedSet(seed)]} · 50 levels × 8 sections × 2 runs
      </div>
      <ul className="ws-hud tr ws-legend" aria-label="Colors">
        <li><i style={{ background: COLORS.lamp }} />power on</li>
        <li><i style={{ background: COLORS.saving }} />less power</li>
        <li><i style={{ background: COLORS.savingWith }} />saving (with)</li>
        <li><i style={{ background: COLORS.darkGlow }} />blackout</li>
        <li><i style={{ background: COLORS.air }} />CO₂ ≥ 5,000 ppm</li>
        <li><i style={{ background: COLORS.lost }} />lost</li>
        <li><i style={{ background: COLORS.plantOn }} />plant online</li>
      </ul>
      <div className="ws-hud bl" aria-hidden="true">
        {hv ? <>hover: <b style={{ color: SIDE_COLOR[hv.side] }}>{hv.side}</b> L{Math.floor(hv.index / 8) + 1}·C{hv.index % 8} · life support {(det(data, hv.side).ls[day * SECTION_COUNT + hv.index] * 100).toFixed(0)}% · CO₂ {fmtNum(det(data, hv.side).co2[day * SECTION_COUNT + hv.index])} ppm — click to inspect</> : 'Click a section to inspect it · drag to turn the view'}
      </div>
      {selected && <SectionCard data={data} day={day} pick={selected} onClose={onClose} />}
    </>
  );
}
