// The Hollow as a cross-section: 50 levels under the surface, level 1 at the top. Each level is a band
// made of its real counties (County.level); each county is a cell whose width is its population, so
// the width of a band shows how many people live at that depth. During a replay a cell goes dark by
// its percent of customers out. Everything here is computed from the data; nothing is tuned.
import type { Live, Scene } from './data.ts';

export const LEVELS = 50;
export const GROUP = 5;                       // levels per row of numbers
export const GROUPS = LEVELS / GROUP;
export const HOLLOW_PEOPLE = 2_000_000_000;   // the brief: 2 billion people live in the Hollow

export interface Section {
  cis: number[];                 // the counties shown (scene index)
  band: number[][];              // per level (0..49): scene indices, in draw order
  bandPop: Float64Array;         // per level: people
  totalPop: number;
  x0: Map<number, number>;       // scene index -> left edge, 0..1 of the widest band
  w: Map<number, number>;        // scene index -> width, 0..1 of the widest band
}

/** Calm: every county. Replay: the counties in the replay (they stand for the Hollow). */
export function buildSection(scene: Scene, live: Live | null): Section {
  const cis: number[] = [];
  const take = (ci: number) => {
    const c = scene.counties[ci];
    if (c.level != null && c.pop != null && c.pop > 0) cis.push(ci);
  };
  if (live) live.ci.forEach((ci) => { if (ci >= 0) take(ci); });
  else scene.counties.forEach((_, ci) => take(ci));

  const band: number[][] = Array.from({ length: LEVELS }, () => []);
  for (const ci of cis) band[scene.counties[ci].level! - 1].push(ci);
  const bandPop = new Float64Array(LEVELS);
  for (let l = 0; l < LEVELS; l++) {
    // West to east by state, so the counties of one storm sit together in each band.
    band[l].sort((a, b) => scene.centroid[a * 2] - scene.centroid[b * 2]);
    for (const ci of band[l]) bandPop[l] += scene.counties[ci].pop!;
  }
  const widest = Math.max(1, ...bandPop);
  const x0 = new Map<number, number>(), w = new Map<number, number>();
  for (let l = 0; l < LEVELS; l++) {
    let x = (1 - bandPop[l] / widest) / 2;     // centred: the bands make the shape of the cavern
    for (const ci of band[l]) {
      const cw = scene.counties[ci].pop! / widest;
      x0.set(ci, x); w.set(ci, cw);
      x += cw;
    }
  }
  const totalPop = bandPop.reduce((s, v) => s + v, 0);
  return { cis, band, bandPop, totalPop, x0, w };
}

export interface GroupStats {
  people: number;
  hollowPeople: number;     // the share of the people shown x 2 billion (a scaling)
  pctOut: number;           // percent of customers out now
  hoursPerPerson: number;   // hours without power per person so far (sum of percent out / 100)
  dmeDark: number;          // people on powered medical equipment in cells with >= 10% out now
}

/** Numbers for each group of 5 levels at hour h (h is a whole hour index). */
export function groupStats(scene: Scene, live: Live | null, sec: Section, h: number): GroupStats[] {
  const out: GroupStats[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let people = 0, cust = 0, custOut = 0, popHours = 0, dmeDark = 0;
    for (let l = g * GROUP; l < (g + 1) * GROUP; l++) {
      for (const ci of sec.band[l]) {
        const c = scene.counties[ci];
        const pop = c.pop ?? 0;
        people += pop;
        const k = live ? live.slot[ci] : -1;
        if (k < 0) { cust += c.customers ?? 0; continue; }
        const pct = live!.replay.counties[k].out[h] ?? 0;
        const cu = c.customers ?? 0;
        cust += cu;
        custOut += (cu * pct) / 100;
        popHours += pop * live!.cumOut[k][h];
        if (pct >= 10) dmeDark += c.dme ?? 0;
      }
    }
    out.push({
      people,
      hollowPeople: sec.totalPop > 0 ? (people / sec.totalPop) * HOLLOW_PEOPLE : 0,
      pctOut: cust > 0 ? (custOut / cust) * 100 : 0,
      hoursPerPerson: people > 0 ? popHours / people : 0,
      dmeDark,
    });
  }
  return out;
}

