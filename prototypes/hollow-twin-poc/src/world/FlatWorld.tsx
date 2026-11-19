// UI branch: a flat, readable cutaway of the Hollow (replaces the pixel-art PixiJS scene in App; that scene is still in
// world/index.tsx). One canvas, drawn at device resolution. Each room is one rectangle whose color says its state:
// lamp-lit, dimmed (saving power), blackout (air and fans off), bad air, or empty. A red rule marks the blackout line.
import { useEffect, useRef } from 'react';
import { LEVELS, SECTIONS_PER_LEVEL, SECTION_COUNT, type Frame, type WorldProps } from '../sim/types.ts';

export const FLAT = {
  rock: '#1d232b',
  rockDeep: '#141920',
  label: '#7d8794',
  labelStrong: '#c9d0d8',
  lit: [242, 212, 146] as const, // a lamp at full power
  dim: [150, 132, 92] as const, // a lamp when the section saves power
  dark: '#07090c',
  badAir: '#5c1b1f',
  blackout: '#f0654f',
  empty: '#2c323a',
  emptyHatch: '#3b424c',
  plant: '#e7ecf2',
  home: '#6cb6ff',
  hover: '#ffffff',
  surface: '#2b2724',
  skyline: '#3a332e',
};

const GUTTER_L = 34, GUTTER_R = 10, SURFACE = 44, CRUST = 10, ROW = 18, GAP_X = 3, GAP_Y = 3;
const BLACKOUT = 0.5, AIR_BAD = 5000;

type RoomState = 'lit' | 'dark' | 'empty';
const stateOf = (s: Frame['sections'][number]): RoomState => (s.lost ? 'empty' : s.lifeSupport < BLACKOUT ? 'dark' : 'lit');

/** Levels from the top that still have air and fans (a level is dark when at least half its rooms are). */
export function blackoutLine(frame: Frame): { line: number; darkLevels: number } {
  let line = -1, darkLevels = 0;
  for (let l = 0; l < LEVELS; l++) {
    let d = 0;
    for (let c = 0; c < SECTIONS_PER_LEVEL; c++) {
      const s = frame.sections[l * SECTIONS_PER_LEVEL + c];
      if (s && stateOf(s) !== 'lit') d++;
    }
    if (d >= SECTIONS_PER_LEVEL / 2) { darkLevels++; if (line < 0) line = l; }
  }
  return { line: line < 0 ? LEVELS : line, darkLevels };
}

function geometry(width: number) {
  const roomW = Math.max(12, (width - GUTTER_L - GUTTER_R - GAP_X * (SECTIONS_PER_LEVEL - 1)) / SECTIONS_PER_LEVEL);
  const top = SURFACE + CRUST;
  return {
    roomW, top, height: top + LEVELS * ROW + 12,
    x: (col: number) => GUTTER_L + col * (roomW + GAP_X),
    y: (level: number) => top + (level - 1) * ROW,
  };
}

const mix = (a: readonly number[], b: readonly number[], t: number) =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;

