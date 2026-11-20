// The 3D scene: two Hollow shafts side by side (left: without Blackout Warning, right: with it).
// Each shaft is 50 levels × 8 sections, set on the back half of a ring so the shaft is cut open toward the camera.
// One instanced mesh for the rock blocks, one for the lit rooms, one for the 6 plants. Colors come from the day
// frames (compute.ts) and are interpolated between days; this component never calls setState per frame.
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { LEVELS, SECTIONS_PER_LEVEL, SECTION_COUNT } from '../sim/types.ts';
import { PLANTS, type SideData, type TwinData } from './compute.ts';
import { COLORS, RGB } from './palette.ts';

// ---------- Layout (world units) ----------
const R = 3; // ring radius
const ARC = (220 * Math.PI) / 180; // the 8 sections cover 220° of the back of the ring
const STEP = ARC / SECTIONS_PER_LEVEL;
const PITCH = 0.22; // height of one level
const BLOCK_H = 0.18;
const DEPTH = 0.5;
const CHORD = 2 * R * Math.sin(STEP / 2);
export const SHAFT_H = LEVELS * PITCH;
const GAP = 3.4; // between the two shafts' axes and the center
const PLANT_LEVELS = [8, 18, 27, 34, 41, 47];
export const SHAFT_X = R + GAP / 2 + 0.6; // axis of each shaft from the center
const RULER = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const LABEL_Y = 1.6; // the bottom of each HTML label (above the surface ruins)
const LABEL_PX = 92; // room kept above LABEL_Y for the label, in screen pixels

/** Angle of section column `col` measured from the −z axis (the back of the ring). */
const angleOf = (col: number) => -ARC / 2 + STEP * (col + 0.5);
const levelY = (level: number) => -(level - 0.5) * PITCH;

export interface Clock {
  /** The shown day, 0..D (fractional between day frames). */
  day: number;
  /** Seconds, for the air pulse. */
  pulseT: number;
  /** False with prefers-reduced-motion: the air stays a steady red. */
  pulse: boolean;
  /**
   * Share of each day that shows that day's snapshot unchanged before the cross-fade to the next day (0..1).
   * The demo page uses 0.85 so the drawn state matches its whole-day labels; the film (no labels) blends smoothly (0).
   */
  hold?: number;
}

// Static geometry and materials, created once per module (disposed by the scene on unmount).
function useResources() {
  const res = useMemo(() => {
    const block = new THREE.BoxGeometry(CHORD * 0.94, BLOCK_H, DEPTH);
    const room = new THREE.PlaneGeometry(CHORD * 0.78, BLOCK_H * 0.62);
    const plantCore = new THREE.CylinderGeometry(0.34, 0.34, PITCH * 1.7, 24);
    const plantPad = new THREE.BoxGeometry(0.22, PITCH * 0.7, 0.62);
    const halo = new THREE.PlaneGeometry(CHORD * 1.02, PITCH * 1.5);
    const wall = new THREE.CylinderGeometry(R + DEPTH / 2 + 0.06, R + DEPTH / 2 + 0.06, SHAFT_H + 0.5, 48, 1, true, Math.PI - ARC / 2 - 0.08, ARC + 0.16);
    const crust = new THREE.RingGeometry(R + DEPTH / 2 + 0.06, R + 2.2, 48, 1, 0, Math.PI * 2);
    const rim = new THREE.TorusGeometry(R - DEPTH / 2 - 0.02, 0.03, 6, 64, ARC);
    const ruin = new THREE.BoxGeometry(1, 1, 1);
    const outline = new THREE.EdgesGeometry(new THREE.BoxGeometry(CHORD * 0.98, BLOCK_H * 1.25, DEPTH * 1.1));
    const selectMat = new THREE.LineBasicMaterial({ color: '#ffd479', toneMapped: false });
    const hoverMat = new THREE.LineBasicMaterial({ color: '#ebe6dc', toneMapped: false, transparent: true, opacity: 0.7 });
    const rockMat = new THREE.MeshStandardMaterial({ color: COLORS.rock, roughness: 0.92, metalness: 0, emissive: COLORS.rockDeep, emissiveIntensity: 0.6 });
    const haloMat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.rockDeep, roughness: 1, side: THREE.BackSide });
    const crustMat = new THREE.MeshStandardMaterial({ color: COLORS.crust, roughness: 1, side: THREE.DoubleSide });
    const roomMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const plantMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const rimWithout = new THREE.MeshBasicMaterial({ color: COLORS.without, toneMapped: false });
    const rimWith = new THREE.MeshBasicMaterial({ color: COLORS.with, toneMapped: false });
    return { outline, selectMat, hoverMat, block, room, halo, haloMat, plantCore, plantPad, wall, crust, rim, ruin, rockMat, wallMat, crustMat, roomMat, plantMat, rimWithout, rimWith };
  }, []);
  useEffect(() => () => { for (const r of Object.values(res)) r.dispose(); }, [res]);
  return res;
}
type Res = ReturnType<typeof useResources>;

