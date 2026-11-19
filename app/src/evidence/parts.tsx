// Evidence page parts: the "good at / not good at" cards, the "More numbers" tables, and the detail
// of one event row. Every number comes from metrics.json, events.json, a replay file or counties.json.
import { useEffect, useState } from 'react';
import { dataUrl, earthName, hollowName, type County, type EventLibrary, type EventReplay, type EventRow } from '../contracts.ts';
import { fetchJson, fmtHours, fmtInt, fmtShare, fmtTime, parseUtc } from '../brief/shared.tsx';
import { GROUP_LABEL, MODEL_LABEL, pct0, pct1, realForecastResult, type GroupResult, type MetricsV2, type ModelResult, type Period } from './metrics.ts';

const NO_FORECAST = ['warn_grid', 'warn_full'];

// ---------------------------------------------------------------- good at / not good at

export function GoodAt({ metrics, lib }: { metrics: MetricsV2; lib: EventLibrary }) {
  const rule = metrics.models.rule_record;
  const ruleGroup = metrics.groups?.demand_record?.models.rule_record;
  const fcstGroup = metrics.groups?.demand_record?.models.warn_fcst;
  const texas = lib.events.find((e) => e.hero === 'texas2021');
  const dark = metrics.dark;
  const full = metrics.models.warn_full;
  const grid = metrics.models.warn_grid;
  const fcst = metrics.models.warn_fcst;
  const real = realForecastResult(metrics);
  const [t0, t1] = metrics.testYears;

  return (
    <section className="goodat" aria-labelledby="goodat-h">
      <h2 id="goodat-h">What this is good at, and what it is not</h2>
      <p className="dim">Final test, {t0} to {t1}: events the models never saw, scored once.</p>
      <div className="cards">
        <article className="card good">
          <p className="verdict-tag">Good at</p>
          <h3>Demand-record events (the Texas kind)</h3>
          {ruleGroup ? (
            <p>
              The simple rule "tomorrow's forecast above this month's record" warned <strong>{ruleGroup.warned12h} of {ruleGroup.testEvents}</strong> demand-record
              events 12 h or more ahead{rule && <>, at {rule.falseAlarmsPerBaYear.toFixed(1)} false alarms per area per year (all events)</>}.
              {fcstGroup && <> The model with a weather forecast warned {fcstGroup.warned12h} of {fcstGroup.testEvents} (upper bound).</>}
            </p>
          ) : (
            <p>
              {rule && (
                <>The simple rule "tomorrow's forecast above this month's record" gives only <strong>{rule.falseAlarmsPerBaYear.toFixed(1)} false alarms per area per year</strong>.{' '}</>
              )}
              <span className="dim">Its result on demand-record events alone is not in the results file yet.</span>
            </p>
          )}
          {texas && texas.leadHours != null && (
            <p className="dim small">
              Texas, Feb 2021 (dev years): first alert {Math.round(texas.leadHours)} h before the start, from the model with a weather forecast (upper bound).
            </p>
          )}
        </article>

        <article className="card good">
          <p className="verdict-tag">Good at</p>
          <h3>Which counties to check first</h3>
          {dark?.top10Overlap != null ? (
            <p>
              Of the counties that stayed dark longest in an event, the model's top 10 held <strong>{pct0(dark.top10Overlap)}</strong>.
              {dark.top10History != null && <> Past outage history alone: {pct0(dark.top10History)}.</>}
              {dark.top10Chance != null && <> Chance: {pct0(dark.top10Chance)}.</>}
            </p>
          ) : dark ? (
            <p>
              Rank correlation between predicted and real dark hours: <strong>{dark.spearman.toFixed(2)}</strong> over {fmtInt(dark.testCountyEvents)} county events.
              Mean error {dark.maeHours.toFixed(1)} h, against {dark.baselineMaeHours.toFixed(1)} h for each county's past mean.{' '}
              <span className="dim">The top-10 overlap is not in the results file yet.</span>
            </p>
          ) : (
            <p className="dim">Results pending.</p>
          )}
        </article>

        <article className="card weak">
          <p className="verdict-tag">Weak</p>
          <h3>Storms, without a weather forecast</h3>
          <table className="mini">
            <tbody>
              {[['warn_grid', grid], ['warn_full', full]].map(([k, m]) =>
                m ? (
                  <tr key={k as string}>
                    <td>{MODEL_LABEL[k as string]}</td>
                    <td className="num"><strong>{pct0((m as ModelResult).recall12h)}</strong></td>
                  </tr>
                ) : null,
              )}
              {fcst && (
                <tr>
                  <td>{MODEL_LABEL.warn_fcst} (upper bound: tested with the weather that happened)</td>
                  <td className="num"><strong>{pct0(fcst.recall12h)}</strong></td>
                </tr>
              )}
              {real && (
                <tr>
                  <td>{real.label}{real.years && <> ({real.years[0] === real.years[1] ? real.years[0] : `${real.years[0]} to ${real.years[1]}`})</>}</td>
                  <td className="num"><strong>{pct0(real.r.recall12h)}</strong></td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="dim small">Share of events warned 12 h or more ahead. Most events are storms that break local lines; grid data shows little before that.{real?.note && ` ${real.note}`}</p>
        </article>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- more numbers

function OverallTable({ p, title }: { p: Period; title: string }) {
  const ms = Object.entries(p.models);
  const has = (k: keyof ModelResult) => ms.some(([, m]) => m[k] != null);
  const c = { w6: has('warned6h'), w24: has('warned24h'), people: has('peopleRecall12h'), ch: has('customerHoursRecall12h'), auc: has('aucPr') };
  return (
    <div className="more-table">
      <h4>{title}</h4>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th className="num">Events</th>
              {c.w6 && <th className="num">Warned 6 h ahead</th>}
              <th className="num">Warned 12 h ahead</th>
              {c.w24 && <th className="num">Warned 24 h ahead</th>}
              <th className="num">Share warned 12 h</th>
              {c.people && <th className="num">Share of people out, warned 12 h</th>}
              {c.ch && <th className="num">Share of customer-hours, warned 12 h</th>}
              <th className="num">Median lead</th>
              <th className="num">False alarms per area per year</th>
              {c.auc && <th className="num">PR-AUC</th>}
            </tr>
          </thead>
          <tbody>
            {ms.map(([k, m]) => (
              <tr key={k}>
                <td>{MODEL_LABEL[k] ?? k}{k === 'warn_fcst' && ' *'}</td>
                <td className="num">{fmtInt(m.testEvents)}</td>
                {c.w6 && <td className="num">{m.warned6h ?? ''}</td>}
                <td className="num">{m.warned12h}</td>
                {c.w24 && <td className="num">{m.warned24h ?? ''}</td>}
                <td className="num">{pct1(m.recall12h)}</td>
                {c.people && <td className="num">{pct1(m.peopleRecall12h)}</td>}
                {c.ch && <td className="num">{pct1(m.customerHoursRecall12h)}</td>}
                <td className="num">{m.medianLeadHours == null ? 'no alert' : `${Math.round(m.medianLeadHours)} h`}</td>
                <td className="num">{m.falseAlarmsPerBaYear.toFixed(2)}</td>
                {c.auc && <td className="num">{m.aucPr == null ? '' : m.aucPr.toFixed(3)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupTable({ name, g, period }: { name: string; g: GroupResult; period: string }) {
  const ms = Object.entries(g.models);
  const people = ms.some(([, m]) => m.peopleRecall12h != null);
  const fa = ms.some(([, m]) => m.falseAlarmsPerBaYear != null);
  return (
    <div className="more-table">
      <h4>{period}: {g.label ?? GROUP_LABEL[name] ?? name}</h4>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th className="num">Events</th>
              <th className="num">Warned 12 h ahead</th>
              <th className="num">Share</th>
              {people && <th className="num">Share of people out</th>}
              <th className="num">Median lead</th>
              {fa && <th className="num">False alarms per area per year</th>}
            </tr>
          </thead>
          <tbody>
            {ms.map(([k, m]) => (
              <tr key={k}>
                <td>{MODEL_LABEL[k] ?? k}{k === 'warn_fcst' && ' *'}</td>
                <td className="num">{fmtInt(m.testEvents)}</td>
                <td className="num">{m.warned12h}</td>
                <td className="num">{pct1(m.recall12h ?? m.warned12h / Math.max(1, m.testEvents))}</td>
                {people && <td className="num">{pct1(m.peopleRecall12h)}</td>}
                <td className="num">{m.medianLeadHours == null ? '–' : `${Math.round(m.medianLeadHours)} h`}</td>
                {fa && <td className="num">{m.falseAlarmsPerBaYear == null ? '' : m.falseAlarmsPerBaYear.toFixed(2)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MoreNumbers({ metrics, warnNote }: { metrics: MetricsV2; warnNote?: string }) {
  const periods: [string, Period][] = [[`Final test, ${metrics.testYears[0]} to ${metrics.testYears[1]}`, metrics]];
  if (metrics.dev) periods.push([`Dev, ${metrics.dev.testYears[0]} to ${metrics.dev.testYears[1]}`, metrics.dev]);
  const missing: string[] = [];
  if (!metrics.seasons) missing.push('results by season');
  if (!metrics.groups) missing.push('results by event group (demand-record or storm-like)');
  if (!Object.values(metrics.models).some((m) => m.peopleRecall12h != null)) missing.push('people-weighted recall');
  if (!Object.values(metrics.models).some((m) => m.warned6h != null)) missing.push('warned 6 h and 24 h ahead');
  return (
    <details className="more">
      <summary>More numbers: every method, final test and dev</summary>
      {periods.map(([title, p]) => (
        <div key={title}>
          <OverallTable p={p} title={title} />
          {Object.entries(p.seasons ?? {}).map(([k, g]) => <GroupTable key={k} name={k} g={g} period={title} />)}
          {Object.entries(p.groups ?? {}).map(([k, g]) => <GroupTable key={k} name={k} g={g} period={title} />)}
        </div>
      ))}
      <p className="dim small">* {warnNote ?? 'Upper bound: the backtest uses the observed weather as the forecast.'}</p>
      {missing.length > 0 && <p className="dim small">Not in the results file yet, so not shown: {missing.join('; ')}.</p>}
    </details>
  );
}

// ---------------------------------------------------------------- one event, expanded

function fmtInput(unit: string, v: number): string {
  switch (unit) {
    case 'ratio': return `${(v * 100).toFixed(0)}%`;
    case 'share': return `${(v * 100).toFixed(v < 0.1 ? 2 : 1)}%`;
    case 'sigma': return `${v > 0 ? '+' : ''}${v.toFixed(1)} SD`;
    case 'm/s': return `${v.toFixed(1)} m/s`;
    case 'mm': return `${v.toFixed(1)} mm`;
    default: return String(v);
  }
}

export function EventDetail({ e, warnNote, counties }: { e: EventRow; warnNote?: string; counties: Map<string, County> | null }) {
  const [replay, setReplay] = useState<EventReplay | 'error' | null>(null);
  useEffect(() => {
    if (!e.hasReplay) return;
    let live = true;
    fetchJson<EventReplay>(dataUrl(`events/${e.id}.json`)).then(
      (r) => live && setReplay(r),
      () => live && setReplay('error'),
    );
    return () => { live = false; };
  }, [e.id, e.hasReplay]);

  const r = replay && replay !== 'error' ? replay : null;
  const inBa = (fips: string) => !counties || counties.get(fips)?.ba === e.ba;
  const top = r ? [...r.counties].filter((c) => inBa(c.fips)).sort((a, b) => b.darkHours - a.darkHours).slice(0, 5).filter((c) => c.darkHours > 0) : [];
  const name = (fips: string) => {
    const c = counties?.get(fips);
    return c ? <span className="names"><span>{earthName(c)}</span><span className="hollow">{hollowName(c)}</span></span> : fips;
  };

  return (
    <div className="detail">
      <dl className="detail-facts">
        <div><dt>First alert (UTC)</dt><dd>{e.firstAlert ? fmtTime(parseUtc(e.firstAlert)) : 'no alert in the 72 h before'}</dd></div>
        <div><dt>Warned before, with a forecast *</dt><dd>{e.leadHours == null ? 'not warned' : `${Math.round(e.leadHours)} h`}</dd></div>
        <div><dt>Warned before, no forecast</dt><dd>{e.leadHoursNoForecast == null ? 'not warned' : `${Math.round(e.leadHoursNoForecast)} h`}</dd></div>
        <div><dt>Peak customers out</dt><dd>{fmtInt(e.peakCustomersOut)} ({fmtShare(e.peakFrac)})</dd></div>
        <div><dt>Hours above 1% out</dt><dd>{fmtHours(e.hoursAbove)}</dd></div>
      </dl>

      {e.hasReplay && !replay && <p className="dim small">Loading the county record.</p>}
      {replay === 'error' && <p className="dim small">The county record did not load.</p>}
      {r && (
        <div className="detail-grid">
          <div>
            <h4>Inputs at the first alert</h4>
            {r.alertInputs && r.alertInputs.length > 0 ? (
              <>
                <ul className="inputs-list">
                  {r.alertInputs.map((x) => (
                    <li key={x.feature}><span>{x.label}</span><span className="num">{fmtInput(x.unit, x.value)}</span></li>
                  ))}
                </ul>
                <p className="dim small">Values the model saw at that hour. They are not the reasons for the alert. SD: standard deviations from normal.</p>
              </>
            ) : (
              <p className="dim small">{r.firstAlertIndex == null ? 'No alert before this event, so there are no inputs to show.' : 'Not in this replay file.'}</p>
            )}
          </div>
          <div>
            <h4>Counties in {e.ba} dark longest</h4>
            {top.length ? (
              <table className="mini">
                <thead><tr><th>County</th><th className="num">Dark hours</th><th className="num">Predicted</th></tr></thead>
                <tbody>
                  {top.map((c) => (
                    <tr key={c.fips}>
                      <td>{name(c.fips)}</td>
                      <td className="num">{c.darkHours} h</td>
                      <td className="num">{c.predDarkHours == null ? <span className="faint">none</span> : `${c.predDarkHours.toFixed(1)} h`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="dim small">No county had 10% or more of its customers out.</p>
            )}
            <p className="dim small">A dark hour: 10% or more of the county's customers out. "Predicted" is the model's estimate at the start of the event.</p>
          </div>
        </div>
      )}
      <p className="detail-links">
        {e.hasReplay && <><a href={`#/event/${e.id}`}>Replay on the map</a><a href={`#/hollow/${e.id}`}>Cross-section view</a></>}
      </p>
      {warnNote && <p className="dim small">* {warnNote}</p>}
    </div>
  );
}
