// The geometry of the smooth map surface. Everything here runs one time, when the data loads.
//
// The surface is one triangle mesh. Each county keeps its own triangles (so a pointer can pick a
// county and an outage can darken one county), but every value on the surface is a blend: a vertex
// takes each value (depth, color, share out) as the weighted mean of the counties near it. The
// weights come from a smooth kernel over a raster of county numbers, and they depend only on the
// position of the vertex. Two counties that share a border have the same points there, so they get
// the same depth there: no wall is between them. A county keeps its own value in its middle.
//
// The weights are fixed. A replay changes only the county values, so no geometry is built again.
//
// This file has no DOM and no deck.gl code. The positions are in Web Mercator "common" units
// (the world is 512 units wide), which deck.gl draws with coordinateSystem CARTESIAN.
import earcut from 'earcut';
import type { Position } from 'geojson';

const WORLD = 512;
const EARTH = 40.03e6;   // metres; the value deck.gl uses for Web Mercator

/** Longitude east of the antimeridian (the far Aleutians) goes to the west side of Alaska. */
export const commonX = (lng: number) => ((lng > 0 ? lng - 360 : lng) + 180) / 360 * WORLD;
export const commonY = (lat: number) => WORLD * (0.5 + Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI));
/** Common units per metre at a latitude. */
const unitsPerMetre = (lat: number) => WORLD / EARTH / Math.cos((lat * Math.PI) / 180);

// ---- the mesh ----

export interface SurfacePart { ci: number; polygon: Position[][] }

export interface Grid {
  x0: number; y0: number; cell: number; w: number; h: number;
  id: Int16Array;       // county index per cell; -1 = no land
  reach: number;        // radius of the blend kernel, in cells
}

export interface Surface {
  count: number;            // vertices
  positions: Float32Array;  // x, y in common units; common units per metre
  kind: Uint8Array;         // 0 = surface, 1 = coast wall at the surface, 2 = coast wall at the base (z = 0)
  county: Uint16Array;      // county index per vertex
  indices: Uint32Array;
  first: Uint32Array;       // per county: its first vertex; first[n] = count (vertices are in county order)
  grid: Grid;
  // The blend, 4 counties per vertex. value = sum(weight x county value); slope = sum(slope weight x county value).
  blendId: Float32Array;    // county index
  blendW: Float32Array;     // weight; the 4 weights sum to 1
  blendX: Float32Array;     // slope weight to the east, per common unit; the 4 sum to 0
  blendY: Float32Array;     // slope weight to the north
}

interface Options {
  maxEdge: number;   // common units: no triangle edge is longer
  cell: number;      // common units: raster cell
  reach: number;     // common units: radius of the blend kernel
}

/** Split a ring edge in two until no piece is longer than maxEdge. The middle point is the same from
 *  both sides of a border, so neighbor counties get the same new points. */
function densify(ax: number, ay: number, bx: number, by: number, max2: number, outX: number[], outY: number[]) {
  const dx = bx - ax, dy = by - ay;
  if (dx * dx + dy * dy <= max2) return;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  densify(ax, ay, mx, my, max2, outX, outY);
  outX.push(mx); outY.push(my);
  densify(mx, my, bx, by, max2, outX, outY);
}

/** earcut drops a ring point that is on a straight line between its neighbors. The neighbor county can
 *  have a corner at that point, and then the two counties do not meet there (a crack). This puts each
 *  dropped point back: the triangle on the edge that goes past the point is cut at the point. */
