// PROTOTYPE module: Snow (problem 4), after John Snow's 1854 cholera map. Traces water complaints and tap
// readings back to the recycler that serves those levels, warns only the levels it serves, and sends a repair crew.
import { LEVELS, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

const REACH = 2; // public knowledge: a recycler serves its own level ±2
const MIN_REPORTS = 6;
const RATE_FACTOR = 3; // a suspect has 3× the typical complaint rate
const BAD_TAP = 0.6;
const REPAIR_EVERY_DAYS = 4;

export interface Finding { id: string; module: 'snow'; lie?: 'waterSafe'; text: string; evidence: string[] }

export function snow(m: ProductMemory, day: number):
  { outputs: Output[]; findings: Finding[]; log: NonNullable<ProductLog['snow']> } | null {
  const recyclers = m.census.recyclerLevels;
  if (!recyclers.length) return null;
  const people = (l: number) => {
    let s = 0;
    for (let c = 0; c < 8; c++) s += m.census.people[(l - 1) * 8 + c] || 0;
    return s;
  };
  const reportsAt = (l: number) => m.reports.water[l - 1].slice(-2).reduce((a, b) => a + b, 0);

  const rows = recyclers.map((r) => {
    let rep = 0, pop = 0, tapSum = 0, tapN = 0;
    for (let l = Math.max(1, r - REACH); l <= Math.min(LEVELS, r + REACH); l++) {
      rep += reportsAt(l);
      pop += people(l);
      const t = m.sensorWater[l - 1];
      if (t !== null) { tapSum += t; tapN++; }
    }
    return { level: r, reports: rep, reportsPer1000: pop > 0 ? (rep / pop) * 1000 : 0, tap: tapN ? tapSum / tapN : null };
  });
  const sorted = rows.map((x) => x.reportsPer1000).sort((a, b) => a - b);
  const baseline = sorted[Math.floor(sorted.length / 2)];
  const suspects = rows.filter((x) =>
    (x.reports >= MIN_REPORTS && x.reportsPer1000 > RATE_FACTOR * baseline + 0.05) || (x.tap !== null && x.tap < BAD_TAP));

  const outputs: Output[] = [];
  const findings: Finding[] = [];
  for (const sus of suspects) {
    const from = Math.max(1, sus.level - REACH), to = Math.min(LEVELS, sus.level + REACH);
    const userNote = m.userReports.filter((u) => u.level >= from && u.level <= to).slice(-1)[0];
    const evidence = [
      `${sus.reports} water complaints in 2 days on levels ${from}–${to} (${sus.reportsPer1000.toFixed(2)} per 1,000 residents; typical ${baseline.toFixed(2)})`,
      sus.tap !== null ? `Sensor tap quality on those levels: ${sus.tap.toFixed(2)} (safe ≥ 0.80)` : 'No sensor tap readings on those levels',
      ...(userNote ? [`Resident report, level ${userNote.level}: “${userNote.text}”`] : []),
    ];
    outputs.push({
      kind: 'alert', id: `snow-${sus.level}-${day}`, module: 'snow', action: 'boilWater', from, to, hours: 48,
      text: `Boil all water on levels ${from}–${to}. The recycler on level ${sus.level} is the likely source.`,
      evidence,
    });
    const sent = m.repairsSent[String(sus.level)];
    if (sent === undefined || day - sent >= REPAIR_EVERY_DAYS) {
      m.repairsSent[String(sus.level)] = day;
      outputs.push({ kind: 'repair', module: 'snow', level: sus.level, text: `Repair crew sent to the recycler on level ${sus.level}.` });
    }
    findings.push({
      id: `water-L${sus.level}`, module: 'snow', lie: 'waterSafe',
      text: `The recycler on level ${sus.level} is the likely source of bad water on levels ${from}–${to}.`,
      evidence,
    });
  }
  return {
    outputs, findings,
    log: { suspects: rows.filter((r) => suspects.includes(r)).map((r) => ({ ...r })), baseline },
  };
}
