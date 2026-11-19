// County brief parts that use the county's outage record and the model results.
import type { ReactNode } from 'react';
import { earthName, type County, type EventLibrary, type EventRow } from '../contracts.ts';
import type { MetricsV2 } from '../evidence/metrics.ts';
import { fmtDay, fmtHours, fmtInt, fmtShare, ordinal, parseUtc } from './shared.tsx';
import { areaMeanDark, dmePer1000, median, type AreaReplays, type CountyInEvent } from './record.ts';

const PRINT_ROWS = 22; // past outages on the printed second page

const pctOut = (p: number | null) => (p == null ? 'under 2%' : `${p < 10 ? p.toFixed(1) : Math.round(p)}%`);

// ---------------------------------------------------------------- what you get

export function WhatYouGet({ county, events, lib, metrics }: { county: County; events: EventRow[]; lib: EventLibrary; metrics: MetricsV2 | null }) {
  const warned = lib.stub ? undefined : events.find((e) => e.leadHours != null); // events are newest first
  const dark = metrics?.dark;
  return (
    <section className="youget" aria-labelledby="youget-h">
      <h2 id="youget-h">What you get that you did not have</h2>
      <ol>
        <li>
          <strong>An earlier alert.</strong>{' '}
          {warned ? (
            <>
              In {county.ba}'s most recent warned event ({fmtDay(parseUtc(warned.start))}), the first alert came {Math.round(warned.leadHours!)} h before the start *.{' '}
              {warned.leadHoursNoForecast == null ? 'Without a weather forecast, the model gave no alert.' : `Without a weather forecast: ${Math.round(warned.leadHoursNoForecast)} h.`}
            </>
          ) : county.ba ? (
            <>No past event in {county.ba} had an alert in the 72 h before it.</>
          ) : (
            <>Not available: this county has no balancing area on record.</>
          )}
        </li>
        <li>
          <strong>A ranked check-first list.</strong>{' '}
          {dark?.top10Overlap != null ? (
            <>On the final test, the model's top 10 held {fmtShare(dark.top10Overlap)} of the counties that stayed dark longest
              {dark.top10History != null && <> (past history alone: {fmtShare(dark.top10History)})</>}
              {dark.top10Chance != null && <>; chance: {fmtShare(dark.top10Chance)}</>}.</>
          ) : dark ? (
            <>On the final test, the rank correlation between predicted and real dark hours was {dark.spearman.toFixed(2)} over {fmtInt(dark.testCountyEvents)} county events.</>
          ) : (
            <>Model results pending.</>
          )}
        </li>
        <li>
          <strong>The people at most risk, counted.</strong>{' '}
          {county.dme != null
            ? <>{fmtInt(county.dme)} people in {earthName(county)} use electricity-dependent medical equipment (HHS emPOWER, Medicare users only).</>
            : <>The HHS emPOWER count is not known for this county.</>}
        </li>
      </ol>
      {warned && lib.warnNote && <p className="dim small">* {lib.warnNote}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- compare strip

export function Compare({ county, peers, all, events, replays }: { county: County; peers: County[]; all: County[]; events: EventRow[]; replays: AreaReplays }) {
  const means = areaMeanDark(events, replays, peers);
  const loaded = events.filter((e) => Array.isArray(replays[e.id])).length;
  const fmt1 = (x: number | null) => (x == null ? 'not known' : x.toFixed(1));
  const pctl = (x: number | null) => (x == null ? 'not known' : `${ordinal(Math.round(x * 100))} percentile`);
  const rows: [string, string, string, string][] = [
    ['People on powered medical equipment, per 1,000 residents', fmt1(dmePer1000(county)), fmt1(median(peers.map(dmePer1000).filter((x): x is number => x != null))), fmt1(median(all.map(dmePer1000).filter((x): x is number => x != null)))],
    ['Vulnerability (CDC SVI)', pctl(county.svi), pctl(median(peers.map((c) => c.svi).filter((x): x is number => x != null))), pctl(median(all.map((c) => c.svi).filter((x): x is number => x != null)))],
    [
      `Mean dark hours per event${loaded ? ` (${loaded} ${county.ba} ${loaded === 1 ? 'event' : 'events'} with a county record)` : ''}`,
      means ? fmt1(means.get(county.fips) ?? 0) : 'no county record',
      means ? fmt1(median([...means.values()])) : 'no county record',
      'not computed',
    ],
  ];
  return (
    <section className="compare">
      <h2>Compared with other counties</h2>
      <table>
        <thead>
          <tr>
            <th>Measure</th>
            <th className="num">{earthName(county)}</th>
            <th className="num">Median county in {county.ba ?? 'its area'}</th>
            <th className="num">Median US county</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, c]) => (
            <tr key={label}><td>{label}</td><td className="num"><strong>{a}</strong></td><td className="num">{b}</td><td className="num dim">{c}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="dim small">The national median of dark hours needs every county record, which this page does not load.</p>
    </section>
  );
}

// ---------------------------------------------------------------- past outages

export function RecordLine({ rec, county }: { rec: CountyInEvent[]; county: County }) {
  if (!rec.length) return null;
  const total = rec.reduce((s, r) => s + r.dark, 0);
  const worst = rec.reduce((w, r) => (r.dark > w.dark ? r : w), rec[0]);
  const withPred = rec.filter((r) => r.pred != null);
  const sp = withPred.reduce((s, r) => s + r.pred!, 0);
  const sa = withPred.reduce((s, r) => s + r.dark, 0);
  const mae = withPred.length ? withPred.reduce((s, r) => s + Math.abs(r.pred! - r.dark), 0) / withPred.length : null;
  return (
    <div className="record">
      <p>
        <strong>Totals.</strong> In the {rec.length} {county.ba} events with a county record, {earthName(county)} had <strong>{fmtInt(total)} dark hours</strong> in total.
        {worst.dark > 0 && <> Worst: {fmtDay(parseUtc(worst.event.start))}, {worst.dark} h dark{worst.peak != null && <>, peak {pctOut(worst.peak)} out</>}.</>}
      </p>
      <p>
        <strong>Predicted against actual.</strong>{' '}
        {withPred.length ? (
          <>In {withPred.length} {withPred.length === 1 ? 'event' : 'events'} with a prediction, the model predicted {sp.toFixed(1)} dark hours in total; the county had {fmtInt(sa)}.
            Mean difference: {mae!.toFixed(1)} h per event.</>
        ) : (
          <>The dark model has no prediction for this county in these events (it covers events from 2021 on and counties that reached 2% out).</>
        )}
      </p>
    </div>
  );
}

export function PastOutages({ county, lib, events, replays, rec }: { county: County; lib: EventLibrary; events: EventRow[]; replays: AreaReplays; rec: CountyInEvent[] }) {
  if (!county.ba) return <p className="dim">This county has no balancing area on record, so the event library has no outages for it.</p>;
  if (events.length === 0)
    return <p className="dim">The event library has no outage in {county.ba} from {lib.years[0]} to {lib.years[1]} that reached 1% of the area's customers for 4 hours.</p>;
  const byId = new Map(rec.map((r) => [r.event.id, r]));
  const ranked = [...events].sort((a, b) => Number(b.hasReplay) - Number(a.hasReplay) || b.peakCustomersOut - a.peakCustomersOut);
  const printIds = new Set(ranked.slice(0, PRINT_ROWS).map((e) => e.id));
  const cell = (e: EventRow, pick: (r: CountyInEvent) => ReactNode) => {
    if (!e.hasReplay) return <span className="faint">no record</span>;
    const st = replays[e.id];
    if (st === undefined) return <span className="faint">loading</span>;
    if (st === 'error') return <span className="faint">not available</span>;
    const r = byId.get(e.id);
    return r ? pick(r) : '';
  };
  const hidden = events.length - Math.min(events.length, PRINT_ROWS);
  return (
    <>
      <RecordLine rec={rec} county={county} />
      <table className="outages">
        <thead>
          <tr>
            <th>Start (UTC)</th>
            <th>Event</th>
            <th className="num">Length</th>
            <th className="num">Peak customers out, {county.ba}</th>
            <th className="num">Dark hours here</th>
            <th className="num">Predicted dark hours</th>
            <th className="num">Peak out here</th>
            <th className="num">Rank in {county.ba} by dark hours</th>
            <th>{lib.stub ? 'Warning' : 'Warned before *'}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className={printIds.has(e.id) ? '' : 'print-hide'}>
              <td>{fmtDay(parseUtc(e.start))}</td>
              <td>{e.hasReplay ? <a href={`#/event/${e.id}`}>{e.title ?? 'Replay on the map'}</a> : e.title ?? <span className="faint">{e.id}</span>}</td>
              <td className="num">{fmtHours(e.hoursAbove)}</td>
              <td className="num">{fmtInt(e.peakCustomersOut)}</td>
              <td className="num">{cell(e, (r) => `${r.dark} h`)}</td>
              <td className="num">{cell(e, (r) => (r.pred == null ? <span className="faint">none</span> : `${r.pred.toFixed(1)} h`))}</td>
              <td className="num">{cell(e, (r) => pctOut(r.peak))}</td>
              <td className="num">{cell(e, (r) => (r.rank == null ? <span className="faint">not dark</span> : `${r.rank} of ${r.areaCounties}`))}</td>
              <td>{lib.stub ? <span className="faint">pending</span> : e.leadHours != null ? `${Math.round(e.leadHours)} h before` : 'not warned'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dim small table-note">
        {events.length} {events.length === 1 ? 'event' : 'events'} in {county.ba}, {lib.years[0]} to {lib.years[1]}. An event is 4 hours or more with at least 1% of the area's customers out.
        A dark hour is an hour with 10% or more of this county's customers out. County records exist for the largest events only, and they leave out a county that stayed under 2% out.
        "Predicted" is the dark model's estimate at the start of the event.
        {hidden > 0 && <span className="print-only"> This page shows {PRINT_ROWS} of them; the Evidence page lists all.</span>}
        {lib.stub && ' Warning results are pending: the model test has not run yet.'}
        {!lib.stub && <> <strong>* Warned before</strong> is the time from the first alert to the start of the event. {lib.warnNote ?? ''} Events before 2021 were used to train the model.</>}
      </p>
    </>
  );
}
