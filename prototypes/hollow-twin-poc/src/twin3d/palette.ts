// Colors of the 3D twin, from the site palette (src/site/site.css): rock and chalk, ember red (#f0654f) for
// danger and "without", system blue (#6cb6ff) for "with". Values are linear RGB 0..1, shown without tone mapping.

export const STATE = { powered: 0, saving: 1, dark: 2, air: 3, lost: 4 } as const;
export type StateCode = (typeof STATE)[keyof typeof STATE];

// three.js treats instance colors as linear RGB and converts to sRGB on output, so the palette is stored linear.
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)];
};

export const COLORS = {
  rock: '#2a2f36',
  rockDeep: '#1b1f24',
  crust: '#33302b',
  bg: '#101215',
  lamp: '#f7bd6e', // a powered section: warm lamp light
  saving: '#b98b55', // saving power: the same lamp, dimmer
  savingWith: '#7dbdff', // saving power because Blackout Warning asked: system blue (calm, not dark)
  savingWithLow: '#4a86c2', // the same, saving more
  dark: '#0d131c', // blackout: near black
  darkGlow: '#1d3550', // faint cold glow (emergency light)
  air: '#f0654f', // air unsafe: ember red (pulses)
  airLow: '#5a1f18',
  lost: '#4a4c50', // everyone dead or gone: grey
  plantOn: '#ffe2a8',
  plantOff: '#1a1c20',
  without: '#f0654f',
  with: '#6cb6ff',
} as const;

const C = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, hex(v)])) as Record<keyof typeof COLORS, [number, number, number]>;
export const RGB = C;

const mix = (a: readonly number[], b: readonly number[], t: number, out: number[]) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
};

/** Writes the section's color into `out` and returns its state code. */
export function sectionColor(lifeSupport: number, power: number, co2: number, lost: boolean, withSide: boolean, out: number[]): StateCode {
  if (lost) { mix(C.lost, C.lost, 0, out); return STATE.lost; }
  if (co2 >= 5000) { mix(C.airLow, C.air, 0.5, out); return STATE.air; }
  if (lifeSupport < 0.5) {
    // Darker as less life-support power is left; a faint cold glow stays.
    mix(C.dark, C.darkGlow, Math.max(0, Math.min(1, lifeSupport * 1.4)), out);
    return STATE.dark;
  }
  if (power >= 0.97) { mix(C.lamp, C.lamp, 0, out); return STATE.powered; }
  // Saving power: dimmer as less power is drawn (power 0.97 → 0.5).
  const t = Math.max(0, Math.min(1, (0.97 - power) / 0.47));
  if (withSide) { mix(C.savingWith, C.savingWithLow, t, out); return STATE.saving; }
  const tmp = [0, 0, 0];
  mix(C.lamp, C.saving, Math.min(1, 0.55 + t), tmp);
  out[0] = tmp[0] * (1 - 0.35 * t); out[1] = tmp[1] * (1 - 0.35 * t); out[2] = tmp[2] * (1 - 0.35 * t);
  return STATE.saving;
}

export function plantColor(on: boolean, capacity: number, out: number[]): void {
  if (!on) { mix(C.plantOff, C.plantOff, 0, out); return; }
  // Brightness follows the share of capacity left (a plant losing output is dimmer).
  const t = Math.max(0, Math.min(1, capacity));
  mix(C.plantOff, C.plantOn, 0.35 + 0.65 * t, out);
}
