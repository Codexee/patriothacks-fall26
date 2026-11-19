// Real data for the hidden test world (spec: .plans/hollow-real-data-spec.md, workstream 0 contract).
// The Residents' System never imports this file. Only the engine, the scenarios and the UI's hover cards do.
// Each generated file (grid.ts, outages.ts, sections.ts, airParams.ts) exports `null` until its workstream fills
// it. When a value is null, the engine uses its old guessed value, so the sim always runs.
import type { Source } from '../../sim/types.ts';
import { grid as gridData } from './grid.ts';
import { outages as outageData } from './outages.ts';
import { sections as sectionData } from './sections.ts';
import { airParams as airData } from './airParams.ts';

/** Workstream 1 (EIA-930). Written by scripts/build_grid.py. */
export interface GridData {
  /** 168 hourly demand multipliers (Monday 00:00 first), mean 1, from calm ERCOT weeks. */
  demandWeek: number[];
  /** Hourly share (0..1) of one plant's capacity that is lost, from the real generation loss. Peak = 1. */
  cascadeLoss: number[];
  source: Source;
  /**
   * More plant-loss shapes from other real grid failures (one fuel of one balancing authority each), keyed by id:
   * elliottTva, elliottCple (Winter Storm Elliott, Dec 2022), sppWind (SPP wind, Feb 2021). Optional: absent in
   * older generated files, and then the scenarios use guessed shapes.
   */
  lossShapes?: Record<string, LossShape>;
}

/** One real plant-loss shape. loss: hourly share (0..1) of one plant's capacity lost, peak = 1. */
export interface LossShape {
  loss: number[];
  stats: {
    ba: string; fuel: string; refMW: number; peakLossMW: number; peakLossShare: number; peakAt: string; minMW: number;
    hours: number; hoursAboveHalf: number; meanLossMW: number; start: string; end: string; imputedHours: number;
  };
  source: Source;
}

/** Workstream 2 (EAGLE-I). Written by scripts/build_outages.py. */
export interface OutageData {
  /**
   * Sample of real restoration times, in whole hours. When a plant trips, the engine draws its downtime
   * uniformly from this list (the old guess is the list 12..36).
   */
  repairHours: number[];
  /** Hourly trip chance per plant at full load. null = keep the guess (0.004). */
  stressTrip: number | null;
  source: Source;
}

/** Workstream 3 (counties). Written by scripts/build_sections.py. 400 rows: level 1 col 0..7, then level 2, … */
export interface SectionRow {
  /** Share of the Hollow's people in this section (all rows sum to 1). The engine rescales to its total. */
  share: number;
  svi: number; // mean CDC SVI of the counties in the section (0..1)
  dme: number; // power-dependent residents (HHS emPOWER), real count, unscaled
  growthPerYear: number; // real population growth per year, Census 2020–2024 (e.g. 0.012 = +1.2%)
  counties: { fips: string; name: string; state: string; svi: number; pop: number }[]; // largest first
  countyCount?: number; // all counties (or parts of counties) in the section; `counties` keeps only the 5 largest
}
export interface SectionData {
  rows: SectionRow[];
  source: Source;
}

/** Workstream 4 (cited constants). Hand-written in airParams.ts. Every value needs its own source. */
export interface CitedValue { value: number; source: Source }
export interface AirData {
  airDanger?: CitedValue; // ppm CO2 where deaths start (guess 5000)
  airDeath?: CitedValue; // hourly death share per 1,000 ppm above airDanger (guess 0.0001)
  preparedSave?: CitedValue; // share of air deaths a warned, prepared resident avoids (guess 0.6)
  volPerPerson?: CitedValue; // m³ of air per resident (guess 62)
  followBase?: CitedValue; // share who follow alerts at zero trust (guess 0.5); at full trust: followBase + followTrust
  followTrust?: CitedValue; // (guess 0.5)
}

export const grid: GridData | null = gridData;
export const outages: OutageData | null = outageData;
export const sections: SectionData | null = sectionData && sectionData.rows.length === 400 ? sectionData : null;
export const air: AirData = airData ?? {};

/** The value of a cited constant, or the old guess when it has no real value yet. */
export function cited(v: CitedValue | undefined, guess: number): number {
  return v ? v.value : guess;
}
