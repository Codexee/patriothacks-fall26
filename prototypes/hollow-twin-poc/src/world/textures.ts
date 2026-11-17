// PROTOTYPE: procedural pixel textures. Everything is drawn into pixel buffers, so no asset files are needed.
import { CanvasSource, Texture } from 'pixi.js';
import { LEVELS, SECTIONS_PER_LEVEL } from '../sim/types.ts';
import {
  C, CRUST_H, GROUND_H, LABEL_W, ROOM_H, SURFACE_H, WALL_W, type Layout, type RGB,
} from './palette.ts';

// ---------- helpers ----------
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number) { return t * t * (3 - 2 * t); }
export function valueNoise(x: number, y: number, cell: number, seed = 0): number {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
  const fx = smooth(x / cell - gx), fy = smooth(y / cell - gy);
  const a = hash2(gx, gy, seed), b = hash2(gx + 1, gy, seed), c = hash2(gx, gy + 1, seed), d = hash2(gx + 1, gy + 1, seed);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered dither of v (0..1) into `bands` levels; returns 0..bands. */
function dither(v: number, x: number, y: number, bands: number): number {
  const t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  return Math.max(0, Math.min(bands, Math.floor(v * bands + t)));
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

class Px {
  data: Uint8ClampedArray;
  constructor(public w: number, public h: number) { this.data = new Uint8ClampedArray(w * h * 4); }
  set(x: number, y: number, c: RGB, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = a;
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }
  vline(x: number, y0: number, y1: number, c: RGB) { for (let y = y0; y <= y1; y++) this.set(x, y, c); }
  hline(x0: number, x1: number, y: number, c: RGB) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }
  texture(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = this.w; canvas.height = this.h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: 'nearest' }) });
  }
}

// ---------- pixel font (3x5) ----------
const GLYPHS: Record<string, string[]> = {
  L: ['100', '100', '100', '100', '111'],
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
};
function text(p: Px, s: string, x: number, y: number, c: RGB) {
  for (const ch of s) {
    const g = GLYPHS[ch];
    if (g) g.forEach((row, j) => [...row].forEach((b, i) => b === '1' && p.set(x + i, y + j, c)));
    x += 4;
  }
}

