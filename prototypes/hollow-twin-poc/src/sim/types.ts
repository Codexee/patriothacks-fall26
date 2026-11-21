// PROTOTYPE contract for HollowGuard proof of concept. Every workstream codes against this file.
// Change it only by agreement: it is the shared interface between sim/, world/ and ui/.

export const LEVELS = 50;
export const SECTIONS_PER_LEVEL = 8;
export const SECTION_COUNT = LEVELS * SECTIONS_PER_LEVEL; // 400
export const HOURS_PER_DAY = 24;

/** Level 1 is just under the surface; level 50 is the deepest. index = (level - 1) * SECTIONS_PER_LEVEL + col */
export function sectionIndex(level: number, col: number): number {
  return (level - 1) * SECTIONS_PER_LEVEL + col;
}

export type StructureKind = 'plant' | 'fan' | 'farm' | 'recycler' | 'clinic';

/**
 * PRODUCT BRANCH (prototype/hollow-twin-product): a ToolKey is now a module of the residents' system
 * (src/product/). The sim no longer contains any tool logic. It only produces Observations and applies Outputs.
 * Truthcount is part of the Ledger module.
 */
export type ToolKey =
  | 'earlyWarning' | 'fairShare' | 'ledger' | 'snow' // problems 1, 2, 9, 4
  | 'lantern' | 'kin' | 'layout' | 'larder' | 'witness'; // problems 7, 8, 3, 12 (+2), 13
export type ToolSet = Record<ToolKey, boolean>;
export const NO_TOOLS: ToolSet = {
  earlyWarning: false, fairShare: false, ledger: false, snow: false, lantern: false, kin: false, layout: false, larder: false, witness: false,
};
export const ALL_TOOLS: ToolSet = {
  earlyWarning: true, fairShare: true, ledger: true, snow: true, lantern: true, kin: true, layout: true, larder: true, witness: true,
};

/** The council's base, where the residents' system runs. Messages start here. */
export const HUB = { level: 25, col: 4 };

// ---------- Observations: the ONLY data the residents' system may read ----------
export type ReportTopic = 'cough' | 'water' | 'dark' | 'hot' | 'surface';

export type Observation =
  /** Feeder-line meter on a plant's output, hourly. 0 when the plant is offline. About ±3% noise; ~5% of readings missing. */
  | { kind: 'plantMeter'; plant: number; level: number; hour: number; output: number }
  /** Total load meter at the main switchyard, hourly. served = power delivered, demand = power asked for. About ±2% noise. */
  | { kind: 'feeder'; hour: number; served: number; demand: number }
  /** Daily averages from a residents' sensor box. Only 2 sections per level have one. Noisy; some days missing. */
  | { kind: 'sensor'; level: number; col: number; day: number; co2: number; wetBulb: number; power: number; lifeSupport: number; water: number }
  /** Resident reports for one section and topic on one day, counted. text is one sample report. */
  | { kind: 'reports'; level: number; col: number; day: number; topic: ReportTopic; count: number; text: string; byUser?: boolean }
  /** Cases a clinic saw today. Most sick residents never reach a clinic. */
  | { kind: 'clinic'; level: number; day: number; cases: number }
  /** What the Directorate says today. officialCases is its public case count. */
  | { kind: 'bulletin'; day: number; lines: string[]; claims: LieId[]; officialCases: number }
  /**
   * Public weather and grid outlook for the next 48 h, issued at `fromHour` (like a weather service forecast).
   * supply = share of normal plant output expected; demand = load multiplier expected. About ±4% error.
   */
  | { kind: 'outlook'; fromHour: number; supply: number[]; demand: number[] }
  /** Section council census: residents, power asked for (critical part too), facilities, and days of food in store. */
  | { kind: 'census'; level: number; col: number; day: number; people: number; demand: number; critical: number; facilities: StructureKind[]; food: number }
  /** Residents' own count: every household enters in the app how many people live in its room (summed per section). */
  | { kind: 'selfCount'; level: number; col: number; day: number; people: number }
  /** Residents' outage report in the app: at `hour`, the section's air and fans lost power (dark) or got it back. */
  | { kind: 'outage'; level: number; col: number; hour: number; dark: boolean }
  /** Whether the Directorate's network is up, hourly. The system notices when it is cut. */
  | { kind: 'network'; hour: number; up: boolean }
  /** Daily family check-ins from one section: how many families were expected to check in, and how many did. */
  | { kind: 'checkins'; level: number; col: number; day: number; expected: number; received: number }
  /**
   * A surface air reading posted by a device, with its signature. Registered council probes sign with their key;
   * anyone else can post too (rumors). value = toxicity index (≥ 10: deadly in minutes; 1–5: survivable for hours
   * with a filter mask; < 1: safe).
   */
  | { kind: 'probe'; device: string; day: number; value: number; sig: string };

