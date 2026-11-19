// UI branch: an illustrated cutaway of the Hollow, drawn smooth at device resolution (the old pixel-art PixiJS scene is
// still in world/index.tsx; ?pixel shows it). Rock strata, a dusk surface with the machines' lights, a lift shaft,
// pipes, and rooms with lamps, people, fans and geothermal plants. The light tells the state: warm lamp light = power,
// dimmer = saving power, black = blackout (no air or fans), pulsing red = blackout and the air is unsafe.
import { useEffect, useRef } from 'react';
import { LEVELS, SECTIONS_PER_LEVEL, SECTION_COUNT, type Frame, type WorldProps } from '../sim/types.ts';

const GUTTER_L = 44, GUTTER_R = 10, SURFACE = 78, CRUST = 14, ROW = 22, GAP_X = 4, GAP_Y = 4;
const SHAFT_X = 28, SHAFT_W = 10;
const BLACKOUT = 0.5, AIR_BAD = 5000;
const ROOM_H = ROW - GAP_Y;

type Sec = Frame['sections'][number];
type RoomState = 'lit' | 'dark' | 'empty';
const stateOf = (s: Sec): RoomState => (s.lost ? 'empty' : s.lifeSupport < BLACKOUT ? 'dark' : 'lit');

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
  const roomW = Math.max(14, (width - GUTTER_L - GUTTER_R - GAP_X * (SECTIONS_PER_LEVEL - 1)) / SECTIONS_PER_LEVEL);
  const top = SURFACE + CRUST;
  return {
    roomW, top, height: top + LEVELS * ROW + 16,
    x: (col: number) => GUTTER_L + col * (roomW + GAP_X),
    y: (level: number) => top + (level - 1) * ROW,
  };
}

const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rgb = (a: number[], b: number[], t: number, alpha = 1) =>
  `rgba(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))},${alpha})`;

const ROCK_TOP = [74, 60, 52], ROCK_MID = [44, 42, 48], ROCK_DEEP = [22, 25, 33];
const LAMP_HOT = [255, 226, 160], LAMP_WARM = [214, 160, 92], LAMP_DIM = [140, 112, 74];