function keepRingPoints(tris: number[], ringEnds: number[], points: number): number[] {
  const used = new Uint8Array(points);
  for (let t = 0; t < tris.length; t++) used[tris[t]] = 1;
  let edges: Map<number, number> | null = null;
  const key = (a: number, b: number) => (a < b ? a * points + b : b * points + a);
  for (let r = 0; r < ringEnds.length; r += 2) {
    const start = ringEnds[r], n = ringEnds[r + 1] - start;
    let firstUsed = -1;
    for (let i = 0; i < n; i++) if (used[start + i]) { firstUsed = i; break; }
    if (firstUsed < 0) continue;   // earcut dropped the whole ring (no area)
    for (let i = 0; i < n;) {
      // p = a used point; then the run of dropped points after it; then q = the next used point.
      const p = start + (firstUsed + i) % n;
      let len = 1;
      while (len < n && !used[start + (firstUsed + i + len) % n]) len++;
      const q = start + (firstUsed + i + len) % n;
      if (len > 1 && p !== q) {
        if (!edges) {
          edges = new Map();
          for (let t = 0; t < tris.length; t += 3) {
            edges.set(key(tris[t], tris[t + 1]), t); edges.set(key(tris[t + 1], tris[t + 2]), t); edges.set(key(tris[t + 2], tris[t]), t);
          }
        }
        const t = edges.get(key(p, q));
        if (t !== undefined) {
          const a = tris[t], b = tris[t + 1], c = tris[t + 2];
          const x = a !== p && a !== q ? a : b !== p && b !== q ? b : c;
          // A fan from x: (p, b1, x), (b1, b2, x), ..., (bk, q, x).
          let prev = p;
          for (let k = 1; k <= len; k++) {
            const next = k === len ? q : start + (firstUsed + i + k) % n;
            if (k === 1) { tris[t] = prev; tris[t + 1] = next; tris[t + 2] = x; edges.set(key(x, p), t); }
            else {
              if (k === len) edges.set(key(q, x), tris.length);
              tris.push(prev, next, x);
            }
            prev = next;
          }
        }
      }
      i += len;
    }
  }
  return tris;
}

/** earcut can make a triangle with no area: three points on one line, A - B - C. On the map it covers
 *  nothing, but in 3D it is a thin blade that stands on the border when B is not as deep as the line
 *  from A to C. This removes each one. The triangle on the other side of the long edge A - C is cut
 *  at B, so the mesh stays closed. */
function dropFlat(px: number[], py: number[], tris: number[]): number[] {
  const flat = (t: number) => {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    return (px[b] - px[a]) * (py[c] - py[a]) - (px[c] - px[a]) * (py[b] - py[a]) === 0;
  };
  let todo: number[] = [];
  for (let t = 0; t < tris.length; t += 3) if (flat(t)) todo.push(t);
  if (!todo.length) return tris;
  const n = px.length;
  const key = (a: number, b: number) => (a < b ? a * n + b : b * n + a);
  const dead = new Uint8Array(tris.length / 3 + todo.length * 2);
  for (const t of todo) dead[t / 3] = 1;
  const edges = new Map<number, number>();
  const index = (t: number) => {
    edges.set(key(tris[t], tris[t + 1]), t); edges.set(key(tris[t + 1], tris[t + 2]), t); edges.set(key(tris[t + 2], tris[t]), t);
  };
  for (let t = 0; t < tris.length; t += 3) if (!dead[t / 3]) index(t);
  for (let pass = 0; pass < 4 && todo.length; pass++) {
    const later: number[] = [];
    for (const t of todo) {
      let a = tris[t], b = tris[t + 1], c = tris[t + 2];
      const same = (u: number, v: number) => px[u] === px[v] && py[u] === py[v];
      if (same(a, b) || same(b, c) || same(a, c)) continue;   // two points at one place: only an edge
      // Turn the names so that b is between a and c.
      const d2 = (u: number, v: number) => (px[u] - px[v]) ** 2 + (py[u] - py[v]) ** 2;
      const ab = d2(a, b), bc = d2(b, c), ac = d2(a, c);
      if (ab >= bc && ab >= ac) { const t0 = c; c = b; b = t0; } else if (bc >= ab && bc >= ac) { const t0 = a; a = b; b = t0; }
      const o = edges.get(key(a, c));
      if (o === undefined) { later.push(t); continue; }
      const x = tris[o] !== a && tris[o] !== c ? tris[o] : tris[o + 1] !== a && tris[o + 1] !== c ? tris[o + 1] : tris[o + 2];
      edges.delete(key(a, c));
      tris[o] = a; tris[o + 1] = b; tris[o + 2] = x;
      const o2 = tris.length;
      tris.push(b, c, x);
      index(o); index(o2);
    }
    todo = later;
  }
  const out: number[] = [];
  for (let t = 0; t < tris.length; t += 3) if (!dead[t / 3]) out.push(tris[t], tris[t + 1], tris[t + 2]);
  return out;
}

