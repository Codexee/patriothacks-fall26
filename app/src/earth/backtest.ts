import { replay, UNTUNED, type AdapterParameters, type EiaDataset, type HourResult, type Timing } from './adapter.ts';

export const EEA3 = '2021-02-15T07:25:00Z';
const HOUR = 3_600_000;
const round = (n: number) => Math.round(n * 10_000) / 10_000;
export function summarize(hours: HourResult[], reference: string | null = null) {
  const evaluated = hours.filter(h => h.log !== null);
  const alerted = hours.filter(h => h.alert);
  const starts = hours.filter((h, i) => h.alert && !hours[i - 1]?.alert);
  const first = alerted[0];
  return {
    firstAlertUtc: first?.issueTime ?? null,
    firstAlertMeterUtc: first?.meterTime ?? null,
    leadHours: first && reference ? round((Date.parse(reference) - Date.parse(first.issueTime)) / HOUR) : null,
    referenceUtc: reference,
    hours: hours.length, evaluatedHours: evaluated.length, warmupOrMissingHours: hours.length - evaluated.length,
    alertHours: alerted.length, alertHourFraction: evaluated.length ? round(alerted.length / evaluated.length) : null,
    alertEpisodes: starts.length, episodeStartsUtc: starts.map(h => h.issueTime),
    firstAlertLog: first?.log ?? null,
  };
}
export function eventResult(dataset: EiaDataset, parameters: AdapterParameters, timing: Timing, reference: string | null = null) {
  return summarize(replay(dataset, parameters, timing), reference);
}
export function monthlyFalseAlarms(dataset: EiaDataset, parameters: AdapterParameters, timing: Timing) {
  const hours = replay(dataset, parameters, timing);
  const months: Record<string, { hours: number; evaluatedHours: number; alertHours: number; episodeStarts: number }> = {};
  hours.forEach((h, i) => {
    const month = h.issueTime.slice(0, 7);
    const m = months[month] ??= { hours: 0, evaluatedHours: 0, alertHours: 0, episodeStarts: 0 };
    m.hours++;
    if (h.log) m.evaluatedHours++;
    if (h.alert) {
      m.alertHours++;
      if (!hours[i - 1]?.alert) m.episodeStarts++;
    }
  });
  const total = summarize(hours);
  return { ...total, months,
    falseAlarmEpisodesPerMonth: round(total.alertEpisodes / Object.keys(months).length),
    definition: 'Every alert episode start in the 2019-2020 control period is counted as an unverified/false alarm. No event labels were supplied; some may coincide with real grid stress. Consecutive alert hours count as one episode; month boundaries do not reset episodes.' };
}

/** Fit ONLY on Texas Feb 2021; hold-out and Elliott never enter selection. */
export function tune(texas: EiaDataset) {
  const candidates: { parameters: AdapterParameters; firstAlertUtc: string | null; leadHours: number | null; preStormAlertHours: number; alertHours: number; score: number }[] = [];
  // Fixed search before evaluating transfer/hold-out. A 72 h event window is the demo's relevance bound.
  const earliest = Date.parse(EEA3) - 72 * HOUR;
  for (const trailingPeakHours of [1, 6, 12, 24, 48, 72]) {
    for (const generationMultiplier of [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2]) {
      const parameters = { generationMultiplier, trailingPeakHours };
      const hours = replay(texas, parameters);
      const result = summarize(hours, EEA3);
      const preStormAlertHours = hours.filter(h => h.alert && Date.parse(h.issueTime) < earliest).length;
      const lead = result.leadHours;
      // Prefer no unrelated early-week alarms, then maximize positive warning up to 72 h.
      const score = preStormAlertHours > 0 ? -1000 - preStormAlertHours
        : lead !== null && lead > 0 && lead <= 72 ? lead : -100;
      candidates.push({ parameters, firstAlertUtc: result.firstAlertUtc, leadHours: lead,
        preStormAlertHours, alertHours: result.alertHours, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.alertHours - b.alertHours || a.parameters.trailingPeakHours - b.parameters.trailingPeakHours || a.parameters.generationMultiplier - b.parameters.generationMultiplier);
  return { parameters: candidates[0].parameters, candidates,
    method: '54 fixed adapter settings; Texas event only. Reject any alert earlier than 72 h before EEA3, then maximize positive lead within 72 h. Tie-break on fewer alert hours, shorter peak window, smaller generation multiplier. This fits the demonstration event and does not establish predictive accuracy.' };
}
export { UNTUNED };
