// PROTOTYPE helpers to build hourly scenario arrays from a few daily anchor values.

/** Linear interpolation between daily anchors (one value per day, placed at noon), sampled hourly. */
export function hourlyFromDaily(daily: number[], diurnal = 0): number[] {
  const days = daily.length;
  const out: number[] = [];
  for (let h = 0; h < days * 24; h++) {
    const t = h / 24 - 0.5; // day position, anchors at noon
    const i = Math.max(0, Math.min(days - 1, Math.floor(t)));
    const j = Math.min(days - 1, i + 1);
    const a = Math.max(0, Math.min(1, t - i));
    const base = daily[i] * (1 - a) + daily[j] * a;
    // Diurnal swing: peak in the evening (18:00), low before dawn (06:00).
    const swing = diurnal * Math.sin((((h % 24) - 12) / 24) * 2 * Math.PI);
    out.push(Math.round(base * (1 + swing) * 1000) / 1000);
  }
  return out;
}

/** Days of driving data for the real-data scenarios: the whole run (the engine's MAX_DAYS), so the week keeps repeating. */
export const RUN_DAYS = 120;

/** Repeat a 168-hour week (Monday 00:00 first) for `days` days. */
export function repeatWeek(week: number[], days = RUN_DAYS): number[] {
  return Array.from({ length: days * 24 }, (_, h) => week[h % week.length]);
}

/** Constant value for `days` days, hourly. */
export function flat(value: number, days = RUN_DAYS): number[] {
  return new Array(days * 24).fill(value);
}
