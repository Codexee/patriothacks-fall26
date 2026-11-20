// REBUILD, problem #4 — Water Safety (key `snow`, after John Snow's 1854 cholera map).
// "Lower-level recyclers fail and tap water makes people sick. Catch bad water before people drink it."
//
// Inputs (only what residents have): residents' reports in the app that the water tastes bad or makes them sick,
// and the census, which lists the sections with a water recycler. No sensor boxes, no tap meters.
// Public knowledge used: a recycler serves its own level and the 2 levels above and below it (stated assumption).
//
// What it does each day: counts water complaints per 1,000 residents around each recycler over the last 2 days. A
// recycler whose levels complain at 3 times the typical rate is the likely source: it tells those levels to boil
// their water, and sends the residents' repair crew (again after 4 days if the complaints continue).
import { LEVELS, SECTIONS_PER_LEVEL, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

const REACH = 2; // a recycler serves its own level ±2
const MIN_REPORTS = 6; // at least this many complaints in 2 days
const RATE_FACTOR = 3; // 3× the typical complaint rate
const REPAIR_EVERY_DAYS = 4;

export function waterSafety(m: ProductMemory, day: number): { outputs: Output[]; log: NonNullable<ProductLog['waterSafety']> } | null {
  const days = m.waterReports ?? [];
  if (!days.length || !m.census.people.length) return null;
  const recyclers: number[] = [];
  m.recyclerSections?.forEach((i) => { const l = Math.floor(i / SECTIONS_PER_LEVEL) + 1; if (!recyclers.includes(l)) recyclers.push(l); });
  if (!recyclers.length) return null;
  const people = (l: number) => { let s = 0; for (let c = 0; c < SECTIONS_PER_LEVEL; c++) s += m.selfCount[(l - 1) * SECTIONS_PER_LEVEL + c] || m.census.people[(l - 1) * SECTIONS_PER_LEVEL + c] || 0; return s; };
  const reportsAt = (l: number) => days.reduce((a, d) => a + (d.perLevel[l - 1] || 0), 0);

  const rows = recyclers.sort((a, b) => a - b).map((r) => {
    let rep = 0, pop = 0;
    for (let l = Math.max(1, r - REACH); l <= Math.min(LEVELS, r + REACH); l++) { rep += reportsAt(l); pop += people(l); }
    return { level: r, reports: rep, per1000: pop > 0 ? (rep / pop) * 1000 : 0 };
  });
  const sorted = rows.map((x) => x.per1000).sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length / 2)];
  const suspects = rows.filter((x) => x.reports >= MIN_REPORTS && x.per1000 > RATE_FACTOR * typical + 0.05);

  m.repairsSent ??= {};
  const outputs: Output[] = [];
  for (const sus of suspects) {
    const from = Math.max(1, sus.level - REACH), to = Math.min(LEVELS, sus.level + REACH);
    const note = m.userReports.filter((u) => u.level >= from && u.level <= to).slice(-1)[0];
    outputs.push({
      kind: 'alert', id: `snow-${sus.level}-${day}`, module: 'snow', action: 'boilWater', from, to, hours: 48,
      text: `Boil all water on levels ${from}–${to} before drinking it. The recycler on level ${sus.level} is the likely source. A repair crew is on the way.`,
      evidence: [
        `${sus.reports} water complaints in 2 days on levels ${from}–${to}: ${sus.per1000.toFixed(2)} per 1,000 residents (typical around a recycler: ${typical.toFixed(2)})`,
        `The census lists a recycler on level ${sus.level}; it serves levels ${from}–${to}`,
        ...(note ? [`Resident report, level ${note.level}: “${note.text}”`] : []),
      ],
    });
    const sent = m.repairsSent[String(sus.level)];
    if (sent === undefined || day - sent >= REPAIR_EVERY_DAYS) {
      m.repairsSent[String(sus.level)] = day;
      outputs.push({ kind: 'repair', module: 'snow', level: sus.level, text: `Repair crew sent to the recycler on level ${sus.level}.` });
    }
  }
  return { outputs, log: { rows, typical, suspects: suspects.map((s) => s.level), crews: outputs.filter((o) => o.kind === 'repair').length } };
}
