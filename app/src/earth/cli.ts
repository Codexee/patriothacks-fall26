import { eventResult, monthlyFalseAlarms, tune, UNTUNED, EEA3 } from './backtest.ts';
import { type EiaDataset, type Timing } from './adapter.ts';
import { runChecks } from './checks.ts';

// Match the existing sim CLI: keep Node-only typings local; no new dependencies.
const proc = (globalThis as unknown as { process: {
  argv: string[];
  getBuiltinModule(name: 'fs'): { readFileSync(path: URL, encoding: 'utf8'): string; writeFileSync(path: URL, value: string): void };
} }).process;
const fs = proc.getBuiltinModule('fs');
function load(name: string): EiaDataset {
  return JSON.parse(fs.readFileSync(new URL(`../../../data/eia-${name}.json`, import.meta.url), 'utf8')) as EiaDataset;
}
const texas = load('ercot-2021');
const timings: Timing[] = ['meter-time', 'public-delay'];
const untuned = Object.fromEntries(timings.map(t => [t, eventResult(texas, UNTUNED, t, EEA3)]));
console.log('UNTUNED (unchanged module; raw generation adapter)');
for (const t of timings) console.log(`${t}: first alert ${untuned[t].firstAlertUtc}; lead ${untuned[t].leadHours} h; alerts ${untuned[t].alertHours}/${untuned[t].evaluatedHours} eligible hours`);
if (proc.argv.includes('--untuned-only')) {
  fs.writeFileSync(new URL('./untuned-results.json', import.meta.url), JSON.stringify({ parameters: UNTUNED, results: untuned }, null, 2) + '\n');
} else {
  const calibration = tune(texas);
  console.log('TUNED adapter parameters (product thresholds unchanged):', calibration.parameters);
  const tuned = Object.fromEntries(timings.map(t => [t, eventResult(texas, calibration.parameters, t, EEA3)]));
  for (const t of timings) console.log(`${t}: first alert ${tuned[t].firstAlertUtc}; lead ${tuned[t].leadHours} h; alerts ${tuned[t].alertHours}/${tuned[t].evaluatedHours} eligible hours`);
  const elliott = Object.fromEntries(['tva', 'duk'].map(ba => [ba.toUpperCase(), Object.fromEntries(timings.map(t => [t, eventResult(load(`elliott-${ba}-2022`), calibration.parameters, t)]))]));
  for (const [ba, result] of Object.entries(elliott)) for (const t of timings) console.log(`Elliott ${ba} ${t}: first alert ${result[t].firstAlertUtc}; ${result[t].alertEpisodes} episodes; alerts ${result[t].alertHours}/${result[t].evaluatedHours} eligible hours`);
  const holdout = Object.fromEntries(timings.map(t => [t, monthlyFalseAlarms(load('ercot-2019-2020'), calibration.parameters, t)]));
  for (const t of timings) console.log(`ERCOT 2019-2020 ${t}: ${holdout[t].falseAlarmEpisodesPerMonth} false/unverified alarm episodes/month (${holdout[t].alertEpisodes} in 24 months), alert fraction ${holdout[t].alertHourFraction}`);
  const results = { schemaVersion: 1, module: 'app/src/product/earlyWarning.ts (unchanged, through stepProduct)', referenceUtc: EEA3,
    untunedParameters: UNTUNED, untuned, calibration, tuned, elliott, holdout,
    timing: {
      'meter-time': 'Ideal immediate BA meter access and prior-day 11 ET access to BA day-ahead DF. Retrospective event-time replay, not public EIA availability.',
      'public-delay': 'NG withheld until next BA operating day 11 ET; DF until target BA operating day 11 ET. Actions evaluated hourly with actual meter timestamps. Module horizon is 36 h after newest meter, so a delayed meter shortens remaining actionable horizon.',
    },
    assumptions: [
      'One aggregate plant, not individual generators. Raw D is measured load served, not total demand including disconnected customers.',
      'NG is dispatched generation, not available capacity. Tuned plantMeter is an assumed capacity proxy: trailing maximum NG multiplied by a fitted factor; no measured reserves or imports are available in these series.',
      'Critical share=25% is an adapter assumption, changes shed amount but not the alert trigger. Census people=1 is a contract placeholder, not a population estimate.',
      'Demand outlook uses only released day-ahead DF; unavailable targets persist last measured D. No future realized generation or demand enters observations.',
      'Historical EIA data are revised, not original release vintages. Publication schedules are conservative approximations, not exact historical arrival logs.',
      'Texas is the calibration event, not an independent test. Elliott is a transfer check. TVA/DUK imports limit comparisons using NG alone.',
      'Hold-out false alarms are conservative unverified episode starts, without labeled real emergencies. Also inspect alert-hour fractions.',
    ] };
  if (proc.argv.includes('--write')) fs.writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
  if (proc.argv.includes('--checks')) runChecks(texas, calibration.parameters);
}