export function FlatWorld(props: WorldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const hoverRef = useRef<{ level: number; col: number } | null>(null);
  const shown = useRef(new Float32Array(SECTION_COUNT).fill(1)); // brightness drawn now, eased toward the frame
  const raf = useRef(0);

  useEffect(() => {
    const host = hostRef.current!, cv = canvasRef.current!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = performance.now();

    const draw = (now: number) => {
      const width = host.clientWidth;
      const g = geometry(width);
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(width * dpr) || cv.height !== Math.round(g.height * dpr)) {
        cv.width = Math.round(width * dpr); cv.height = Math.round(g.height * dpr);
        cv.style.width = `${width}px`; cv.style.height = `${g.height}px`;
      }
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { frame, selected } = propsRef.current;

      // Rock, darker with depth; the surface band with a ruined skyline.
      const grad = ctx.createLinearGradient(0, g.top, 0, g.height);
      grad.addColorStop(0, FLAT.rock); grad.addColorStop(1, FLAT.rockDeep);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, width, g.height);
      ctx.fillStyle = FLAT.surface; ctx.fillRect(0, 0, width, SURFACE);
      ctx.fillStyle = FLAT.skyline;
      for (let x = 0, k = 0; x < width; k++) {
        const w = 14 + ((k * 37) % 23), h = 8 + ((k * 53) % 26);
        ctx.fillRect(x, SURFACE - h, w, h); x += w + 4 + ((k * 11) % 9);
      }
      ctx.fillStyle = FLAT.labelStrong; ctx.font = '600 12px "Barlow Semi Condensed", system-ui, sans-serif';
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText('Surface: closed for 30 years', GUTTER_L, 13);

      // Ease each room's brightness toward its target.
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const k = reduce ? 1 : 1 - Math.exp(-dt / 0.12);
      let moving = false;
      for (let i = 0; i < SECTION_COUNT; i++) {
        const s = frame.sections[i];
        const target = !s || s.lost ? 0 : s.lifeSupport < BLACKOUT ? 0 : 0.6 + 0.4 * Math.max(0, Math.min(1, s.power));
        const v = shown.current[i] + (target - shown.current[i]) * k;
        if (Math.abs(target - v) > 0.004) moving = true;
        shown.current[i] = Math.abs(target - v) < 0.004 ? target : v;
      }

      // Rooms.
      ctx.font = '500 10px "Barlow Semi Condensed", system-ui, sans-serif';
      ctx.textAlign = 'right';
      for (let level = 1; level <= LEVELS; level++) {
        const y = g.y(level), h = ROW - GAP_Y;
        ctx.fillStyle = level % 5 === 0 || level === 1 ? FLAT.labelStrong : FLAT.label;
        ctx.fillText(String(level), GUTTER_L - 8, y + h / 2 + 0.5);
        for (let col = 0; col < SECTIONS_PER_LEVEL; col++) {
          const i = (level - 1) * SECTIONS_PER_LEVEL + col;
          const s = frame.sections[i];
          if (!s) continue;
          const x = g.x(col), w = g.roomW, st = stateOf(s), b = shown.current[i];
          if (st === 'empty') {
            ctx.fillStyle = FLAT.empty; ctx.fillRect(x, y, w, h);
            ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
            ctx.strokeStyle = FLAT.emptyHatch; ctx.lineWidth = 1; ctx.beginPath();
            for (let d = -h; d < w; d += 5) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); }
            ctx.stroke(); ctx.restore();
          } else if (st === 'dark' && b < 0.05) {
            ctx.fillStyle = s.co2 >= AIR_BAD ? FLAT.badAir : FLAT.dark; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x, y, w, 1); // keep the room's shape readable
          } else {
            // 0.6 = dimmed (saving power), 1 = full lamp; below 0.6 only while fading into a blackout.
            const t = Math.max(0, Math.min(1, (b - 0.6) / 0.4));
            const lampTop = b >= 0.6 ? mix(FLAT.dim, FLAT.lit, t) : mix([7, 9, 12], FLAT.dim, b / 0.6);
            ctx.fillStyle = lampTop; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = 'rgba(20,14,4,0.22)'; ctx.fillRect(x, y + 3, w, h - 3); // lamp at the ceiling, floor in shade
          }
          if (s.structures.includes('plant') && !s.lost) { // a power plant: a small light square at the right
            ctx.fillStyle = FLAT.plant; ctx.fillRect(x + w - 8, y + 3, 5, h - 6);
            ctx.fillStyle = st === 'dark' ? FLAT.dark : '#3b3326'; ctx.fillRect(x + w - 7, y + 4, 3, h - 8);
          }
        }
      }

      // The blackout line: below it, levels have no air or fans.
      const { line, darkLevels } = blackoutLine(frame);
      if (darkLevels > 0) {
        const most = darkLevels >= 0.9 * LEVELS;
        const yy = most ? g.top - 3 : g.y(line + 1) - GAP_Y / 2 - 0.5;
        ctx.strokeStyle = FLAT.blackout; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(GUTTER_L - 4, yy); ctx.lineTo(width - GUTTER_R + 4, yy); ctx.stroke();
        const text = most ? 'Almost the whole Hollow is dark' : `Blackout below level ${line}: no air or fans`;
        ctx.font = '600 11px "Barlow Semi Condensed", system-ui, sans-serif';
        const tw = ctx.measureText(text).width;
        const bx = width - GUTTER_R - tw - 12, by = yy - 9;
        ctx.fillStyle = FLAT.blackout; ctx.beginPath(); ctx.roundRect(bx, by, tw + 12, 18, 3); ctx.fill();
        ctx.fillStyle = '#1a0806'; ctx.textAlign = 'left'; ctx.fillText(text, bx + 6, by + 9.5);
      }

      // Your home (blue) and the hovered room (white).
      const box = (t: { level: number; col: number } | null | undefined, color: string, lw: number) => {
        if (!t || t.level < 1 || t.level > LEVELS) return;
        ctx.strokeStyle = color; ctx.lineWidth = lw;
        ctx.strokeRect(g.x(t.col) - 1.5, g.y(t.level) - 1.5, g.roomW + 3, ROW - GAP_Y + 3);
      };
      box(hoverRef.current, FLAT.hover, 1.5);
      box(selected, FLAT.home, 2);

      raf.current = moving ? requestAnimationFrame(draw) : 0;
    };
    const kick = () => { if (!raf.current) { last = performance.now(); raf.current = requestAnimationFrame(draw); } };
    (host as HTMLDivElement & { __kick?: () => void }).__kick = kick;

    const hit = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const g = geometry(host.clientWidth);
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (y < g.top || y >= g.top + LEVELS * ROW) return null;
      const level = Math.floor((y - g.top) / ROW) + 1;
      const col = Math.floor((x - GUTTER_L + GAP_X / 2) / (g.roomW + GAP_X));
      return col >= 0 && col < SECTIONS_PER_LEVEL ? { level, col } : null;
    };
    let lastKey = '';
    const onMove = (e: PointerEvent) => {
      const t = hit(e);
      const key = t ? `${t.level}:${t.col}` : '';
      if (key === lastKey) return;
      lastKey = key; hoverRef.current = t; propsRef.current.onHover(t); kick();
    };
    const onLeave = () => { lastKey = ''; hoverRef.current = null; propsRef.current.onHover(null); kick(); };
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', onLeave);
    const ro = new ResizeObserver(kick); ro.observe(host);
    document.fonts?.ready.then(kick);
    kick();
    return () => {
      cancelAnimationFrame(raf.current); raf.current = 0;
      cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerleave', onLeave); ro.disconnect();
    };
  }, []);

  useEffect(() => { (hostRef.current as (HTMLDivElement & { __kick?: () => void }) | null)?.__kick?.(); }, [props.frame, props.selected]);

  return (
    <div ref={hostRef} className="flat-world">
      <canvas ref={canvasRef} aria-label="Cutaway of the Hollow: 50 levels, 8 sections each. Hover a section to see its values." />
    </div>
  );
}
