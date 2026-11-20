// Runs the two simulations off the main thread (a disaster takes about 0.3–0.9 s; with workstation detail about 1 s).
import { computeTwin, type TwinData } from './compute.ts';
import { detailBuffers } from './detail.ts';

export type TwinRequest = { id: string; seed: number; days: number; detail?: boolean };

self.onmessage = (e: MessageEvent<TwinRequest>) => {
  const { id, seed, days, detail } = e.data;
  const data: TwinData = computeTwin(id, seed, days, !!detail);
  const bufs = [data.without, data.with].flatMap((s) => [
    s.color.buffer, s.pulse.buffer, s.state.buffer, s.plant.buffer, s.plantOn.buffer, ...(s.detail ? detailBuffers(s.detail) : []),
  ]);
  (self as unknown as Worker).postMessage(data, bufs as ArrayBuffer[]);
};
