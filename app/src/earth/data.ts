// Loads the static data and prepares the map geometry. Everything here runs one time.
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { MultiPolygon, Polygon, Position } from 'geojson';
import { dataUrl } from '../contracts.ts';
import type { County, EventLibrary, EventReplay, EventRow, HeroSlug } from '../contracts.ts';

/** One polygon of one county. A county with islands has more than one part. */
export interface Part {
  ci: number;            // index into Scene.counties
  polygon: Position[][]; // outer ring, then holes
}

export interface Scene {
  counties: County[];
  index: Map<string, number>;   // fips -> index
  parts: Part[];
  centroid: Float32Array;       // lng, lat per county
  countyLines: Position[][];    // borders between counties
  stateLines: Position[][];     // state borders and the coast
  library: EventLibrary;
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(dataUrl(path));
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

function ringCentroid(ring: Position[]): [number, number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (a === 0) return [ring[0][0], ring[0][1], 0];
  return [cx / (3 * a), cy / (3 * a), Math.abs(a / 2)];
}

let scenePromise: Promise<Scene> | null = null;

export function loadScene(): Promise<Scene> {
  scenePromise ??= (async () => {
    const [counties, topo, library] = await Promise.all([
      getJson<County[]>('counties.json'),
      getJson<Topology>('counties-10m.json'),
      getJson<EventLibrary>('events.json'),
    ]);
    const index = new Map<string, number>();
    counties.forEach((c, i) => index.set(c.fips, i));

    const obj = topo.objects.counties as GeometryCollection;
    const fc = feature(topo, obj);
    const parts: Part[] = [];
    const centroid = new Float32Array(counties.length * 2);
    const bestArea = new Float32Array(counties.length);
    for (const f of fc.features) {
      const ci = index.get(String(f.id).padStart(5, '0'));
      if (ci == null || !f.geometry) continue;
      const g = f.geometry as Polygon | MultiPolygon;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      for (const polygon of polys) {
        parts.push({ ci, polygon });
        const [x, y, area] = ringCentroid(polygon[0]);
        if (area >= bestArea[ci]) { bestArea[ci] = area; centroid[ci * 2] = x; centroid[ci * 2 + 1] = y; }
      }
    }
    // Lines only for the counties and states that are on the map (no territories).
    const known = (g: { id?: string | number }) => index.has(String(g.id).padStart(5, '0'));
    const knownState = (g: { id?: string | number }) => Number(g.id) <= 56;
    const countyLines = mesh(topo, obj, (a, b) => a !== b && known(a) && known(b)).coordinates;
    const stateLines = mesh(topo, topo.objects.states as GeometryCollection, (a, b) => knownState(a) || knownState(b)).coordinates;
    return { counties, index, parts, centroid, countyLines, stateLines, library };
  })();
  return scenePromise;
}

const replayCache = new Map<string, Promise<EventReplay>>();
export function loadReplay(id: string): Promise<EventReplay> {
  let p = replayCache.get(id);
  if (!p) {
    p = getJson<EventReplay>(`events/${id}.json`);
    p.catch(() => replayCache.delete(id));
    replayCache.set(id, p);
  }
  return p;
}

/** The replay in the form the map and the panels read each hour. */
export interface Live {
  replay: EventReplay;
  row: EventRow | null;
  ci: Int32Array;          // county index for each replay county (-1 = not on the map)
  slot: Int32Array;        // per scene county: position in replay.counties, or -1
  cumDark: Uint16Array[];  // per replay county: hours with >= 10% out, up to and including hour h
  share: Float32Array;     // per hour: percent of the customers in these counties who are out
  peakHour: number;
}

export function prepareLive(scene: Scene, replay: EventReplay): Live {
  const n = replay.counties.length;
  const ci = new Int32Array(n);
  const slot = new Int32Array(scene.counties.length).fill(-1);
  const cumDark: Uint16Array[] = [];
  const share = new Float32Array(replay.hours);
  let customers = 0;
  replay.counties.forEach((rc, k) => {
    const i = scene.index.get(rc.fips) ?? -1;
    ci[k] = i;
    if (i >= 0) slot[i] = k;
    const cum = new Uint16Array(replay.hours);
    let run = 0;
    const w = i >= 0 ? scene.counties[i].customers ?? 0 : 0;
    customers += w;
    for (let h = 0; h < replay.hours; h++) {
      const out = rc.out[h] ?? 0;
      if (out >= 10) run++;
      cum[h] = run;
      share[h] += out * w;
    }
    cumDark.push(cum);
  });
  let peakHour = 0;
  for (let h = 0; h < replay.hours; h++) {
    share[h] = customers > 0 ? share[h] / customers : 0;
    if (share[h] > share[peakHour]) peakHour = h;
  }
  const row = scene.library.events.find((e) => e.id === replay.id) ?? null;
  return { replay, row, ci, slot, cumDark, share, peakHour };
}

/** The main group of these counties: drops the few that are far from the others (the 10% farthest
 *  from the median point), so a camera that frames them does not frame the whole country. */
export function mainGroup(scene: Scene, cis: number[]): number[] {
  if (cis.length < 5) return cis;
  const med = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)];
  const mx = med(cis.map((ci) => scene.centroid[ci * 2]));
  const my = med(cis.map((ci) => scene.centroid[ci * 2 + 1]));
  const dist = (ci: number) => Math.hypot(scene.centroid[ci * 2] - mx, scene.centroid[ci * 2 + 1] - my);
  const cut = cis.map(dist).sort((a, b) => a - b)[Math.floor(cis.length * 0.9)];
  return cis.filter((ci) => dist(ci) <= cut);
}