/** Hours without power per person over the whole replay, for the deepest and the top `n` levels. */
export function deepVsTop(scene: Scene, live: Live, sec: Section, n = 10): { deep: number; top: number } {
  const last = live.replay.hours - 1;
  const avg = (from: number, to: number) => {
    let pop = 0, ph = 0;
    for (let l = from; l < to; l++) for (const ci of sec.band[l]) {
      const p = scene.counties[ci].pop ?? 0;
      pop += p;
      ph += p * live.cumOut[live.slot[ci]][last];
    }
    return pop > 0 ? ph / pop : 0;
  };
  return { deep: avg(LEVELS - n, LEVELS), top: avg(0, n) };
}

export interface FairRotation {
  ba: string;
  counties: number;
  actual: (number | null)[];  // per group: hours without power per person, whole event, in the BA
  fair: number;               // the same for every county under fair rotation
  deepActual: number;         // the deepest 10 levels, actual
  spared: number;             // deepActual - fair (negative = fair rotation would add hours there)
}

/** Fair rotation: the same customers out in each hour, spread evenly over every county of the
 *  balancing area (each county's percent out = the area's percent out that hour). A what-if. */
export function fairRotation(scene: Scene, live: Live): FairRotation | null {
  const { replay } = live;
  const ks: number[] = [];
  replay.counties.forEach((_, k) => {
    const ci = live.ci[k];
    if (ci < 0) return;
    const c = scene.counties[ci];
    if (c.ba === replay.ba && c.level != null && (c.pop ?? 0) > 0 && (c.customers ?? 0) > 0) ks.push(k);
  });
  if (ks.length < 10) return null;
  let cust = 0;
  for (const k of ks) cust += scene.counties[live.ci[k]].customers!;
  let fair = 0;
  for (let h = 0; h < replay.hours; h++) {
    let o = 0;
    for (const k of ks) o += scene.counties[live.ci[k]].customers! * (replay.counties[k].out[h] ?? 0);
    fair += o / cust / 100;
  }
  const last = replay.hours - 1;
  const pop = new Float64Array(GROUPS), ph = new Float64Array(GROUPS);
  let dp = 0, dph = 0;
  for (const k of ks) {
    const c = scene.counties[live.ci[k]];
    const g = Math.floor((c.level! - 1) / GROUP);
    const hrs = live.cumOut[k][last];
    pop[g] += c.pop!; ph[g] += c.pop! * hrs;
    if (c.level! > LEVELS - 10) { dp += c.pop!; dph += c.pop! * hrs; }
  }
  const actual = Array.from(pop, (p, g) => (p > 0 ? ph[g] / p : null));
  const deepActual = dp > 0 ? dph / dp : 0;
  return { ba: replay.ba, counties: ks.length, actual, fair, deepActual, spared: deepActual - fair };
}

// ------------------------------------------------------------------ painter

