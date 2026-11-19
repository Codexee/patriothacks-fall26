// UI branch: an illustrated cutaway of the Hollow, drawn smooth at device resolution (the old pixel-art PixiJS scene is
// still in world/index.tsx; ?pixel shows it). Rock strata, a dusk surface with the machines' lights, a lift shaft,
// pipes, and rooms with lamps, people, fans and geothermal plants. The light tells the state: warm lamp light = power,
// dimmer = saving power, black = blackout (no air or fans), pulsing red = blackout and the air is unsafe.
import { useEffect, useRef } from 'react';
import { LEVELS, SECTIONS_PER_LEVEL, SECTION_COUNT, type Frame, type WorldProps } from '../sim/types.ts';

const GUTTER_L = 44, GUTTER_R = 10, SURFACE = 78, CRUST = 14, ROW = 28, GAP_X = 4, GAP_Y = 4;
/** Levels down to here are old subway tunnels (tiled vaults, rails); below are old mine galleries (rough rock, timber). */
const SUBWAY_LEVELS = 18;

/**
 * One section of a level is a neighborhood of the tunnel city, not a room: thousands of people living in blocks built
 * inside an old subway tunnel or mine gallery. Its shapes do not change between frames, so they are built once.
 */
interface District {
  shell: Path2D; // the tunnel's outline (clip)
  ribs: Path2D; // vault ribs or timber props
  blocks: Path2D; // housing blocks along the floor and stacked up the walls
  windows: { x: number; y: number; k: number }[]; // k: lights up when the lit share is above k
  rails: Path2D;
  lamps: number[]; // x of each ceiling lamp
  subway: boolean;
  x: number; y: number; w: number; h: number;
}
function buildDistrict(i: number, level: number, x: number, y: number, w: number, h: number): District {
  const subway = level <= SUBWAY_LEVELS;
  const shell = new Path2D();
  if (subway) shell.roundRect(x, y, w, h, [h * 0.55, h * 0.55, 2, 2]);
  else { // a rough-hewn gallery: jagged ceiling, near-straight walls
    shell.moveTo(x, y + h);
    shell.lineTo(x, y + 3 + hash(i, 1) * 3);
    for (let px = x + 4; px < x + w - 2; px += 4 + hash(i, px) * 4) shell.lineTo(px, y + hash(i, px + 7) * 3.5);
    shell.lineTo(x + w, y + 3 + hash(i, 2) * 3); shell.lineTo(x + w, y + h); shell.closePath();
  }
  const ribs = new Path2D();
  for (let px = x + 5 + hash(i, 3) * 4; px < x + w - 2; px += subway ? 9 : 13) {
    if (subway) { ribs.moveTo(px, y + 1); ribs.lineTo(px, y + h); }
    else { ribs.rect(px, y + 2, 1.6, h - 2); ribs.rect(px - 2, y + 2, 5.6, 1.4); } // timber prop and cap
  }
  // Housing: deeper = more crowded, built higher and tighter (the brief: deep levels are darker and more crowded).
  const crowd = 0.35 + 0.65 * ((level - 1) / (LEVELS - 1));
  const blocks = new Path2D();
  const windows: District['windows'] = [];
  const floor = y + h - 4; // leave room for the rails
  for (let bx = x + 1; bx < x + w - 2;) {
    const bw = 4 + hash(i, bx) * (subway ? 6 : 4);
    if (hash(i, bx + 3) < 0.18 - crowd * 0.12) { bx += bw * 0.6; continue; } // a gap: a street or square
    const bh = Math.min(h - 6, 4 + hash(i, bx + 5) * (5 + crowd * 9));
    blocks.rect(bx, floor - bh, bw - 0.8, bh);
    for (let wy = floor - bh + 1.5; wy < floor - 1; wy += 2.6) {
      for (let wx = bx + 1; wx < bx + bw - 1.8; wx += 2.2) windows.push({ x: wx, y: wy, k: hash(i * 7 + wx, wy) });
    }
    bx += bw;
  }
  const rails = new Path2D();
  rails.rect(x, y + h - 2.6, w, 0.7); rails.rect(x, y + h - 1.2, w, 0.7);
  for (let px = x + 1; px < x + w; px += 3) rails.rect(px, y + h - 3, 0.8, 3); // ties
  const lamps: number[] = [];
  const nl = Math.max(2, Math.round(w / 26));
  for (let q = 0; q < nl; q++) lamps.push(x + ((q + 0.5) * w) / nl);
  return { shell, ribs, blocks, windows, rails, lamps, subway, x, y, w, h };
}

