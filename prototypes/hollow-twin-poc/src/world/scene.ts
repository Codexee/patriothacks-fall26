// PROTOTYPE: the Pixi scene for the cutaway. Built once per width; frames update sprites in place.
import { Container, Sprite, Texture, type Application } from 'pixi.js';
import { LEVELS, SECTIONS_PER_LEVEL, SECTION_COUNT, type Frame, type StructureKind } from '../sim/types.ts';
import {
  BULB_OFF, BULB_ON, HOVER_COLOR, ROOM_H, ROW_H, SELECT_COLOR, SICK_TINT, SURFACE_H, CRUST_H, WALL_W,
  computeLayout, type Layout,
} from './palette.ts';
import {
  CROWD_H, CROWD_MAX, backgroundTexture, crowdTexture, dripTexture, fogTexture, glowTexture, hash2, heatTexture,
  puddleTexture, rubbleTexture, sickTexture, structTextures, type StructTextures,
} from './textures.ts';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerpColor = (a: number, b: number, t: number) => {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};

const DRIPS = 3;
const FLOOR_ORDER: StructureKind[] = ['plant', 'recycler', 'clinic', 'farm'];

interface StructNode { root: Container; blade?: Sprite; core?: Sprite; halo?: Sprite; lamp?: Sprite }

interface Section {
  rx: number; ry: number;
  glow: Sprite; bulb: Sprite; crowd: Sprite; sick: Sprite; heat: Sprite; fog: Sprite; dark: Sprite; rubble: Sprite;
  drips: Sprite[]; dripX: number[]; dripPhase: number[]; puddle: Sprite;
  structs: Partial<Record<StructureKind, StructNode>>;
  structKey: string;
  crowdVariant: number;
}

/** Channels smoothed toward the latest frame every tick. */
interface Channels { power: Float32Array; heat: Float32Array; fog: Float32Array; sick: Float32Array; wet: Float32Array }
const makeChannels = (): Channels => ({
  power: new Float32Array(SECTION_COUNT).fill(1), heat: new Float32Array(SECTION_COUNT),
  fog: new Float32Array(SECTION_COUNT), sick: new Float32Array(SECTION_COUNT), wet: new Float32Array(SECTION_COUNT),
});

export class HollowScene {
  layout: Layout;
  private root = new Container();
  private textures: Texture[] = [];
  private sections: Section[] = [];
  private st!: StructTextures;
  private crowdTex: Texture[][] = [];
  private cur = makeChannels();
  private tgt = makeChannels();
  private lost = new Uint8Array(SECTION_COUNT);
  private peopleMax = 1;
  private time = 0;
  private selectBox: Container;
  private hoverBox: Container;
  private layers: Record<string, Container> = {};

  constructor(private app: Application, artW: number) {
    this.layout = computeLayout(artW);
    app.stage.addChild(this.root);
    this.build();
    this.selectBox = this.outline(SELECT_COLOR, 1);
    this.hoverBox = this.outline(HOVER_COLOR, 0.45);
    this.root.addChild(this.hoverBox, this.selectBox);
  }

  private keep(t: Texture) { this.textures.push(t); return t; }

  private build() {
    const L = this.layout;
    const w = L.roomW, h = ROOM_H;
    this.root.addChild(new Sprite(this.keep(backgroundTexture(L))));
    const names = ['glow', 'struct', 'crowd', 'sick', 'heat', 'fog', 'drip', 'dark', 'rubble'];
    for (const n of names) { const c = new Container(); this.layers[n] = c; this.root.addChild(c); }
    this.layers.glow.blendMode = 'add';

    const glowT = this.keep(glowTexture(w, h));
    const heatT = this.keep(heatTexture(w, h));
    const fogT = [this.keep(fogTexture(w, h, 1)), this.keep(fogTexture(w, h, 2)), this.keep(fogTexture(w, h, 3))];
    const sickT = [this.keep(sickTexture(w, h, 1)), this.keep(sickTexture(w, h, 2))];
    const rubbleT = [this.keep(rubbleTexture(w, h, 1)), this.keep(rubbleTexture(w, h, 2)), this.keep(rubbleTexture(w, h, 3))];
    const dripT = this.keep(dripTexture());
    const puddleT = this.keep(puddleTexture(Math.max(4, Math.floor(w * 0.35))));
    this.st = structTextures();
    Object.values(this.st).forEach((t) => this.keep(t));
    for (let v = 0; v < 3; v++) {
      const row: Texture[] = [];
      for (let n = 0; n <= CROWD_MAX; n++) row.push(this.keep(crowdTexture(w, n, v * 101 + 7)));
      this.crowdTex.push(row);
    }

    for (let level = 1; level <= LEVELS; level++) {
      for (let col = 0; col < SECTIONS_PER_LEVEL; col++) {
        const i = (level - 1) * SECTIONS_PER_LEVEL + col;
        const rx = L.roomX(col), ry = L.rowY(level);
        const at = (t: Texture, layer: string, x = rx, y = ry) => {
          const s = new Sprite(t); s.position.set(x, y); this.layers[layer].addChild(s); return s;
        };
        const glow = at(glowT, 'glow');
        const bulb = at(Texture.WHITE, 'struct', rx + (w >> 1) - 1, ry + 3);
        bulb.width = 3; bulb.height = 1;
        const crowdVariant = i % 3;
        const crowd = at(this.crowdTex[crowdVariant][0], 'crowd', rx, ry + ROOM_H - CROWD_H);
        const sick = at(sickT[i % 2], 'sick'); sick.alpha = 0;
        const heat = at(heatT, 'heat'); heat.alpha = 0;
        const fog = at(fogT[i % 3], 'fog'); fog.alpha = 0;
        const dark = at(Texture.WHITE, 'dark'); dark.tint = 0x000000; dark.width = w; dark.height = h; dark.alpha = 0;
        const rubble = at(rubbleT[i % 3], 'rubble'); rubble.visible = false;
        const drips: Sprite[] = [], dripX: number[] = [], dripPhase: number[] = [];
        for (let d = 0; d < DRIPS; d++) {
          dripX.push(rx + 3 + Math.floor(hash2(i, d, 77) * (w - 6)));
          dripPhase.push(hash2(i, d, 78));
          const s = at(dripT, 'drip'); s.visible = false; drips.push(s);
        }
        const puddle = at(puddleT, 'drip', rx + Math.floor(w * 0.3), ry + ROOM_H - 1); puddle.visible = false;
        this.sections.push({ rx, ry, glow, bulb, crowd, sick, heat, fog, dark, rubble, drips, dripX, dripPhase, puddle, structs: {}, structKey: '', crowdVariant });
      }
    }
  }