type RGB = [number, number, number];
function cssColor(name: string, fallback: RGB): RGB {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

export interface Geometry { left: number; top: number; width: number; bandH: number; gap: number; surface: number }

/** Draws the cross-section on a canvas. paint() is cheap enough to run on every clock tick. */
export class HollowPainter {
  private ctx: CanvasRenderingContext2D;
  private lit: RGB; private dark: RGB; private deep: RGB;
  private skyline: { x: number; w: number; h: number }[] = [];
  geo: Geometry = { left: 0, top: 0, width: 0, bandH: 0, gap: 0, surface: 0 };
  highlight = new Set<number>();

  constructor(private canvas: HTMLCanvasElement, private scene: Scene) {
    this.ctx = canvas.getContext('2d')!;
    this.lit = cssColor('--lit', [242, 196, 107]);
    this.dark = cssColor('--dark', [5, 6, 10]);
    this.deep = [196, 74, 36];
    // A dead skyline: fixed, so the picture does not change between frames.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = 0; x < 1; ) {
      const w = 0.004 + rnd() * 0.018;
      this.skyline.push({ x, w, h: rnd() < 0.18 ? 0 : 0.15 + rnd() * rnd() * 0.85 });
      x += w + rnd() * 0.004;
    }
  }

  resize(cssW: number, cssH: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const surface = Math.min(44, cssH * 0.06);
    const gap = cssH > 600 ? 2 : 1;
    const bandH = (cssH - surface - 6 - gap * (LEVELS - 1)) / LEVELS;
    this.geo = { left: 0, top: surface + 6, width: cssW, bandH, gap, surface };
  }

  bandY(l: number) { return this.geo.top + l * (this.geo.bandH + this.geo.gap); }

  /** The county under a point, or -1. */
  pick(sec: Section, x: number, y: number): number {
    const { top, bandH, gap, width } = this.geo;
    const l = Math.floor((y - top) / (bandH + gap));
    if (l < 0 || l >= LEVELS || y - this.bandY(l) > bandH) return -1;
    const u = x / width;
    for (const ci of sec.band[l]) {
      const x0 = sec.x0.get(ci)!, w = sec.w.get(ci)!;
      if (u >= x0 && u <= x0 + Math.max(w, 2 / width)) return ci;
    }
    return -1;
  }

  paint(sec: Section, live: Live | null, hour: number) {
    const { ctx } = this;
    const { width, bandH, surface } = this.geo;
    const W = width;
    ctx.clearRect(0, 0, W, this.canvas.height);

    // The surface: a dead skyline on the ground line.
    ctx.fillStyle = '#1b2029';
    for (const b of this.skyline) if (b.h > 0) ctx.fillRect(b.x * W, surface - b.h * surface, Math.max(1, b.w * W), b.h * surface);
    ctx.fillStyle = '#3a414d';
    ctx.fillRect(0, surface, W, 1.5);

    const h0 = Math.floor(hour), f = hour - h0;
    const [lr, lg, lb] = this.lit, [dr, dg, db] = this.dark, [er, eg, eb] = this.deep;
    for (let l = 0; l < LEVELS; l++) {
      const y = this.bandY(l);
      const t = l / (LEVELS - 1);
      // Deeper levels: warmer and dimmer by default (the brief: darker, hotter, sicker).
      const dim = 1 - 0.42 * t;
      const br = (lr + (er - lr) * t) * dim, bg = (lg + (eg - lg) * t) * dim, bb = (lb + (eb - lb) * t) * dim;
      for (const ci of sec.band[l]) {
        const x = sec.x0.get(ci)! * W, w = Math.max(0.6, sec.w.get(ci)! * W);
        let o = 0;
        const k = live ? live.slot[ci] : -1;
        if (k >= 0) {
          const arr = live!.replay.counties[k].out;
          const a = arr[Math.min(arr.length - 1, h0)] ?? 0, b = arr[Math.min(arr.length - 1, h0 + 1)] ?? 0;
          o = Math.min(1, (a + (b - a) * f) / 100) ** 0.55;
        }
        ctx.fillStyle = `rgb(${br + (dr - br) * o | 0},${bg + (dg - bg) * o | 0},${bb + (db - bb) * o | 0})`;
        ctx.fillRect(x, y, w, bandH);
      }
    }
    // Cells to check first: a thin ring, at least 4 px wide so a small county is still visible.
    if (this.highlight.size) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 1.5;
      for (const ci of this.highlight) {
        const lvl = this.scene.counties[ci].level;
        if (lvl == null || !sec.x0.has(ci)) continue;
        const w = Math.max(4, sec.w.get(ci)! * W);
        const x = sec.x0.get(ci)! * W + Math.min(0, sec.w.get(ci)! * W - w) / 2;
        ctx.strokeRect(x - 1, this.bandY(lvl - 1) - 1, w + 2, bandH + 2);
      }
    }
  }
}