/**
 * PERFORMANCE: a section's still picture depends only on its state, so each state is painted once for all 400
 * sections into its own sheet. Every frame then just copies rectangles from the sheets (and blends two of them while
 * the light changes), and only the small moving parts are drawn live.
 */
type Mode = 'lit' | 'dim' | 'dark' | 'bad' | 'empty';
type Sheets = Record<Mode, HTMLCanvasElement>;
function paintSheet(mode: Mode, cw: number, ch: number, dpr: number, districts: District[], structs: string[][]): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lit = mode === 'lit' ? 1 : mode === 'dim' ? 0.6 : 0;
  const warm = mode === 'lit' ? 1 : 0, bad = mode === 'bad';
  for (let i = 0; i < districts.length; i++) {
    const D = districts[i], { x, y, w, h } = D, st = structs[i] ?? [];
    ctx.save(); ctx.clip(D.shell);
    if (mode === 'empty') { // abandoned: grey, unlit
      ctx.fillStyle = '#23272d'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#2f343b'; ctx.fill(D.blocks);
      ctx.strokeStyle = 'rgba(60,66,76,0.8)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let d = -h; d < w; d += 6) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); }
      ctx.stroke(); ctx.restore(); continue;
    }
    const top = lit >= 0.6 ? rgb(D.subway ? [150, 128, 96] : [120, 92, 64], LAMP_HOT, warm * 0.75) : rgb(bad ? [36, 12, 14] : [12, 15, 21], [110, 90, 64], 0);
    const bottom = lit >= 0.6 ? rgb([70, 52, 34], [150, 108, 64], warm) : rgb(bad ? [22, 8, 10] : [8, 10, 14], [70, 52, 34], 0);
    const wall = ctx.createLinearGradient(0, y, 0, y + h);
    wall.addColorStop(0, top); wall.addColorStop(1, bottom);
    ctx.fillStyle = wall; ctx.fillRect(x, y, w, h);
    if (D.subway) {
      ctx.strokeStyle = `rgba(0,0,0,${0.18 + 0.1 * lit})`; ctx.lineWidth = 0.6; ctx.stroke(D.ribs);
      ctx.fillStyle = `rgba(255,255,255,${0.06 * lit})`; ctx.fillRect(x, y + h * 0.42, w, 0.6);
    } else { ctx.fillStyle = lit > 0 ? 'rgba(60,40,22,0.55)' : 'rgba(30,30,34,0.6)'; ctx.fill(D.ribs); }
    if (lit > 0) {
      for (const lx of D.lamps) {
        const pool = ctx.createRadialGradient(lx, y + 2, 0, lx, y + 2, h * 1.1);
        pool.addColorStop(0, `rgba(255,236,190,${0.32 * lit})`); pool.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = pool; ctx.fillRect(lx - h * 1.1, y, h * 2.2, h);
      }
    }
    ctx.fillStyle = lit > 0 ? rgb([44, 34, 26], [104, 78, 52], lit) : bad ? '#1a0b0d' : '#0d1015';
    ctx.fill(D.blocks);
    const share = lit >= 0.6 ? 0.35 + 0.55 * warm : 0;
    if (share > 0) {
      ctx.fillStyle = `rgba(255,214,140,${0.75 + 0.25 * warm})`;
      ctx.beginPath();
      for (const wn of D.windows) if (wn.k < share) ctx.rect(wn.x, wn.y, 1.1, 1.2);
      ctx.fill();
    }
    ctx.fillStyle = lit > 0 ? 'rgba(30,22,16,0.7)' : 'rgba(60,70,85,0.45)';
    ctx.fill(D.rails);
    if (st.includes('farm')) {
      ctx.fillStyle = lit > 0 ? `rgba(200,120,255,${0.65 * lit})` : 'rgba(80,60,100,0.3)';
      for (let r = 0; r < 3; r++) ctx.fillRect(x + w * 0.08, y + h - 9 - r * 3, w * 0.22, 0.9);
      ctx.fillStyle = lit > 0 ? `rgba(90,170,90,${0.8 * lit})` : 'rgba(40,60,40,0.4)';
      for (let r = 0; r < 3; r++) ctx.fillRect(x + w * 0.08, y + h - 8 - r * 3, w * 0.22, 1.2);
    }
    if (st.includes('clinic')) {
      const cx = x + w * 0.5, cy = y + 6;
      ctx.fillStyle = lit > 0 ? 'rgba(255,255,255,0.9)' : 'rgba(200,210,230,0.3)';
      ctx.fillRect(cx - 2.5, cy - 0.8, 5, 1.6); ctx.fillRect(cx - 0.8, cy - 2.5, 1.6, 5);
    }
    if (st.includes('recycler')) {
      ctx.fillStyle = lit > 0 ? 'rgba(110,180,220,0.85)' : 'rgba(60,80,100,0.4)';
      ctx.beginPath(); ctx.roundRect(x + w * 0.62, y + h - 12, 6, 8, 2); ctx.fill();
    }
    if (lit > 0) {
      ctx.fillStyle = `rgba(255,248,225,${lit})`;
      for (const lx of D.lamps) ctx.fillRect(lx - 1.5, y + (D.subway ? 2.2 : 3), 3, 1.3);
    }
    if (bad) { // a steady part of the emergency light; the pulse is drawn live
      ctx.fillStyle = 'rgba(255,70,55,0.35)'; ctx.fillRect(x, y + (D.subway ? 3 : 4), w, 1.2);
      ctx.fillStyle = 'rgba(200,40,40,0.06)'; ctx.fillRect(x, y, w, h);
    }
    if (st.includes('fan')) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x + 7, y + 6.5, 4.6, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  return cv;
}