/** Everything that does not change between frames: sky, ruins, rock strata, shaft, pipes, carved recesses. */
function paintStatic(width: number, height: number, dpr: number): HTMLCanvasElement {
  const g = geometry(width);
  const cv = document.createElement('canvas');
  cv.width = Math.round(width * dpr); cv.height = Math.round(height * dpr);
  const c = cv.getContext('2d')!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Dusk sky over the dead cities.
  const sky = c.createLinearGradient(0, 0, 0, SURFACE);
  sky.addColorStop(0, '#2b2733'); sky.addColorStop(0.55, '#6b4a48'); sky.addColorStop(1, '#c47a48');
  c.fillStyle = sky; c.fillRect(0, 0, width, SURFACE);
  const sun = c.createRadialGradient(width * 0.72, SURFACE - 6, 2, width * 0.72, SURFACE - 6, 70);
  sun.addColorStop(0, 'rgba(255,200,140,0.75)'); sun.addColorStop(1, 'rgba(255,170,110,0)');
  c.fillStyle = sun; c.fillRect(0, 0, width, SURFACE);
  for (const [layer, color, maxH] of [[0, '#4a3a40', 40], [1, '#271e24', 28]] as const) {
    c.fillStyle = color;
    for (let x = -10, k = 0; x < width + 20; k++) {
      const w = 12 + hash(k, layer + 3) * 26, h = 10 + hash(k, layer + 9) * maxH;
      c.fillRect(x, SURFACE - h, w, h);
      if (hash(k, layer + 5) > 0.6) c.fillRect(x + w * 0.3, SURFACE - h - 8, 2, 8); // antenna
      if (layer === 0 && hash(k, 21) > 0.55) { // broken top
        c.beginPath(); c.moveTo(x, SURFACE - h); c.lineTo(x + w * 0.5, SURFACE - h - 6); c.lineTo(x + w, SURFACE - h); c.fill();
      }
      x += w + (layer ? 3 : 6) + hash(k, layer + 11) * 10;
    }
  }

  // Rock strata, warm near the surface and cold and blue with depth.
  const bands = 14;
  for (let k = 0; k <= bands; k++) {
    const t = k / bands;
    const col = t < 0.5 ? rgb(ROCK_TOP, ROCK_MID, t * 2) : rgb(ROCK_MID, ROCK_DEEP, (t - 0.5) * 2);
    const y0 = SURFACE + (height - SURFACE) * (k / (bands + 1));
    c.fillStyle = col; c.beginPath(); c.moveTo(0, height);
    for (let x = 0; x <= width; x += 6) c.lineTo(x, y0 + 7 * Math.sin(x / 61 + k * 1.7) + 3 * Math.sin(x / 19 + k * 3.1));
    c.lineTo(width, height); c.closePath(); c.fill();
  }
  for (let i = 0; i < 2200; i++) { // grit
    const x = hash(i, 1) * width, y = SURFACE + hash(i, 2) * (height - SURFACE);
    c.fillStyle = hash(i, 3) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.18)';
    c.fillRect(x, y, 1 + hash(i, 4) * 1.5, 1);
  }
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, SURFACE, width, 3); // the crust line

  // The lift shaft, with rails.
  c.fillStyle = '#0c0f14'; c.fillRect(SHAFT_X, g.top - 6, SHAFT_W, LEVELS * ROW + 10);
  c.fillStyle = '#2a3039'; c.fillRect(SHAFT_X + 1, g.top - 6, 1, LEVELS * ROW + 10); c.fillRect(SHAFT_X + SHAFT_W - 2, g.top - 6, 1, LEVELS * ROW + 10);

  // Carved recesses for every room, and a pipe along each floor.
  for (let level = 1; level <= LEVELS; level++) {
    const y = g.y(level);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    for (let col = 0; col < SECTIONS_PER_LEVEL; col++) {
      c.beginPath(); c.roundRect(g.x(col) - 1.5, y - 1.5, g.roomW + 3, ROOM_H + 3, 5); c.fill();
    }
    c.fillStyle = '#3a414b'; c.fillRect(GUTTER_L - 6, y + ROOM_H + 1.5, width - GUTTER_L - GUTTER_R + 8, 1.2);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(GUTTER_L - 6, y + ROOM_H + 1.5, width - GUTTER_L - GUTTER_R + 8, 0.5);
  }
  return cv;
}

