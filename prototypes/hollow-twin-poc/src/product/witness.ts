// PROTOTYPE module: Witness (problem 13). Is the surface safe? The Directorate says the air kills in minutes;
// a growing rumor says it has healed, and believers try the closed way up. Witness trusts only readings signed by
// the council's own registered probes, rejects everything else, takes the median of the last 3 days, and
// broadcasts the verified answer to everyone the network or the Lantern mesh can reach. The Ledger publishes it,
// which exposes the Directorate's claim.
import type { Observation, Output } from '../sim/types.ts';
import { probeSig } from '../sim/sign.ts';
import type { ProductLog, ProductMemory } from './types.ts';
import type { Finding } from './ledger.ts';

/** Keys of the probes the council installed at the surface vents (it holds them because it built the probes). */
const REGISTRY: Record<string, string> = { 'vent-A': 'k7f2', 'vent-B': 'q91x', 'vent-C': 'z3m8' };
const MIN_VALID = 3;

export function verifyProbe(o: Extract<Observation, { kind: 'probe' }>): boolean {
  const key = REGISTRY[o.device];
  return key !== undefined && probeSig(key, o.device, o.day, o.value) === o.sig;
}

export function classify(v: number): string {
  if (v >= 10) return 'deadly in minutes';
  if (v >= 1) return `not safe: survivable for about ${v < 3 ? 2 : 1} h with a filter mask`;
  return 'safe to breathe';
}

export function witness(m: ProductMemory, day: number):
  { outputs: Output[]; findings: Finding[]; log: NonNullable<ProductLog['witness']> } {
  const valid = m.probes.filter((p) => p.valid);
  const rejected = [...new Set(m.probes.filter((p) => !p.valid).map((p) => p.device))];
  const rumorReports = m.reports.surface.reduce((s, days) => s + (days[days.length - 1] ?? 0), 0);
  if (valid.length < MIN_VALID) {
    return { outputs: [], findings: [], log: { valid: valid.length, rejected, median: null, verdict: null, rumorReports } };
  }
  const sorted = valid.map((p) => p.value).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const verdict = classify(median);
  const evidence = [
    `${valid.length} signed readings from council probes ${[...new Set(valid.map((p) => p.device))].join(', ')} in 3 days; median toxicity ${median.toFixed(2)}`,
    rejected.length ? `Rejected unsigned or unknown devices: ${rejected.join(', ')}` : 'No unsigned readings',
  ];
  const outputs: Output[] = [{
    kind: 'verdict', module: 'witness', value: median,
    text: `Surface air (verified): ${verdict}. The surface has NOT healed, and it does not kill in minutes. Do not go up without a suit.`,
  }];
  const findings: Finding[] = median < 10 ? [{
    id: 'surface', module: 'witness', lie: 'surfaceDeadly',
    text: `Surface air is ${verdict} (toxicity ${median.toFixed(2)}). It does not kill in minutes, and it has not healed.`,
    evidence,
  }] : [];
  void day;
  return { outputs, findings, log: { valid: valid.length, rejected, median, verdict, rumorReports } };
}