// Instance transforms, computed once.
const blockMatrices = (() => {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const blocks: THREE.Matrix4[] = [];
  const rooms: THREE.Matrix4[] = [];
  const halos: THREE.Matrix4[] = [];
  for (let level = 1; level <= LEVELS; level++) {
    for (let col = 0; col < SECTIONS_PER_LEVEL; col++) {
      const a = angleOf(col);
      // Block faces the axis: its local +z points inward.
      q.setFromAxisAngle(up, -a);
      const y = levelY(level);
      blocks.push(m.clone().compose(new THREE.Vector3(R * Math.sin(a), y, -R * Math.cos(a)), q, new THREE.Vector3(1, 1, 1)));
      const rr = R - DEPTH / 2 - 0.004;
      rooms.push(m.clone().compose(new THREE.Vector3(rr * Math.sin(a), y, -rr * Math.cos(a)), q, new THREE.Vector3(1, 1, 1)));
      const rh = R - DEPTH / 2 - 0.03;
      halos.push(m.clone().compose(new THREE.Vector3(rh * Math.sin(a), y, -rh * Math.cos(a)), q, new THREE.Vector3(1, 1, 1)));
    }
  }
  const plants: THREE.Matrix4[] = [];
  const pads: THREE.Matrix4[] = [];
  const a0 = angleOf(0);
  for (const level of PLANT_LEVELS) {
    q.setFromAxisAngle(up, -a0);
    const rp = R + DEPTH / 2 + 0.62;
    const y = levelY(level);
    plants.push(m.clone().compose(new THREE.Vector3(rp * Math.sin(a0), y, -rp * Math.cos(a0)), q, new THREE.Vector3(1, 1, 1)));
    const rq = R + DEPTH / 2 + 0.28;
    pads.push(m.clone().compose(new THREE.Vector3(rq * Math.sin(a0), y, -rq * Math.cos(a0)), q, new THREE.Vector3(1, 1, 1)));
  }
  // Surface ruins: fixed, hand-placed (no randomness).
  const ruins: THREE.Matrix4[] = [];
  const spots: [number, number, number, number, number][] = [
    // angle (deg from −z), radius, width, height, depth
    // Only behind and beside the mouth, so no ruin covers the shaft.
    [-100, 4.7, 0.5, 0.3, 0.8], [-70, 4.5, 0.8, 0.22, 0.5], [-48, 4.9, 0.35, 0.9, 0.35],
    [-20, 4.5, 0.7, 0.4, 0.6], [8, 4.9, 0.5, 0.18, 0.9], [34, 4.4, 0.4, 0.7, 0.4], [62, 4.8, 0.9, 0.28, 0.5],
    [95, 4.6, 0.5, 0.45, 0.45],
  ];
  for (const [deg, rad, w, h, d] of spots) {
    const a = (deg * Math.PI) / 180;
    q.setFromAxisAngle(up, -a + 0.3 * Math.sin(deg));
    ruins.push(m.clone().compose(new THREE.Vector3(rad * Math.sin(a), h / 2, -rad * Math.cos(a)), q, new THREE.Vector3(w, h, d)));
  }
  return { blocks, rooms, halos, plants, pads, ruins };
})();

type PickHandlers = {
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
};

function StaticInstances({ geometry, material, matrices, pick }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; pick?: PickHandlers }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    matrices.forEach((mx, i) => mesh.setMatrixAt(i, mx));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} frustumCulled={false} {...pick} />;
}