/** Split every triangle edge that is longer than the limit, until none is. */
function refine(px: number[], py: number[], tris: number[], max2: number): number[] {
  let cur = tris;
  for (let pass = 0; pass < 14; pass++) {
    const mids = new Map<number, number>();
    const mid = (a: number, b: number) => {
      const key = a < b ? a * 4194304 + b : b * 4194304 + a;
      let v = mids.get(key);
      if (v === undefined) {
        v = px.length;
        px.push((px[a] + px[b]) / 2); py.push((py[a] + py[b]) / 2);
        mids.set(key, v);
      }
      return v;
    };
    const long = (a: number, b: number) => {
      const dx = px[a] - px[b], dy = py[a] - py[b];
      return dx * dx + dy * dy > max2;
    };
    const next: number[] = [];
    let split = false;
    for (let t = 0; t < cur.length; t += 3) {
      let a = cur[t], b = cur[t + 1], c = cur[t + 2];
      const lab = long(a, b), lbc = long(b, c), lca = long(c, a);
      const n = +lab + +lbc + +lca;
      if (n === 0) { next.push(a, b, c); continue; }
      split = true;
      if (n === 3) {
        const mab = mid(a, b), mbc = mid(b, c), mca = mid(c, a);
        next.push(a, mab, mca, mab, b, mbc, mca, mbc, c, mab, mbc, mca);
      } else if (n === 1) {
        // Turn the triangle so that the long edge is a-b.
        if (lbc) { const t0 = a; a = b; b = c; c = t0; } else if (lca) { const t0 = c; c = b; b = a; a = t0; }
        const m = mid(a, b);
        next.push(a, m, c, m, b, c);
      } else {
        // Turn the triangle so that the short edge is c-a.
        if (!lab) { const t0 = a; a = b; b = c; c = t0; } else if (!lbc) { const t0 = c; c = b; b = a; a = t0; }
        const m1 = mid(a, b), m2 = mid(b, c);
        next.push(m1, b, m2, a, m1, m2, a, m2, c);
      }
    }
    cur = next;
    if (!split) break;
  }
  return cur;
}

