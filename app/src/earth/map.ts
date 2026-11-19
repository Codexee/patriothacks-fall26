// The map: deck.gl draws the counties; MapLibre draws the basemap below them and the place names
// above them. All per-frame work stays in this class. React does not render during a replay tick.
//
// Depth = vulnerability. The land is one smooth surface below the base plane (z = 0). A county is
// deeper when its Hollow level is higher and, in a replay, when it has been dark for more hours.
// The depth is smoothed for display (see surface.ts): no walls between counties, no county outlines. The numbers in the
// hover card and the panels are the exact county values.
//
// The view from below: a camera below the surface that looks up is the mirror image of a camera
// above the surface that looks down at land that goes up. So for "below" the surface is drawn
// upward and the canvas is flipped top to bottom. No second camera type is necessary.
import { Deck, MapView, WebMercatorViewport, COORDINATE_SYSTEM } from 'deck.gl';
import maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { earthName, hollowName } from '../contracts.ts';
import type { Live, Scene } from './data.ts';
import { blendAt, commonX, commonY } from './surface.ts';
import type { Surface } from './surface.ts';
import { SurfaceLayer, countyTextureSize } from './surface-layer.ts';

export interface View { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number }
export const HOME: View = { longitude: -96.2, latitude: 37.2, zoom: 3.95, pitch: 44, bearing: 0 };

const BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

