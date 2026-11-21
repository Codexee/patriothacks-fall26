// REBUILD, problem #9 — Outbreak Tracker (key `ledger`).
// "A lung sickness spreads; the official numbers don't match what people see. Track the real outbreak."
//
// Inputs (only what residents have): residents' cough reports in the app, the cases the clinics saw per level, the
// residents' own head count, and the Directorate's public case count (its bulletin). No hidden infection numbers.
//
// What it does each day: puts the residents' cough reports and the clinic counts side by side per level (2 days),
// and compares the total with the Directorate's number. Levels where coughs run at 3 times the typical rate (and at
// least 8 reports) are hot spots: the app tells them and the next level up and down to isolate the sick (masks,
// separate rooms, food left at the door). The thresholds are design choices, not measured values.
import { LEVELS, SECTIONS_PER_LEVEL, type Output } from '../sim/types.ts';
import type { ProductLog, ProductMemory } from './types.ts';

const MIN_REPORTS = 8;
const RATE_FACTOR = 3;
const SPREAD = 1; // also warn the level above and below

export function outbreak(m: ProductMemory, day: number): { outputs: Output[]; log: NonNullable<ProductLog['outbreak']> } | null {
  const days = m.coughReports ?? [];
  if (!days.length || !m.census.people.length) return null;
  const people = (l: number) => { let s = 0; for (let c = 0; c < SECTIONS_PER_LEVEL; c++) { const i = (l - 1) * SECTIONS_PER_LEVEL + c; s += m.selfCount[i] || m.census.people[i] || 0; } return s; };
  const rows = Array.from({ length: LEVELS }, (_, k) => {
    const l = k + 1;
    const reports = days.reduce((a, d) => a + (d.perLevel[k] || 0), 0);
    const clinic = (m.clinicCases ?? []).reduce((a, d) => a + (d.perLevel[k] || 0), 0);
    const p = people(l);
    return { level: l, reports, clinic, per1000: p > 0 ? (reports / p) * 1000 : 0 };
  });
  const sorted = rows.map((r) => r.per1000).sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length / 2)];
  const hotspots = rows.filter((r) => r.reports >= MIN_REPORTS && r.per1000 > RATE_FACTOR * typical + 0.05).map((r) => r.level);
  // Group hot spots (± SPREAD) into level ranges.
  const covered = new Set<number>();
  for (const l of hotspots) for (let k = l - SPREAD; k <= l + SPREAD; k++) if (k >= 1 && k <= LEVELS) covered.add(k);
  const levels = [...covered].sort((a, b) => a - b);
  const outputs: Output[] = [];
  for (let a = 0; a < levels.length;) {
    let b = a;
    while (b + 1 < levels.length && levels[b + 1] === levels[b] + 1) b++;
    const from = levels[a], to = levels[b];
    const spot = rows.filter((r) => r.level >= from && r.level <= to).sort((x, y) => y.per1000 - x.per1000)[0];
    outputs.push({
      kind: 'alert', id: `ob-${day}-${from}`, module: 'ledger', action: 'isolateSick', from, to, hours: 48,
      text: `Lung sickness is spreading on levels ${from}–${to}. Keep anyone coughing in a separate room, wear a mask near them, and leave food at the door. Go to the clinic if breathing gets hard.`,
      evidence: [
        `${spot.reports} cough reports in 2 days on level ${spot.level}: ${spot.per1000.toFixed(2)} per 1,000 residents (typical: ${typical.toFixed(2)})`,
        `Clinics on these levels saw ${rows.filter((r) => r.level >= from && r.level <= to).reduce((s, r) => s + r.clinic, 0)} cases in 2 days`,
      ],
    });
    a = b + 1;
  }
  const residentsCount = rows.reduce((s, r) => s + r.reports, 0);
  const clinicCount = rows.reduce((s, r) => s + r.clinic, 0);
  return {
    outputs,
    log: { hotspots, top: [...rows].sort((x, y) => y.per1000 - x.per1000).slice(0, 5), typical, residentsCount, clinicCount, official: m.officialCases ?? null },
  };
}
