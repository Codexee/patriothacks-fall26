// Real plant-loss shapes for the 3 extra disasters (EIA-930, built by scripts/build_grid.py), with guessed
// fallbacks so the sim still runs when grid.ts is null or older than the lossShapes field.
import type { Source } from '../sim/types.ts';
import { grid, type LossShape } from './real/index.ts';
import { hourlyFromDaily } from './shape.ts';

const EIA_URL = 'https://www.eia.gov/electricity/gridmonitor/';

/** Peak-normalized daily guesses (approximate shapes, used only without the generated data). */
const GUESS: Record<string, { daily: number[]; label: string }> = {
  elliottTva: { daily: [0.5, 0.7, 1, 0.5], label: 'TVA coal, Winter Storm Elliott, Dec 23–26, 2022 (approximate shape)' },
  elliottCple: { daily: [0, 0.6, 0.6, 0.1], label: 'CPLE coal, Winter Storm Elliott, Dec 23–26, 2022 (approximate shape)' },
  sppWind: {
    daily: [0, 0.6, 0.8, 0.8, 0.9, 0.7, 0.7, 0.4, 0.7, 0.7, 1, 0.8, 0.4, 0.1],
    label: 'SPP wind, Feb 6–19, 2021 (approximate shape)',
  },
};

export interface Shape { loss: number[]; source: Source; real: LossShape | null }

export function lossShape(id: keyof typeof GUESS & string): Shape {
  const real = grid?.lossShapes?.[id] ?? null;
  if (real) return { loss: real.loss, source: real.source, real };
  const g = GUESS[id];
  const raw = hourlyFromDaily(g.daily, 0);
  const peak = Math.max(...raw);
  return {
    loss: raw.map((v) => Math.round((v / peak) * 1000) / 1000),
    source: { label: g.label, detail: 'Approximate shape, used until the EIA-930 data is built. Peak = one whole plant lost.', url: EIA_URL },
    real: null,
  };
}
