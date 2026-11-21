// Loads the twin data for one disaster: picks the typical held-out seed from public/results/scenarios.json,
// then runs both simulations in a Web Worker. Results are cached per disaster.
import type { Plan } from './compute.ts';
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

/** The workstation's data: any seed and plan, with per-day detail. Cached per disaster, seed and plan. */
export function loadTwinDetail(id: string, seed: number, plan: Plan = []): Promise<TwinData> {
  const key = `${id}:${seed}:detail:${JSON.stringify(plan)}`;
  let p = cache.get(key);
  if (!p) {
    p = runWorker({ id, seed, days: daysFor(id), detail: true, plan });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/**
 * Loads the workstation data for a disaster, seed and plan. While a new plan runs, it keeps returning the last data
 * of the same disaster and seed (pending = true), so the 3D view does not blank out.
 */
export function useTwinDetail(id: string, seed: number | null, plan: Plan = []): { data: TwinData | null; error: string | null; pending: boolean } {
  const base = `${id}:${seed}`;
  const key = `${base}:${JSON.stringify(plan)}`;
  const [state, setState] = useState<{ base: string; key: string; data: TwinData | null; error: string | null }>({ base, key, data: null, error: null });
  useEffect(() => {
    if (seed === null) return;
    let live = true;
    loadTwinDetail(id, seed, plan).then(
      (data) => { if (live) setState({ base, key, data, error: null }); },
      (e: unknown) => { if (live) setState({ base, key, data: null, error: e instanceof Error ? e.message : String(e) }); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (state.key === key) return { data: state.data, error: state.error, pending: false };
  return { data: state.base === base ? state.data : null, error: null, pending: true };
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
