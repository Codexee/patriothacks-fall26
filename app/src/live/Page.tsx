// Live: #/live?ba=ERCO. Fetches the last days of EIA grid data through /api/eia and runs the
// warn_grid model in the browser. With no live data it shows a saved sample and says so.
import { useEffect, useMemo, useState } from 'react';
import { dataUrl, earthName, hollowName, type County, type ModelFile } from '../contracts.ts';
import { useRoute } from '../shell/router.ts';
import { featuresAt, missingFeatureNames, type HourRow } from '../model/features.ts';
import { PageNav, fmtDay, fmtInt, fmtShare, fmtTime, useJson } from '../brief/shared.tsx';
import { LineChart, Legend, type Series } from './Chart.tsx';
import { fetchLive, loadSample, loadWarnModel, scoreSeries, toHourRows, type RiskPoint } from './data.ts';
import './live.css';

const DEFAULT_BA = 'ERCO';
const HOUR = 3_600_000;

interface View {
  ba: string;                 // the area the data is for (the sample's area when live data failed)
  mode: 'live' | 'sample';
  reason: string | null;      // why live data is not shown
  fetchedAt: string;
  rows: HourRow[];
  model: ModelFile | null;
  risk: RiskPoint[] | null;
}

async function load(ba: string): Promise<View> {
  const model = await loadWarnModel();
  let payload;
  let reason: string | null = null;
  try {
    payload = await fetchLive(ba);
  } catch (err) {
    reason = err instanceof Error ? err.message : 'Live data is not available.';
    payload = await loadSample();
  }
  const rows = toHourRows(payload);
  return {
    ba: payload.ba,
    mode: reason ? 'sample' : 'live',
    reason,
    fetchedAt: payload.fetchedAt,
    rows,
    model,
    risk: model ? scoreSeries(model, rows, 168) : null,
  };
}