export function buildSurface(parts: SurfacePart[], counties: number, opt: Options): Surface {
  const max2 = opt.maxEdge * opt.maxEdge;

  // Project every ring; drop the closing point.
  interface Ring { x: number[]; y: number[] }
  const projected: { ci: number; rings: Ring[]; upm: number }[] = [];
  for (const p of parts) {
    const rings: Ring[] = [];
    let lat = 0, n = 0;
    for (const ring of p.polygon) {
      const x: number[] = [], y: number[] = [];
      for (let i = 0; i < ring.length - 1; i++) { x.push(commonX(ring[i][0])); y.push(commonY(ring[i][1])); lat += ring[i][1]; n++; }
      if (x.length >= 3) rings.push({ x, y });
      else if (!rings.length) break;   // no outer ring: no polygon
    }
    if (rings.length) projected.push({ ci: p.ci, rings, upm: unitsPerMetre(lat / n) });
  }
  projected.sort((a, b) => a.ci - b.ci);

  // An edge that only one county uses is the coast (or the border of the country).
  const pointIds = new Map<number, number>();
  const pointId = (x: number, y: number) => {
    const key = Math.round((x + 64) * 8192) * 4194304 + Math.round(y * 8192);
    let v = pointIds.get(key);
    if (v === undefined) { v = pointIds.size; pointIds.set(key, v); }
    return v;
  };
  const uses = new Map<number, number>();
  const edgeKey = (a: number, b: number) => (a < b ? a * 2097152 + b : b * 2097152 + a);
  for (const p of projected) for (const r of p.rings) {
    for (let i = 0, n = r.x.length; i < n; i++) {
      const j = (i + 1) % n;
      const k = edgeKey(pointId(r.x[i], r.y[i]), pointId(r.x[j], r.y[j]));
      uses.set(k, (uses.get(k) ?? 0) + 1);
    }
  }

  const X: number[] = [], Y: number[] = [], UPM: number[] = [], KIND: number[] = [], CI: number[] = [];
  const indices: number[] = [];
  const first = new Uint32Array(counties + 1);
  let filled = 0;   // counties whose first vertex is set

  for (const p of projected) {
    while (filled <= p.ci) first[filled++] = X.length;
    const px: number[] = [], py: number[] = [];
    const holes: number[] = [];
    const wall: number[] = [];   // pairs of local vertices: coast edges
    const ringEnds: number[] = [];   // start, end of each ring in px
    p.rings.forEach((r, ri) => {
      if (ri > 0) holes.push(px.length);
      const start = px.length;
      for (let i = 0, n = r.x.length; i < n; i++) {
        const j = (i + 1) % n;
        const coast = uses.get(edgeKey(pointId(r.x[i], r.y[i]), pointId(r.x[j], r.y[j]))) === 1;
        const from = px.length;
        px.push(r.x[i]); py.push(r.y[i]);
        densify(r.x[i], r.y[i], r.x[j], r.y[j], max2, px, py);
        if (coast) for (let k = from; k < px.length; k++) wall.push(k, k + 1 < px.length || j !== 0 ? k + 1 : start);
      }
      ringEnds.push(start, px.length);
    });
    const flat = new Float64Array(px.length * 2);
    for (let i = 0; i < px.length; i++) { flat[i * 2] = px[i]; flat[i * 2 + 1] = py[i]; }
    const tris = refine(px, py, dropFlat(px, py, keepRingPoints(earcut(flat, holes.length ? holes : null, 2), ringEnds, px.length)), max2);

    const base = X.length;
    for (let i = 0; i < px.length; i++) { X.push(px[i]); Y.push(py[i]); UPM.push(p.upm); KIND.push(0); CI.push(p.ci); }
    for (let i = 0; i < tris.length; i++) indices.push(base + tris[i]);
    // The coast wall: from the surface up to the base plane.
    for (let k = 0; k < wall.length; k += 2) {
      const a = wall[k], b = wall[k + 1];
      const v = X.length;
      X.push(px[a], px[b], px[a], px[b]); Y.push(py[a], py[b], py[a], py[b]);
      UPM.push(p.upm, p.upm, p.upm, p.upm); KIND.push(1, 1, 2, 2); CI.push(p.ci, p.ci, p.ci, p.ci);
      indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  while (filled <= counties) first[filled++] = X.length;

  const count = X.length;
  const positions = new Float32Array(count * 3);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    positions[i * 3] = X[i]; positions[i * 3 + 1] = Y[i]; positions[i * 3 + 2] = UPM[i];
    if (X[i] < minX) minX = X[i]; if (X[i] > maxX) maxX = X[i];
    if (Y[i] < minY) minY = Y[i]; if (Y[i] > maxY) maxY = Y[i];
  }

  // ---- the raster: which county is at each cell ----
  const cell = opt.cell;
  const reach = opt.reach / cell;
  const margin = Math.ceil(reach) + 2;
  const x0 = minX - margin * cell, y0 = minY - margin * cell;
  const w = Math.ceil((maxX - minX) / cell) + 2 * margin, h = Math.ceil((maxY - minY) / cell) + 2 * margin;
  const id = new Int16Array(w * h).fill(-1);
  const cross: number[] = [];
  for (const p of projected) {
    let lo = Infinity, hi = -Infinity;
    for (const y of p.rings[0].y) { if (y < lo) lo = y; if (y > hi) hi = y; }
    const j0 = Math.max(0, Math.ceil((lo - y0) / cell - 0.5)), j1 = Math.min(h - 1, Math.floor((hi - y0) / cell - 0.5));
    for (let j = j0; j <= j1; j++) {
      const yc = y0 + (j + 0.5) * cell;
      cross.length = 0;
      for (const r of p.rings) {
        for (let i = 0, n = r.x.length; i < n; i++) {
          const k = (i + 1) % n;
          const ya = r.y[i], yb = r.y[k];
          if ((ya <= yc) !== (yb <= yc)) cross.push(r.x[i] + ((yc - ya) / (yb - ya)) * (r.x[k] - r.x[i]));
        }
      }
      cross.sort((a, b) => a - b);
      for (let c = 0; c + 1 < cross.length; c += 2) {
        const i0 = Math.max(0, Math.ceil((cross[c] - x0) / cell - 0.5)), i1 = Math.min(w - 1, Math.floor((cross[c + 1] - x0) / cell - 0.5));
        for (let i = i0; i <= i1; i++) id[j * w + i] = p.ci;
      }
    }
  }
  const grid: Grid = { x0, y0, cell, w, h, id, reach };

  // ---- the blend of each vertex ----
  const blendId = new Float32Array(count * 4), blendW = new Float32Array(count * 4);
  const blendX = new Float32Array(count * 4), blendY = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) {
    if (!blendAt(grid, X[v], Y[v], blendId, blendW, blendX, blendY, v * 4)) { blendId[v * 4] = CI[v]; blendW[v * 4] = 1; }
  }
  return {
    count, positions, kind: Uint8Array.from(KIND), county: Uint16Array.from(CI), indices: Uint32Array.from(indices),
    first, grid, blendId, blendW, blendX, blendY,
  };
}

