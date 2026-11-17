// PROTOTYPE: palette and layout for the Hollow cutaway. All sizes are in "art pixels".
// The canvas renders at art resolution and CSS scales it by SCALE with image-rendering: pixelated.
import { LEVELS, SECTIONS_PER_LEVEL } from '../sim/types.ts';

export const SCALE = 2; // CSS px per art pixel (row height 28 art px = 56 CSS px)
export const LABEL_W = 16;
export const WALL_W = 4;
export const ROW_H = 28;
export const FLOOR_H = 3;
export const ROOM_H = ROW_H - FLOOR_H;
export const SURFACE_H = 76;
export const GROUND_H = 9; // dirt band at the bottom of the surface
export const CRUST_H = 6;
export const BOTTOM_H = 12;
export const MIN_ROOM_W = 16; // 180 art px = 360 CSS px minimum width, so a 375 px phone still fits

export type RGB = [number, number, number];
export const hex = (n: number): RGB => [(n >> 16) & 255, (n >> 8) & 255, n & 255];

export const C = {
  bg: 0x0b0b10,
  skyTop: hex(0x46434e),
  skyMid: hex(0x87695c),
  skyLow: hex(0xd2823f),
  sun: hex(0xf2b673),
  ruinFar: hex(0x6b5450),
  ruinNear: hex(0x2a2125),
  ruinRim: hex(0xa65b35),
  windowDark: hex(0x17121a),
  windowLit: hex(0xd9984a),
  dirt: hex(0x4a3628),
  dirtTop: hex(0x6e5139),
  rockTop: hex(0x5d4433),
  rockDeep: hex(0x221b1a),
  ore: hex(0xb3713b),
  crystal: hex(0x5d8191),
  wallPanel: hex(0x3c2f27),
  wallSeam: hex(0x2a201b),
  rivet: hex(0x5b4a3c),
  beam: hex(0x60452f),
  beamDark: hex(0x46321f),
  floorTop: hex(0x7c6351),
  floorMid: hex(0x54433a),
  floorLow: hex(0x3a2d28),
  shadow: hex(0x201814),
  door: hex(0x18120f),
  label: hex(0xd1a87c),
  labelPlate: hex(0x17110f),
  lamp: hex(0xffc870),
  heat: hex(0xff3b1c),
  fog: hex(0x8fa882),
  sick: hex(0xb9da4a),
  drip: hex(0x7c5526),
  rubble: hex(0x5a4638),
  rubbleDark: hex(0x2c221d),
  metal: hex(0x3b3a42),
  metalDark: hex(0x23222a),
  metalLight: hex(0x7a7880),
  core: hex(0x7ff0ff),
  leaf: hex(0x62b23c),
  leafDark: hex(0x3c7a29),
  soil: hex(0x4a3020),
  pipe: hex(0x6e7c7a),
  pipeDark: hex(0x435150),
  clinic: hex(0xe9e4dc),
  cross: hex(0xd2352c),
} as const;

export const BULB_OFF = 0x3a2a20;
export const BULB_ON = 0xffe39a;
export const SELECT_COLOR = 0xffd35a;
export const HOVER_COLOR = 0xffffff;
export const SICK_TINT = 0x9fd060;

export interface Layout {
  artW: number;
  artH: number;
  roomW: number;
  roomX: (col: number) => number;
  rowY: (level: number) => number; // top of the room interior
}

export function computeLayout(artW: number): Layout {
  const roomW = Math.max(MIN_ROOM_W, Math.floor((artW - LABEL_W - WALL_W * (SECTIONS_PER_LEVEL + 1)) / SECTIONS_PER_LEVEL));
  const w = Math.max(artW, LABEL_W + WALL_W * (SECTIONS_PER_LEVEL + 1) + roomW * SECTIONS_PER_LEVEL);
  const artH = SURFACE_H + CRUST_H + LEVELS * ROW_H + BOTTOM_H;
  return {
    artW: w,
    artH,
    roomW,
    roomX: (col) => LABEL_W + WALL_W + col * (roomW + WALL_W),
    rowY: (level) => SURFACE_H + CRUST_H + (level - 1) * ROW_H,
  };
}