  private outline(color: number, alpha: number): Container {
    const c = new Container();
    const w = this.layout.roomW + 2, h = ROOM_H + 2;
    const bars: [number, number, number, number][] = [[0, 0, w, 1], [0, h - 1, w, 1], [0, 0, 1, h], [w - 1, 0, 1, h]];
    for (const [x, y, bw, bh] of bars) {
      const s = new Sprite(Texture.WHITE); s.tint = color; s.position.set(x, y); s.width = bw; s.height = bh; c.addChild(s);
    }
    c.alpha = alpha; c.visible = false;
    return c;
  }

  private placeBox(box: Container, t: { level: number; col: number } | null | undefined) {
    if (!t || t.level < 1 || t.level > LEVELS || t.col < 0 || t.col >= SECTIONS_PER_LEVEL) { box.visible = false; return; }
    box.visible = true;
    box.position.set(this.layout.roomX(t.col) - 1, this.layout.rowY(t.level) - 1);
  }
  setSelected(t: { level: number; col: number } | null | undefined) { this.placeBox(this.selectBox, t); }
  setHover(t: { level: number; col: number } | null) { this.placeBox(this.hoverBox, t); }

  private structNode(sec: Section, kind: StructureKind): StructNode {
    const have = sec.structs[kind];
    if (have) return have;
    const st = this.st;
    const root = new Container();
    const node: StructNode = { root };
    if (kind === 'plant') {
      node.halo = new Sprite(st.halo); node.halo.position.set(-1, 2); node.halo.blendMode = 'add';
      root.addChild(new Sprite(st.plant), node.halo);
      node.core = new Sprite(st.core); node.core.position.set(4, 6); root.addChild(node.core);
    } else if (kind === 'fan') {
      root.addChild(new Sprite(st.fanBody));
      node.blade = new Sprite(st.fanBlade); node.blade.anchor.set(0.5); node.blade.position.set(4.5, 4.5); root.addChild(node.blade);
    } else if (kind === 'farm') {
      root.addChild(new Sprite(st.farm));
      node.lamp = new Sprite(st.farmLamp); node.lamp.position.set(1, 1); node.lamp.blendMode = 'add'; root.addChild(node.lamp);
    } else if (kind === 'recycler') root.addChild(new Sprite(st.recycler));
    else root.addChild(new Sprite(st.clinic));
    this.layers.struct.addChild(root);
    sec.structs[kind] = node;
    return node;
  }

  private layoutStructs(sec: Section, kinds: StructureKind[]) {
    for (const n of Object.values(sec.structs)) if (n) n.root.visible = false;
    let x = sec.rx + this.layout.roomW - 2;
    const floor = sec.ry + ROOM_H;
    for (const kind of FLOOR_ORDER) {
      if (!kinds.includes(kind)) continue;
      const n = this.structNode(sec, kind);
      const b = n.root.getLocalBounds();
      x -= Math.ceil(b.width);
      n.root.position.set(x, floor - Math.ceil(b.height + b.y));
      n.root.visible = true;
      x -= 1;
    }
    if (kinds.includes('fan')) {
      const n = this.structNode(sec, 'fan');
      n.root.position.set(sec.rx + 3, sec.ry + 4);
      n.root.visible = true;
    }
  }

