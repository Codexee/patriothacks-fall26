// Evidence: #/evidence. Every event in the library as one row, the model results, and the downloads.
import { memo, useMemo, useState } from 'react';
import { dataUrl, type EventLibrary, type EventRow, type Metrics } from '../contracts.ts';
import { PageNav, fmtDay, fmtHours, fmtInt, fmtShare, parseUtc, useJson } from '../brief/shared.tsx';
import './evidence.css';

// Timeline strip: one scale for every row. 72 h before the start, then up to 7 days of the event.
const BEFORE_H = 72;
const AFTER_H = 168;
const SPAN_H = BEFORE_H + AFTER_H;
const pct = (h: number) => `${(h / SPAN_H) * 100}%`;

const MODEL_LABEL: Record<string, string> = {
  warn_full: 'Model: grid and weather',
  warn_grid: 'Model: grid data only',
  rule_forecast_error: 'Rule: demand above forecast',
  rule_hand: 'Rule: our earlier hand rule',
};
const MODEL_ORDER = ['warn_full', 'warn_grid', 'rule_forecast_error', 'rule_hand'];

interface Row extends EventRow {
  startMs: number;
  lengthH: number; // first hour to last hour of the event
  year: number;
}

type SortKey = 'start' | 'ba' | 'peakCustomersOut' | 'peakFrac' | 'lengthH' | 'leadHours';

const Strip = memo(function Strip({ e, stub }: { e: Row; stub: boolean }) {
  const shown = Math.min(e.lengthH, AFTER_H);
  const label =
    `Event of ${fmtHours(e.lengthH)}.` +
    (stub ? '' : e.leadHours != null ? ` Alert ${Math.round(e.leadHours)} hours before the start.` : ' No alert in the 72 hours before the start.');
  return (
    <div className="strip" role="img" aria-label={label}>
      {!stub && e.leadHours != null && <i className="alert" style={{ left: pct(Math.max(0, BEFORE_H - e.leadHours)) }} />}
      <i className={e.lengthH > AFTER_H ? 'out clipped' : 'out'} style={{ left: pct(BEFORE_H), width: pct(shown) }} />
    </div>
  );
});

const EventLine = memo(function EventLine({ e, stub }: { e: Row; stub: boolean }) {
  return (
    <tr>
      <td className="strip-cell"><Strip e={e} stub={stub} /></td>
      <td>{e.ba}</td>
      <td>
        {fmtDay(e.startMs)}
        {e.title && <span className="title">{e.title}</span>}
      </td>
      <td className="num">{fmtInt(e.peakCustomersOut)}</td>
      <td className="num">{fmtShare(e.peakFrac)}</td>
      <td className="num">{fmtHours(e.lengthH)}</td>
      <td><span className={`tag ${e.split}`}>{e.split}</span></td>
      <td className={!stub && e.leadHours == null ? 'missed' : ''}>
        {stub ? <span className="faint">pending</span> : e.leadHours != null ? `${Math.round(e.leadHours)} h` : 'not warned'}
      </td>
      <td>{e.hasReplay && <a href={`#/event/${e.id}`}>Replay</a>}</td>
    </tr>
  );
});