/** The lit rooms and plants of one shaft; their colors follow the clock. */
function LiveInstances({ side, days, clock, res, pick }: { side: SideData; days: number; clock: React.MutableRefObject<Clock>; res: Res; pick?: PickHandlers }) {
  const rooms = useRef<THREE.InstancedMesh>(null);
  const plants = useRef<THREE.InstancedMesh>(null);
  const halos = useRef<THREE.InstancedMesh>(null);
  const last = useRef({ day: -1, phase: -1, side: null as SideData | null });

  useLayoutEffect(() => {
    for (const [mesh, mats, n] of [[rooms.current!, blockMatrices.rooms, SECTION_COUNT], [plants.current!, blockMatrices.plants, PLANTS]] as const) {
      mats.forEach((mx, i) => mesh.setMatrixAt(i, mx));
      mesh.instanceMatrix.needsUpdate = true;
      if (!mesh.instanceColor) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      mesh.computeBoundingSphere();
    }
    // The glow behind each room shares the rooms' color buffer.
    const h = halos.current!;
    blockMatrices.halos.forEach((mx, i) => h.setMatrixAt(i, mx));
    h.instanceMatrix.needsUpdate = true;
    h.instanceColor = rooms.current!.instanceColor;
  }, []);

  useFrame(() => {
    const c = clock.current;
    const day = Math.max(0, Math.min(days, c.day));
    const phase = c.pulse ? 0.5 + 0.5 * Math.sin(c.pulseT * Math.PI * 1.6) : 0.5;
    const L = last.current;
    if (L.day === day && L.phase === phase && L.side === side) return;
    L.day = day; L.phase = phase; L.side = side;
    const d0 = Math.floor(day);
    const d1 = Math.min(days, d0 + 1);
    const h = Math.max(0, Math.min(0.99, c.hold ?? 0));
    const f = h > 0 ? Math.max(0, (day - d0 - h) / (1 - h)) : day - d0;
    const col = rooms.current!.instanceColor!.array as Float32Array;
    const lo = RGB.airLow, hi = RGB.air;
    for (let i = 0; i < SECTION_COUNT; i++) {
      const a = (d0 * SECTION_COUNT + i) * 3;
      const b = (d1 * SECTION_COUNT + i) * 3;
      const p = side.pulse[d0 * SECTION_COUNT + i] * (1 - f) + side.pulse[d1 * SECTION_COUNT + i] * f;
      for (let k = 0; k < 3; k++) {
        const base = side.color[a + k] * (1 - f) + side.color[b + k] * f;
        const red = lo[k] + (hi[k] - lo[k]) * phase;
        col[i * 3 + k] = p > 0 ? base * (1 - p) + red * p : base;
      }
    }
    rooms.current!.instanceColor!.needsUpdate = true;
    const pc = plants.current!.instanceColor!.array as Float32Array;
    for (let k = 0; k < PLANTS * 3; k++) pc[k] = side.plant[d0 * PLANTS * 3 + k] * (1 - f) + side.plant[d1 * PLANTS * 3 + k] * f;
    plants.current!.instanceColor!.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={rooms} args={[res.room, res.roomMat, SECTION_COUNT]} frustumCulled={false} {...pick} />
      <instancedMesh ref={halos} args={[res.halo, res.haloMat, SECTION_COUNT]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={plants} args={[res.plantCore, res.plantMat, PLANTS]} frustumCulled={false} />
    </>
  );
}

export type SideKey = 'without' | 'with';
export interface Pick { side: SideKey; index: number }

function Shaft({ x, side, days, clock, res, accent, label, onPick, selected, hovered, ruler }: {
  x: number; side: SideData; days: number; clock: React.MutableRefObject<Clock>; res: Res; accent: SideKey; label?: ReactNode;
  onPick?: (p: Pick | null, kind: 'hover' | 'click') => void; selected?: number | null; hovered?: number | null; ruler?: boolean;
}) {
  const pick = useMemo<PickHandlers | undefined>(() => onPick && {
    onPointerMove: (e) => { e.stopPropagation(); if (e.instanceId !== undefined) onPick({ side: accent, index: e.instanceId }, 'hover'); },
    onPointerOut: () => onPick(null, 'hover'),
    onClick: (e) => { e.stopPropagation(); if (e.instanceId !== undefined) onPick({ side: accent, index: e.instanceId }, 'click'); },
  }, [onPick, accent]);
  return (
    <group position={[x, 0, 0]}>
      <StaticInstances geometry={res.block} material={res.rockMat} matrices={blockMatrices.blocks} pick={pick} />
      <StaticInstances geometry={res.plantPad} material={res.rockMat} matrices={blockMatrices.pads} />
      <LiveInstances side={side} days={days} clock={clock} res={res} pick={pick} />
      {hovered != null && <lineSegments geometry={res.outline} material={res.hoverMat} matrix={blockMatrices.blocks[hovered]} matrixAutoUpdate={false} />}
      {selected != null && <lineSegments geometry={res.outline} material={res.selectMat} matrix={blockMatrices.blocks[selected]} matrixAutoUpdate={false} />}
      {ruler && RULER.map((level) => (
        <Html key={level} position={[R * 0.97 + 0.55, levelY(level), -0.2]} zIndexRange={[3, 0]} className="ws-ruler-tick">
          <span>L{level}</span>
        </Html>
      ))}
      <mesh geometry={res.wall} material={res.wallMat} position={[0, -SHAFT_H / 2 + 0.1, 0]} />
      {/* The surface: a crust around the shaft mouth, with a few ruins. */}
      <mesh geometry={res.crust} material={res.crustMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />
      <StaticInstances geometry={res.ruin} material={res.crustMat} matrices={blockMatrices.ruins} />
      {/* Rim in the side's color: ember = without, blue = with. */}
      <mesh geometry={res.rim} material={accent === 'with' ? res.rimWith : res.rimWithout} rotation={[Math.PI / 2, 0, -ARC / 2 - Math.PI / 2]} position={[0, 0.06, 0]} />
      {label && (
        <Html position={[0, LABEL_Y, 0]} zIndexRange={[4, 0]} className="twin-label-anchor">
          {label}
        </Html>
      )}
    </group>
  );
}

/** The vertical box the camera fits: the shafts, plus room for the HTML labels above them in the demo. */
function frameBox(film: boolean, extraTop = 0) {
  const top = (film ? 1.4 : LABEL_Y) + extraTop;
  const bottom = -SHAFT_H - 0.4;
  return { halfH: (top - bottom) / 2, cy: (top + bottom) / 2 };
}

/** Puts the camera at a fixed three-quarter view that fits both shafts in the canvas. */
function CameraFit({ film, push = 0, single = false }: { film: boolean; push?: number; single?: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const halfW = single ? R + 2.4 : SHAFT_X + R + 1.4;
    const fov = 28;
    const t = Math.tan(((fov / 2) * Math.PI) / 180);
    // Fit the box; in the demo, grow the top until LABEL_PX pixels fit above the labels' anchor (2 passes converge).
    let extra = 0;
    let box = frameBox(film);
    let dist = 0;
    for (let pass = 0; pass < 3; pass++) {
      box = frameBox(film, extra);
      dist = Math.max(box.halfH / t, halfW / (t * aspect)) * 1.1 * (1 - push);
      if (film) break;
      const unitsPerPx = (2 * dist * t) / Math.max(1, size.height);
      extra = LABEL_PX * unitsPerPx;
    }
    const { cy } = box;
    dist += R;
    const elev = (16 * Math.PI) / 180;
    const yaw = 0; // straight on, so both shafts are the same size (a fair comparison)
    camera.fov = fov;
    camera.near = 1;
    camera.far = dist * 3;
    camera.position.set(Math.sin(yaw) * Math.cos(elev) * dist, cy + Math.sin(elev) * dist, Math.cos(yaw) * Math.cos(elev) * dist);
    camera.lookAt(0, cy, -R * 0.4);
    orbitTarget.set(0, cy, -R * 0.4);
    if (controls?.target) { controls.target.copy(orbitTarget); controls.update(); }
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size, film, push, invalidate, controls, single]);
  return null;
}

// The orbit target follows the fitted view's center (set by CameraFit).
const orbitTarget = new THREE.Vector3(0, frameBox(false).cy, -R * 0.4);

export function TwinScene({ data, clock, film = false, push = 0, labels, controls = false, view = 'both', onPick, selected, hovered, ruler = false }: {
  data: TwinData; clock: React.MutableRefObject<Clock>; film?: boolean; push?: number;
  labels?: { without: ReactNode; with: ReactNode }; controls?: boolean;
  /** Which shafts to draw (the workstation's view mode). */
  view?: 'both' | SideKey;
  onPick?: (p: Pick | null, kind: 'hover' | 'click') => void;
  selected?: Pick | null;
  hovered?: Pick | null;
  /** Level ticks (L1 … L50) beside each shaft. */
  ruler?: boolean;
}) {
  const xOf = (side: SideKey) => (view === 'both' ? (side === 'without' ? -SHAFT_X : SHAFT_X) : 0);
  const sel = (side: SideKey) => (selected?.side === side ? selected.index : null);
  const hov = (side: SideKey) => (hovered?.side === side ? hovered.index : null);
  const res = useResources();
  return (
    <>
      <color attach="background" args={[COLORS.bg]} />
      <fog attach="fog" args={[COLORS.bg, 40, 120]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#c9d3e0', '#2a2520', 0.6]} />
      <directionalLight position={[-6, 10, 14]} intensity={1.3} />
      <CameraFit film={film} push={push} single={view !== 'both'} />
      {view !== 'with' && (
        <Shaft x={xOf('without')} side={data.without} days={data.days} clock={clock} res={res} accent="without" label={labels?.without}
          onPick={onPick} selected={sel('without')} hovered={hov('without')} ruler={ruler} />
      )}
      {view !== 'without' && (
        <Shaft x={xOf('with')} side={data.with} days={data.days} clock={clock} res={res} accent="with" label={labels?.with}
          onPick={onPick} selected={sel('with')} hovered={hov('with')} ruler={ruler} />
      )}
      {controls && (
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping={false}
          minAzimuthAngle={-0.45}
          maxAzimuthAngle={0.45}
          minPolarAngle={1.0}
          maxPolarAngle={1.62}
          minDistance={20}
          maxDistance={90}
          target={orbitTarget}
        />
      )}
    </>
  );
}