export function FlatWorld(props: WorldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const hoverRef = useRef<{ level: number; col: number } | null>(null);
  const shown = useRef(new Float32Array(SECTION_COUNT).fill(1)); // brightness drawn now, eased toward the frame
  const kickRef = useRef<() => void>(() => {});

  useEffect(() => {
    const host = hostRef.current!, cv = canvasRef.current!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let staticCv: HTMLCanvasElement | null = null, staticKey = '';
    let raf = 0, last = performance.now(), lastDraw = 0, peopleMax = 1;
    const prevTarget = new Float32Array(SECTION_COUNT).fill(1);
    let sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    const t0 = performance.now();

    const draw = (now: number) => {
      raf = 0;
      const width = host.clientWidth;
      const g = geometry(width);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const key = `${width}x${dpr}`;
      if (key !== staticKey) {
        staticKey = key; staticCv = paintStatic(width, g.height, dpr);
        cv.width = Math.round(width * dpr); cv.height = Math.round(g.height * dpr);
        cv.style.width = `${width}px`; cv.style.height = `${g.height}px`;
      }
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(staticCv!, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = reduce ? 0 : (now - t0) / 1000;
      const { frame, selected } = propsRef.current;
      for (const s of frame.sections) if (s.people > peopleMax) peopleMax = s.people;

      // Ease brightness toward the frame (1 = full power, 0.6 = saving power, 0 = blackout).
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const k = reduce ? 1 : 1 - Math.exp(-dt / 0.15);
      for (let i = 0; i < SECTION_COUNT; i++) {
        const s = frame.sections[i];
        const target = !s || s.lost ? 0 : s.lifeSupport < BLACKOUT ? 0 : 0.6 + 0.4 * Math.max(0, Math.min(1, s.power));
        const v = shown.current[i] + (target - shown.current[i]) * k;
        shown.current[i] = Math.abs(target - v) < 0.003 ? target : v;
        // A lamp that dies throws a few sparks.
        if (!reduce && prevTarget[i] >= 0.5 && target === 0 && s && !s.lost && sparks.length < 400) {
          const lx = g.x(i % SECTIONS_PER_LEVEL) + g.roomW / 2, ly = g.y(Math.floor(i / SECTIONS_PER_LEVEL) + 1) + 2;
          for (let q = 0; q < 5; q++) sparks.push({ x: lx, y: ly, vx: (hash(i, q + now) - 0.5) * 40, vy: -hash(q, i + now) * 25, life: 0.5 + hash(i, q) * 0.4 });
        }
        prevTarget[i] = target;
      }
      sparks = sparks.filter((p) => (p.life -= dt) > 0);
      for (const p of sparks) { p.vy += 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }

      // The surface: smoke drifting over the ruins, and a machine's searchlight sweeping the sky.
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, width, SURFACE); ctx.clip();
      for (let j = 0; j < 4; j++) {
        const cx = ((t * (6 + j * 3) + hash(j, 60) * width) % (width + 160)) - 80, cy = 16 + hash(j, 61) * 30;
        const sm = ctx.createRadialGradient(cx, cy, 2, cx, cy, 46);
        sm.addColorStop(0, 'rgba(30,24,30,0.32)'); sm.addColorStop(1, 'rgba(30,24,30,0)');
        ctx.fillStyle = sm; ctx.fillRect(cx - 50, cy - 50, 100, 100);
      }
      const sx = width * 0.3, sy = SURFACE - 30, ang = -Math.PI / 2 + Math.sin(t * 0.35) * 0.9;
      const beam = ctx.createLinearGradient(sx, sy, sx + Math.cos(ang) * 120, sy + Math.sin(ang) * 120);
      beam.addColorStop(0, 'rgba(255,120,90,0.22)'); beam.addColorStop(1, 'rgba(255,120,90,0)');
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang - 0.09) * 140, sy + Math.sin(ang - 0.09) * 140);
      ctx.lineTo(sx + Math.cos(ang + 0.09) * 140, sy + Math.sin(ang + 0.09) * 140); ctx.fill();
      // Two of the machines' drones patrol over the ruins, scanning the ground.
      for (let d = 0; d < 2; d++) {
        const dir = d ? -1 : 1, span = width + 120;
        const raw = (t * (22 + d * 9) + d * span * 0.5) % span;
        const dx = dir > 0 ? raw - 60 : width + 60 - raw, dy = 22 + d * 14 + Math.sin(t * 1.4 + d) * 3;
        ctx.fillStyle = 'rgba(255,90,70,0.10)';
        ctx.beginPath(); ctx.moveTo(dx - 1.5, dy + 2); ctx.lineTo(dx + 1.5, dy + 2); ctx.lineTo(dx + 9, SURFACE); ctx.lineTo(dx - 9, SURFACE); ctx.fill();
        ctx.fillStyle = '#17121a'; ctx.beginPath(); ctx.ellipse(dx, dy, 6, 2.2, 0, 0, 7); ctx.fill();
        ctx.fillRect(dx - 9, dy - 1.5, 18, 0.8);
        ctx.fillStyle = `rgba(255,70,50,${Math.sin(t * 6 + d * 2) > 0 ? 1 : 0.25})`; ctx.beginPath(); ctx.arc(dx, dy + 1.5, 1.1, 0, 7); ctx.fill();
      }
      ctx.restore();

      // Machine lights on the surface.
      for (let j = 0; j < 7; j++) {
        const x = (0.08 + j * 0.13 + hash(j, 40) * 0.05) * width, y = SURFACE - 18 - hash(j, 41) * 26;
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * (1.2 + hash(j, 42)) + j * 2));
        ctx.fillStyle = `rgba(255,80,60,${a})`; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
      }
      ctx.font = '600 12px "Barlow Semi Condensed", system-ui, sans-serif';
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,236,220,0.85)';
      ctx.fillText('The surface: closed for 30 years, held by the machines', GUTTER_L, 14);

      // The lift: travels between levels, stops, and lights the landing while its door is open.
      const HOP = 7, hop = Math.floor(t / HOP), u = (t % HOP) / HOP;
      const stopAt = (n: number) => 1 + Math.floor(hash(n, 90) * LEVELS);
      const from = stopAt(hop), to = stopAt(hop + 1);
      const m = u < 0.45 ? 0 : (1 - Math.cos(((u - 0.45) / 0.55) * Math.PI)) / 2;
      const liftLevel = from + (to - from) * m;
      const liftY = g.y(liftLevel) + 2;
      ctx.fillStyle = 'rgba(160,170,185,0.35)'; ctx.fillRect(SHAFT_X + SHAFT_W / 2 - 0.4, g.top - 6, 0.8, liftY - g.top + 6); // cable
      ctx.fillStyle = '#c9a46a'; ctx.fillRect(SHAFT_X + 2, liftY, SHAFT_W - 4, 13);
      ctx.fillStyle = 'rgba(255,220,150,0.95)'; ctx.fillRect(SHAFT_X + 3, liftY + 2, SHAFT_W - 6, 3);
      if (m === 0) { // stopped: the landing light is on
        const lg = ctx.createRadialGradient(SHAFT_X + SHAFT_W, liftY + 6, 0, SHAFT_X + SHAFT_W, liftY + 6, 14);
        lg.addColorStop(0, 'rgba(255,215,140,0.55)'); lg.addColorStop(1, 'rgba(255,215,140,0)');
        ctx.fillStyle = lg; ctx.fillRect(SHAFT_X - 4, liftY - 8, 30, 28);
      }

      // Light spilling out of lit rooms onto the rock.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < SECTION_COUNT; i++) {
        const b = shown.current[i];
        if (b < 0.1) continue;
        const level = Math.floor(i / SECTIONS_PER_LEVEL) + 1, col = i % SECTIONS_PER_LEVEL;
        const cx = g.x(col) + g.roomW / 2, cy = g.y(level) + ROOM_H / 2, r = g.roomW * 0.75;
        const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
        gl.addColorStop(0, `rgba(255,180,90,${0.13 * b})`); gl.addColorStop(1, 'rgba(255,180,90,0)');
        ctx.fillStyle = gl; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      // Power flowing along the floor pipes of every level that has it.
      const pipeW = width - GUTTER_L - GUTTER_R;
      for (let level = 1; level <= LEVELS && !reduce; level++) {
        let lit = 0;
        for (let c = 0; c < SECTIONS_PER_LEVEL; c++) if (shown.current[(level - 1) * SECTIONS_PER_LEVEL + c] > 0.3) lit++;
        if (lit < SECTIONS_PER_LEVEL / 2) continue;
        const py = g.y(level) + ROOM_H + 2;
        for (let d = 0; d < 2; d++) {
          const px = GUTTER_L + ((t * (34 + hash(level, 70) * 20) + hash(level, d + 71) * pipeW + d * pipeW / 2) % pipeW);
          const pg = ctx.createRadialGradient(px, py, 0, px, py, 6);
          pg.addColorStop(0, 'rgba(255,205,130,0.75)'); pg.addColorStop(1, 'rgba(255,205,130,0)');
          ctx.fillStyle = pg; ctx.fillRect(px - 6, py - 6, 12, 12);
        }
      }
      ctx.globalCompositeOperation = 'source-over';

      // Rooms.
      ctx.font = '500 10px "Barlow Semi Condensed", system-ui, sans-serif';
      for (let level = 1; level <= LEVELS; level++) {
        const y = g.y(level), h = ROOM_H;
        ctx.textAlign = 'right';
        ctx.fillStyle = level % 5 === 0 || level === 1 ? '#d5dbe2' : '#7d8794';
        ctx.fillText(String(level), SHAFT_X - 5, y + h / 2 + 0.5);
        for (let col = 0; col < SECTIONS_PER_LEVEL; col++) {
          const i = (level - 1) * SECTIONS_PER_LEVEL + col;
          const s = frame.sections[i];
          if (!s) continue;
          const x = g.x(col), w = g.roomW, st = stateOf(s);
          // A light that is losing power flickers on its way out.
          let b = shown.current[i];
          if (b > 0.04 && b < 0.58 && !reduce) b *= 0.55 + 0.45 * Math.abs(Math.sin(t * 31 + i * 3.7));
          ctx.save();
          ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.clip();

          if (st === 'empty') {
            ctx.fillStyle = '#2b3037'; ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = '#3c434d'; ctx.lineWidth = 1; ctx.beginPath();
            for (let d = -h; d < w; d += 5) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); }
            ctx.stroke();
          } else {
            const bad = st === 'dark' && s.co2 >= AIR_BAD;
            // Back wall: lamp-lit warm, or dark blue-black; dark red when the air has gone bad.
            const lit = Math.max(0, Math.min(1, b));
            const warm = lit >= 0.6 ? (lit - 0.6) / 0.4 : 0;
            const top = lit >= 0.6 ? rgb(LAMP_DIM, LAMP_HOT, warm) : rgb(bad ? [40, 12, 14] : [11, 14, 20], LAMP_DIM, lit / 0.6);
            const bottom = lit >= 0.6 ? rgb([88, 64, 38], LAMP_WARM, warm) : rgb(bad ? [26, 8, 10] : [8, 10, 15], [88, 64, 38], lit / 0.6);
            const wall = ctx.createLinearGradient(0, y, 0, y + h);
            wall.addColorStop(0, top); wall.addColorStop(1, bottom);
            ctx.fillStyle = wall; ctx.fillRect(x, y, w, h);
            if (lit > 0.05) { // the lamp and its cone of light
              const shimmer = reduce ? 1 : 0.94 + 0.06 * Math.sin(t * 5.3 + i * 1.9); // lamps hum a little
              ctx.fillStyle = `rgba(255,246,220,${lit * shimmer})`; ctx.fillRect(x + w * 0.42, y + 1, w * 0.16, 1.5);
              ctx.fillStyle = `rgba(255,235,190,${0.16 * lit * shimmer})`;
              ctx.beginPath(); ctx.moveTo(x + w * 0.42, y + 2.5); ctx.lineTo(x + w * 0.58, y + 2.5);
              ctx.lineTo(x + w * 0.85, y + h); ctx.lineTo(x + w * 0.15, y + h); ctx.fill();
              if (lit > 0.6 && !reduce) { // dust drifting down through the light
                ctx.fillStyle = `rgba(255,250,235,${0.55 * lit})`;
                for (let q = 0; q < 2; q++) {
                  const dy = ((t * (2.5 + q) + hash(i, q + 50) * h) % (h - 4)) + 3;
                  ctx.fillRect(x + w * 0.5 + Math.sin(t * 0.7 + i + q * 2) * w * 0.18, y + dy, 1, 1);
                }
              }
            }
            if (bad) { // emergency strip and a red haze
              const p = reduce ? 0.8 : 0.45 + 0.55 * Math.max(0, Math.sin(t * 3.2 + i));
              ctx.fillStyle = `rgba(255,70,55,${0.9 * p})`; ctx.fillRect(x, y, w, 1.5);
              ctx.fillStyle = `rgba(200,40,40,${0.22 * p})`; ctx.fillRect(x, y, w, h);
            }
            // People: more figures in more crowded rooms.
            const n = Math.max(1, Math.min(6, Math.round((s.people / peopleMax) * 6)));
            const figure = lit > 0.3 ? 'rgba(52,34,18,0.9)' : bad ? 'rgba(255,140,130,0.28)' : 'rgba(140,165,200,0.22)';
            ctx.fillStyle = figure;
            for (let p = 0; p < n && w > 18; p++) {
              // People move about while the lights are on, and stand still in the dark.
              const roam = lit > 0.3 && !reduce ? Math.sin(t * (0.25 + hash(i, p + 30) * 0.35) + hash(i, p + 31) * 6.3) * Math.min(7, (w - 22) * 0.2) : 0;
              const fx = Math.max(x + 3, Math.min(x + w - 6, x + 6 + hash(i, p) * (w - 22) + roam)), fh = 6 + hash(i, p + 9) * 2.5;
              ctx.beginPath(); ctx.arc(fx + 1.5, y + h - fh - 2.2, 1.7, 0, 7); ctx.fill();
              ctx.beginPath(); ctx.roundRect(fx, y + h - fh, 3, fh, 1.2); ctx.fill();
            }
            if (s.structures.includes('fan')) { // a fan that turns with the power
              const cx = x + 6, cy = y + 6, a = t * 10 * (st === 'lit' ? lit : 0) + i;
              ctx.strokeStyle = lit > 0.3 ? 'rgba(60,40,20,0.8)' : 'rgba(150,170,200,0.3)'; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.stroke();
              for (let bl = 0; bl < 3; bl++) {
                const ang = a + (bl * Math.PI * 2) / 3;
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * 3.4, cy + Math.sin(ang) * 3.4); ctx.stroke();
              }
            }
          }
          ctx.restore();

          if (s.structures.includes('plant') && !s.lost) { // a geothermal plant: a glowing core fed from below
            const cx = x + w - 8, cy = y + h / 2 + 1;
            const pulse = reduce ? 1 : 0.75 + 0.25 * Math.sin(t * 2.4 + i);
            const on = st === 'lit' ? 1 : 0.35;
            ctx.fillStyle = '#20262e'; ctx.fillRect(cx - 1, cy, 2, y + ROW + 2 - cy);
            const core = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, 9);
            core.addColorStop(0, `rgba(255,250,220,${on * pulse})`); core.addColorStop(0.35, `rgba(255,150,60,${0.85 * on * pulse})`);
            core.addColorStop(1, 'rgba(255,120,40,0)');
            ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fill();
            for (let k = 0; k < 3 && !reduce && st === 'lit'; k++) { // steam rising off the core
              const ph = (t * 0.45 + k / 3 + hash(i, 80)) % 1;
              ctx.fillStyle = `rgba(235,225,215,${0.3 * (1 - ph)})`;
              ctx.beginPath(); ctx.arc(cx + Math.sin(ph * 6 + k) * 1.5, cy - 4 - ph * 9, 1.2 + ph * 2.4, 0, 7); ctx.fill();
            }
            ctx.strokeStyle = 'rgba(30,24,20,0.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, 4.2, 0, 7); ctx.stroke();
          }
        }
      }

      // Sparks from lamps that just died.
      for (const p of sparks) {
        ctx.fillStyle = `rgba(255,${Math.round(180 + 60 * p.life)},120,${Math.min(1, p.life * 2)})`;
        ctx.fillRect(p.x, p.y, 1.6, 1.6);
      }

      // The blackout line: below it, levels have no air or fans.
      const { line, darkLevels } = blackoutLine(frame);
      if (darkLevels > 0) {
        const most = darkLevels >= 0.9 * LEVELS;
        const yy = most ? g.top - 7 : g.y(line + 1) - GAP_Y / 2;
        const glow = ctx.createLinearGradient(0, yy - 8, 0, yy + 8);
        glow.addColorStop(0, 'rgba(240,101,79,0)'); glow.addColorStop(0.5, 'rgba(240,101,79,0.35)'); glow.addColorStop(1, 'rgba(240,101,79,0)');
        ctx.fillStyle = glow; ctx.fillRect(GUTTER_L - 6, yy - 8, width - GUTTER_L - GUTTER_R + 12, 16);
        ctx.strokeStyle = '#ff7a63'; ctx.lineWidth = 2; ctx.setLineDash([8, 5]); ctx.lineDashOffset = -t * 12;
        ctx.beginPath(); ctx.moveTo(GUTTER_L - 6, yy); ctx.lineTo(width - GUTTER_R + 6, yy); ctx.stroke(); ctx.setLineDash([]);
        const text = most ? 'Almost the whole Hollow is dark' : `Blackout below level ${line}: no air or fans`;
        ctx.font = '700 11.5px "Barlow Semi Condensed", system-ui, sans-serif';
        const tw = ctx.measureText(text).width, bx = width - GUTTER_R - tw - 14, by = yy - 10;
        ctx.fillStyle = '#ff6b55'; ctx.beginPath(); ctx.roundRect(bx, by, tw + 14, 20, 10); ctx.fill();
        ctx.fillStyle = '#2a0904'; ctx.textAlign = 'left'; ctx.fillText(text, bx + 7, by + 10.5);
      }

      // Your home (blue, with a tag) and the hovered room (white).
      const box = (tt: { level: number; col: number } | null | undefined, color: string, lw: number) => {
        if (!tt || tt.level < 1 || tt.level > LEVELS) return;
        ctx.strokeStyle = color; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.roundRect(g.x(tt.col) - 2, g.y(tt.level) - 2, g.roomW + 4, ROOM_H + 4, 6); ctx.stroke();
      };
      box(hoverRef.current, 'rgba(255,255,255,0.9)', 1.5);
      if (selected) {
        box(selected, '#6cb6ff', 2.5);
        const hx = g.x(selected.col), hy = g.y(selected.level) - 2;
        ctx.font = '700 10px "Barlow Semi Condensed", system-ui, sans-serif';
        ctx.fillStyle = '#6cb6ff'; ctx.beginPath(); ctx.roundRect(hx, hy - 12, 34, 12, 6); ctx.fill();
        ctx.fillStyle = '#06121f'; ctx.textAlign = 'left'; ctx.fillText('Home', hx + 6, hy - 5.5);
      }

      if (!reduce) schedule();
    };
    // ~30 frames a second is enough for lamps, fans and the lift.
    const loop = (now: number) => { raf = 0; if (now - lastDraw >= 32) { lastDraw = now; draw(now); } else schedule(); };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(loop); };
    kickRef.current = () => { if (reduce) { if (!raf) raf = requestAnimationFrame(draw); } else schedule(); };

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
      const tt = hit(e);
      const key = tt ? `${tt.level}:${tt.col}` : '';
      if (key === lastKey) return;
      lastKey = key; hoverRef.current = tt; propsRef.current.onHover(tt); kickRef.current();
    };
    const onLeave = () => { lastKey = ''; hoverRef.current = null; propsRef.current.onHover(null); kickRef.current(); };
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', onLeave);
    const ro = new ResizeObserver(() => kickRef.current()); ro.observe(host);
    document.fonts?.ready.then(() => kickRef.current());
    kickRef.current();
    return () => {
      cancelAnimationFrame(raf); raf = 0; kickRef.current = () => {};
      cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerleave', onLeave); ro.disconnect();
    };
  }, []);

  useEffect(() => { kickRef.current(); }, [props.frame, props.selected]);

  return (
    <div ref={hostRef} className="flat-world">
      <canvas ref={canvasRef} aria-label="Cutaway of the Hollow: 50 levels, 8 sections each. Hover a section to see its values." />
    </div>
  );
}
