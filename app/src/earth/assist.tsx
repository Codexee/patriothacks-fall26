// "Without / With": what the public sees without the warning, and what this tool adds.
// Also the live counter strip and the card of model inputs at the first alert.
import { useEffect, useMemo, useRef, useState } from 'react';
import { modelUrl } from '../contracts.ts';
import type { EventReplay } from '../contracts.ts';
import { HERO_FACTS } from '../story/script.ts';
import type { Clock } from './clock.ts';
import { fmtHour, fmtInt, parseUtc } from './data.ts';
import type { Live, Scene } from './data.ts';
import { firstAlertIndex } from './panels.tsx';
import type { Official } from './panels.tsx';

export type Assist = 'without' | 'with';

/** The first official action of a hero event (from the story facts table), as a replay hour. */
export function officialFor(live: Live): (Official & { utc: string }) | null {
  const hero = live.row?.hero;
  const f = hero ? HERO_FACTS[hero] : undefined;
  if (!f) return null;
  const index = (parseUtc(f.utc) - parseUtc(live.replay.t0)) / 3600_000;
  if (index < 0 || index > live.replay.hours - 1) return null;
  return { index, label: f.action, utc: f.utc };
}

export function AssistToggle({ value, onChange }: { value: Assist; onChange: (v: Assist) => void }) {
  return (
    <div className="em-assist" role="radiogroup" aria-label="Show the replay without or with the warning">
      {(['without', 'with'] as const).map((v) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {v === 'without' ? 'Without the warning' : 'With the warning'}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- counters

/** Numbers that follow the clock. They update through refs; widths are fixed, so nothing moves. */
export function Counters({ scene, live, clock, assist }: { scene: Scene; live: Live; clock: Clock; assist: Assist }) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const alertIdx = useMemo(() => firstAlertIndex(live), [live]);
  const official = useMemo(() => officialFor(live), [live]);

  useEffect(() => {
    const { replay } = live;
    let last = -1;
    const paint = () => {
      const h = clock.index;
      if (h === last) return;
      last = h;
      let custOut = 0, n = 0, dme = 0;
      replay.counties.forEach((rc, k) => {
        const ci = live.ci[k];
        if (ci < 0) return;
        const c = scene.counties[ci];
        const pct = rc.out[h] ?? 0;
        custOut += ((c.customers ?? 0) * pct) / 100;
        if (pct >= 10) { n++; dme += c.dme ?? 0; }
      });
      const set = (i: number, t: string) => { const el = refs.current[i]; if (el && el.textContent !== t) el.textContent = t; };
      set(0, fmtInt(custOut));
      set(1, fmtInt(n));
      set(2, fmtInt(dme));
      if (alertIdx != null) set(3, h >= alertIdx ? `${h - alertIdx} h` : 'not yet');
      if (official) {
        const d = Math.round(h - official.index);
        set(4, d < 0 ? `in ${-d} h` : d === 0 ? 'now' : `${d} h ago`);
      }
    };
    paint();
    return clock.subscribe(paint);
  }, [scene, live, clock, alertIdx, official]);

  const cell = (i: number, label: string) => (
    <div className="em-counter" key={i}>
      <span className="em-counter-v" ref={(el) => { refs.current[i] = el; }} />
      <span className="em-counter-l">{label}</span>
    </div>
  );
  return (
    <div className="em-counters" aria-live="off">
      {cell(0, 'customers out now')}
      {cell(1, 'counties with 10% or more out')}
      {cell(2, 'on powered medical equipment there')}
      {assist === 'with' && alertIdx != null && cell(3, 'since the first alert')}
      {official && cell(4, official.label)}
    </div>
  );
}

// ---------------------------------------------------------------- model card

type Input = NonNullable<EventReplay['alertInputs']>[number];

/** How unusual an input is, so the card can show the most extreme three. null = not extreme. */
function extremity(i: Input): number | null {
  const v = i.value;
  switch (i.unit) {
    case 'ratio': return v >= 1 ? 3 + (v - 1) * 20 : null;
    case 'sigma': return Math.abs(v) >= 1.5 ? Math.abs(v) : null;
    case 'share': return v >= 0.02 ? 2 + v * 20 : null;   // skip tiny shares
    case 'm/s': return v >= 15 ? v / 5 : null;
    case 'mm': return v >= 25 ? v / 10 : null;
    default: return null;
  }
}

export function formatInput(i: Input, month: string | null): string {
  const v = i.value;
  switch (i.unit) {
    case 'ratio': {
      const pct = `${Math.round(v * 100)}%`;
      if (/month's record/.test(i.label) && month) return `${pct} of the ${month} record`;
      if (/all-time record/.test(i.label)) return `${pct} of the all-time record`;
      if (/30-day peak/.test(i.label)) return `${pct} of the 30-day peak`;
      return pct;
    }
    case 'sigma':
      return /temperature/i.test(i.label)
        ? `${Math.abs(v).toFixed(1)} sigma ${v < 0 ? 'colder' : 'warmer'} than normal`
        : `${v.toFixed(1)} sigma`;
    case 'share': return `${(v * 100).toFixed(1)}%`;
    case 'm/s': return `${v.toFixed(1)} m/s`;
    case 'mm': return `${Math.round(v)} mm`;
  }
}

export function topInputs(live: Live, n = 3): Input[] {
  const all = live.replay.alertInputs ?? [];
  return all
    .map((i) => ({ i, s: extremity(i) }))
    .filter((x): x is { i: Input; s: number } => x.s != null)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.i);
}

/** "13 h before the first outage; 19 h before the order". null when the model did not warn. */
export function leadText(live: Live): string | null {
  const row = live.row;
  if (!row || row.leadHours == null || !row.firstAlert) return null;
  let t = `${Math.round(row.leadHours)} h before the first outage`;
  const hero = row.hero ? HERO_FACTS[row.hero] : undefined;
  if (hero) {
    const h = Math.round((parseUtc(hero.utc) - parseUtc(row.firstAlert)) / 3600_000);
    if (h > 0) t += `; ${h} h before the ${/order/.test(hero.action) ? 'order' : 'first official action'}`;
  }
  return t;
}

interface TopTen { model: number; history: number; chance: number }

/** The measured advantage of the check-first list, if metrics.json has it (else nothing is shown). */
function useTopTen(): TopTen | null {
  const [v, setV] = useState<TopTen | null>(null);
  useEffect(() => {
    let on = true;
    fetch(modelUrl('metrics'))
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        const d = m?.dark;
        const t = { model: d?.top10Overlap, history: d?.top10History, chance: d?.top10Chance };
        if (on && [t.model, t.history, t.chance].every((x) => typeof x === 'number')) setV(t as TopTen);
      })
      .catch(() => {});
    return () => { on = false; };
  }, []);
  return v;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function ModelCard({ scene, live, compact = false }: { scene: Scene; live: Live; compact?: boolean }) {
  const inputs = useMemo(() => topInputs(live), [live]);
  const lead = useMemo(() => leadText(live), [live]);
  const topTen = useTopTen();
  const fa = live.row?.firstAlert ?? null;
  const month = fa ? MONTHS[new Date(parseUtc(fa)).getUTCMonth()] : null;
  const noForecast = live.row?.leadHoursNoForecast;
  return (
    <aside className={`em-model${compact ? ' em-model-compact' : ''}`} aria-label="The warning">
      <p className="em-lead">
        {lead
          ? <>Warned <b>{lead}</b>.</>
          : noForecast != null
            ? <>Warned <b>{Math.round(noForecast)} h</b> before, without a weather forecast.</>
            : <>The model did not warn this one.</>}
      </p>
      {lead && <p className="em-caveat">{scene.library.warnNote ?? 'Model with a weather forecast; lead times are an upper bound.'}</p>}
      {inputs.length > 0 && fa && (
        <>
          <h3>Inputs at the first alert, {fmtHour(parseUtc(fa))}</h3>
          <dl>
            {inputs.map((i) => (
              <div key={i.feature}>
                <dt>{i.label}</dt>
                <dd>{formatInput(i, month)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {topTen && !compact && (
        <p className="em-advantage">
          Check-first list, 2023–2024 test: its top 10 held {Math.round(topTen.model * 100)}% of the 10 counties that stayed dark
          longest; past outages alone: {Math.round(topTen.history * 100)}%; chance: {Math.round(topTen.chance * 100)}%.
        </p>
      )}
    </aside>
  );
}