  setFrame(frame: Frame) {
    const secs = frame.sections;
    let maxP = this.peopleMax;
    for (let i = 0; i < secs.length; i++) if (secs[i].people > maxP) maxP = secs[i].people;
    this.peopleMax = maxP;
    for (let i = 0; i < SECTION_COUNT && i < secs.length; i++) {
      const v = secs[i], sec = this.sections[i];
      this.tgt.power[i] = v.lost ? 0 : clamp01(v.power);
      this.tgt.heat[i] = clamp01((v.wetBulb - 27) / 8);
      this.tgt.fog[i] = clamp01((v.co2 - 1000) / 4000);
      this.tgt.sick[i] = clamp01(v.infected);
      this.tgt.wet[i] = v.water < 0.6 ? clamp01((0.6 - v.water) / 0.6) : 0;
      this.lost[i] = v.lost ? 1 : 0;
      sec.rubble.visible = v.lost;
      const n = v.lost ? 0 : Math.min(CROWD_MAX, Math.ceil((v.people / maxP) * CROWD_MAX - 0.25));
      sec.crowd.texture = this.crowdTex[sec.crowdVariant][Math.max(0, n)];
      const key = v.lost ? '' : v.structures.slice().sort().join(',');
      if (key !== sec.structKey) { sec.structKey = key; this.layoutStructs(sec, v.lost ? [] : v.structures); }
    }
  }

  tick(dtMs: number) {
    const dt = Math.min(0.1, dtMs / 1000);
    this.time += dt;
    const t = this.time;
    const k = 1 - Math.exp(-dt / 0.12);
    const { cur, tgt } = this;
    for (let i = 0; i < this.sections.length; i++) {
      const sec = this.sections[i];
      const p = (cur.power[i] += (tgt.power[i] - cur.power[i]) * k);
      const ht = (cur.heat[i] += (tgt.heat[i] - cur.heat[i]) * k);
      const fg = (cur.fog[i] += (tgt.fog[i] - cur.fog[i]) * k);
      const sk = (cur.sick[i] += (tgt.sick[i] - cur.sick[i]) * k);
      const wt = (cur.wet[i] += (tgt.wet[i] - cur.wet[i]) * k);
      const lost = this.lost[i] === 1;
      const flicker = p > 0.02 && p < 0.7 ? 0.85 + 0.15 * Math.sin(t * 23 + i * 1.7) : 1;
      sec.glow.alpha = p * 0.9 * flicker;
      sec.bulb.tint = lerpColor(BULB_OFF, BULB_ON, p * flicker);
      sec.dark.alpha = Math.max(lost ? 0.55 : 0, (1 - p) * 0.8);
      sec.heat.alpha = ht * (0.75 + 0.2 * Math.sin(t * 3 + i));
      sec.fog.alpha = fg * (0.85 + 0.15 * Math.sin(t * 0.9 + i * 0.6));
      sec.sick.alpha = Math.min(1, sk * 2.5);
      sec.crowd.tint = lerpColor(0xffffff, SICK_TINT, Math.min(1, sk * 2));
      sec.crowd.visible = !lost;
      // drips
      const active = lost ? 0 : Math.ceil(wt * DRIPS - 0.05);
      for (let d = 0; d < DRIPS; d++) {
        const s = sec.drips[d];
        s.visible = d < active;
        if (!s.visible) continue;
        const ph = (t * 0.7 + sec.dripPhase[d]) % 1;
        s.position.set(sec.dripX[d], sec.ry + 3 + Math.floor(ph * (ROOM_H - 5)));
      }
      sec.puddle.visible = wt > 0.05 && !lost;
      sec.puddle.alpha = Math.min(1, wt * 2);
      // structure animation
      const fan = sec.structs.fan;
      if (fan?.root.visible && fan.blade) fan.blade.rotation += dt * 9 * p;
      const plant = sec.structs.plant;
      if (plant?.root.visible) {
        const pulse = 0.7 + 0.3 * Math.sin(t * 4 + i);
        plant.core!.alpha = 0.25 + 0.75 * p * pulse;
        plant.halo!.alpha = p * pulse;
      }
      const farm = sec.structs.farm;
      if (farm?.root.visible) farm.lamp!.alpha = p;
    }
  }

  /** Map an art-pixel position to a section, or null outside the rooms. */
  hitTest(ax: number, ay: number): { level: number; col: number } | null {
    const L = this.layout;
    const top = SURFACE_H + CRUST_H;
    if (ay < top || ay >= top + LEVELS * ROW_H) return null;
    const level = Math.floor((ay - top) / ROW_H) + 1;
    const step = L.roomW + WALL_W;
    const col = Math.floor((ax - L.roomX(0) + WALL_W / 2) / step);
    if (col < 0 || col >= SECTIONS_PER_LEVEL) return null;
    return { level, col };
  }

  destroy() {
    this.root.destroy({ children: true });
    for (const t of this.textures) t.destroy(true);
    this.textures = [];
  }
}
