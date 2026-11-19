// Evidence: #/evidence. Every event in the library as one row, the model results, and the downloads.
import { Fragment, memo, useEffect, useMemo, useState } from 'react';
import { dataUrl, type County, type EventLibrary, type EventRow, type Metrics } from '../contracts.ts';
import { MODEL_LABEL, type DarkResult, type MetricsV2, type ModelResult, type Period } from './metrics.ts';
import { EventDetail, GoodAt, MoreNumbers } from './parts.tsx';
import { MatchedSentence, Tradeoff } from './Tradeoff.tsx';
import { PageNav, fmtDay, fmtHours, fmtInt, fmtShare, parseUtc, useJson } from '../brief/shared.tsx';
import './evidence.css';

// Timeline strip: one scale for every row. 72 h before the start, then up to 7 days of the event.
const BEFORE_H = 72;
const AFTER_H = 168;
const SPAN_H = BEFORE_H + AFTER_H;
const pct = (h: number) => `${(h / SPAN_H) * 100}%`;

const NO_FORECAST = ['warn_grid', 'warn_full'];
const WITH_FORECAST = 'warn_fcst';

// Plain names for the inputs of warn_grid.
const FEATURE_LABEL: Record<string, string> = {
  month: 'month of the year',
  hod: 'hour of the day',
  import_share: 'share of demand met by power from other areas',
  fc_err: 'demand against its forecast, this hour',
  fc_err_max_24h: 'largest gap between demand and its forecast in the last 24 hours',
  gas_share: 'gas share of generation',
  gas_chg_6h: 'change in gas generation in 6 hours',
  netgen_chg_6h: 'change in net generation in 6 hours',
  demand_vs_30d_peak: 'demand against its 30-day peak',
  demand_vs_record: "demand against the area's highest demand on record",
  demand_vs_month_record: "demand against this month's record",
  fc12_vs_record: "the next 12 hours' demand forecast against the area's record",
  fc12_vs_365d_peak: "the next 12 hours' demand forecast against the 365-day peak",
  fc12_vs_30d_peak: "the next 12 hours' demand forecast against the 30-day peak",
  fc12_vs_month_record: "tomorrow's demand forecast against this month's record",
  fc12_vs_month_record_max_72h: "highest value in 72 hours of tomorrow's forecast against this month's record",
};

type SetName = 'train' | 'dev' | 'test';
const SET_LABEL: Record<SetName, string> = { train: 'train', dev: 'dev', test: 'final test' };

interface Row extends EventRow {
  startMs: number;
  lengthH: number; // first hour to last hour of the event
  year: number;
  set: SetName;
}

type SortKey = 'start' | 'ba' | 'peakCustomersOut' | 'peakFrac' | 'lengthH' | 'leadHours' | 'leadHoursNoForecast';

const lead = (h: number | null | undefined) => (h == null ? 'not warned' : `${Math.round(h)} h`);

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

