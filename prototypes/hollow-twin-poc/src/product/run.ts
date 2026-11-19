// PROTOTYPE runner: one day = the residents' system reads yesterday's observations and produces outputs,
// then the sim (the test world) applies those outputs and simulates the day.
import { sim } from '../sim/index.ts';
import type { Action, Frame, Output, SimState, ToolSet } from '../sim/types.ts';
import { createMemory, stepProduct } from './index.ts';
import type { ProductLog, ProductMemory } from './types.ts';
import { moduleName } from './names.ts';

export interface Run {
  sim: SimState;
  memory: ProductMemory;
  outputs: Output[]; // what the system sent today
  log: ProductLog | null;
}

export function createRun(scenarioId: string, seed: number, modules: ToolSet): Run {
  return { sim: sim.createState(scenarioId, seed, modules), memory: createMemory(), outputs: [], log: null };
}

const anyOn = (t: ToolSet) => Object.values(t).some(Boolean);

/** Pure: returns a new Run. `extra` holds a person's events and typed reports for this day. */
export function stepRun(run: Run, modules: ToolSet, extra: Action[] = []): { run: Run; frames: Frame[]; events: string[] } {
  const day = run.sim.day + 1;
  const step = anyOn(modules)
    ? stepProduct(run.sim.observations, run.memory, modules, day)
    : { outputs: [] as Output[], memory: run.memory, log: null };
  const actions: Action[] = [{ type: 'setTools', tools: modules }, ...extra, { type: 'outputs', outputs: step.outputs }];
  const r = sim.stepDay(run.sim, actions);
  const sent: string[] = [];
  for (const o of step.outputs) {
    if (o.kind === 'alert') sent.push(`Day ${day} 00:00 · ${label(o.module)} → L${o.from}–${o.to}: ${o.text}`);
  }
  return {
    run: { sim: r.state, memory: step.memory, outputs: step.outputs, log: step.log },
    frames: r.frames,
    events: [...sent, ...r.events],
  };
}

export function label(module: string): string {
  return moduleName(module);
}
