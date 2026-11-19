// Runs the two simulations off the main thread (a disaster takes about 0.5–2 s).
import { computeTwin, type TwinData } from './compute.ts';

export type TwinRequest = { id: string; seed: number; days: number };

self.onmessage = (e: MessageEvent<TwinRequest>) => {
  const { id, seed, days } = e.data;
  const data: TwinData = computeTwin(id, seed, days);
  const bufs = [data.without, data.with].flatMap((s) => [s.color.buffer, s.pulse.buffer, s.state.buffer, s.plant.buffer, s.plantOn.buffer]);
  (self as unknown as Worker).postMessage(data, bufs);
};
