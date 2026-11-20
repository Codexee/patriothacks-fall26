// Shared helpers for the workstation panels.
import type { Scenario } from '../../sim/types.ts';
import type { TwinData } from '../compute.ts';
import type { SideDetail } from '../detail.ts';
import type { SideKey } from '../Scene.tsx';

export const SIDES: SideKey[] = ['without', 'with'];
export const SIDE_NAME: Record<SideKey, string> = { without: 'Without Blackout Warning', with: 'With Blackout Warning' };
export const SIDE_SHORT: Record<SideKey, string> = { without: 'Without', with: 'With' };
export const SIDE_COLOR: Record<SideKey, string> = { without: '#f0654f', with: '#6cb6ff' };

export type SeedSet = 'held-out' | 'tuning' | 'check';
export function seedSet(seed: number): SeedSet {
  return seed >= 11 ? 'held-out' : seed <= 5 ? 'tuning' : 'check';
}
export const SET_TEXT: Record<SeedSet, string> = { 'held-out': 'held-out test seed', tuning: 'tuning seed', check: 'check seed' };

export const det = (data: TwinData, side: SideKey): SideDetail => data[side].detail!;

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

/** Day on which each plant loss of the scenario starts (1-based), with its plant and length in hours. */
export function plantLosses(s: Scenario): { plant: number; startDay: number; startHour: number; hours: number; loss: number[] }[] {
  const pl = s.plantLoss;
  if (!pl) return [];
  return (Array.isArray(pl) ? pl : [pl]).map((x) => ({ plant: x.plant, startDay: Math.floor(x.startHour / 24) + 1, startHour: x.startHour, hours: x.loss.length, loss: x.loss }));
}

/** First day with at least one dark section, or null. */
export function firstDark(data: TwinData, side: SideKey): number | null {
  const d = data[side].dark;
  for (let i = 1; i < d.length; i++) if (d[i] > 0) return i;
  return null;
}

/** Trips per day (1..D) from the event log. */
export function tripsPerDay(x: SideDetail): number[] {
  const t = new Array<number>(x.days + 1).fill(0);
  for (const e of x.events) if (e.type === 'trip' && e.day <= x.days) t[e.day]++;
  return t;
}

/** Which real loss shape each plant-loss scenario uses (src/data/*.ts), for its EIA-930 statistics. */
export const LOSS_SHAPE_KEYS: Record<string, string[]> = {
  cascade: ['cascade'],
  elliott: ['elliottTva'],
  twoplants: ['elliottTva', 'elliottCple'],
  slowloss: ['sppWind'],
};
