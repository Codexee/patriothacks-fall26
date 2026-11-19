// The cross-section screen (#/hollow, #/hollow/<event id>). The canvas and the numbers beside it
// follow the shared clock through refs; React renders only when the event or the view changes.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Clock } from './clock.ts';
import { fmtInt } from './data.ts';
import type { Live, Scene } from './data.ts';
import { GROUP, GROUPS, HollowPainter, buildSection, fairRotation, groupStats } from './hollow.ts';
import type { FairRotation, Geometry, Section } from './hollow.ts';
import type { HoverInfo } from './map.ts';

export const fmtPeople = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)} B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e4 ? `${Math.round(n / 1e3)} k` : fmtInt(n);
const fmtH = (h: number) => (h < 10 ? h.toFixed(1) : String(Math.round(h)));

export function HollowView({ scene, live, clock, highlight, showFair, bare = false, onHover, aside }: {
  scene: Scene; live: Live | null; clock: Clock;
  highlight?: number[];       // counties to ring (the check-first list, in the "With" view)
  showFair?: boolean;         // the load-shed comparison (per-hero flag)
  bare?: boolean;             // story mode: the picture and the level numbers only
  onHover?: (h: HoverInfo | null) => void;
  aside?: ReactNode;          // shown above the picture, left of the fair-rotation note
}) {
  const sec = useMemo<Section>(() => buildSection(scene, live), [scene, live]);
  const fair = useMemo<FairRotation | null>(() => (showFair && live ? fairRotation(scene, live) : null), [scene, live, showFair]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painterRef = useRef<HollowPainter | null>(null);
  const cellRefs = useRef<(HTMLElement | null)[][]>([]);
  const [geo, setGeo] = useState<Geometry | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const painter = new HollowPainter(canvas, scene);
    painterRef.current = painter;
    const fit = () => {
      painter.resize(wrap.clientWidth, wrap.clientHeight);
      setGeo({ ...painter.geo });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => { ro.disconnect(); painterRef.current = null; };
  }, [scene]);

  useEffect(() => {
    const painter = painterRef.current;
    if (!painter || !geo) return;
    painter.highlight = new Set(highlight ?? []);
    let lastIdx = -1;
    const paint = () => {
      painter.paint(sec, live, live ? clock.hour : 0);
      const idx = live ? clock.index : 0;
      if (idx === lastIdx) return;
      lastIdx = idx;
      const stats = groupStats(scene, live, sec, idx);
      stats.forEach((s, g) => {
        const r = cellRefs.current[g];
        if (!r) return;
        if (r[0]) r[0].textContent = fmtPeople(s.people);
        if (r[1]) r[1].textContent = `${fmtPeople(s.hollowPeople)} at Hollow scale`;
        if (r[2]) r[2].textContent = live ? `${s.pctOut < 1 && s.pctOut > 0 ? s.pctOut.toFixed(1) : Math.round(s.pctOut)}%` : '–';
        if (r[3]) r[3].textContent = live ? fmtH(s.hoursPerPerson) : '–';
        if (r[4]) r[4].textContent = live ? fmtInt(s.dmeDark) : '–';
        r[2]?.classList.toggle('hv-hot', s.pctOut >= 10);
      });
    };
    paint();
    return clock.subscribe(paint);
  }, [scene, live, sec, clock, geo, highlight]);

  const pick = (e: { clientX: number; clientY: number }) => {
    const painter = painterRef.current, wrap = wrapRef.current;
    if (!painter || !wrap) return -1;
    const r = wrap.getBoundingClientRect();
    return painter.pick(sec, e.clientX - r.left, e.clientY - r.top);
  };

  const rowTop = (g: number) => (geo ? geo.top + g * GROUP * (geo.bandH + geo.gap) : 0);
  const rowH = geo ? GROUP * (geo.bandH + geo.gap) - geo.gap : 0;

  return (
    <div className={`hv${bare ? ' hv-bare' : ''}${live ? '' : ' hv-calm'}`}>
      {!bare && (fair || aside) && (
        <div className="hv-top">
          <div className="hv-aside">{aside}</div>
          {fair && <FairNote fair={fair} />}
        </div>
      )}
      <div className="hv-body">
      <div className="hv-figure">
        <div
          className="hv-canvas" ref={wrapRef}
          onPointerMove={(e) => { if (bare) return; const ci = pick(e); onHover?.(ci >= 0 ? { ci, x: e.clientX, y: e.clientY } : null); e.currentTarget.style.cursor = ci >= 0 ? 'pointer' : 'default'; }}
          onPointerLeave={() => onHover?.(null)}
          onClick={(e) => { if (bare) return; const ci = pick(e); if (ci >= 0) window.location.hash = `#/brief/${scene.counties[ci].fips}`; }}
        >
          <canvas ref={canvasRef} aria-label="The Hollow as a cross-section: 50 levels of real US counties, level 1 at the top" role="img" />
          {geo && <span className="hv-surface" style={{ top: geo.surface - 22 }}>Surface</span>}
        </div>
        {geo && (
          <div className="hv-levels" aria-hidden="true">
            {Array.from({ length: GROUPS }, (_, g) => (
              <span key={g} style={{ top: rowTop(g), height: rowH }}>{g * GROUP + 1}–{(g + 1) * GROUP}</span>
            ))}
          </div>
        )}
      </div>

      {!bare && geo && (
        <div className="hv-table">
          <div className="hv-head" style={{ height: geo.top }}>
            <span>People</span>
            <span>Customers out now</span>
            <span>Hours without power per person</span>
            <span>On medical equipment, in dark counties</span>
            {fair && <span className="hv-fair-h">Whole event in {fair.ba}: actual / fair rotation</span>}
          </div>
          {Array.from({ length: GROUPS }, (_, g) => (
            <div key={g} className="hv-row" style={{ top: rowTop(g), height: rowH }}>
              <span className="hv-people">
                <b ref={(el) => { (cellRefs.current[g] ??= [])[0] = el; }} />
                <small ref={(el) => { (cellRefs.current[g] ??= [])[1] = el; }} />
              </span>
              <span ref={(el) => { (cellRefs.current[g] ??= [])[2] = el; }} />
              <span ref={(el) => { (cellRefs.current[g] ??= [])[3] = el; }} />
              <span ref={(el) => { (cellRefs.current[g] ??= [])[4] = el; }} />
              {fair && (
                <span className="hv-fair">
                  {fair.actual[g] == null ? '–' : `${fmtH(fair.actual[g]!)} / ${fmtH(fair.fair)}`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      </div>

      {!bare && (
        <p className="hv-note">
          Cell width = people. Level = CDC vulnerability (50 = most vulnerable).
          {' '}{live ? `The ${fmtInt(sec.cis.length)} US counties in this replay` : `All ${fmtInt(sec.cis.length)} US counties`} stand for the Hollow.
          {' '}Hollow scale = a level's share of these {fmtPeople(sec.totalPop)} people × 2 billion: a scaling, not a count.
        </p>
      )}
    </div>
  );
}

function FairNote({ fair }: { fair: FairRotation }) {
  const s = fair.spared;
  const f1 = (h: number) => h.toFixed(1);
  return (
    <aside className="hv-fairnote" aria-label="The Directorate's rule against fair rotation">
      <h3>The Directorate's rule vs fair rotation</h3>
      <p>
        Deepest 10 levels in {fair.ba}: <b>{f1(fair.deepActual)} h</b> without power per person. Fair rotation: <b>{f1(fair.fair)} h</b>.
        {' '}{Math.abs(s) < 0.5
          ? 'About the same.'
          : s > 0 ? <>Fair rotation would have spared them <b>{f1(s)} h</b>.</> : <>Fair rotation would have given them <b>{f1(-s)} h</b> more.</>}
      </p>
      <p className="hv-fair-label">the same shortage, spread evenly; a simple what-if, not a grid simulation</p>
    </aside>
  );
}