const signed = (x: number | null) => (x == null ? 'not known' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%`);

function RiskNow({ view }: { view: View }) {
  const { model, risk, ba } = view;
  if (!model || !risk || risk.length === 0) {
    return (
      <div className="now">
        <p className="now-label dim">Risk in {ba}</p>
        <p className="now-none">Not available yet</p>
        <p className="dim">The warning model file is not on this server yet. When it is, this page shows the chance that an outage event starts in the next 48 hours, against the alert threshold. The grid data that the model reads is below.</p>
      </div>
    );
  }
  const last = risk[risk.length - 1];
  const thr = model.threshold;
  const over = thr != null && last.p >= thr;
  const scale = Math.max(last.p, thr ?? 0) * 1.6 || 1;
  const hoursOver = thr == null ? 0 : risk.filter((r) => r.p >= thr).length;
  return (
    <div className={over ? 'now over' : 'now'}>
      <p className="now-label dim">Chance that an outage event starts in {ba} in the next 48 hours</p>
      <p className="now-value">{fmtShare(last.p)}</p>
      {thr != null && (
        <>
          <div className="gauge" role="img" aria-label={`Risk ${fmtShare(last.p)}. Alert threshold ${fmtShare(thr)}.`}>
            <i className="fill" style={{ width: `${Math.min(100, (last.p / scale) * 100)}%` }} />
            <i className="mark" style={{ left: `${(thr / scale) * 100}%` }} />
            <span className="mark-label" style={{ left: `${(thr / scale) * 100}%` }}>alert at {fmtShare(thr)}</span>
          </div>
          <p className="now-state">
            {over ? 'At or above the alert threshold.' : 'Below the alert threshold.'}{' '}
            <span className="dim">
              {hoursOver === 0 ? 'No hour in the last 7 days reached it.' : `${hoursOver} of the last ${risk.length} hours reached it.`}
            </span>
          </p>
        </>
      )}
    </div>
  );
}

export default function Page() {
  const { query } = useRoute();
  const wanted = (query.get('ba') ?? DEFAULT_BA).toUpperCase();
  const counties = useJson<County[]>(dataUrl('counties.json'));
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    let live = true;
    setView(null);
    load(wanted).then((v) => live && setView(v));
    return () => {
      live = false;
    };
  }, [wanted]);

  const areas = useMemo(() => {
    const n = new Map<string, number>();
    for (const c of counties.data ?? []) if (c.ba) n.set(c.ba, (n.get(c.ba) ?? 0) + 1);
    if (!n.has(wanted)) n.set(wanted, 0);
    return [...n.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [counties.data, wanted]);

  const topCounties = useMemo(
    () => (counties.data && view ? counties.data.filter((c) => c.ba === view.ba && c.dme != null).sort((a, b) => b.dme! - a.dme!).slice(0, 3) : []),
    [counties.data, view],
  );

  const week = view ? view.rows.slice(-168) : [];
  const last = view && view.rows.length ? view.rows[view.rows.length - 1] : null;
  const f = view && last ? featuresAt(view.rows, view.rows.length - 1) : null;
  const demandSeries: Series[] = [
    { label: 'Demand', color: 'var(--lit)', points: week.map((r) => ({ t: r.t, v: r.demand })) },
    { label: 'Day-ahead forecast', color: 'var(--text-dim)', dashed: true, points: week.map((r) => ({ t: r.t, v: r.forecast })) },
  ];
  const missing = view?.model ? missingFeatureNames(view.model.features) : [];

  return (
    <>
      <PageNav current="live" />
      <main className="pg live">
        <header className="live-head">
          <div>
            <h1>Grid risk now</h1>
            <p className="lede">The warning model reads the last days of public grid data for one balancing area and gives the chance that an outage event starts in the next 48 hours.</p>
          </div>
          <label className="area">Balancing area
            <select value={wanted} onChange={(e) => { window.location.hash = `#/live?ba=${e.target.value}`; }}>
              {areas.map(([code, n]) => <option key={code} value={code}>{code}{n ? ` (${n} counties)` : ''}</option>)}
            </select>
          </label>
        </header>

        {!view && <p className="dim">Loading grid data for {wanted}.</p>}

        {view && (
          <>
            {view.mode === 'live' ? (
              <p className="status"><span className="dot live-dot" />Live data from EIA for {view.ba}. Fetched {fmtTime(Date.parse(view.fetchedAt))}; latest hour ends {last ? fmtTime(last.t + HOUR) : 'not known'}.</p>
            ) : (
              <p className="notice warn">
                <strong>Live data for {wanted} is not available. This is a saved sample.</strong> {view.reason}{' '}
                The numbers below are real EIA data for {view.ba}, {week.length ? `${fmtDay(week[0].t)} to ${fmtDay(week[week.length - 1].t)}` : ''}. They do not show the grid now.
              </p>
            )}

            <section className="now-wrap">
              <RiskNow view={view} />
              {f && last && (
                <dl className="inputs">
                  <div><dt>Demand, latest hour</dt><dd>{fmtInt(last.demand)} MW</dd></div>
                  <div><dt>Demand against the forecast</dt><dd>{signed(f.fc_err)}</dd></div>
                  <div><dt>Demand against its 30-day peak</dt><dd>{f.demand_vs_30d_peak == null ? 'not known' : fmtShare(f.demand_vs_30d_peak)}</dd></div>
                  <div><dt>Net generation, change in 6 hours</dt><dd>{signed(f.netgen_chg_6h)}</dd></div>
                  <div><dt>Gas share of generation</dt><dd>{f.gas_share == null ? 'not known' : fmtShare(f.gas_share)}</dd></div>
                </dl>
              )}
            </section>

            {view.risk && view.model && (
              <section>
                <h2>Risk in the last 7 days{view.mode === 'sample' ? ' of the sample' : ''}</h2>
                <LineChart
                  series={[{ label: 'Risk', color: 'var(--alert)', points: view.risk.map((r) => ({ t: r.t, v: r.p })) }]}
                  threshold={view.model.threshold}
                  thresholdLabel={view.model.threshold != null ? `alert threshold ${fmtShare(view.model.threshold)}` : undefined}
                  yMin={0}
                  format={(v) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`}
                  ariaLabel={`Model risk for ${view.ba}, one value per hour for 7 days.`}
                />
                <p className="dim small">
                  Model {view.model.name}, version {view.model.version}. It runs in this browser.
                  {missing.length > 0 && ` ${missing.length} of its ${view.model.features.length} inputs are not in live data (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? ', ...' : ''}); the model reads them as missing.`}
                </p>
              </section>
            )}

            <section>
              <h2>Demand and its forecast, last 7 days{view.mode === 'sample' ? ' of the sample' : ''}</h2>
              <Legend series={demandSeries} />
              <LineChart series={demandSeries} format={(v) => `${fmtInt(v / 1000)} GW`} ariaLabel={`Hourly demand and day-ahead demand forecast for ${view.ba}, 7 days.`} />
              <p className="dim small">Source: EIA Form 930, hourly, by balancing area. Times are UTC.</p>
            </section>

            {topCounties.length > 0 && (
              <section>
                <h2>Counties in {view.ba} to check first</h2>
                <p className="dim">The three counties with the most people on electricity-dependent medical equipment (HHS emPOWER, Medicare users).</p>
                <ul className="top-counties">
                  {topCounties.map((c) => (
                    <li key={c.fips}>
                      <a href={`#/brief/${c.fips}`}>
                        <span className="names"><span>{earthName(c)}</span><span className="hollow">{hollowName(c)}</span></span>
                      </a>
                      <span className="n">{fmtInt(c.dme)} people</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="notice foot">This is a research prototype. It is not an official warning. For emergency decisions, use your utility and your emergency management agency.</p>
          </>
        )}
      </main>
    </>
  );
}
