// Loads the twin data for one disaster: picks the typical held-out seed from public/results/scenarios.json,
// then runs both simulations in a Web Worker. Results are cached per disaster.
import { useEffect, useState } from 'react';
import type { ScenariosFile } from '../site/contracts.ts';
import { daysFor, typicalSeed, type TwinData } from './compute.ts';
import type { TwinRequest } from './worker.ts';

let results: Promise<ScenariosFile | null> | null = null;
export function loadResults(): Promise<ScenariosFile | null> {
  results ??= fetch(import.meta.env.BASE_URL + 'results/scenarios.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? (r.json() as Promise<ScenariosFile>) : null))
    .catch(() => null);
  return results;
}

export async function seedFor(id: string): Promise<number> {
  const f = await loadResults();
  const s = f?.scenarios.find((x) => x.id === id);
  return typicalSeed(s?.perSeed, s?.with.deaths.mean);
}

const cache = new Map<string, Promise<TwinData>>();

export function loadTwin(id: string): Promise<TwinData> {
  let p = cache.get(id);
  if (!p) {
    p = seedFor(id).then((seed) => new Promise<TwinData>((resolve, reject) => {
      const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<TwinData>) => { resolve(e.data); w.terminate(); };
      w.onerror = (e) => { reject(new Error(e.message || 'The simulation worker failed')); w.terminate(); };
      const req: TwinRequest = { id, seed, days: daysFor(id) };
      w.postMessage(req);
    }));
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

export function useTwin(id: string): { data: TwinData | null; error: string | null } {
  const [state, setState] = useState<{ id: string; data: TwinData | null; error: string | null }>({ id, data: null, error: null });
  useEffect(() => {
    let live = true;
    loadTwin(id).then(
      (data) => { if (live) setState({ id, data, error: null }); },
      (e: unknown) => { if (live) setState({ id, data: null, error: e instanceof Error ? e.message : String(e) }); },
    );
    return () => { live = false; };
  }, [id]);
  return state.id === id ? state : { data: null, error: null };
}
