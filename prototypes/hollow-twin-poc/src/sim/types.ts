// PROTOTYPE contract for the Hollow Twin proof of concept. Every workstream codes against this file.
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

export type ToolKey = 'earlyWarning' | 'fairShare' | 'ledger' | 'layout';
export type ToolSet = Record<ToolKey, boolean>;
export const NO_TOOLS: ToolSet = { earlyWarning: false, fairShare: false, ledger: false, layout: false };
export const ALL_TOOLS: ToolSet = { earlyWarning: true, fairShare: true, ledger: true, layout: true };

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

export type LieId = 'plantFine' | 'noOutbreak' | 'waterSafe';

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
}

/** Player choices for one day. */
export type Action =
  | { type: 'setTools'; tools: ToolSet }
  | { type: 'build'; kind: Exclude<StructureKind, 'plant'>; level: number; col: number }
  | { type: 'remove'; level: number; col: number; kind: Exclude<StructureKind, 'plant'> };

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
}

/** Opaque full state. ui/ and world/ must not reach inside it; they use the functions below and Frames. */
export interface SimState {
  seed: number;
  scenario: Scenario;
  day: number;
  tools: ToolSet;
  trust: number; // 0..1
  lies: Lie[];
  totals: Totals;
  bulletin: Bulletin;
  end: EndState | null;
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