// ---------- static background: surface, rock, rooms, labels ----------
export function backgroundTexture(L: Layout): Texture {
  const { artW: W, artH: H } = L;
  const p = new Px(W, H);
  const groundY = SURFACE_H - GROUND_H;

  // rock everywhere below the sky
  for (let y = groundY; y < H; y++) {
    const dt = Math.min(1, Math.max(0, (y - SURFACE_H) / (H - SURFACE_H)));
    const base = mix(C.rockTop, C.rockDeep, Math.pow(dt, 0.8));
    for (let x = 0; x < W; x++) {
      const n = valueNoise(x, y, 7, 3) - 0.5;
      const chunk = hash2(x >> 1, y >> 1, 9) - 0.5;
      const q = Math.round((n * 0.45 + chunk * 0.14) / 0.07) * 0.07;
      let c = shade(base, 1 + q);
      const r = hash2(x, y, 17);
      if (r > 0.9965) c = mix(base, dt > 0.5 ? C.crystal : C.ore, 0.85);
      p.set(x, y, c);
    }
  }

  // sky with dithered bands and a hazy sun
  const sunX = Math.round(W * 0.72), sunY = Math.round(groundY * 0.42);
  for (let y = 0; y < groundY; y++) {
    for (let x = 0; x < W; x++) {
      const t = y / groundY;
      const band = dither(t, x, y, 10) / 10;
      let c = band < 0.55 ? mix(C.skyTop, C.skyMid, band / 0.55) : mix(C.skyMid, C.skyLow, (band - 0.55) / 0.45);
      const d = Math.hypot(x - sunX, (y - sunY) * 1.1);
      if (d < 26) c = mix(c, C.sun, (dither(1 - d / 26, x, y, 4) / 4) * 0.55);
      if (d < 6) c = C.sun;
      p.set(x, y, c);
    }
  }

  // ruined skyline: far layer, then near layer with windows
  const skyline = (seed: number, minH: number, maxH: number, color: RGB, windows: boolean) => {
    let x = -3, i = 0;
    while (x < W) {
      const bw = 8 + Math.floor(hash2(i, 1, seed) * 18);
      const bh = minH + Math.floor(hash2(i, 2, seed) * (maxH - minH));
      const broken = hash2(i, 3, seed) > 0.45;
      for (let bx = 0; bx < bw; bx++) {
        let top = groundY - bh;
        if (broken) top += Math.floor(Math.max(0, (bx - bw * 0.4)) * (0.6 + hash2(i, 4, seed)) + hash2(bx, i, seed) * 2);
        p.vline(x + bx, top, groundY - 1, color);
      }
      if (windows) {
        for (let wy = groundY - bh + 3; wy < groundY - 3; wy += 4) {
          for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
            const r = hash2(wx, wy, seed + 5);
            if (r < 0.35) continue;
            p.set(wx, wy, r > 0.95 ? C.windowLit : C.windowDark);
          }
        }
        p.hline(x, x + 1, groundY - bh, C.ruinRim);
      }
      x += bw + Math.floor(hash2(i, 5, seed) * 6);
      i++;
    }
  };
  skyline(11, 10, 34, C.ruinFar, false);
  skyline(23, 6, 26, C.ruinNear, true);

  // machines on the surface
  const M = C.ruinNear, R = C.ruinRim;
  // tower crane
  const cx = Math.round(W * 0.14), cTop = groundY - 52;
  for (let y = cTop; y < groundY; y++) { p.set(cx, y, M); p.set(cx + 3, y, M); if ((y - cTop) % 4 === 0) p.line(cx, y, cx + 3, y + 3, M); }
  p.hline(cx - 10, cx + 34, cTop, M); p.hline(cx - 10, cx + 34, cTop + 2, M);
  for (let x = cx - 10; x <= cx + 34; x += 3) p.line(x, cTop, x + 2, cTop + 2, M);
  p.rect(cx - 10, cTop + 1, 5, 4, M); // counterweight
  p.vline(cx + 26, cTop + 3, cTop + 22, M); p.rect(cx + 25, cTop + 22, 3, 2, M);
  p.hline(cx - 10, cx + 34, cTop - 1, R);
  // power pylon
  const px = Math.round(W * 0.47), pTop = groundY - 40;
  for (let y = pTop; y < groundY; y++) {
    const spread = Math.floor((y - pTop) / 5);
    p.set(px - spread, y, M); p.set(px + spread, y, M);
    if ((y - pTop) % 6 === 0) p.hline(px - spread, px + spread, y, M);
  }
  p.hline(px - 9, px + 9, pTop + 6, M); p.hline(px - 6, px + 6, pTop + 13, M);
  p.line(px + 9, pTop + 7, px + 22, pTop + 16, M); // sagging broken cable
  // shaft headframe over the way down
  const hx = Math.round(W * 0.6);
  p.line(hx - 8, groundY - 1, hx, groundY - 30, M); p.line(hx + 8, groundY - 1, hx, groundY - 30, M);
  p.line(hx + 8, groundY - 1, hx + 16, groundY - 22, M);
  p.rect(hx - 3, groundY - 33, 7, 4, M); p.hline(hx - 3, hx + 3, groundY - 34, R);
  p.hline(hx - 6, hx + 6, groundY - 12, M);
  // broken wind turbine
  const tx = Math.round(W * 0.86), tTop = groundY - 44;
  p.vline(tx, tTop, groundY - 1, M); p.vline(tx + 1, tTop + 4, groundY - 1, M);
  p.rect(tx - 1, tTop - 1, 4, 3, M);
  p.line(tx, tTop, tx - 3, tTop - 16, M); p.line(tx + 1, tTop, tx + 15, tTop + 7, M);
  p.line(tx, tTop + 2, tx - 5, tTop + 8, M); // snapped blade
  p.line(tx + 18, groundY - 1, tx + 24, groundY - 3, M); // fallen tip
  // radar dish
  const dx = Math.round(W * 0.31), dy = groundY - 22;
  for (let a = 0; a <= 12; a++) { const ang = Math.PI * (0.85 + a / 12 * 0.9); p.set(dx + Math.round(Math.cos(ang) * 8), dy + Math.round(Math.sin(ang) * 8), M); }
  p.line(dx - 6, dy + 3, dx + 6, dy - 5, M); p.vline(dx, dy, groundY - 1, M); p.line(dx, dy, dx + 4, dy - 4, M);

  // ground band
  for (let y = groundY; y < SURFACE_H; y++) {
    for (let x = 0; x < W; x++) {
      const n = hash2(x >> 1, y, 41);
      p.set(x, y, y === groundY ? C.dirtTop : shade(C.dirt, 0.85 + n * 0.3 - (y - groundY) * 0.02));
    }
  }
  for (let x = 0; x < W; x += 1) if (hash2(x, 0, 43) > 0.86) p.set(x, groundY - 1, C.ruinNear); // debris
  // shaft entrance going down to level 1
  for (let y = groundY; y < SURFACE_H + CRUST_H; y++) { p.hline(hx - 3, hx + 3, y, C.door); p.set(hx - 4, y, C.beam); p.set(hx + 4, y, C.beam); }

  // rooms
  for (let level = 1; level <= LEVELS; level++) {
    const ry = L.rowY(level);
    const dk = 1 - 0.38 * ((level - 1) / (LEVELS - 1));
    // level label
    p.rect(1, ry + 8, LABEL_W - 2, 9, C.labelPlate);
    text(p, `L${level}`, 2, ry + 10, C.label);
    for (let col = 0; col < SECTIONS_PER_LEVEL; col++) {
      const rx = L.roomX(col);
      const seed = level * 31 + col;
      const pw = 10 + Math.floor(hash2(col, level, 5) * 6);
      for (let y = 0; y < ROOM_H; y++) {
        for (let x = 0; x < L.roomW; x++) {
          let c: RGB = C.wallPanel;
          if (x % pw === 0 || y === 12) c = C.wallSeam;
          else if ((x % pw === 2 || x % pw === pw - 2) && (y === 3 || y === 21)) c = C.rivet;
          const stain = valueNoise(x, y, 5, seed) - 0.5;
          c = shade(c, (1 + Math.round(stain * 3) * 0.06) * dk);
          if (x === 0 || x === L.roomW - 1) c = shade(C.shadow, dk);
          p.set(rx + x, ry + y, c);
        }
      }
      // ceiling beam with bolts
      for (let x = 0; x < L.roomW; x++) {
        p.set(rx + x, ry, shade(C.beam, dk));
        p.set(rx + x, ry + 1, shade(x % 6 === 3 ? C.rivet : C.beamDark, dk));
      }
      // lamp fixture
      const lx = rx + (L.roomW >> 1);
      p.hline(lx - 2, lx + 2, ry + 2, C.metalDark);
      // floor slab
      for (let x = -WALL_W; x < L.roomW; x++) {
        p.set(rx + x, ry + ROOM_H, shade(C.floorTop, dk));
        p.set(rx + x, ry + ROOM_H + 1, shade(hash2(x, level, 7) > 0.8 ? C.floorLow : C.floorMid, dk));
        p.set(rx + x, ry + ROOM_H + 2, shade(C.floorLow, dk));
      }
      // door in the wall to the right
      if (col < SECTIONS_PER_LEVEL - 1 && hash2(level, col, 13) > 0.35) {
        const wx = rx + L.roomW;
        p.rect(wx, ry + ROOM_H - 9, WALL_W, 9, shade(C.door, dk));
        p.hline(wx, wx + WALL_W - 1, ry + ROOM_H - 10, shade(C.beam, dk));
      }
    }
  }
  return p.texture();
}

