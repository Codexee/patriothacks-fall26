// PROTOTYPE module: the Ledger (problems 9 and 13) with Truthcount inside it.
// It checks Directorate claims against residents' own data and publishes findings in a hash chain,
// so anyone can see that no finding was changed later. A published finding ends a lie's delay.
//  - Plant check: Plant 3's share of total plant output against its own baseline.
//  - Truthcount: estimates real cases from cough reports and clinic counts, and compares with the official count.
import { LEVELS, type LieId, type Output } from '../sim/types.ts';
import type { LedgerRecord, ProductLog, ProductMemory } from './types.ts';

/** A finding another module asks the Ledger to publish. */
export interface Finding { id: string; module: string; lie?: LieId; text: string; evidence: string[] }

const REPORT_RATE = 0.01; // calibration: about 1 in 100 sick residents reports a cough each day
const CLINIC_SHARE = 0.05; // calibration: a clinic sees about 5% of the sick within ±2 levels each day
const PLANT_DROP = 0.9; // Plant 3 below 90% of its normal share
const MIN_READINGS = 16;
const GAP_FACTOR = 2.5; // estimate ≥ 2.5 × the official count
const MIN_PREVALENCE = 0.002;
const ISOLATE_PREVALENCE = 0.005;
const MIN_EXCESS = 5;

/** FNV-1a, 32-bit. Enough to show tampering in a prototype; a real Ledger would use signatures. */
export function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function ledger(m: ProductMemory, day: number, incoming: Finding[]):
  { outputs: Output[]; log: NonNullable<ProductLog['ledger']> } {
  const outputs: Output[] = [];
  const candidates: { id: string; module: string; lie?: LieId; text: string; evidence: string[] }[] = [...incoming];

  // --- Plant check ---
  const P = m.plantOut.length;
  const hours = P ? m.plantOut[0].length : 0;
  const newRatios: number[] = [];
  for (let h = Math.max(0, hours - 24); h < hours; h++) {
    const p3 = m.plantOut[2]?.[h];
    let others = 0, k = 0;
    for (let j = 0; j < P; j++) if (j !== 2) { const v = m.plantOut[j][h]; if (v !== null && v > 0) { others += v; k++; } }
    if (p3 !== null && p3 !== undefined && p3 > 0 && k > 0) newRatios.push(p3 / (others / k));
  }
  m.plant3Ratios.push(...newRatios);
  if (m.plant3Ratios.length > 72) m.plant3Ratios.splice(0, m.plant3Ratios.length - 72);
  const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  if (m.plant3Baseline === null && m.plant3Ratios.length >= 40) m.plant3Baseline = med(m.plant3Ratios);
  const recent = newRatios.length >= MIN_READINGS ? med(newRatios) : null;
  if (m.plant3Baseline !== null && recent !== null && recent < PLANT_DROP * m.plant3Baseline) {
    candidates.push({
      id: 'plant3', module: 'ledger', lie: 'plantFine',
      text: `Plant 3 is producing ${Math.round((recent / m.plant3Baseline) * 100)}% of its normal share. It is not operating normally.`,
      evidence: [`${newRatios.length} feeder-meter readings in 24 h; Plant 3 / other plants = ${recent.toFixed(2)} (normal ${m.plant3Baseline.toFixed(2)})`],
    });
  }

  // --- Truthcount ---
  const coughs = m.reports.cough.map((days) => days.slice(-2).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(2, days.length)));
  const background = med(coughs); // most levels have no outbreak: their reports are the false-report floor
  const byLevel: { level: number; est: number }[] = [];
  let fromReports = 0, pop = 0;
  for (let l = 1; l <= LEVELS; l++) {
    const est = Math.max(0, coughs[l - 1] - background) / REPORT_RATE;
    byLevel.push({ level: l, est });
    fromReports += est;
  }
  for (const p of m.census.people) pop += p || 0;
  const fromClinics = m.clinicCases.reduce((s, c) => s + c.cases, 0) / CLINIC_SHARE;
  const estimated = Math.round(m.clinicCases.length ? (fromReports + fromClinics) / 2 : fromReports);
  const official = m.officialCases;
  if (pop > 0 && estimated > GAP_FACTOR * Math.max(1, official) && estimated / pop > MIN_PREVALENCE) {
    candidates.push({
      id: 'outbreak', module: 'ledger', lie: 'noOutbreak',
      text: `There is an outbreak. Official count ${official.toLocaleString('en-US')}; estimated ${estimated.toLocaleString('en-US')}.`,
      evidence: [
        `Cough reports: about ${Math.round(fromReports).toLocaleString('en-US')} sick (reporting rate 1%/day, background removed)`,
        `Clinics: ${m.clinicCases.reduce((s, c) => s + c.cases, 0)} cases seen → about ${Math.round(fromClinics).toLocaleString('en-US')} sick`,
      ],
    });
  }
  // Isolation alerts for the levels where the estimate is high (always sent; they are local advice).
  const levelPop = (l: number) => { let s = 0; for (let c = 0; c < 8; c++) s += m.census.people[(l - 1) * 8 + c] || 0; return s; };
  let start = -1;
  // A level needs both: a high estimate, and at least MIN_EXCESS reports above background in 2 days (not noise).
  const excess = (l: number) => m.reports.cough[l - 1].slice(-2).reduce((a, b) => a + b, 0) - 2 * background;
  for (let l = 1; l <= LEVELS + 1; l++) {
    const hot = l <= LEVELS && levelPop(l) > 0 && byLevel[l - 1].est / levelPop(l) > ISOLATE_PREVALENCE && excess(l) >= MIN_EXCESS;
    if (hot && start < 0) start = l;
    if (!hot && start >= 0) {
      outputs.push({
        kind: 'alert', id: `iso-${start}-${day}`, module: 'ledger', action: 'isolateSick', from: start, to: l - 1, hours: 48,
        text: `Lung sickness on levels ${start}–${l - 1}. Keep the sick apart, and wear masks in shared rooms.`,
        evidence: [`Estimated over ${Math.round(ISOLATE_PREVALENCE * 1000) / 10}% of residents sick on these levels`],
      });
      start = -1;
    }
  }

  // --- Publish new findings in the hash chain ---
  for (const c of candidates) {
    if (m.ledger.some((r) => r.id === c.id)) continue;
    const prevHash = m.ledger.length ? m.ledger[m.ledger.length - 1].hash : '00000000';
    const hash = fnv(prevHash + c.text + c.evidence.join('|'));
    const rec: LedgerRecord = { id: c.id, day, module: c.module, text: c.text, evidence: c.evidence, lie: c.lie, hash, prevHash };
    m.ledger.push(rec);
    outputs.push({ kind: 'finding', id: c.id, module: 'ledger', lie: c.lie, text: c.text, evidence: c.evidence, hash });
  }
  return {
    outputs,
    log: { plant3Share: recent, plant3Baseline: m.plant3Baseline, official, estimated, byLevel: byLevel.filter((b) => b.est > 0) },
  };
}