// ---- the blend ----

const MAXC = 48;
const tId = new Int32Array(MAXC), tS = new Float64Array(MAXC), tX = new Float64Array(MAXC), tY = new Float64Array(MAXC);
let kx = new Float64Array(0), dkx = new Float64Array(0);

/** The counties near a point and their weights (the 4 largest), written at offset o of the four arrays.
 *  The kernel is (1 - t^2)^2, t = distance / reach: smooth, and 0 at the reach. The weights and their
 *  slopes change smoothly with the position. Returns false when no land is in reach. */
export function blendAt(
  grid: Grid, x: number, y: number,
  ids: Float32Array, ws: Float32Array, wxs: Float32Array, wys: Float32Array, o: number,
): boolean {
  const R = grid.reach, { w, h, id } = grid;
  const u = (x - grid.x0) / grid.cell - 0.5, v = (y - grid.y0) / grid.cell - 0.5;
  const i0 = Math.max(0, Math.ceil(u - R)), i1 = Math.min(w - 1, Math.floor(u + R));
  const j0 = Math.max(0, Math.ceil(v - R)), j1 = Math.min(h - 1, Math.floor(v + R));
  const span = i1 - i0 + 1;
  if (kx.length < span) { kx = new Float64Array(span + 8); dkx = new Float64Array(span + 8); }
  const dk = 4 / (R * grid.cell);   // d/dx of (1 - t^2)^2 with t = (i - u) / R is 4 t (1 - t^2) / (R cell)
  for (let i = i0; i <= i1; i++) {
    const t = (i - u) / R, q = 1 - t * t;
    kx[i - i0] = q * q; dkx[i - i0] = dk * t * q;
  }
  let n = 0, last = -1, slot = 0;
  for (let j = j0; j <= j1; j++) {
    const t = (j - v) / R, q = 1 - t * t;
    const ky = q * q, dky = dk * t * q;
    const row = j * w;
    for (let i = i0; i <= i1; i++) {
      const c = id[row + i];
      if (c < 0) continue;
      if (c !== last) {
        for (slot = 0; slot < n && tId[slot] !== c; slot++);
        if (slot === n) {
          if (n === MAXC) { last = -1; continue; }
          tId[n] = c; tS[n] = tX[n] = tY[n] = 0; n++;
        }
        last = c;
      }
      const a = kx[i - i0];
      tS[slot] += a * ky; tX[slot] += dkx[i - i0] * ky; tY[slot] += a * dky;
    }
  }
  let D = 0, Dx = 0, Dy = 0;
  for (let k = 0; k < n; k++) { D += tS[k]; Dx += tX[k]; Dy += tY[k]; }
  if (!(D > 1e-9)) return false;
  // Keep the 4 largest. Then the weights sum to 1 again and the slope weights sum to 0 again.
  let sum = 0, sx = 0, sy = 0, kept = 0;
  for (; kept < 4 && kept < n; kept++) {
    let best = kept;
    for (let k = kept + 1; k < n; k++) if (tS[k] > tS[best]) best = k;
    const c = tId[best], S = tS[best], Sx = tX[best], Sy = tY[best];
    tId[best] = tId[kept]; tS[best] = tS[kept]; tX[best] = tX[kept]; tY[best] = tY[kept];
    const wt = S / D;
    ids[o + kept] = c; ws[o + kept] = wt;
    wxs[o + kept] = (Sx - wt * Dx) / D; wys[o + kept] = (Sy - wt * Dy) / D;
    sum += wt; sx += wxs[o + kept]; sy += wys[o + kept];
  }
  for (let k = 0; k < 4; k++) {
    if (k < kept) { ws[o + k] /= sum; wxs[o + k] -= sx / kept; wys[o + k] -= sy / kept; }
    else { ids[o + k] = 0; ws[o + k] = 0; wxs[o + k] = 0; wys[o + k] = 0; }
  }
  return true;
}