type RGB = [number, number, number];
function cssColor(name: string, fallback: RGB): RGB {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

const BASE_DEPTH = 14_000;     // metres, level 1
const LEVEL_DEPTH = 170_000;   // metres added at level 50
const DARK_DEPTH = 650;        // metres added per dark hour
const depthScale = (zoom: number) => 2 ** ((4 - zoom) * 0.8);
const RELIEF_LIGHT = 0.5;      // how much the slope changes the light (1 = the true slope)
const BELOW_DEPTH = 1.7;       // the view from below shows the depth this much larger, so the relief reads
const BELOW_LIGHT = 0.8;

export interface HoverInfo { ci: number; x: number; y: number }

export class EarthMap {
  view: View = { ...HOME };
  below = false;
  private scene: Scene;
  private root: HTMLElement;
  private deck: Deck<MapView>;
  private canvas: HTMLCanvasElement;
  private baseEl: HTMLDivElement;
  private namesEl: HTMLDivElement;
  private labelEl: HTMLDivElement;
  private base: maplibregl.Map | null = null;
  private names: maplibregl.Map | null = null;
  private live: Live | null = null;
  private hour = 0;
  private surface: Surface;
  private colors: Uint8Array;        // per vertex: the blended base color, and the kind of vertex
  private relief: Float32Array;      // per vertex: depth and slope from the level only (fixed)
  private countyData: Float32Array;  // per county, for the GPU: share out, alert, extra depth of the replay
  private countyKey = 0;
  private lit: Uint8Array;        // rgb per county when it has power
  private depth0: Float32Array;   // depth from the level, per county
  private cDark: RGB; private cAlert: RGB; private cLit: RGB;
  private labels: { ci: number; el: HTMLDivElement }[] = [];
  private interactive = true;
  private assist = true;
  private destroyed = false;
  onHover: (h: HoverInfo | null) => void = () => {};

  constructor(root: HTMLElement, scene: Scene) {
    this.root = root;
    this.scene = scene;
    this.cLit = cssColor('--lit', [242, 196, 107]);
    this.cDark = cssColor('--dark', [5, 6, 10]);
    this.cAlert = cssColor('--alert', [255, 90, 79]);

    const n = scene.counties.length;
    this.lit = new Uint8Array(n * 3);
    this.depth0 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const c = scene.counties[i];
      // Brightness follows the number of electric customers, like city lights at night.
      const b = Math.max(0, Math.min(1, (Math.log10(Math.max(1, c.customers ?? c.pop ?? 1)) - 3.2) / 2.8));
      const k = 0.2 + 0.8 * b ** 1.5;
      // Small counties are a deep ember; large ones go toward the full --lit color and a little past it.
      this.lit[i * 3] = Math.min(255, this.cLit[0] * (0.34 + 0.72 * k));
      this.lit[i * 3 + 1] = Math.min(255, this.cLit[1] * (0.16 + 0.9 * k * k));
      this.lit[i * 3 + 2] = Math.min(255, this.cLit[2] * (0.1 + 1.0 * k * k * k));
      const level = c.level ?? 1;
      this.depth0[i] = BASE_DEPTH + LEVEL_DEPTH * ((level - 1) / 49) ** 1.35;
    }

    // The calm surface: depth and base color of each vertex are a blend of the counties near it,
    // so neither has a hard edge.
    const s = this.surface = scene.surface;
    this.relief = new Float32Array(s.count * 3);
    this.colors = new Uint8Array(s.count * 4);
    for (let v = 0; v < s.count; v++) {
      let d = 0, dx = 0, dy = 0, r = 0, g = 0, b = 0;
      for (let k = v * 4; k < v * 4 + 4; k++) {
        const ci = s.blendId[k], w = s.blendW[k];
        d += w * this.depth0[ci]; dx += s.blendX[k] * this.depth0[ci]; dy += s.blendY[k] * this.depth0[ci];
        r += w * this.lit[ci * 3]; g += w * this.lit[ci * 3 + 1]; b += w * this.lit[ci * 3 + 2];
      }
      this.relief[v * 3] = d; this.relief[v * 3 + 1] = dx; this.relief[v * 3 + 2] = dy;
      this.colors[v * 4] = r; this.colors[v * 4 + 1] = g; this.colors[v * 4 + 2] = b;
      this.colors[v * 4 + 3] = s.kind[v] === 0 ? 0 : s.kind[v] === 1 ? 128 : 255;
    }
    this.countyData = new Float32Array(countyTextureSize(n));

    const mk = (cls: string) => {
      const el = document.createElement('div');
      el.className = cls;
      root.appendChild(el);
      return el;
    };
    this.baseEl = mk('em-layer em-base');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'em-layer em-deck';
    root.appendChild(this.canvas);
    this.namesEl = mk('em-layer em-names');
    this.labelEl = mk('em-layer em-labels');

    this.deck = new Deck<MapView>({
      canvas: this.canvas,
      views: new MapView({ repeat: false, farZMultiplier: 2.5 }),
      viewState: this.deckView(),
      controller: { dragRotate: true, keyboard: false },
      onViewStateChange: ({ viewState }) => {
        if (!this.interactive) return;
        const v = viewState as unknown as View;
        this.setView({ longitude: v.longitude, latitude: v.latitude, zoom: v.zoom, pitch: v.pitch, bearing: v.bearing });
      },
      onHover: (info) => {
        if (!this.interactive) return;
        this.onHover(info.index >= 0 ? { ci: info.index, x: info.x, y: info.y } : null);
      },
      getCursor: ({ isDragging }) => (isDragging ? 'grabbing' : 'default'),
      layers: [],
      onAfterRender: () => this.placeLabels(),
    });
    this.render();
    void this.loadBasemap();
  }

  /** The basemap is optional. If the style does not load, the map stays on the plain background. */
  private async loadBasemap() {
    let style: StyleSpecification;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(BASEMAP, { signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) return;
      style = (await r.json()) as StyleSpecification;
    } catch {
      return;
    }
    if (this.destroyed) return;
    const common = {
      interactive: false, attributionControl: false as const, maxPitch: 85, renderWorldCopies: false,
      center: [this.view.longitude, this.view.latitude] as [number, number],
      zoom: this.view.zoom, pitch: Math.min(85, this.view.pitch), bearing: this.view.bearing,
      fadeDuration: 0,
    };
    const ground = style.layers.filter((l) => l.type !== 'symbol');
    const text = style.layers.filter((l) => l.type === 'symbol');
    try {
      this.base = new maplibregl.Map({ ...common, container: this.baseEl, style: { ...style, layers: ground } });
      this.names = new maplibregl.Map({ ...common, container: this.namesEl, style: { ...style, layers: text } });
    } catch {
      this.base = this.names = null;
      return;
    }
    // A tile that does not load must not stop the app or fill the console.
    this.base.on('error', () => {});
    this.names.on('error', () => {});
    this.base.once('load', () => this.root.classList.add('em-has-basemap'));
  }

  private deckView() {
    return { ...this.view, maxPitch: this.interactive ? 72 : 89, minZoom: 2.6, maxZoom: 9.5 };
  }

  setInteractive(on: boolean) {
    this.interactive = on;
    this.deck.setProps({ controller: on ? { dragRotate: true, keyboard: false } : false, viewState: this.deckView() });
    if (!on) this.onHover(null);
  }

  setView(v: View) {
    this.view = v;
    this.deck.setProps({ viewState: this.deckView() });
    const cam = { center: [v.longitude, v.latitude] as [number, number], zoom: v.zoom, pitch: Math.min(85, v.pitch), bearing: v.bearing };
    this.base?.jumpTo(cam);
    this.names?.jumpTo(cam);
    this.render();
  }

  /** below = the camera is under the surface and looks up (see the note at the top of the file). */
  setBelow(below: boolean) {
    if (below === this.below) return;
    this.below = below;
    this.canvas.style.transform = below ? 'scaleY(-1)' : '';
    this.render();
  }

  /** 0 = no basemap (the Hollow), 1 = full basemap (Earth). */
  setBasemap(opacity: number) {
    this.baseEl.style.opacity = String(opacity);
    this.namesEl.style.opacity = String(opacity);
  }

  setLive(live: Live | null) {
    this.live = live;
    this.hour = 0;
    this.countyData.fill(0);
    this.countyKey++;
    this.updateLive();
    this.render();
  }

  setHour(hour: number) {
    if (!this.live || Math.abs(hour - this.hour) < 0.08) return;
    this.hour = hour;
    this.updateLive();
    this.render();
  }

  /** Writes the state of the replay at this.hour into the county values. No geometry is built here:
   *  the GPU blends these values with the fixed weights of each vertex. */
  private updateLive() {
    const live = this.live;
    if (!live) return;
    const data = this.countyData;
    const alertBa = this.alertOn() ? live.replay.ba : null;
    const counties = this.scene.counties;
    for (let k = 0; k < live.ci.length; k++) {
      const ci = live.ci[k];
      if (ci < 0) continue;
      data[ci * 4] = Math.min(1, this.outNow(ci) / 100);
      data[ci * 4 + 1] = alertBa && counties[ci].ba === alertBa ? 1 : 0;
      data[ci * 4 + 2] = DARK_DEPTH * this.darkNow(ci);
    }
    this.countyKey++;
  }

  /** Percent of customers out now for a county; 0 for a county that is not in the replay. */
  outNow(ci: number): number {
    const live = this.live;
    if (!live) return 0;
    const k = live.slot[ci];
    if (k < 0) return 0;
    const out = live.replay.counties[k].out;
    const h0 = Math.max(0, Math.min(out.length - 1, Math.floor(this.hour)));
    const h1 = Math.min(out.length - 1, h0 + 1);
    const f = this.hour - h0;
    return (out[h0] ?? 0) * (1 - f) + (out[h1] ?? 0) * f;
  }
  private darkNow(ci: number): number {
    const live = this.live;
    if (!live) return 0;
    const k = live.slot[ci];
    if (k < 0) return 0;
    const cum = live.cumDark[k];
    const h0 = Math.max(0, Math.min(cum.length - 1, Math.floor(this.hour)));
    const h1 = Math.min(cum.length - 1, h0 + 1);
    const f = this.hour - h0;
    return cum[h0] * (1 - f) + cum[h1] * f;
  }
  /** The depth of the smooth surface at the middle of a county, in metres. */
  private surfaceDepth(ci: number) {
    const x = commonX(this.scene.centroid[ci * 2]), y = commonY(this.scene.centroid[ci * 2 + 1]);
    const b = this.blendScratch;
    if (!blendAt(this.surface.grid, x, y, b, b.subarray(4), b.subarray(8), b.subarray(12), 0)) {
      return this.depth0[ci] + DARK_DEPTH * this.darkNow(ci);
    }
    let d = 0;
    for (let k = 0; k < 4; k++) d += b[4 + k] * (this.depth0[b[k]] + DARK_DEPTH * this.darkNow(b[k]));
    return d;
  }
  private blendScratch = new Float32Array(16);

  /** false = the "Without" view: no alert state on the map. */
  setAssist(on: boolean) {
    if (on === this.assist) return;
    this.assist = on;
    this.updateLive();
    this.render();
  }

  private alertOn(): boolean {
    if (!this.assist) return false;
    const r = this.live?.replay;
    if (!r?.risk || r.alertThreshold == null) return false;
    const p = r.risk[Math.max(0, Math.min(r.hours - 1, Math.floor(this.hour)))];
    return p != null && p >= r.alertThreshold;
  }

  /** Drawn height per metre of depth. Negative = down (the usual view). */
  private zScale() { return depthScale(this.view.zoom) * (this.below ? BELOW_DEPTH : -1); }

  private render() {
    if (this.destroyed) return;
    const norm = (c: RGB): RGB => [c[0] / 255, c[1] / 255, c[2] / 255];
    this.deck.setProps({
      layers: [
        new SurfaceLayer({
          id: 'surface',
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          surface: this.surface,
          colors: this.colors,
          relief: this.relief,
          countyData: this.countyData,
          countyVersion: this.countyKey,
          zScale: this.zScale(),
          reliefLight: this.below ? BELOW_LIGHT : RELIEF_LIGHT,
          dark: norm(this.cDark),
          alert: norm(this.cAlert),
          pickable: true,
        }),
      ],
    });
  }

  // ---- county labels (HTML, so they stay sharp and do not flip with the canvas) ----

  /** Show a label with both names on these counties. */
  setLabels(cis: number[], hollowOnly = false) {
    this.labelEl.classList.toggle('em-hollow-only', hollowOnly);
    const same = cis.length === this.labels.length && cis.every((ci, i) => this.labels[i].ci === ci);
    if (same) return;
    this.labelEl.textContent = '';
    this.labels = cis.map((ci) => {
      const c = this.scene.counties[ci];
      const el = document.createElement('div');
      el.className = 'em-label';
      const e = document.createElement('span'); e.className = 'em-label-earth'; e.textContent = earthName(c);
      const h = document.createElement('span'); h.className = 'em-label-hollow'; h.textContent = hollowName(c);
      el.append(e, h);
      this.labelEl.appendChild(el);
      return { ci, el };
    });
    this.placeLabels();
  }

  private placeLabels() {
    if (!this.labels.length || this.destroyed) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const vp = new WebMercatorViewport({ width: w, height: h, ...this.view, farZMultiplier: 2.5 });
    const es = Math.abs(this.zScale());
    const placed: { x: number; y: number }[] = [];
    const items = this.labels.map((l) => {
      const z = this.below ? this.surfaceDepth(l.ci) * es : 0;
      const [x, y0] = vp.project([this.scene.centroid[l.ci * 2], this.scene.centroid[l.ci * 2 + 1], z]);
      return { l, x, y: this.below ? h - y0 : y0 };
    }).sort((a, b) => a.y - b.y);
    for (const it of items) {
      let y = it.y;
      // Keep labels apart: move a label down when it is on top of one that is already placed.
      for (let pass = 0; pass < 6; pass++) {
        const hit = placed.find((p) => Math.abs(p.x - it.x) < 230 && Math.abs(p.y - y) < 50);
        if (!hit) break;
        y = hit.y + 50;
      }
      placed.push({ x: it.x, y });
      const on = it.x > -50 && it.x < w + 50 && y > -50 && y < h + 50;
      it.l.el.style.transform = `translate(${it.x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      it.l.el.style.visibility = on ? 'visible' : 'hidden';
    }
  }

  /** A view that puts these counties in the frame. */
  fit(cis: number[], padding = 80): View {
    let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
    for (const ci of cis) {
      const x = this.scene.centroid[ci * 2], y = this.scene.centroid[ci * 2 + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x0 > x1) return { ...HOME };
    const w = Math.max(320, this.canvas.clientWidth), h = Math.max(240, this.canvas.clientHeight);
    const vp = new WebMercatorViewport({ width: w, height: h });
    const pad = Math.min(padding, w / 4, h / 4);
    const f = vp.fitBounds([[x0, y0], [x1, y1]], { padding: pad, maxZoom: 7.2 });
    return { longitude: f.longitude, latitude: f.latitude, zoom: f.zoom, pitch: 0, bearing: 0 };
  }

  destroy() {
    this.destroyed = true;
    this.deck.finalize();
    this.base?.remove();
    this.names?.remove();
    this.root.classList.remove('em-has-basemap');
    for (const el of [this.baseEl, this.canvas, this.namesEl, this.labelEl]) el.remove();
  }
}