function EquityChart({ equity }: { equity: NonNullable<Metrics['equity']> }) {
  const max = Math.max(...equity.map((q) => q.hi)) || 1;
  const W = 420, H = 150, left = 150, right = 60, rowH = 30;
  const x = (v: number) => left + (v / max) * (W - left - right);
  const names = ['Least vulnerable quarter', 'Second quarter', 'Third quarter', 'Most vulnerable quarter'];
  return (
    <figure className="equity">
      <figcaption>Mean dark hours for each county in an event, by vulnerability (CDC SVI quarter). The thin line is the interval.</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={equity.map((q) => `${names[q.quartile - 1]}: ${q.meanDarkHours.toFixed(1)} hours`).join('. ')}>
        {equity.map((q, i) => {
          const y = 12 + i * rowH;
          return (
            <g key={q.quartile}>
              <text x={left - 10} y={y + 13} textAnchor="end" className="eq-label">{names[q.quartile - 1]}</text>
              <rect x={left} y={y} width={Math.max(1, x(q.meanDarkHours) - left)} height={18} className={q.quartile === 4 ? 'eq-bar deep' : 'eq-bar'} />
              <line x1={x(q.lo)} x2={x(q.hi)} y1={y + 9} y2={y + 9} className="eq-ci" />
              <line x1={x(q.lo)} x2={x(q.lo)} y1={y + 5} y2={y + 13} className="eq-ci" />
              <line x1={x(q.hi)} x2={x(q.hi)} y1={y + 5} y2={y + 13} className="eq-ci" />
              <text x={x(q.hi) + 6} y={y + 13} className="eq-value">{q.meanDarkHours.toFixed(1)} h</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function Summary({ lib, metrics }: { lib: EventLibrary; metrics: Metrics | null }) {
  const train = lib.events.filter((e) => e.split === 'train').length;
  const test = lib.events.length - train;
  const areas = new Set(lib.events.map((e) => e.ba)).size;
  const counts = (
    <p>
      The library has <strong>{fmtInt(lib.events.length)} events</strong> in {areas} balancing areas, {lib.years[0]} to {lib.years[1]}:{' '}
      {fmtInt(train)} before {lib.trainEnd.slice(0, 4)} (used to train) and {fmtInt(test)} from {lib.trainEnd.slice(0, 4)} on (used only to test).
    </p>
  );
  if (!metrics || lib.stub) {
    return (
      <section className="summary">
        <h2>Results</h2>
        <p className="notice warn">
          <strong>Model results pending.</strong>{' '}
          {lib.stub ? 'The warning model has not been run on this library yet, so no row has an alert time.' : 'The results file is not available yet.'}{' '}
          Recall, lead time and false alarms will show here, next to two simple rules for comparison.
        </p>
        {counts}
      </section>
    );
  }
  const names = [...MODEL_ORDER.filter((k) => metrics.models[k]), ...Object.keys(metrics.models).filter((k) => !MODEL_ORDER.includes(k))];
  return (
    <section className="summary">
      <h2>Results on the test years, {metrics.testYears[0]} to {metrics.testYears[1]}</h2>
      {counts}
      <div className="summary-grid">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th className="num">Warned 12 h or more before</th>
              <th className="num">Median lead</th>
              <th className="num">False alarms per area per year</th>
            </tr>
          </thead>
          <tbody>
            {names.map((k) => {
              const m = metrics.models[k];
              return (
                <tr key={k} className={k.startsWith('warn') ? 'model' : 'rule'}>
                  <td>{MODEL_LABEL[k] ?? k}</td>
                  <td className="num"><strong>{fmtShare(m.recall12h)}</strong> <span className="dim">({m.warned12h} of {m.testEvents})</span></td>
                  <td className="num">{m.medianLeadHours == null ? 'no alert' : `${Math.round(m.medianLeadHours)} h`}</td>
                  <td className="num">{m.falseAlarmsPerBaYear.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {metrics.equity && metrics.equity.length > 0 && <EquityChart equity={metrics.equity} />}
      </div>
      {metrics.dark && (
        <p className="dim">
          Dark-hours model, {fmtInt(metrics.dark.testCountyEvents)} county events in the test years: mean error {metrics.dark.maeHours.toFixed(1)} h
          (a simple baseline: {metrics.dark.baselineMaeHours.toFixed(1)} h); rank correlation {metrics.dark.spearman.toFixed(2)}.
        </p>
      )}
      <p className="faint small">Trained on {metrics.trainYears[0]} to {metrics.trainYears[1]}. Results made {metrics.generated}.</p>
    </section>
  );
}

export default function Page() {
  const libState = useJson<EventLibrary>(dataUrl('events.json'));
  const metricsState = useJson<Metrics>(`${import.meta.env.BASE_URL}models/metrics.json`);
  const lib = libState.data;
  const stub = lib?.stub ?? true;

  const [ba, setBa] = useState('');
  const [year, setYear] = useState('');
  const [split, setSplit] = useState('');
  const [warned, setWarned] = useState('');
  const [heroes, setHeroes] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'start', dir: -1 });

  const rows = useMemo<Row[]>(
    () =>
      (lib?.events ?? []).map((e) => {
        const startMs = parseUtc(e.start);
        return { ...e, startMs, lengthH: Math.round((parseUtc(e.stop) - startMs) / 3_600_000) + 1, year: new Date(startMs).getUTCFullYear() };
      }),
    [lib],
  );
  const baOptions = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of rows) n.set(r.ba, (n.get(r.ba) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);
  const yearOptions = useMemo(() => [...new Set(rows.map((r) => r.year))].sort(), [rows]);

  const shown = useMemo(() => {
    const out = rows.filter(
      (r) =>
        (!ba || r.ba === ba) &&
        (!year || r.year === Number(year)) &&
        (!split || r.split === split) &&
        (!warned || stub || (warned === 'yes') === (r.leadHours != null)) &&
        (!heroes || r.hero != null),
    );
    const { key, dir } = sort;
    out.sort((a, b) => {
      const va = key === 'start' ? a.startMs : a[key];
      const vb = key === 'start' ? b.startMs : b[key];
      if (va == null && vb == null) return b.startMs - a.startMs;
      if (va == null) return 1; // rows with no lead time go last in both directions
      if (vb == null) return -1;
      const c = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return c !== 0 ? c * dir : b.startMs - a.startMs;
    });
    return out;
  }, [rows, ba, year, split, warned, heroes, sort, stub]);

  const head = (key: SortKey, label: string, numeric = false) => {
    const on = sort.key === key;
    return (
      <th className={numeric ? 'num' : ''} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => setSort({ key, dir: on ? (sort.dir === 1 ? -1 : 1) : key === 'ba' ? 1 : -1 })}>
          {label}
          <span className="arrow" aria-hidden="true">{on ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
        </button>
      </th>
    );
  };
  const filtered = ba || year || split || warned || heroes;

  return (
    <>
      <PageNav current="evidence" />
      <main className="pg evidence">
        <header>
          <h1>Every outage event, and what the warning said</h1>
          <p className="lede">
            Each row is one real outage event from public records. The table shows the misses and the hits. You can download all of it.
          </p>
        </header>

        {libState.loading && <p className="dim">Loading the event library.</p>}
        {libState.error && <p className="notice warn"><strong>The event library did not load.</strong> {libState.error}</p>}

        {lib && (
          <>
            <Summary lib={lib} metrics={metricsState.data} />

            <section>
              <div className="bar">
                <h2>Events</h2>
                <div className="downloads">
                  <a className="btn" href={dataUrl('evidence.csv')} download="evidence.csv">Download evidence.csv</a>
                  <a className="btn" href={dataUrl('events.json')} download="events.json">Download events.json</a>
                </div>
              </div>
              <div className="filters">
                <label>Balancing area
                  <select value={ba} onChange={(e) => setBa(e.target.value)}>
                    <option value="">All ({baOptions.length})</option>
                    {baOptions.map(([code, n]) => <option key={code} value={code}>{code} ({n})</option>)}
                  </select>
                </label>
                <label>Year
                  <select value={year} onChange={(e) => setYear(e.target.value)}>
                    <option value="">All</option>
                    {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                <label>Set
                  <select value={split} onChange={(e) => setSplit(e.target.value)}>
                    <option value="">Train and test</option>
                    <option value="train">Train</option>
                    <option value="test">Test</option>
                  </select>
                </label>
                <label>Warning
                  <select value={warned} onChange={(e) => setWarned(e.target.value)} disabled={stub} title={stub ? 'Available when the model results are in' : undefined}>
                    <option value="">{stub ? 'Pending' : 'Warned or not'}</option>
                    <option value="yes">Warned</option>
                    <option value="no">Not warned</option>
                  </select>
                </label>
                <label className="check-label">
                  <input type="checkbox" checked={heroes} onChange={(e) => setHeroes(e.target.checked)} /> Named events only
                </label>
                <p className="count dim" aria-live="polite">
                  {shown.length === rows.length ? `${fmtInt(rows.length)} events` : `${fmtInt(shown.length)} of ${fmtInt(rows.length)} events`}
                  {filtered && (
                    <button type="button" className="clear" onClick={() => { setBa(''); setYear(''); setSplit(''); setWarned(''); setHeroes(false); }}>
                      Clear filters
                    </button>
                  )}
                </p>
              </div>

              <div className="events-wrap">
                <table className="events">
                  <thead>
                    <tr>
                      <th className="strip-cell">
                        <div className="axis" aria-hidden="true">
                          <span style={{ left: 0 }}>-72 h</span>
                          <span style={{ left: pct(BEFORE_H) }}>start</span>
                          <span style={{ right: 0 }}>+7 days</span>
                        </div>
                      </th>
                      {head('ba', 'Area')}
                      {head('start', 'Start (UTC)')}
                      {head('peakCustomersOut', 'Peak customers out', true)}
                      {head('peakFrac', 'Peak share', true)}
                      {head('lengthH', 'Length', true)}
                      <th>Set</th>
                      {head('leadHours', 'Warned before')}
                      <th><span className="sr">Map replay</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((e) => <EventLine key={e.id} e={e} stub={stub} />)}
                  </tbody>
                </table>
                {shown.length === 0 && <p className="dim empty">No event matches these filters.</p>}
              </div>
            </section>

            <section className="prose">
              <div>
                <h2>How to read this</h2>
                <p>
                  <strong>An event</strong> is a period of {lib.rule.min_hours} hours or more in which at least {fmtShare(lib.rule.threshold_share_of_ba_customers)} of the
                  customers in one balancing area had no power. Two periods less than {lib.rule.merge_gap_hours} hours apart count as one event. We fixed this rule before we trained a model.
                </p>
                <p>
                  <strong>The strip</strong> uses one scale for all rows. It starts 72 hours before the event. The red bar is the event, from its first hour to its last.
                  A bar with a cut end is longer than 7 days. The yellow mark is the first alert from the warning model{stub ? ' (it shows when the results are in)' : ''}.
                </p>
                <p>
                  <strong>Warned before</strong> is the time from the first alert to the first hour of the event. "Not warned" means the model gave no alert in those 72 hours.
                </p>
                <p>
                  <strong>Train and test.</strong> The model learns only from hours before {lib.trainEnd}. Events from that date on are test events: the model did not see them,
                  and the alert threshold was chosen without them. Only the test rows show what the model can do on a new event.
                </p>
              </div>
              <div>
                <h2>Limits</h2>
                <p>Most events are storms: hurricanes, ice, wind. A storm breaks local lines. Grid data shows little before that, so a model that reads only grid data will miss many of these events.</p>
                <p>Outage counts are from ORNL EAGLE-I, which collects utility outage maps. Some utilities are missing in some years, so a peak can be too low.</p>
                <p>Each county belongs to one balancing area in this data: the one that serves most of its customers. Some counties have two or more.</p>
                <p>A test result shows what the model said on past data that it did not see. It does not prove what the model will say next time.</p>
                <p>This is a research prototype. It is not an official warning.</p>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
