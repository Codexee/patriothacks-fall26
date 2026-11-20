// REBUILD: the Residents' System ("the product"). Its features read ONLY Observations (sim/types.ts) and produce
// Outputs. They never read the engine's hidden state. We add one feature per Hollow problem, step by step.
import type { Output } from '../sim/types.ts';

/** One day of residents' outage reports, summarized by hour of day. */
export interface DayLine {
  line: number[]; // per hour (0–23): how many levels from the top had power (50 = nobody dark)
  hollowDark: boolean[]; // per hour: most of the Hollow dark at once (a plant tripped), so the line says nothing
  shed: number; // the power saving the system had asked for that day
}

/** Everything the system remembers between days. Plain JSON, so runs can be cloned and replayed. */
export interface ProductMemory {
  day: number; // last day of observations processed
  census: { people: number[]; demand: number[]; critical: number[] }; // per section, the Directorate's
  selfCount: number[]; // per section, residents' own count in the app
  outDark: boolean[]; // per section: dark at the end of the last day, from outage reports
  lines: DayLine[]; // the last 2 days, oldest first
  shed: number; // the power saving asked for most recently
  quietDays?: number; // days in a row with no blackout and no plant trip
  troubleShed?: number; // the request in effect the last time there was a blackout or trip
  troubleAge?: number; // quiet days since then
  troubleSeverity?: number; // how bad the last trouble was, 0..1 (1 = plant trip); sets how fast the request eases
  userReports: { day: number; level: number; col: number; text: string }[];
  /** Per section, the last day's family check-ins in the app (Family Check-In). */
  checkins?: ({ day: number; expected: number; received: number } | null)[];
}

/** A predicted blackout for a range of levels, worked out from residents' reports and the Directorate's rule. */
export interface PredictedBlackout {
  from: number; // levels
  to: number;
  startsIn: number; // hours from the start of the day
  hours: number; // expected length today
  startClock: number; // hour of day (0–23)
}

/** What each feature worked out today, for the council console. Not used by the sim. */
export interface ProductLog {
  day: number;
  seen: Record<string, number>; // observation counts by kind
  blackoutWarning?: {
    lineWorst: number | null; // yesterday's blackout line at its worst hour (levels with power), null = nobody dark
    lineWorstHour: number;
    trend: number; // levels per day the line is moving (negative = blackouts reach higher levels)
    supplyEstimate: number | null; // plant output worked out from the line, at the worst hour (units)
    demand: number; // what all sections need (units, from residents' count)
    hollowDarkHours: number; // hours yesterday when most of the Hollow was dark (plant trips)
    shed: number; // share of non-essential load residents are asked to switch off today
    blackouts: PredictedBlackout[];
    darkNow: number[]; // levels still dark at the end of yesterday
    tripRisk: boolean; // a blackout of the whole Hollow is possible
    quietDays: number; // days in a row with no blackout and no plant trip
    eased: boolean; // the request was lowered today after enough quiet days
    censusPeople: number; // the Directorate's census total
    selfPeople: number; // residents' own count total
    deepRatio: number; // residents' count / census on the deepest level
    /** Day 1 only, before any outage reports: the riskiest hour, from the usual use (see firstDayForecast). */
    firstDay?: { peakHour: number; peakMult: number; from: number; to: number }; // to = end hour (exclusive)
  };
  familyCheckIn?: {
    expected: number; // split families expected to check in yesterday
    received: number; // check-ins that arrived
    noNews: number; // expected − received
    relayed: number; // check-ins that came from dark sections (phone to phone)
    darkSections: number; // sections dark at the end of yesterday
    silent: number[]; // dark sections where under 70% checked in
    checks: number[]; // silent sections a neighbor was asked to check
  };
}

export interface ProductStep {
  outputs: Output[];
  memory: ProductMemory;
  log: ProductLog;
}
