// Loads the two result files from public/results/. If a file is missing or does not look like the contract, the
// site uses the sample fixture for that file and marks it, so the page can show a "sample data" banner.
import { useEffect, useState } from 'react';
import type { CheckFirstFile, ImpactFile, ScenariosFile } from './contracts.ts';
import { sampleScenarios } from './fixtures/scenarios.ts';
import { sampleCheckFirst } from './fixtures/checkfirst.ts';

export interface Loaded<T> { data: T; sample: boolean; path: string; reason?: string }
export interface SiteData { scenarios: Loaded<ScenariosFile>; checkfirst: Loaded<CheckFirstFile>; impact: ImpactFile | null }

const isScenarios = (x: unknown): x is ScenariosFile =>
  !!x && typeof x === 'object' && Array.isArray((x as ScenariosFile).scenarios) && (x as ScenariosFile).scenarios.length > 0 &&
  Array.isArray((x as ScenariosFile).seeds) && Array.isArray((x as ScenariosFile).scenarios[0].daily);

const isCheckFirst = (x: unknown): x is CheckFirstFile =>
  !!x && typeof x === 'object' && Array.isArray((x as CheckFirstFile).inputs) && !!(x as CheckFirstFile).test &&
  Array.isArray((x as CheckFirstFile).test.rows);

async function load<T>(path: string, check: (x: unknown) => x is T, fallback: T): Promise<Loaded<T>> {
  try {
    const res = await fetch(import.meta.env.BASE_URL + path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('json')) throw new Error('not a JSON file');
    const json: unknown = await res.json();
    if (!check(json)) throw new Error('does not match the contract');
    return { data: json, sample: false, path };
  } catch (e) {
    return { data: fallback, sample: true, path, reason: e instanceof Error ? e.message : String(e) };
  }
}

let cache: Promise<SiteData> | null = null;

export function loadSiteData(): Promise<SiteData> {
  cache ??= Promise.all([
    load('results/scenarios.json', isScenarios, sampleScenarios),
    load('results/checkfirst.json', isCheckFirst, sampleCheckFirst),
    // Optional: each app's leave-one-out impact (`npm run impact`). Without it the app list shows no impact column.
    fetch(import.meta.env.BASE_URL + 'results/impact.json', { cache: 'no-cache' })
      .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
      .then((x: ImpactFile | null) => (x && Array.isArray(x.apps) ? x : null))
      .catch(() => null),
  ]).then(([scenarios, checkfirst, impact]) => ({ scenarios, checkfirst, impact }));
  return cache;
}

export function useSiteData(): SiteData | null {
  const [data, setData] = useState<SiteData | null>(null);
  useEffect(() => {
    let live = true;
    loadSiteData().then((d) => live && setData(d));
    return () => { live = false; };
  }, []);
  return data;
}
