// #/demo — the 3D twin: the same disaster on the same seed, twice. Left: without Blackout Warning. Right: with it.
// The day frames are computed once per disaster (in a Web Worker) and played back here.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { SiteData } from '../site/data.ts';
import { displayName } from '../site/parts.tsx';
import { href } from '../site/router.ts';
import { sim } from '../sim/index.ts';
import { SECTION_COUNT } from '../sim/types.ts';
import { useTwin, loadResults } from './data.ts';
import { TwinScene, type Clock } from './Scene.tsx';
import { COLORS } from './palette.ts';
import './twin3d.css';

const DEFAULT = 'twoplants';
const SPEEDS = [1, 2, 4];
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

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

  const { data, error } = useTwin(id);
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [day, setDay] = useState(0); // the shown day, whole days (the clock holds the fraction)
  const [meanWith, setMeanWith] = useState<number | null>(null);
  const clock = useRef<Clock>({ day: 0, pulseT: 0, pulse: !reduced, hold: 0.85 });
  const invalidateRef = useRef<(() => void) | null>(null);
  clock.current.pulse = !reduced;

  useEffect(() => {
    loadResults().then((f) => setMeanWith(f?.scenarios.find((s) => s.id === id)?.with.deaths.mean ?? null));
  }, [id]);

  // A new disaster: start at day 0 and play (not with reduced motion).
  useEffect(() => {
    if (!data) return;
    clock.current.day = 0;
    setDay(0);
    setPlaying(!reduced);
    invalidateRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const D = data?.days ?? 30;

  // Playback loop: outside React's render and outside useFrame. setState only when the whole day changes.
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

  const togglePlay = () => {
    if (!playing && clock.current.day >= D) seek(0);
    setPlaying((p) => !p);
  };

  const shown = Math.min(D, day);
  const label = (side: 'without' | 'with') => {
    if (!data) return null;
    const s = data[side];
    return (
      <div className={`twin-label ${side}`}>
        <p className="twin-label-title">{side === 'with' ? 'With Blackout Warning' : 'Without Blackout Warning'}</p>
        <p className="twin-label-num"><span>{fmt(s.deaths[shown])}</span> deaths so far</p>
        <p className="twin-label-sub">{s.dark[shown]} of {SECTION_COUNT} sections dark</p>
      </div>
    );
  };

  const seedNote = data && (
    <>Seed {data.seed}, a typical held-out seed: of the test seeds 11–20, its deaths with Blackout Warning
      ({fmt(data.with.deaths[data.days])}{data.with.endDay && data.with.endDay > data.days ? ` by day ${data.days}` : ''})
      are closest to the mean{meanWith !== null ? ` (${fmt(meanWith)})` : ''}.</>
  );

  return (
    <section className="twin" aria-labelledby="twin-h">
      <header className="twin-head">
        <h1 id="twin-h" tabIndex={-1}>Watch it run</h1>
        <p className="twin-lede">
          The same disaster on the same seed, twice. Left: the Hollow without Blackout Warning. Right: with it. Each
          block is one section: 50 levels, 8 sections per level. The 6 blocks on the left edge of each shaft are the power plants.
        </p>
      </header>

      <div className="twin-controls" role="group" aria-label="Playback">
        <label className="twin-field">
          <span>Disaster</span>
          <select value={id} onChange={(e) => { setPlaying(false); setId(e.target.value); }}>
            {order.map((s) => <option key={s} value={s}>{nameOf(s)}</option>)}
          </select>
        </label>
        <button type="button" className="twin-btn primary" onClick={togglePlay} disabled={!data} aria-pressed={playing}>
          {playing ? 'Pause' : clock.current.day >= D ? 'Play again' : 'Play'}
        </button>
        <button type="button" className="twin-btn" onClick={() => { seek(0); setPlaying(!reduced); }} disabled={!data}>Restart</button>
        <label className="twin-field twin-scrub">
          <span>Day <strong>{shown}</strong> of {D}</span>
          <input
            type="range" min={0} max={D} step={1} value={shown} disabled={!data}
            aria-valuetext={`Day ${shown} of ${D}`}
            onChange={(e) => { setPlaying(false); seek(Number(e.target.value)); }}
          />
        </label>
        <label className="twin-field">
          <span>Speed</span>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => <option key={s} value={s}>{s} {s === 1 ? 'day' : 'days'} a second</option>)}
          </select>
        </label>
      </div>

      <div className="twin-stage">
        {data ? (
          <Canvas
            frameloop="demand"
            dpr={[1, 2]}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            camera={{ fov: 28, position: [0, 0, 60] }}
            onCreated={(s) => { invalidateRef.current = s.invalidate; }}
            aria-label={`3D view of two Hollow shafts on day ${shown}`}
            role="img"
          >
            <TwinScene data={data} clock={clock} labels={{ without: label('without'), with: label('with') }} controls={finePointer()} />
          </Canvas>
        ) : (
          <p className="twin-loading" role="status">{error ? `The simulation did not run: ${error}` : `Running ${nameOf(id)} twice, without and with Blackout Warning…`}</p>
        )}
      </div>

      <div className="twin-foot">
        <p className="twin-seed" aria-live="polite">{seedNote}</p>
        <ul className="twin-legend" aria-label="Colors">
          <li><i style={{ background: COLORS.lamp }} />Power on</li>
          <li><i style={{ background: COLORS.saving }} />Less power than normal</li>
          <li><i style={{ background: COLORS.savingWith }} />Less power than normal, right shaft (residents save power on the warning)</li>
          <li><i style={{ background: COLORS.darkGlow }} />Blackout: air and fans under half power</li>
          <li><i style={{ background: COLORS.air }} />Air unsafe: CO₂ at 5,000 ppm or more</li>
          <li><i style={{ background: COLORS.lost }} />Everyone dead or gone</li>
          <li><i style={{ background: COLORS.plantOn }} />Plant online (dark: offline)</li>
        </ul>
        <p className="twin-note">
          Each day shows its worst hour. Deaths count people in the simulation (1,600,000 at the start).{' '}
          <a className="text-link" href={href.demoClassic(id)}>Open the 2D cutaway</a> to play one day at a time.
        </p>
      </div>
    </section>
  );
}
