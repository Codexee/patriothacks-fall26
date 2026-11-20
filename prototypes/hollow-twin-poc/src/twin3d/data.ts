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

function runWorker(req: TwinRequest): Promise<TwinData> {
  return new Promise<TwinData>((resolve, reject) => {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<TwinData>) => { resolve(e.data); w.terminate(); };
    w.onerror = (e) => { reject(new Error(e.message || 'The simulation worker failed')); w.terminate(); };
    w.postMessage(req);
  });
}

/** The film's data: the typical held-out seed, no workstation detail. */
export function loadTwin(id: string): Promise<TwinData> {
  let p = cache.get(id);
  if (!p) {
    p = seedFor(id).then((seed) => runWorker({ id, seed, days: daysFor(id) }));
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** The workstation's data: any seed, with per-day detail. Cached per disaster and seed. */
export function loadTwinDetail(id: string, seed: number): Promise<TwinData> {
  const key = `${id}:${seed}:detail`;
  let p = cache.get(key);
  if (!p) {
    p = runWorker({ id, seed, days: daysFor(id), detail: true });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** Loads the workstation data for a disaster and seed (null while it runs). */
export function useTwinDetail(id: string, seed: number | null): { data: TwinData | null; error: string | null } {
  const key = `${id}:${seed}`;
  const [state, setState] = useState<{ key: string; data: TwinData | null; error: string | null }>({ key, data: null, error: null });
  useEffect(() => {
    if (seed === null) return;
    let live = true;
    loadTwinDetail(id, seed).then(
      (data) => { if (live) setState({ key, data, error: null }); },
      (e: unknown) => { if (live) setState({ key, data: null, error: e instanceof Error ? e.message : String(e) }); },
    );
    return () => { live = false; };
  }, [id, seed, key]);
  return state.key === key ? state : { data: null, error: null };
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
