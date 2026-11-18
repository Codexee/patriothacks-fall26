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
  census: { people: number[]; demand: number[]; critical: number[]; facilities: string[][]; food: number[]; recyclerLevels: number[] };
  sensorWater: (number | null)[]; // per level, latest mean tap quality from sensor boxes
  sensorWet: (number | null)[]; // per level, latest mean wet-bulb
  sensorPower: (number | null)[]; // per level, latest mean share of power served
  ledger: LedgerRecord[];
  repairsSent: Record<string, number>; // recycler level → day sent
  userReports: { day: number; level: number; col: number; text: string }[];
  // Lantern / Kin (problems 7, 8)
  networkDownHours: number; // hours of yesterday the network was down
  networkUpNow: boolean;
  checkins: ({ expected: number; received: number; day: number } | null)[]; // per section, latest heard
  // Layout (problem 3)
  fanReceivers: number[]; // levels that received a fan (never used as donors again)
  // Larder (problems 12, 2)
  runway: number[][]; // per level, mean days of food, last 3 days (newest last)
  // Witness (problem 13)
  probes: { device: string; day: number; value: number; valid: boolean }[]; // last 3 days
}

/** What each module worked out today, for the council console. Not used by the sim. */
export interface ProductLog {
  day: number;
  seen: Record<string, number>; // observation counts by kind
  earlyWarning?: { capNow: number; capForecast: number; demandForecast: number; shortfallPct: number; inHours: number; shed: number };
  fairShare?: { available: number; critical: number; nonCriticalShare: number; criticalShare: number; hotLevels: number[] };
  ledger?: { plant3Share: number | null; plant3Baseline: number | null; official: number; estimated: number; byLevel: { level: number; est: number }[] };
  snow?: { suspects: { level: number; reportsPer1000: number; tap: number | null; reports: number }[]; baseline: number };
  lantern?: { relays: number; predictedReach: number; darkLevels: number[]; networkDownHours: number };
  kin?: { expected: number; received: number; unheardSections: number; flagged: number[] };
  layout?: { moves: { from: number; to: number }[]; hotLevels: number[] };
  larder?: { lowest: { level: number; runway: number; trend: number }[]; transfers: { from: number; to: number; days: number }[]; grow: number | null };
  witness?: { valid: number; rejected: string[]; median: number | null; verdict: string | null; rumorReports: number };
}

export interface ProductStep {
  outputs: Output[];
  memory: ProductMemory;
  log: ProductLog;
}
