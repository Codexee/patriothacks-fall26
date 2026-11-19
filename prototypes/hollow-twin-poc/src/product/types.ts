// REBUILD: the Residents' System ("the product"). Its features read ONLY Observations (sim/types.ts) and produce
// Outputs. They never read the engine's hidden state. We add one feature per Hollow problem, step by step.
import type { Output } from '../sim/types.ts';

export interface Outlook { fromHour: number; supply: number[]; demand: number[] }

/** Everything the system remembers between days. Plain JSON, so runs can be cloned and replayed. */
export interface ProductMemory {
  day: number; // last day of observations processed
  // Plant meters: hourly history (newest last), up to 96 h.
  plantOut: (number | null)[][]; // per plant
  plantHours: number[]; // absolute hour of each plantOut column
  feederDemand: number[]; // switchyard load, hourly
  outlook: Outlook | null; // latest public weather and grid outlook (next 48 h)
  outlookPrev: Outlook | null; // the one before (covers yesterday)
  census: { people: number[]; demand: number[]; critical: number[] }; // per section, the Directorate's
  selfCount: number[]; // per section, residents' own count in the app
  sensorPower: (number | null)[]; // per level: yesterday's mean share of LIFE-SUPPORT power (air, fans)
  sensorCo2: (number | null)[]; // per level: yesterday's mean CO2
  darkReports: number[]; // per level: "the power is off" reports yesterday
  userReports: { day: number; level: number; col: number; text: string }[];
}

/** A predicted blackout for a range of levels, worked out from the forecast and the Directorate's rule. */
export interface PredictedBlackout {
  from: number; // levels
  to: number;
  startsIn: number; // hours from the start of the day
  hours: number; // expected length within the 36 h horizon
  startClock: number; // hour of day (0–23)
}

/** What each feature worked out today, for the council console. Not used by the sim. */
export interface ProductLog {
  day: number;
  seen: Record<string, number>; // observation counts by kind
  blackoutWarning?: {
    capNow: number;
    capForecast: number; // at the worst hour
    demandForecast: number;
    shortfallPct: number; // at the worst hour
    inHours: number; // worst hour
    shed: number; // share of non-essential load residents were asked to switch off
    blackouts: PredictedBlackout[];
    darkNow: number[]; // levels whose air-and-fans circuit had less than half its power yesterday
    tripRisk: boolean; // even after saving, plants will run close to tripping: a Hollow-wide blackout is possible
    censusPeople: number; // the Directorate's census total
    selfPeople: number; // residents' own count total
    deepRatio: number; // residents' count / census on the deepest level
  };
}

export interface ProductStep {
  outputs: Output[];
  memory: ProductMemory;
  log: ProductLog;
}