// ---------- per-section overlays (shared by every section) ----------
export function glowTexture(w: number, h: number): Texture {
  const p = new Px(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - w / 2) / (w * 0.62), dy = (y - 2) / (h * 1.15);
    const v = Math.max(0, 1 - Math.hypot(dx, dy));
    const b = dither(v, x, y, 4);
    if (b > 0) p.set(x, y, C.lamp, b * 52);
  }
  return p.texture();
}

export function heatTexture(w: number, h: number): Texture {
  const p = new Px(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const rise = Math.pow(y / h, 1.3);
    const shimmer = 0.55 + 0.45 * Math.sin(x * 0.8 + y * 0.45);
    const b = dither(0.25 + rise * shimmer * 0.75, x, y, 4);
    if (b > 0) p.set(x, y, C.heat, b * 48);
  }
  return p.texture();
}

export function fogTexture(w: number, h: number, seed: number): Texture {
  const p = new Px(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = valueNoise(x, y, 6, seed) * 0.7 + valueNoise(x, y, 3, seed + 1) * 0.3;
    const b = dither(n * 1.05, x, y, 4);
    if (b > 0) p.set(x, y, shade(C.fog, 0.8 + b * 0.07), 40 + b * 40);
  }
  return p.texture();
}

export function sickTexture(w: number, h: number, seed: number): Texture {
  const p = new Px(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = hash2(x, y, seed);
    if (r > 0.965) p.set(x, y, C.sick, 230);
    else if (r > 0.94) p.set(x, y, shade(C.sick, 0.7), 150);
    else p.set(x, y, C.sick, 26);
  }
  return p.texture();
}

