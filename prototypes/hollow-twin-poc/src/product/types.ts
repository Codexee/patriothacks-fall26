// PROTOTYPE: the residents' system ("the product"). Its modules read ONLY Observations (sim/types.ts)
// and produce Outputs. They never import or read the engine's internal state.
import type { LieId, Output, ReportTopic } from '../sim/types.ts';

/** One published, hash-chained record in the Ledger. */
export interface LedgerRecord {
  id: string;
  day: number;
  module: string;
  text: string;
  evidence: string[];
  lie?: LieId;
  hash: string;
  prevHash: string;
}

export interface Outlook { fromHour: number; supply: number[]; demand: number[] }

/** Everything the system remembers between days. Plain JSON, so runs can be cloned and replayed. */
export interface ProductMemory {
  day: number; // last day of observations processed
  // Early Warning: hourly history (newest last), up to 96 h.
  plantOut: (number | null)[][]; // per plant
  plantHours: number[]; // absolute hour of each plantOut column
  feederDemand: number[];
  outlook: Outlook | null; // latest public outlook (covers the next 48 h)
  outlookPrev: Outlook | null; // the one before (covers yesterday), used to normalize yesterday's meters
  // Ledger: Plant 3's share of plant output, as a baseline and recent readings.
  plant3Baseline: number | null;
  plant3Ratios: number[]; // newest last, up to 72
  // Reports per level (index level-1), last 3 days (newest last).
  reports: Record<ReportTopic, number[][]>;
  clinicCases: { level: number; cases: number }[]; // today
  officialCases: number;
  census: { people: number[]; demand: number[]; critical: number[]; facilities: string[][]; recyclerLevels: number[] };
  sensorWater: (number | null)[]; // per level, latest mean tap quality from sensor boxes
  sensorWet: (number | null)[]; // per level, latest mean wet-bulb
  ledger: LedgerRecord[];
  repairsSent: Record<string, number>; // recycler level → day sent
  userReports: { day: number; level: number; col: number; text: string }[];
}

/** What each module worked out today, for the council console. Not used by the sim. */
export interface ProductLog {
  day: number;
  seen: Record<string, number>; // observation counts by kind
  earlyWarning?: { capNow: number; capForecast: number; demandForecast: number; shortfallPct: number; inHours: number; shed: number };
  fairShare?: { available: number; critical: number; nonCriticalShare: number; criticalShare: number; hotLevels: number[] };
  ledger?: { plant3Share: number | null; plant3Baseline: number | null; official: number; estimated: number; byLevel: { level: number; est: number }[] };
  snow?: { suspects: { level: number; reportsPer1000: number; tap: number | null; reports: number }[]; baseline: number };
}

export interface ProductStep {
  outputs: Output[];
  memory: ProductMemory;
  log: ProductLog;
}