// ---------- Outputs: what the residents' system produces; the sim applies them ----------
/** prepare (#1): a blackout is coming to these levels; get ready (charge lights, store water, plan where to get air). */
export type AlertAction = 'shed' | 'boilWater' | 'isolateSick' | 'prepare';

export type Output =
  /**
   * An alert to every section in levels [from, to]. Residents follow it in proportion to their trust in the system.
   * shed: switch off `amount` (0..1) of non-critical load. boilWater / isolateSick: protective behavior.
   */
  | { kind: 'alert'; id: string; module: ToolKey; action: AlertAction; from: number; to: number; hours: number; amount?: number; text: string; evidence: string[] }
  /** A power plan for the next day: share of critical and non-critical demand each section may draw (0..1). */
  | { kind: 'allocation'; module: ToolKey; crit: number[]; non: number[]; text: string }
  /** A published finding. When `lie` is set, it contradicts a Directorate claim. hash chains it to the previous finding. */
  | { kind: 'finding'; id: string; module: ToolKey; lie?: LieId; text: string; evidence: string[]; hash: string }
  /** Send a residents' repair crew to the recycler on `level`. It takes 2 days. */
  | { kind: 'repair'; module: ToolKey; level: number; text: string }
  /** Lantern: sections that get a battery-powered relay, so the phone mesh still crosses dark sections. */
  | { kind: 'relays'; module: ToolKey; sections: number[]; text: string }
  /** Kin: send neighbors to check on these sections (families there went silent). */
  | { kind: 'welfare'; module: ToolKey; sections: number[]; text: string }
  /** Layout: a crew moves one fan between sections (at most 2 moves a day). */
  | { kind: 'moveFan'; module: ToolKey; from: number; to: number; text: string }
  /** Larder: carry `days` of food (per resident of the receiving level) from one level to another. */
  | { kind: 'foodTransfer'; module: ToolKey; from: number; to: number; days: number; text: string }
  /** Larder: turn spare space on a level into a grow-lamp farm (at most 1 a day). */
  | { kind: 'grow'; module: ToolKey; level: number; text: string }
  /** Witness: the verified surface reading, broadcast to every resident it can reach. */
  | { kind: 'verdict'; module: ToolKey; value: number; text: string };

/** Events a person can inject into the world (the judge's buttons). */
export type WorldEvent =
  | { type: 'breakRecycler'; level: number }
  | { type: 'tripPlant'; plant: number }
  | { type: 'outbreak'; level: number }
  | { type: 'cutNetwork'; hours: number }
  | { type: 'divertFarms'; from: number; to: number };

/** Where a number or model comes from. Shown in the hover card. */
export interface Source {
  label: string; // e.g. "Wells–Riley with Rudnick–Milton CO2 method"
  detail: string; // one or two sentences: the equation or the dataset, and how it is rescaled
  url: string;
}

export type MetricKey = 'power' | 'co2' | 'wetBulb' | 'infected' | 'water' | 'food';

/** Per-section state the renderer and the hover card read. All values are plain numbers. */
export interface SectionView {
  level: number; // 1..50
  col: number; // 0..7
  people: number; // alive residents
  power: number; // 0..1 share of demand served this hour
  lifeSupport: number; // 0..1 share of life-support power (air, fans) served this hour; < 0.5 = blackout
  co2: number; // ppm
  wetBulb: number; // °C
  infected: number; // 0..1 share of residents sick
  water: number; // 0..1 water quality (1 = safe)
  food: number; // days of food reserve
  lost: boolean; // section abandoned or everyone dead
  structures: StructureKind[];
}

/** One rendered moment. The sim emits 24 frames per day (one per hour). */
export interface Frame {
  day: number; // 1-based
  hour: number; // 0..23
  sections: SectionView[]; // length SECTION_COUNT, ordered by sectionIndex
  plantsOnline: number;
  plantsTotal: number;
}

export type LieId = 'plantFine' | 'noOutbreak' | 'waterSafe' | 'surfaceDeadly';

export interface Lie {
  id: LieId;
  bulletin: string; // what the Directorate says, e.g. "Plant 3 is operating normally"
  truth: string; // what is actually happening
  active: boolean; // still being told
  exposed: boolean; // residents learned the truth (lowers trust)
}

export interface Bulletin {
  directorate: string[]; // official lines shown in the panel
  measured: string[]; // the measured truth, shown next to it
}

export type EndState = { kind: 'lost'; day: number; reason: string } | { kind: 'stable'; day: number };