export function rubbleTexture(w: number, h: number, seed: number): Texture {
  const p = new Px(w, h);
  p.rect(0, 0, w, h, [14, 10, 9], 170);
  // cracks in the back wall
  for (let k = 0; k < 3; k++) {
    let x = Math.floor(hash2(k, 1, seed) * w), y = 2;
    while (y < h - 6) { p.set(x, y, [8, 6, 5]); x += Math.floor(hash2(x, y, seed) * 3) - 1; y++; }
  }
  // fallen ceiling beam
  const flip = hash2(seed, 2) > 0.5;
  const bx0 = flip ? w - 3 : 2, bx1 = flip ? Math.floor(w * 0.35) : Math.floor(w * 0.65);
  p.line(bx0, 1, bx1, h - 2, C.beam); p.line(bx0 + 1, 1, bx1 + 1, h - 2, C.beamDark);
  // rubble heap on the floor
  const cx = Math.floor(w * (0.3 + hash2(seed, 3) * 0.4)), hw = Math.floor(w * 0.45);
  for (let x = cx - hw; x <= cx + hw; x++) {
    const ht = Math.round((1 - Math.abs(x - cx) / hw) * 9 + hash2(x, 4, seed) * 2);
    for (let y = h - ht; y < h; y++) p.set(x, y, hash2(x >> 1, y >> 1, seed) > 0.5 ? C.rubble : C.rubbleDark);
  }
  return p.texture();
}

const SHIRTS: RGB[] = [[230, 220, 200], [200, 210, 230], [235, 200, 170], [210, 230, 205], [240, 240, 235]];
export const CROWD_H = 6;
export const CROWD_MAX = 10;
export function crowdTexture(w: number, count: number, seed: number): Texture {
  const p = new Px(w, CROWD_H);
  const span = Math.floor(w * 0.62) - 3;
  for (let i = 0; i < count; i++) {
    const x = 2 + Math.floor(((i + 0.5) / count) * span + (hash2(i, 0, seed) - 0.5) * 2);
    const shirt = SHIRTS[Math.floor(hash2(i, 1, seed) * SHIRTS.length)];
    const tall = hash2(i, 2, seed) > 0.4 ? 0 : 1;
    p.set(x, tall, [240, 205, 170]); // head
    p.rect(x, 1 + tall + 0, 2, 3 - tall, shirt);
    p.set(x, 4, [150, 140, 140]); p.set(x + 1, 5, [150, 140, 140]); p.set(x, 5, [150, 140, 140]);
  }
  return p.texture();
}

