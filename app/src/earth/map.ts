// The map: deck.gl draws the counties; MapLibre draws the basemap below them and the place names
// above them. All per-frame work stays in this class. React does not render during a replay tick.
//
// Depth = vulnerability. Each county is a column that goes down from the surface (z = 0). The
// depth grows with the Hollow level and, in a replay, with the hours the county has been dark.
//
// The view from below: a camera below the surface that looks up is the mirror image of a camera
// above the surface that looks down at columns that go up. So for "below" the columns are drawn
// upward and the canvas is flipped top to bottom. No second camera type is necessary.
import { Deck, MapView, LightingEffect, AmbientLight, DirectionalLight, WebMercatorViewport } from 'deck.gl';
import { SolidPolygonLayer, PathLayer } from 'deck.gl';
import maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Position } from 'geojson';
import { earthName, hollowName } from '../contracts.ts';
import type { Live, Part, Scene } from './data.ts';

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
  private colorKey = 0;
  private dataKey = 0;
  private staticParts: Part[];
  private liveParts: Part[] = [];
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
    this.staticParts = scene.parts;

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
        const o = info.object as Part | undefined;
        this.onHover(o ? { ci: o.ci, x: info.x, y: info.y } : null);
      },
      getCursor: ({ isDragging }) => (isDragging ? 'grabbing' : 'default'),
      effects: [new LightingEffect({
        ambient: new AmbientLight({ color: [255, 255, 255], intensity: 1.9 }),
        sun: new DirectionalLight({ color: [255, 226, 196], intensity: 0.85, direction: [-0.5, 0.9, -1.6] }),
      })],
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
    this.dataKey++;
    if (live) {
      this.staticParts = this.scene.parts.filter((p) => live.slot[p.ci] < 0);
      this.liveParts = this.scene.parts.filter((p) => live.slot[p.ci] >= 0);
    } else {
      this.staticParts = this.scene.parts;
      this.liveParts = [];
    }
    this.colorKey++;
    this.render();
  }

  setHour(hour: number) {
    if (!this.live || Math.abs(hour - this.hour) < 0.08) return;
    this.hour = hour;
    this.colorKey++;
    this.render();
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
  private depth(ci: number) { return this.depth0[ci] + DARK_DEPTH * this.darkNow(ci); }

  /** false = the "Without" view: no alert state on the map. */
  setAssist(on: boolean) {
    if (on === this.assist) return;
    this.assist = on;
    this.colorKey++;
    this.render();
  }

  private alertOn(): boolean {
    if (!this.assist) return false;
    const r = this.live?.replay;
    if (!r?.risk || r.alertThreshold == null) return false;
    const p = r.risk[Math.max(0, Math.min(r.hours - 1, Math.floor(this.hour)))];
    return p != null && p >= r.alertThreshold;
  }

  private render() {
    if (this.destroyed) return;
    const es = depthScale(this.view.zoom) * (this.below ? 1 : -1);
    const lit = this.lit;
    const dark = this.cDark;
    const alert = this.cAlert;
    const material = { ambient: 0.42, diffuse: 0.55, shininess: 0, specularColor: [0, 0, 0] as RGB };
    const alertBa = this.alertOn() ? this.live!.replay.ba : null;
    const counties = this.scene.counties;
    const lineAlpha = this.below ? 0.5 : 1;

    this.deck.setProps({
      layers: [
        new SolidPolygonLayer<Part>({
          id: 'calm',
          data: this.staticParts,
          getPolygon: (d) => d.polygon as [number, number][][],
          extruded: true,
          getElevation: (d) => this.depth0[d.ci],
          elevationScale: es,
          getFillColor: (d) => [lit[d.ci * 3], lit[d.ci * 3 + 1], lit[d.ci * 3 + 2]],
          material,
          pickable: true,
          updateTriggers: { getElevation: this.dataKey, getFillColor: this.dataKey },
        }),
        new SolidPolygonLayer<Part>({
          id: 'live',
          data: this.liveParts,
          getPolygon: (d) => d.polygon as [number, number][][],
          extruded: true,
          getElevation: (d) => this.depth(d.ci),
          elevationScale: es,
          getFillColor: (d) => {
            const f = Math.min(1, this.outNow(d.ci) / 100) ** 0.55;
            const i = d.ci * 3;
            return [lit[i] + (dark[0] - lit[i]) * f, lit[i + 1] + (dark[1] - lit[i + 1]) * f, lit[i + 2] + (dark[2] - lit[i + 2]) * f];
          },
          material,
          pickable: true,
          updateTriggers: { getElevation: this.colorKey, getFillColor: this.colorKey },
        }),
        new PathLayer<Position[]>({
          id: 'county-lines',
          data: this.scene.countyLines,
          getPath: (d) => d as [number, number][],
          getColor: [10, 8, 6, 120 * lineAlpha],
          getWidth: 1,
          widthUnits: 'pixels',
          visible: !this.below,
        }),
        new PathLayer<Part>({
          id: 'alert-rings',
          data: this.liveParts,
          getPath: (d) => d.polygon[0] as [number, number][],
          getColor: (d) => {
            const f = Math.min(1, this.outNow(d.ci) / 100);
            const a = Math.max(f < 0.02 ? 0 : 0.25 + 0.75 * f, alertBa && counties[d.ci].ba === alertBa ? 0.45 : 0);
            return [alert[0], alert[1], alert[2], 255 * a];
          },
          getWidth: 1.6,
          widthUnits: 'pixels',
          updateTriggers: { getColor: this.colorKey },
        }),
        new PathLayer<Position[]>({
          id: 'state-lines',
          data: this.scene.stateLines,
          getPath: (d) => d as [number, number][],
          getColor: [255, 236, 205, 105 * lineAlpha],
          getWidth: 1.2,
          widthUnits: 'pixels',
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
    const es = depthScale(this.view.zoom);
    const placed: { x: number; y: number }[] = [];
    const items = this.labels.map((l) => {
      const z = this.below ? this.depth(l.ci) * es : 0;
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