/** Soft round glows, made once and stamped with drawImage instead of building a gradient per section per frame. */
function glowSprite(r: number, dpr: number, color: string): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.max(2, Math.ceil(r * 2 * dpr));
  const c = cv.getContext('2d')!;
  const R = cv.width / 2;
  const gr = c.createRadialGradient(R, R, 0, R, R, R);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr; c.fillRect(0, 0, cv.width, cv.height);
  return cv;
}
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

  // The brief: superstorms, fires and poisoned air over dead cities that machines still run. A storm-dark sky, a
  // sickly yellow-green haze low down, and a sun that barely gets through.
  const sky = c.createLinearGradient(0, 0, 0, SURFACE);
  sky.addColorStop(0, '#1c1f22'); sky.addColorStop(0.45, '#3d3b2c'); sky.addColorStop(0.8, '#6f6236'); sky.addColorStop(1, '#8e6a34');
  c.fillStyle = sky; c.fillRect(0, 0, width, SURFACE);
  const sun = c.createRadialGradient(width * 0.72, SURFACE - 10, 2, width * 0.72, SURFACE - 10, 60);
  sun.addColorStop(0, 'rgba(230,210,120,0.45)'); sun.addColorStop(1, 'rgba(200,180,90,0)');
  c.fillStyle = sun; c.fillRect(0, 0, width, SURFACE);
  for (let k = 0; k < 3; k++) { // storm clouds
    c.fillStyle = `rgba(12,14,16,${0.35 - k * 0.08})`;
    c.beginPath();
    for (let x = 0; x <= width; x += 8) c.lineTo(x, 6 + k * 7 + 6 * Math.sin(x / (40 + k * 13) + k * 2) + 3 * Math.sin(x / 11 + k));
    c.lineTo(width, 0); c.lineTo(0, 0); c.closePath(); c.fill();
  }
  for (const [layer, color, maxH] of [[0, '#4a3a40', 40], [1, '#271e24', 28]] as const) {
    c.fillStyle = color;
    for (let x = -10, k = 0; x < width + 20; k++) {
      const w = 12 + hash(k, layer + 3) * 26, h = 10 + hash(k, layer + 9) * maxH;
      c.fillRect(x, SURFACE - h, w, h);
      if (hash(k, layer + 5) > 0.6) c.fillRect(x + w * 0.3, SURFACE - h - 8, 2, 8); // antenna
      if (layer === 0 && hash(k, 21) > 0.55) { // broken top
        c.beginPath(); c.moveTo(x, SURFACE - h); c.lineTo(x + w * 0.5, SURFACE - h - 6); c.lineTo(x + w, SURFACE - h); c.fill();
      }
      // Machines still run some of the dead buildings: a few cold, working lights in the windows.
      if (layer === 1 && hash(k, 31) > 0.5) {
        c.fillStyle = 'rgba(120,225,255,0.75)';
        for (let wy = SURFACE - h + 3; wy < SURFACE - 3; wy += 4) {
          for (let wx = x + 2; wx < x + w - 2; wx += 3) if (hash(wx, wy) > 0.72) c.fillRect(wx, wy, 1.2, 1.4);
        }
        c.fillStyle = color;
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
    c.font = '500 10px "Barlow Semi Condensed", system-ui, sans-serif';
    c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillStyle = level % 5 === 0 || level === 1 ? '#d5dbe2' : '#7d8794';
    c.fillText(String(level), SHAFT_X - 5, y + ROOM_H / 2 + 0.5);
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
    let districts: District[] = [];
    let sheets: Sheets | null = null, sheetKey = '';
    let sprites: { glow: HTMLCanvasElement; glowR: number; pulse: HTMLCanvasElement } | null = null;
    let lastFrame: Frame | null = null, structKey = '';
    let raf = 0, last = performance.now(), lastDraw = 0, peopleMax = 1;
    const prevTarget = new Float32Array(SECTION_COUNT).fill(1);
    let sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    const lift = { pos: 6, target: 1 + Math.floor(hash(0, 90) * LEVELS), wait: 1, hops: 0, halted: false };
    const t0 = performance.now();

    const draw = (now: number) => {
      raf = 0;
      const width = host.clientWidth;
      const g = geometry(width);
      const dpr = Math.min(1.5, window.devicePixelRatio || 1); // sharper than this costs a lot of memory and time
      const key = `${width}x${dpr}`;
      if (key !== staticKey) {
        staticKey = key; staticCv = paintStatic(width, g.height, dpr);
        districts = [];
        for (let i = 0; i < SECTION_COUNT; i++) {
          const level = Math.floor(i / SECTIONS_PER_LEVEL) + 1;
          districts.push(buildDistrict(i, level, g.x(i % SECTIONS_PER_LEVEL), g.y(level), g.roomW, ROOM_H));
        }
        cv.width = Math.round(width * dpr); cv.height = Math.round(g.height * dpr);
        cv.style.width = `${width}px`; cv.style.height = `${g.height}px`;
        const gr = g.roomW * 0.75;
        sprites = { glow: glowSprite(gr, dpr, 'rgba(255,180,90,1)'), glowR: gr, pulse: glowSprite(6, dpr, 'rgba(255,205,130,1)') };
      }
      const { frame, selected } = propsRef.current;
      // Sheets are repainted only when the size changes or a section's facilities change.
      if (frame !== lastFrame) { lastFrame = frame; structKey = frame.sections.map((s) => s.structures.join('')).join('|'); }
      const sk = `${key}:${structKey}`;
      if (sk !== sheetKey) {
        sheetKey = sk;
        const structs = frame.sections.map((s) => s.structures as string[]);
        sheets = {} as Sheets;
        for (const m of ['lit', 'dim', 'dark', 'bad', 'empty'] as Mode[]) sheets[m] = paintSheet(m, cv.width, cv.height, dpr, districts, structs);
      }

      // Only the part of the cutaway on screen is drawn.
      const rect = cv.getBoundingClientRect();
      const visTop = Math.max(0, -rect.top), visBot = Math.min(g.height, window.innerHeight - rect.top);
      if (visBot <= visTop) { if (!reduce) schedule(); return; }
      const firstLevel = Math.max(1, Math.floor((visTop - g.top) / ROW));
      const lastLevel = Math.min(LEVELS, Math.max(firstLevel, Math.ceil((visBot - g.top) / ROW) + 1));

      const ctx = cv.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const by0 = Math.floor(visTop * dpr), bh = Math.min(cv.height, Math.ceil(visBot * dpr)) - by0;
      ctx.drawImage(staticCv!, 0, by0, cv.width, bh, 0, by0, cv.width, bh);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = reduce ? 0 : (now - t0) / 1000;
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
      for (let j = 0; j < 4; j++) { // poisoned air: yellow-green haze drifting over the ruins
        const cx = ((t * (6 + j * 3) + hash(j, 60) * width) % (width + 160)) - 80, cy = 26 + hash(j, 61) * 34;
        const sm = ctx.createRadialGradient(cx, cy, 2, cx, cy, 52);
        sm.addColorStop(0, 'rgba(150,160,60,0.22)'); sm.addColorStop(1, 'rgba(150,160,60,0)');
        ctx.fillStyle = sm; ctx.fillRect(cx - 56, cy - 56, 112, 112);
      }
      for (let j = 0; j < 3; j++) { // fires still burning in the dead city
        const fx = (0.18 + j * 0.31 + hash(j, 62) * 0.08) * width, fy = SURFACE - 2;
        const fl = reduce ? 1 : 0.7 + 0.3 * Math.sin(t * 9 + j * 3) * Math.sin(t * 4.3 + j);
        const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 16 * fl);
        fg.addColorStop(0, `rgba(255,170,70,${0.85 * fl})`); fg.addColorStop(0.4, `rgba(230,90,30,${0.45 * fl})`); fg.addColorStop(1, 'rgba(200,60,20,0)');
        ctx.fillStyle = fg; ctx.fillRect(fx - 18, fy - 18, 36, 20);
        ctx.fillStyle = 'rgba(25,20,18,0.35)'; // its smoke column
        for (let k = 0; k < 4 && !reduce; k++) {
          const ph = (t * 0.25 + k / 4 + j * 0.3) % 1;
          ctx.beginPath(); ctx.arc(fx + Math.sin(ph * 5 + j) * 4 + ph * 10, fy - 6 - ph * 40, 3 + ph * 7, 0, 7); ctx.fill();
        }
      }
      // Superstorm: every few seconds, lightning.
      const strikeCycle = 11, sc = Math.floor(t / strikeCycle), st0 = t - sc * strikeCycle;
      if (!reduce && st0 < 0.22) {
        const flash = st0 < 0.08 || (st0 > 0.13 && st0 < 0.18) ? 1 : 0.35;
        ctx.fillStyle = `rgba(220,230,255,${0.18 * flash})`; ctx.fillRect(0, 0, width, SURFACE);
        ctx.strokeStyle = `rgba(235,240,255,${0.9 * flash})`; ctx.lineWidth = 1.2; ctx.beginPath();
        let lx = (0.15 + hash(sc, 63) * 0.7) * width, ly = 0;
        ctx.moveTo(lx, ly);
        while (ly < SURFACE - 22) { ly += 6 + hash(sc, ly) * 6; lx += (hash(ly, sc) - 0.5) * 14; ctx.lineTo(lx, ly); }
        ctx.stroke();
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

      // The lift: travels between levels and stops to let people on. It needs power: when the level it is at has a
      // blackout, it halts there, dark, until the power comes back.
      const levelDark = (L: number) => {
        let d = 0;
        for (let c2 = 0; c2 < SECTIONS_PER_LEVEL; c2++) if (shown.current[(L - 1) * SECTIONS_PER_LEVEL + c2] < 0.3) d++;
        return d >= SECTIONS_PER_LEVEL / 2;
      };
      const here = Math.max(1, Math.min(LEVELS, Math.round(lift.pos)));
      lift.halted = levelDark(here);
      if (!lift.halted && !reduce) {
        if (lift.wait > 0) lift.wait -= dt;
        else {
          const dist = lift.target - lift.pos, step = Math.sign(dist) * Math.min(Math.abs(dist), dt * Math.min(6, 0.8 + Math.abs(dist) * 1.5));
          lift.pos += step;
          if (Math.abs(lift.target - lift.pos) < 0.01) {
            lift.pos = lift.target; lift.wait = 2.5; lift.hops++;
            lift.target = 1 + Math.floor(hash(lift.hops, 90) * LEVELS);
          }
        }
      }
      const m = lift.halted ? 1 : lift.wait > 0 ? 0 : 1;
      const liftY = g.y(lift.pos) + 2;
      ctx.fillStyle = 'rgba(160,170,185,0.35)'; ctx.fillRect(SHAFT_X + SHAFT_W / 2 - 0.4, g.top - 6, 0.8, liftY - g.top + 6); // cable
      ctx.fillStyle = lift.halted ? '#5a4c38' : '#c9a46a'; ctx.fillRect(SHAFT_X + 2, liftY, SHAFT_W - 4, 13);
      ctx.fillStyle = lift.halted ? `rgba(255,70,55,${reduce ? 0.9 : 0.4 + 0.5 * Math.max(0, Math.sin(t * 4))})` : 'rgba(255,220,150,0.95)';
      ctx.fillRect(SHAFT_X + 3, liftY + 2, SHAFT_W - 6, lift.halted ? 2 : 3); // a stuck lift shows a red emergency light
      if (m === 0) { // stopped: the landing light is on
        const lg = ctx.createRadialGradient(SHAFT_X + SHAFT_W, liftY + 6, 0, SHAFT_X + SHAFT_W, liftY + 6, 14);
        lg.addColorStop(0, 'rgba(255,215,140,0.55)'); lg.addColorStop(1, 'rgba(255,215,140,0)');
        ctx.fillStyle = lg; ctx.fillRect(SHAFT_X - 4, liftY - 8, 30, 28);
      }

      // Light spilling out of lit sections onto the rock, and power flowing along the pipes (pre-made glow sprites).
      ctx.globalCompositeOperation = 'lighter';
      const gr = sprites!.glowR;
      for (let i = (firstLevel - 1) * SECTIONS_PER_LEVEL; i < lastLevel * SECTIONS_PER_LEVEL; i++) {
        const b = shown.current[i];
        if (b < 0.1) continue;
        const D = districts[i];
        ctx.globalAlpha = 0.13 * b;
        ctx.drawImage(sprites!.glow, D.x + D.w / 2 - gr, D.y + D.h / 2 - gr, gr * 2, gr * 2);
      }
      const pipeW = width - GUTTER_L - GUTTER_R;
      ctx.globalAlpha = 0.75;
      for (let level = firstLevel; level <= lastLevel && !reduce; level++) {
        let lit = 0;
        for (let c = 0; c < SECTIONS_PER_LEVEL; c++) if (shown.current[(level - 1) * SECTIONS_PER_LEVEL + c] > 0.3) lit++;
        if (lit < SECTIONS_PER_LEVEL / 2) continue;
        const py = g.y(level) + ROOM_H + 2;
        for (let d = 0; d < 2; d++) {
          const px = GUTTER_L + ((t * (34 + hash(level, 70) * 20) + hash(level, d + 71) * pipeW + d * pipeW / 2) % pipeW);
          ctx.drawImage(sprites!.pulse, px - 6, py - 6, 12, 12);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // Sections: copy each one's look from the cached sheets, blending between states while the light changes.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const copy = (sheet: HTMLCanvasElement, D: District, alpha: number) => {
        if (alpha <= 0.01) return;
        const sx = Math.floor((D.x - 1) * dpr), sy = Math.floor((D.y - 1) * dpr);
        const sw = Math.ceil((D.w + 2) * dpr), sh = Math.ceil((D.h + 2) * dpr);
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(sheet, sx, sy, sw, sh, sx, sy, sw, sh);
      };
      const bright = new Float32Array(SECTION_COUNT);
      for (let i = (firstLevel - 1) * SECTIONS_PER_LEVEL; i < lastLevel * SECTIONS_PER_LEVEL; i++) {
        const s = frame.sections[i];
        if (!s) continue;
        const D = districts[i], st = stateOf(s);
        let b = shown.current[i];
        if (b > 0.04 && b < 0.58 && !reduce) b *= 0.55 + 0.45 * Math.abs(Math.sin(t * 31 + i * 3.7)); // flicker on the way out
        bright[i] = b;
        if (st === 'empty') { copy(sheets!.empty, D, 1); continue; }
        if (b >= 0.6) { copy(sheets!.dim, D, 1); copy(sheets!.lit, D, (b - 0.6) / 0.4); }
        else { copy(st === 'dark' && s.co2 >= AIR_BAD ? sheets!.bad : sheets!.dark, D, 1); copy(sheets!.dim, D, b / 0.6); }
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // The moving parts, batched: people on the streets, hand lights in the dark, dust, fans, the red pulse.
      const peopleLit = new Path2D(), peopleDark = new Path2D(), peopleBad = new Path2D();
      const phones = new Path2D(), phonesBad = new Path2D(), dust = new Path2D();
      const fansLit = new Path2D(), fansDark = new Path2D();
      for (let i = (firstLevel - 1) * SECTIONS_PER_LEVEL; i < lastLevel * SECTIONS_PER_LEVEL; i++) {
        const s = frame.sections[i];
        if (!s || s.lost) continue;
        const D = districts[i], x = D.x, y = D.y, w = D.w, h = D.h, st = stateOf(s);
        const lit = Math.max(0, Math.min(1, bright[i]));
        const bad = st === 'dark' && s.co2 >= AIR_BAD;
        const n = Math.max(2, Math.min(14, Math.round((s.people / peopleMax) * 14)));
        const pp = lit > 0.3 ? peopleLit : bad ? peopleBad : peopleDark;
        for (let p = 0; p < n; p++) {
          const speed = (hash(i, p + 30) - 0.5) * 6;
          const px = x + ((hash(i, p) * w + (lit > 0.3 && !reduce ? t * speed : 0)) % w + w) % w;
          pp.rect(px, y + h - 6.2 - hash(i, p + 9) * 0.8, 1, 2.6);
        }
        if (lit <= 0.05) {
          const ph = bad ? phonesBad : phones;
          for (const wn of D.windows) {
            if (wn.k > 0.035) continue;
            if (!reduce && Math.sin(t * (1.5 + wn.k * 40) + wn.x) < -0.3) continue; // they move and go out
            ph.rect(wn.x, wn.y, 1, 1);
          }
        }
        if (lit > 0.6 && !reduce) {
          for (let q = 0; q < 2; q++) {
            const dy = ((t * (2.5 + q) + hash(i, q + 50) * h) % (h - 4)) + 3;
            dust.rect(D.lamps[q % D.lamps.length] + Math.sin(t * 0.7 + i + q * 2) * 6, y + dy, 1, 1);
          }
        }
        if (bad) {
          const p = reduce ? 0.8 : 0.45 + 0.55 * Math.max(0, Math.sin(t * 3.2 + i));
          ctx.fillStyle = `rgba(255,70,55,${0.6 * p})`; ctx.fillRect(x, y + (D.subway ? 3 : 4), w, 1.2);
        }
        if (s.structures.includes('fan')) {
          const cx = x + 7, cy = y + 6.5, a = t * 10 * (st === 'lit' ? lit : 0) + i;
          const fp = lit > 0.3 ? fansLit : fansDark;
          for (let bl = 0; bl < 3; bl++) {
            const ang = a + (bl * Math.PI * 2) / 3;
            fp.moveTo(cx, cy); fp.lineTo(cx + Math.cos(ang) * 3.8, cy + Math.sin(ang) * 3.8);
          }
        }
      }
      ctx.fillStyle = 'rgba(28,18,10,0.9)'; ctx.fill(peopleLit);
      ctx.fillStyle = 'rgba(160,180,210,0.28)'; ctx.fill(peopleDark);
      ctx.fillStyle = 'rgba(255,150,140,0.35)'; ctx.fill(peopleBad);
      ctx.fillStyle = 'rgba(190,210,255,0.6)'; ctx.fill(phones);
      ctx.fillStyle = 'rgba(255,170,160,0.55)'; ctx.fill(phonesBad);
      ctx.fillStyle = 'rgba(255,250,235,0.5)'; ctx.fill(dust);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(220,200,170,0.75)'; ctx.stroke(fansLit);
      ctx.strokeStyle = 'rgba(150,170,200,0.3)'; ctx.stroke(fansDark);

      // Geothermal plants: a glowing core fed from below, with steam while running.
      for (let i = (firstLevel - 1) * SECTIONS_PER_LEVEL; i < lastLevel * SECTIONS_PER_LEVEL; i++) {
        const s = frame.sections[i];
        if (!s || s.lost || !s.structures.includes('plant')) continue;
        const D = districts[i], st = stateOf(s);
        const cx = D.x + D.w - 8, cy = D.y + D.h / 2 + 1;
        const pulse = reduce ? 1 : 0.75 + 0.25 * Math.sin(t * 2.4 + i);
        const on = st === 'lit' ? 1 : 0.35;
        ctx.fillStyle = '#20262e'; ctx.fillRect(cx - 1, cy, 2, D.y + ROW + 2 - cy);
        const core = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, 9);
        core.addColorStop(0, `rgba(255,250,220,${on * pulse})`); core.addColorStop(0.35, `rgba(255,150,60,${0.85 * on * pulse})`);
        core.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fill();
        for (let k = 0; k < 3 && !reduce && st === 'lit'; k++) {
          const ph = (t * 0.45 + k / 3 + hash(i, 80)) % 1;
          ctx.fillStyle = `rgba(235,225,215,${0.3 * (1 - ph)})`;
          ctx.beginPath(); ctx.arc(cx + Math.sin(ph * 6 + k) * 1.5, cy - 4 - ph * 9, 1.2 + ph * 2.4, 0, 7); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(30,24,20,0.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, 4.2, 0, 7); ctx.stroke();
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
    if (import.meta.env.DEV) Object.assign(window, { __drawHollow: () => draw(performance.now()), __lift: lift }); // dev checks
    document.fonts?.ready.then(() => { staticKey = ''; sheetKey = ''; kickRef.current(); }); // repaint labels in the real font
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