// ---------- structures ----------
export interface StructTextures {
  plant: Texture; core: Texture; halo: Texture;
  fanBody: Texture; fanBlade: Texture;
  farm: Texture; farmLamp: Texture;
  recycler: Texture; clinic: Texture;
}
export function structTextures(): StructTextures {
  const plant = new Px(10, 12);
  plant.rect(0, 2, 10, 10, C.metalDark); plant.rect(1, 3, 8, 8, C.metal);
  plant.rect(3, 0, 4, 2, C.metal); plant.hline(1, 8, 3, C.metalLight);
  plant.rect(3, 5, 4, 4, C.metalDark);
  const core = new Px(2, 2); core.rect(0, 0, 2, 2, C.core);
  const halo = new Px(12, 12);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    const b = dither(1 - Math.hypot(x - 5.5, y - 5.5) / 6, x, y, 3);
    if (b > 0) halo.set(x, y, C.core, b * 60);
  }
  const fanBody = new Px(9, 9);
  for (let a = 0; a < 32; a++) fanBody.set(4 + Math.round(Math.cos(a / 32 * Math.PI * 2) * 4), 4 + Math.round(Math.sin(a / 32 * Math.PI * 2) * 4), C.metalDark);
  for (let y = 1; y < 8; y++) for (let x = 1; x < 8; x++) if (Math.hypot(x - 4, y - 4) < 3.6) fanBody.set(x, y, [24, 22, 26]);
  const fanBlade = new Px(7, 7);
  fanBlade.hline(0, 6, 3, C.metalLight); fanBlade.vline(3, 0, 6, C.metalLight);
  fanBlade.set(1, 2, C.metalLight); fanBlade.set(5, 4, C.metalLight); fanBlade.set(4, 1, C.metalLight); fanBlade.set(2, 5, C.metalLight);
  fanBlade.set(3, 3, C.metalDark);
  const farm = new Px(14, 7);
  farm.rect(0, 5, 14, 2, C.soil); farm.hline(0, 13, 0, C.metal);
  farm.vline(0, 0, 4, C.metalDark); farm.vline(13, 0, 4, C.metalDark);
  for (let x = 1; x < 13; x += 2) { farm.vline(x, 3, 4, C.leafDark); farm.set(x, 2, C.leaf); farm.set(x + 1, 3, C.leaf); }
  const farmLamp = new Px(12, 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 12; x++) if (dither(1 - y / 4, x, y, 2) > 0) farmLamp.set(x, y, [255, 214, 140], 120 - y * 25);
  const recycler = new Px(11, 12);
  recycler.rect(0, 4, 6, 8, C.pipeDark); recycler.rect(1, 5, 4, 6, C.pipe); recycler.hline(1, 4, 7, C.pipeDark);
  recycler.vline(7, 0, 11, C.pipe); recycler.vline(8, 0, 11, C.pipeDark); recycler.hline(5, 7, 6, C.pipe);
  recycler.vline(10, 3, 11, C.pipe); recycler.hline(8, 10, 3, C.pipe); recycler.set(2, 9, [120, 220, 120]);
  const clinic = new Px(9, 9);
  clinic.rect(0, 0, 9, 9, C.metalDark); clinic.rect(1, 1, 7, 7, C.clinic);
  clinic.rect(3, 2, 3, 5, C.cross); clinic.rect(2, 3, 5, 3, C.cross);
  return {
    plant: plant.texture(), core: core.texture(), halo: halo.texture(),
    fanBody: fanBody.texture(), fanBlade: fanBlade.texture(),
    farm: farm.texture(), farmLamp: farmLamp.texture(),
    recycler: recycler.texture(), clinic: clinic.texture(),
  };
}

export function dripTexture(): Texture {
  const p = new Px(1, 2); p.set(0, 0, C.drip, 200); p.set(0, 1, C.drip); return p.texture();
}
export function puddleTexture(w: number): Texture {
  const p = new Px(w, 1);
  for (let x = 0; x < w; x++) p.set(x, 0, C.drip, x === 0 || x === w - 1 ? 120 : 220);
  return p.texture();
}