export interface Totals {
  population: number; // alive now
  startPopulation: number;
  deaths: number;
  sectionsLost: number;
  hoursDarkDeepest: number; // cumulative dark hours, levels 41–50 average
  // PRODUCT BRANCH: world facts for problems 7, 8, 12, 13 (shown in the hidden-truth column, never read by modules)
  networkUp: boolean;
  familiesNoNews: number; // families split across levels who do not know if their relatives are okay
  familyNightsNoNews?: number; // the sum of familiesNoNews over every night so far
  surfaceBelief: number; // 0..1 share of residents who believe the rumor that the surface has healed
  climbersLost: number; // residents who went up the closed way, believing the rumor, and died
  hungerDeaths: number;
  // REBUILD, problem #1
  airDeaths: number; // deaths from bad air while the fans were off
  blackoutPersonHours: number; // person-hours without life-support power
  warnedPersonHours: number; // of those, person-hours where residents had been warned and prepared
}

/** Player choices for one day. */
export type Action =
  | { type: 'setTools'; tools: ToolSet }
  | { type: 'outputs'; outputs: Output[] } // from the residents' system (src/product/)
  | { type: 'event'; event: WorldEvent } // injected by a person
  | { type: 'report'; level: number; col: number; text: string } // a report typed by a person, as a resident
  | { type: 'build'; kind: Exclude<StructureKind, 'plant'>; level: number; col: number }
  | { type: 'remove'; level: number; col: number; kind: Exclude<StructureKind, 'plant'> };

export interface PlantLoss { plant: number; startHour: number; loss: number[] }

export interface Scenario {
  id: string;
  name: string; // e.g. "Texas, Feb 2021"
  summary: string;
  days: number; // length of the driving data, after which the last value repeats
  /** Share of nominal plant capacity available at each hour of the scenario (0..1). Length days*24. */
  supply: number[];
  /** Demand multiplier per hour (1 = normal). Length days*24. */
  demand: number[];
  source: Source;
  // --- Real-data scenario options (spec: .plans/hollow-real-data-spec.md). All optional; absent = old behavior. ---
  /**
   * One plant (or several) loses part of its capacity: loss[t] (0..1) is the share lost t hours after startHour.
   * An array applies each loss; losses on the same plant multiply.
   */
  plantLoss?: PlantLoss | PlantLoss[];
  /** Health lost per day by every plant (overrides the guess 0.002). */
  agingPerDay?: number;
  /**
   * Real years of section growth (SectionRow.growthPerYear) played over MAX_DAYS. 0 or absent = no growth.
   * Example: 4 means 4 real years of county growth happen in the 120-day run, and the UI must say so.
   */
  growthYears?: number;
  /** The run cannot end as "stable" before this day (so slow scenarios play out). */
  minDays?: number;
}

/** Opaque full state. ui/ and world/ must not reach inside it; they use the functions below and Frames. */
export interface SimState {
  seed: number;
  scenario: Scenario;
  day: number;
  tools: ToolSet;
  trust: number; // 0..1, residents' trust in the Directorate
  /** 0..1, residents' trust in their own system. It sets how many follow its alerts. Right findings raise it; wrong ones lower it. */
  systemTrust: number;
  /** What the residents' system can see about the day just simulated. Empty on day 0. */
  observations: Observation[];
  lies: Lie[];
  totals: Totals;
  bulletin: Bulletin;
  end: EndState | null;
  /** UI branch: set when a person chose "Keep playing" after a stable end; stable then no longer ends the run. */
  keepGoing?: boolean;
  /** UI branch: the first day the Hollow became stable (kept when the person plays on). */
  stableDay?: number;
  lastFrame: Frame;
  /** Free-form engine internals. Only sim/ may read or write this. */
  internal: unknown;
}

export interface DayResult {
  state: SimState;
  frames: Frame[]; // 24 frames for the day just simulated
  events: string[]; // short human-readable events, e.g. "Day 12, 03:00: Plant 3 tripped"
}

export interface Score {
  total: number;
  days: number;
  alivePct: number; // 0..100
  fairness: number; // 0..100, 100 = no gap between best and worst level
}

/** The functions sim/index.ts must export. */
export interface SimApi {
  scenarios: Scenario[];
  createState(scenarioId: string, seed: number, tools: ToolSet): SimState;
  stepDay(state: SimState, actions: Action[]): DayResult; // pure: never mutates its input
  score(state: SimState): Score;
  /** Source for a metric, for the hover card. */
  sourceFor(metric: MetricKey | 'directorate' | 'scenario'): Source;
}

/** Contract for world/index.tsx (the PixiJS cutaway). */
export interface WorldProps {
  frame: Frame;
  /** Called when the pointer enters a section tile (null when it leaves the cutaway). */
  onHover: (target: { level: number; col: number } | null) => void;
  /** Optional: a section to outline (for example, the one the hover card describes). */
  selected?: { level: number; col: number } | null;
}