export interface CheckRow {
  county: County;
  hours: number;      // predicted dark hours, or observed while the model output is not in
  score: number;      // hours x dme
}

/** Check-first ranking: dark hours x people on powered medical equipment. */
export function checkFirst(scene: Scene, live: Live): { rows: CheckRow[]; observed: boolean } {
  const observed = live.replay.stub || live.replay.counties.every((c) => c.predDarkHours == null);
  const rows: CheckRow[] = [];
  live.replay.counties.forEach((rc, k) => {
    const i = live.ci[k];
    if (i < 0) return;
    const county = scene.counties[i];
    const hours = observed ? rc.darkHours : rc.predDarkHours ?? 0;
    const score = hours * (county.dme ?? 0);
    if (score > 0) rows.push({ county, hours, score });
  });
  rows.sort((a, b) => b.score - a.score);
  return { rows, observed };
}

/** Heroes first, in the order of the contract; then the other playable events, largest first. */
const HERO_ORDER: HeroSlug[] = ['texas2021', 'elliott2022', 'irma2017'];
export function playable(library: EventLibrary): { heroes: EventRow[]; others: EventRow[] } {
  const ok = library.events.filter((e) => e.hasReplay);
  const heroes = ok.filter((e) => e.hero).sort((a, b) => HERO_ORDER.indexOf(a.hero!) - HERO_ORDER.indexOf(b.hero!));
  const others = ok.filter((e) => !e.hero).sort((a, b) => b.peakCustomersOut - a.peakCustomersOut);
  return { heroes, others };
}

/** The hero for a story slug. A hero with no data falls back to any hero that has data. */
export function findHero(library: EventLibrary, slug: string | null): EventRow | null {
  const { heroes } = playable(library);
  return heroes.find((e) => e.hero === slug) ?? heroes[0] ?? null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const parseUtc = (s: string) => Date.parse(s.replace(' ', 'T') + 'Z');
export function fmtHour(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}:00 UTC`;
}
export function fmtDay(s: string): string {
  const d = new Date(parseUtc(s));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
export const fmtInt = (n: number | null | undefined) => (n == null ? 'no data' : Math.round(n).toLocaleString('en-US'));