const EventLine = memo(function EventLine({ e, stub, open, onToggle }: { e: Row; stub: boolean; open: boolean; onToggle: (id: string) => void }) {
  return (
    <tr id={`ev-${e.id}`} className={open ? 'open' : undefined}>
      <td className="strip-cell"><div className="sw">
        <button type="button" className="expand" aria-expanded={open} aria-label={`Details for ${e.id}`} onClick={() => onToggle(e.id)}>
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
        <Strip e={e} stub={stub} />
      </div></td>
      <td>{e.ba}</td>
      <td>
        {fmtDay(e.startMs)}
        {e.title && <span className="title">{e.title}</span>}
      </td>
      <td className="num">{fmtInt(e.peakCustomersOut)}</td>
      <td className="num">{fmtShare(e.peakFrac)}</td>
      <td className="num">{fmtHours(e.lengthH)}</td>
      <td><span className={`tag ${e.set}`}>{SET_LABEL[e.set]}</span></td>
      <td className={!stub && e.leadHours == null ? 'missed' : ''}>{stub ? <span className="faint">pending</span> : lead(e.leadHours)}</td>
      <td className="dim num">
        {stub || e.leadHoursNoForecast === undefined ? '' : e.leadHoursNoForecast == null ? <span aria-label="not warned">–</span> : `${Math.round(e.leadHoursNoForecast)} h`}
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
  const q1 = equity.find((q) => q.quartile === 1);
  const q4 = equity.find((q) => q.quartile === 4);
  return (
    <figure className="equity">
      <figcaption>Mean dark hours for each county in an event, by vulnerability (CDC SVI quarter). The thin line is the 95% interval. All events; this is data, not a model.</figcaption>
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
      {q1 && q4 && (
        <p className="eq-note">
          Across events, the most vulnerable quarter of counties is dark longer ({q4.meanDarkHours.toFixed(1)} h against {q1.meanDarkHours.toFixed(1)} h per event).
          Inside the same event the difference is close to zero, and its interval includes zero. So the gap comes from where long outages happen, not from slower repair
          of vulnerable counties in the same storm.
        </p>
      )}
    </figure>
  );
}

/** The rules that `m` beats: more events warned 12 h ahead and the same or fewer false alarms. */
function beats(m: ModelResult, rules: [string, ModelResult][]) {
  return rules.filter(([, r]) => m.warned12h > r.warned12h && m.falseAlarmsPerBaYear <= r.falseAlarmsPerBaYear).map(([k]) => k);
}

function Verdict({ models }: { models: Record<string, ModelResult> }) {
  const rules = Object.entries(models).filter(([k]) => k.startsWith('rule_'));
  return (
    <ul className="verdict">
      {NO_FORECAST.filter((k) => models[k]).map((k) => {
        const won = beats(models[k], rules);
        const m = models[k];
        const lost = rules.filter(([r]) => !won.includes(r));
        return (
          <li key={k}>
            <strong>{MODEL_LABEL[k]}</strong> beats {won.length} of {rules.length} rules (more events warned, and the same or fewer false alarms).{' '}
            {lost.map(([r, x]) => (
              <span key={r}>
                It does <strong>not</strong> beat "{MODEL_LABEL[r] ?? r}":{' '}
                {m.warned12h > x.warned12h
                  ? `it warns more events (${m.warned12h} against ${x.warned12h}) but gives more false alarms (${m.falseAlarmsPerBaYear.toFixed(2)} against ${x.falseAlarmsPerBaYear.toFixed(2)} per area per year).`
                  : `it warns ${m.warned12h === x.warned12h ? 'the same number of' : 'fewer'} events (${m.warned12h} against ${x.warned12h}).`}{' '}
              </span>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

function ResultRow({ k, m, people }: { k: string; m: ModelResult; people: boolean }) {
  return (
    <tr className={k.startsWith('warn') ? 'model' : 'rule'}>
      <td>{MODEL_LABEL[k] ?? k}</td>
      <td className="num"><strong>{fmtInt(m.warned12h)} of {fmtInt(m.testEvents)}</strong> <span className="dim">({(m.recall12h * 100).toFixed(1)}%)</span></td>
      <td className="num">{m.medianLeadHours == null ? 'no alert' : `${Math.round(m.medianLeadHours)} h`}</td>
      <td className="num">{m.falseAlarmsPerBaYear.toFixed(1)}</td>
      {people && <td className="num">{m.peopleRecall12h == null ? '' : fmtShare(m.peopleRecall12h)}</td>}
    </tr>
  );
}

function ResultsTable({ p, warnNote }: { p: Period; warnNote: string | undefined }) {
  const models = p.models;
  const order = [
    ...NO_FORECAST.filter((k) => models[k]),
    ...Object.keys(models).filter((k) => k.startsWith('rule_')),
    ...Object.keys(models).filter((k) => !NO_FORECAST.includes(k) && k !== WITH_FORECAST && !k.startsWith('rule_')),
  ];
  const people = Object.values(models).some((m) => m.peopleRecall12h != null);
  const cols = people ? 5 : 4;
  return (
    <table className="results">
      <thead>
        <tr>
          <th>Method</th>
          <th className="num">Warned 12 h or more before</th>
          <th className="num">Median lead</th>
          <th className="num">False alarms per area per year</th>
          {people && <th className="num">Share of people out, warned 12 h before</th>}
        </tr>
      </thead>
      <tbody>
        {order.map((k) => <ResultRow key={k} k={k} m={models[k]} people={people} />)}
      </tbody>
      {models[WITH_FORECAST] && (
        <tbody className="fcst">
          <tr className="group"><td colSpan={cols}>With a weather forecast: an upper bound, not a fair comparison</td></tr>
          <ResultRow k={WITH_FORECAST} m={models[WITH_FORECAST]} people={people} />
          {warnNote && <tr className="caveat"><td colSpan={cols}>{warnNote}</td></tr>}
        </tbody>
      )}
    </table>
  );
}

function DarkResult({ dark }: { dark: DarkResult | null }) {
  if (!dark) return null;
  return (
    <div className="dark-result">
      <h3>Who stays dark longest</h3>
      {dark.top10Overlap != null ? (
        <p>
          In each event, of the 10 counties that stayed dark longest, the model named <strong>{fmtShare(dark.top10Overlap)}</strong> in its own top 10.
          {dark.top10History != null && <> Past outage history alone named {fmtShare(dark.top10History)}</>}
          {dark.top10Chance != null && <>; chance gives {fmtShare(dark.top10Chance)}</>}.
        </p>
      ) : null}
      <p>
        {fmtInt(dark.testCountyEvents)} county events. Rank correlation between predicted and real dark hours: <strong>{dark.spearman.toFixed(2)}</strong> (0 is no
        relation, 1 is the same order). Mean error {dark.maeHours.toFixed(1)} h; each county's past mean gives {dark.baselineMaeHours.toFixed(1)} h.
      </p>
      <p className="dim small">Most counties have no dark hour in an event, so the mean error is small for any method. The ranking is what the county brief uses.</p>
    </div>
  );
}

function TopFeatures({ list }: { list: { feature: string; gain: number }[] | undefined }) {
  if (!list || list.length === 0) return null;
  return (
    <div className="features">
      <h3>What the grid-only model reads most</h3>
      <ol>
        {list.slice(0, 5).map((f) => (
          <li key={f.feature}>
            <span>{FEATURE_LABEL[f.feature] ?? f.feature}</span>
            <span className="num dim">{(f.gain * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ol>
      <p className="dim small">Share of the model's total gain. It shows what the model uses, not what causes an outage.</p>
    </div>
  );
}

function Summary({ lib, metrics, rows }: { lib: EventLibrary; metrics: MetricsV2 | null; rows: Row[] }) {
  const [period, setPeriod] = useState<'test' | 'dev'>('test');
  const n = { train: 0, dev: 0, test: 0 };
  for (const r of rows) n[r.set]++;
  const areas = new Set(lib.events.map((e) => e.ba)).size;
  const counts = (
    <p className="dim">
      The library has {fmtInt(lib.events.length)} events in {areas} balancing areas, {lib.years[0]} to {lib.years[1]}: {fmtInt(n.train)} train, {fmtInt(n.dev)} dev,{' '}
      {fmtInt(n.test)} final test.
    </p>
  );
  if (!metrics || lib.stub) {
    return (
      <section className="summary">
        <h2>Results</h2>
        <p className="notice warn">
          <strong>Model results pending.</strong>{' '}
          {lib.stub ? 'The warning model has not been run on this library yet, so no row has an alert time.' : 'The results file is not available yet.'}
        </p>
        {counts}
      </section>
    );
  }
  const p: Period = period === 'dev' && metrics.dev ? metrics.dev : metrics;
  const testN = metrics.models.warn_grid?.testEvents ?? Object.values(metrics.models)[0]?.testEvents;
  const devN = metrics.dev ? (metrics.dev.models.warn_grid?.testEvents ?? Object.values(metrics.dev.models)[0]?.testEvents) : null;
  const [tr, dv, ts] = [metrics.trainYears, metrics.dev?.testYears ?? [2021, 2022], metrics.testYears];
  return (
    <section className="summary">
      <div className="bar">
        <h2>{period === 'dev' ? `Results on the dev years, ${p.testYears[0]} to ${p.testYears[1]}` : `Final test results, ${p.testYears[0]} to ${p.testYears[1]}`}</h2>
        {metrics.dev && (
          <div className="toggle" role="group" aria-label="Period">
            <button type="button" aria-pressed={period === 'test'} onClick={() => setPeriod('test')}>Final test</button>
            <button type="button" aria-pressed={period === 'dev'} onClick={() => setPeriod('dev')}>Dev</button>
          </div>
        )}
      </div>
      <p className="protocol">
        We trained on {tr[0]} to {tr[1]}, chose the design on {dv[0]} to {dv[1]}, and tested once on {ts[0]} to {ts[1]}: {fmtInt(testN)} events.
        {period === 'dev' && ` Below: the ${fmtInt(devN)} dev events. We looked at the dev years many times while we chose the design, so these numbers are better than a fair test.`}
      </p>
      <Verdict models={p.models} />
      <ResultsTable p={p} warnNote={lib.warnNote} />
      <div className="summary-grid">
        <div>
          <DarkResult dark={p.dark} />
          <TopFeatures list={metrics.importance?.warn_grid} />
        </div>
        {metrics.equity && metrics.equity.length > 0 && <EquityChart equity={metrics.equity} />}
      </div>
      <MoreNumbers metrics={metrics} warnNote={lib.warnNote} />
      {counts}
      <p className="faint small">Results made {metrics.generated}. Full tables: models/RESULTS.md.</p>
    </section>
  );
}

export default function Page() {
  const libState = useJson<EventLibrary>(dataUrl('events.json'));
  const metricsState = useJson<MetricsV2>(`${import.meta.env.BASE_URL}models/metrics.json`);
  const lib = libState.data;
  const metrics = metricsState.data;
  const stub = lib?.stub ?? true;

  const [ba, setBa] = useState('');
  const [year, setYear] = useState('');
  const [split, setSplit] = useState('');
  const [warned, setWarned] = useState('');
  const [heroes, setHeroes] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'start', dir: -1 });
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('open'));
  const [everOpened, setEverOpened] = useState(openId != null);
  const countiesState = useJson<County[]>(everOpened ? dataUrl('counties.json') : null);
  const countyMap = useMemo(() => (countiesState.data ? new Map(countiesState.data.map((c) => [c.fips, c])) : null), [countiesState.data]);
  const libLoaded = lib != null;
  useEffect(() => {
    // A link to #/evidence?open=<id> opens that row and scrolls to it once the table is there.
    const id = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('open');
    if (libLoaded && id) requestAnimationFrame(() => document.getElementById(`ev-${id}`)?.scrollIntoView({ block: 'center' }));
  }, [libLoaded]);
  const toggle = useMemo(() => (id: string) => { setEverOpened(true); setOpenId((cur) => (cur === id ? null : id)); }, []);

  const devStart = parseUtc(`${metrics?.split?.dev[0] ?? '2021-01-01'} 00:00:00`);
  const testStart = parseUtc(`${metrics?.split?.test[0] ?? '2023-01-01'} 00:00:00`);
  const rows = useMemo<Row[]>(
    () =>
      (lib?.events ?? []).map((e) => {
        const startMs = parseUtc(e.start);
        const set: SetName = startMs < devStart ? 'train' : startMs < testStart ? 'dev' : 'test';
        return { ...e, startMs, set, lengthH: Math.round((parseUtc(e.stop) - startMs) / 3_600_000) + 1, year: new Date(startMs).getUTCFullYear() };
      }),
    [lib, devStart, testStart],
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
        (!split || r.set === split) &&
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

  const head = (key: SortKey, label: string, numeric = false, title?: string) => {
    const on = sort.key === key;
    return (
      <th className={numeric ? 'num' : ''} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} title={title}>
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
            {metrics && !lib.stub && (
              <>
                <GoodAt metrics={metrics} lib={lib} />
                <section className="equal-rate" aria-labelledby="equal-h">
                  <h2 id="equal-h">Comparison at equal false-alarm rates</h2>
                  <MatchedSentence metrics={metrics} />
                  <Tradeoff metrics={metrics} />
                </section>
              </>
            )}
            <Summary lib={lib} metrics={metrics} rows={rows} />

            <section>
              <div className="bar">
                <h2>Events</h2>
                <div className="downloads">
                  <a className="btn" href={dataUrl('evidence.csv')} download="evidence.csv">Download evidence.csv</a>
                  <a className="btn" href={dataUrl('events.json')} download="events.json">Download events.json</a>
                </div>
              </div>
              {!stub && lib.warnNote && (
                <p className="notice warn">
                  <strong>About the lead times.</strong> "Warned before" and the yellow mark: {lib.warnNote}{' '}
                  "No forecast" is the lead time of the model that reads only grid data, weather now and outages already reported; – means not warned.
                </p>
              )}
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
                    <option value="">All sets</option>
                    <option value="train">Train (before 2021)</option>
                    <option value="dev">Dev (2021 to 2022)</option>
                    <option value="test">Final test (2023 on)</option>
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
                      {head('peakCustomersOut', 'Peak out', true, 'Peak customers without power')}
                      {head('peakFrac', 'Peak share', true)}
                      {head('lengthH', 'Length', true)}
                      <th>Set</th>
                      {head('leadHours', 'Warned before', false, 'Model with a weather forecast (upper bound)')}
                      {head('leadHoursNoForecast', 'No forecast', true, 'Model with grid data, weather now and outages reported; no weather forecast')}
                      <th><span className="sr">Map replay</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((e) => (
                      <Fragment key={e.id}>
                        <EventLine e={e} stub={stub} open={openId === e.id} onToggle={toggle} />
                        {openId === e.id && (
                          <tr className="detail-row"><td colSpan={10}><EventDetail e={e} warnNote={lib.warnNote} counties={countyMap} /></td></tr>
                        )}
                      </Fragment>
                    ))}
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
                  A bar with a cut end is longer than 7 days. The yellow mark is the first alert from the model with a weather forecast.
                </p>
                <p>
                  <strong>Warned before</strong> is the time from the first alert to the first hour of the event. "Not warned" means the model gave no alert in those 72 hours.
                </p>
                <p>
                  <strong>Train, dev and final test.</strong> The models learn only from events before 2021. We used 2021 to 2022 (dev) to choose the design, so dev results
                  are too good. We scored 2023 to 2024 (final test) once, with the models and alert thresholds frozen. Only the final test shows what a model can do on new events.
                </p>
              </div>
              <div>
                <h2>Limits</h2>
                <p>Most events are storms: hurricanes, ice, wind. A storm breaks local lines. Grid data shows little before that, so a model that reads only grid data misses most of these events.</p>
                <p>The model with a weather forecast was tested with the weather that really happened, as if the forecast had been perfect. Its lead times are an upper bound.</p>
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
