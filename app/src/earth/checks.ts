import { replay, UNTUNED, type AdapterParameters, type EiaDataset, type Timing } from './adapter.ts';

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
function rejects(action: () => unknown, message: string): void {
  let threw = false;
  try { action(); } catch { threw = true; }
  check(threw, message);
}
export function runChecks(texas: EiaDataset, parameters: AdapterParameters): void {
  const cut = 96;
  const changed = structuredClone(texas);
  const original = structuredClone(texas);
  // Future DF can be legitimately known day-ahead; remove it in both inputs for the actual-data isolation check.
  original.rows.slice(cut).forEach(r => { r.DF = null; });
  changed.rows.slice(cut).forEach(r => { r.D = 1; r.NG = 1; r.DF = null; });
  for (const timing of ['meter-time', 'public-delay'] as Timing[]) {
    check(JSON.stringify(replay(original, parameters, timing).slice(0, cut)) === JSON.stringify(replay(changed, parameters, timing).slice(0, cut)), `Future actual values changed earlier outputs: ${timing}`);
  }
  const unpublished = structuredClone(texas);
  // At Feb 12 00Z, Feb 11 NG remains unpublished and Feb 14 DF is unavailable even to the ideal day-ahead feed.
  unpublished.rows.slice(84).forEach(r => { r.NG = 1; });
  unpublished.rows.slice(144).forEach(r => { r.DF = 1; });
  check(JSON.stringify(replay(texas, parameters, 'public-delay').slice(0, cut)) === JSON.stringify(replay(unpublished, parameters, 'public-delay').slice(0, cut)), 'Unpublished values changed public-delay outputs');

  const synthetic: EiaDataset = { respondent: 'ERCO', rows: Array.from({ length: 80 }, (_, i) => ({
    time: new Date(Date.UTC(2021, 1, 8) + i * 3_600_000).toISOString().replace('.000Z', 'Z'), D: 100, DF: 100, NG: 120,
  })) };
  synthetic.rows[40].NG = 0;
  const zero = replay(synthetic, UNTUNED);
  check(zero[40].log !== null && zero[40].alert, 'A measured zero must remain an outage observation');
  synthetic.rows[40].NG = null;
  const missing = replay(synthetic, UNTUNED);
  check(missing[40].log === null && missing[63].log === null && missing[64].log !== null, 'Missing generation must restart the 24-reading warmup');
  const gap = structuredClone(synthetic);
  gap.rows.splice(40, 1);
  check(replay(gap, UNTUNED)[40].log === null, 'A clock gap must restart history');
  for (const value of [NaN, Infinity]) rejects(() => replay(texas, { ...parameters, generationMultiplier: value }), 'Nonfinite scaling must be rejected');
  const badClock = structuredClone(synthetic);
  badClock.rows[0].time = '2021-02-08T00:15:00Z';
  rejects(() => replay(badClock, parameters), 'Off-hour timestamps must be rejected');
  console.log('Earth checks: PASS (future actuals, unpublished data, measured zero, missing/gapped hours, invalid parameters and clocks)');
}
