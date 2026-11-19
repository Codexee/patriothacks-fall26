// The county's outage record, built from the replay files of its balancing area's events.
// A replay file keeps only the counties that reached 2% of customers out (data/build/export_app.py),
// so a county that is not in a replay had 0 dark hours in that event.
import { useEffect, useState } from 'react';
import { dataUrl, type County, type EventReplay, type EventRow } from '../contracts.ts';
import { fetchJson } from './shared.tsx';

export interface CountyRow {
  fips: string;
  dark: number;          // hours with >= 10% of customers out
  pred: number | null;   // the dark model's estimate at the event start
  peak: number;          // highest percent of customers out, 0..100
}

/** Event id -> the counties of that replay, or 'error'. Loads one file at a time. */
export type AreaReplays = Record<string, CountyRow[] | 'error'>;

export function useAreaReplays(events: EventRow[]): AreaReplays {
  const [byId, setById] = useState<AreaReplays>({});
  const ids = events.filter((e) => e.hasReplay).map((e) => e.id).join(',');
  useEffect(() => {
    let live = true;
    setById({});
    (async () => {
      for (const id of ids ? ids.split(',') : []) {
        let value: CountyRow[] | 'error';
        try {
          const r = await fetchJson<EventReplay>(dataUrl(`events/${id}.json`));
          value = r.counties.map((c) => ({ fips: c.fips, dark: c.darkHours, pred: c.predDarkHours, peak: c.out.reduce((m, v) => (v > m ? v : m), 0) }));
        } catch {
          value = 'error';
        }
        if (!live) return;
        setById((prev) => ({ ...prev, [id]: value }));
      }
    })();
    return () => {
      live = false;
    };
  }, [ids]);
  return byId;
}

export interface CountyInEvent {
  event: EventRow;
  dark: number;
  pred: number | null;
  peak: number | null;   // null = under the 2% cutoff
  rank: number | null;   // rank by dark hours among the area's counties; null when not dark
  areaCounties: number;
}

/** This county in each loaded event of its area. */
export function countyInEvents(fips: string, events: EventRow[], replays: AreaReplays, areaFips: Set<string>): CountyInEvent[] {
  const out: CountyInEvent[] = [];
  for (const e of events) {
    const r = replays[e.id];
    if (!r || r === 'error') continue;
    const inArea = r.filter((c) => areaFips.has(c.fips));
    const me = r.find((c) => c.fips === fips);
    const dark = me?.dark ?? 0;
    out.push({
      event: e,
      dark,
      pred: me?.pred ?? null,
      peak: me ? me.peak : null,
      rank: dark > 0 ? inArea.filter((c) => c.dark > dark).length + 1 : null,
      areaCounties: areaFips.size,
    });
  }
  return out;
}

export function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Mean dark hours per event for every county of the area, over the loaded events. */
export function areaMeanDark(events: EventRow[], replays: AreaReplays, area: County[]): Map<string, number> | null {
  const loaded = events.filter((e) => Array.isArray(replays[e.id]));
  if (!loaded.length) return null;
  const sum = new Map<string, number>(area.map((c) => [c.fips, 0]));
  for (const e of loaded) {
    for (const c of replays[e.id] as CountyRow[]) if (sum.has(c.fips)) sum.set(c.fips, sum.get(c.fips)! + c.dark);
  }
  return new Map([...sum].map(([k, v]) => [k, v / loaded.length]));
}

export const dmePer1000 = (c: County) => (c.dme != null && c.pop ? (c.dme / c.pop) * 1000 : null);
