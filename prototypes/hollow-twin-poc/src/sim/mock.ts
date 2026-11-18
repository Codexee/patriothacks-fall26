// PROTOTYPE mock of SimApi. Produces plausible-looking frames so world/ and ui/ can be built in parallel.
// The sim workstream keeps this file as a reference and must not delete it.
import {
  HOURS_PER_DAY, LEVELS, SECTIONS_PER_LEVEL, NO_TOOLS,
  type Frame, type Scenario, type SectionView, type SimApi, type SimState, type Source,
} from './types.ts';

const src: Source = { label: 'Mock data', detail: 'Placeholder values from the mock sim.', url: 'https://example.com' };
const flat = (n: number, v: number) => Array.from({ length: n }, () => v);
const mockScenario: Scenario = {
  id: 'mock', name: 'Mock scenario', summary: 'Placeholder', days: 30,
  supply: flat(30 * 24, 0.9), demand: flat(30 * 24, 1), source: src,
};

function frameFor(day: number, hour: number): Frame {
  const sections: SectionView[] = [];
  for (let level = 1; level <= LEVELS; level++) {
    for (let col = 0; col < SECTIONS_PER_LEVEL; col++) {
      const depth = level / LEVELS;
      const wave = Math.sin((day * 24 + hour) / 9 + col);
      const dark = depth > 0.75 && wave > 0.3;
      sections.push({
        level, col, people: Math.round(5000 * (1 - depth * 0.3)),
        power: dark ? 0 : 1, co2: 600 + depth * 1800 + (dark ? 900 : 0), wetBulb: 22 + depth * 10,
        infected: Math.max(0, depth - 0.6) * 0.5, water: 1 - Math.max(0, depth - 0.7), food: 20 - depth * 10,
        lost: depth > 0.96 && day > 20,
        structures: col === 0 && level % 10 === 5 ? ['plant'] : col === 3 ? ['fan'] : col === 6 && level % 4 === 0 ? ['farm'] : [],
      });
    }
  }
  return { day, hour, sections, plantsOnline: 4, plantsTotal: 5 };
}

export const mockSim: SimApi = {
  scenarios: [mockScenario],
  createState(_id, seed, tools = NO_TOOLS): SimState {
    return {
      seed, scenario: mockScenario, day: 0, tools, trust: 0.7, systemTrust: 0.7, observations: [],
      lies: [{ id: 'plantFine', bulletin: 'Plant 3 is operating normally', truth: 'Plant 3 is at 40% capacity', active: true, exposed: false }],
      totals: { population: 1_500_000, startPopulation: 1_500_000, deaths: 0, sectionsLost: 0, hoursDarkDeepest: 0 },
      bulletin: { directorate: ['All levels nominal'], measured: ['Levels 41–50: power 60%'] },
      end: null, lastFrame: frameFor(0, 0), internal: null,
    };
  },
  stepDay(state) {
    const day = state.day + 1;
    const frames = Array.from({ length: HOURS_PER_DAY }, (_, h) => frameFor(day, h));
    const deaths = state.totals.deaths + 1200;
    const next: SimState = {
      ...state, day, lastFrame: frames[frames.length - 1],
      totals: { ...state.totals, deaths, population: state.totals.startPopulation - deaths },
      end: day >= 25 ? { kind: 'lost', day, reason: 'Mock end' } : null,
    };
    return { state: next, frames, events: [`Day ${day}: mock event`] };
  },
  score(state) { return { total: state.day * 100, days: state.day, alivePct: 90, fairness: 50 }; },
  sourceFor() { return src; },
};
