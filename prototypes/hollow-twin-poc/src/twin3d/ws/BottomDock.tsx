// Bottom dock with tabs: event log, Blackout Warning's daily output, residents' observations, the sections table.
import { memo, useMemo, useState } from 'react';
import { SECTION_COUNT } from '../../sim/types.ts';
import { sections as realSections } from '../../data/real/index.ts';
import type { TwinData } from '../compute.ts';
import type { EventType } from '../detail.ts';
import type { Pick, SideKey } from '../Scene.tsx';
import { Tag, fmtNum } from './charts.tsx';
import { SIDES, SIDE_COLOR, SIDE_SHORT, det, pad2, pct } from './model.ts';

type TabId = 'events' | 'module' | 'obs' | 'sections';
const TABS: [TabId, string][] = [['events', 'Event log'], ['module', 'Module output'], ['obs', 'Observations'], ['sections', 'Sections']];

export const BottomDock = memo(function BottomDock({ data, day, onSelect }: { data: TwinData; day: number; onSelect: (p: Pick) => void }) {
  const [tab, setTab] = useState<TabId>('events');
  return (
    <div className="ws-bottom">
      <div className="ws-tabs" role="tablist" aria-label="Bottom panels">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`ws-tab-${id}`} aria-selected={tab === id} aria-controls={`ws-panel-${id}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="ws-tabpanel" role="tabpanel" id={`ws-panel-${tab}`} aria-labelledby={`ws-tab-${tab}`}>
        {tab === 'events' && <EventLog data={data} day={day} />}
        {tab === 'module' && <ModuleOutput data={data} day={day} />}
        {tab === 'obs' && <Observations data={data} day={day} />}
        {tab === 'sections' && <SectionsTable data={data} day={day} onSelect={onSelect} />}
      </div>
    </div>
  );
});

const TYPE_TEXT: Record<EventType, string> = { trip: 'Plant trip', alert: 'Alert sent', level: 'Level lost', end: 'Run end', other: 'Other' };

function EventLog({ data, day }: { data: TwinData; day: number }) {
  const [run, setRun] = useState<'both' | SideKey>('both');
  const [type, setType] = useState<'all' | EventType>('all');
  const all = useMemo(() => SIDES.flatMap((side) => det(data, side).events.map((e) => ({ ...e, side }))), [data]);
  const rows = all
    .filter((e) => e.day <= day && (run === 'both' || e.side === run) && (type === 'all' || e.type === type))
    .sort((a, b) => b.day - a.day || b.hour - a.hour || (a.side < b.side ? -1 : 1));
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of all) if (e.day <= day) c[`${e.side}:${e.type}`] = (c[`${e.side}:${e.type}`] ?? 0) + 1;
    return c;
  }, [all, day]);
  const LIMIT = 300;
  return (
    <>
      <div className="ws-filters">
        <label>Run <select value={run} onChange={(e) => setRun(e.target.value as typeof run)}><option value="both">Both</option><option value="without">Without</option><option value="with">With</option></select></label>
        <label>Type <select value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="all">All</option>{(Object.keys(TYPE_TEXT) as EventType[]).map((t) => <option key={t} value={t}>{TYPE_TEXT[t]}</option>)}</select></label>
        <span className="ws-dim">{fmtNum(rows.length)} events to day {day}{rows.length > LIMIT ? `, newest ${LIMIT} shown` : ''} · trips {counts['without:trip'] ?? 0} / {counts['with:trip'] ?? 0} · alerts {counts['with:alert'] ?? 0}</span>
        <Tag kind="sim" />
      </div>
      <table className="ws-table ws-log">
        <thead><tr><th scope="col">Day</th><th scope="col">Time</th><th scope="col">Run</th><th scope="col">Type</th><th scope="col">Event (engine and module text, unchanged)</th></tr></thead>
        <tbody>
          {rows.slice(0, LIMIT).map((e, i) => (
            <tr key={i}>
              <td className="num">{e.day}</td>
              <td className="num">{pad2(e.hour)}:00</td>
              <td style={{ color: SIDE_COLOR[e.side] }}>{SIDE_SHORT[e.side]}</td>
              <td className={`ev-${e.type}`}>{TYPE_TEXT[e.type]}</td>
              <td className="ws-evtext">{e.text}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="ws-dim">No events to day {day}.</td></tr>}
        </tbody>
      </table>
    </>
  );
}

function ModuleOutput({ data, day }: { data: TwinData; day: number }) {
  const x = det(data, 'with');
  let d = day;
  while (d > 0 && !x.log[d]) d--;
  const log = x.log[d];
  const alerts = x.alerts[d] ?? [];
  const seen = x.seen[d];
  if (!log) return <p className="ws-dim ws-pad">HollowGuard has not run yet. It runs at 00:00 on day 1.</p>;
  const ended = d < day;
  return (
    <div className="ws-module">
      <div className="ws-modcol">
        <p className="ws-sub">Daily log, day {d} <Tag kind="module" />{ended && <span className="ws-dim"> (run ended day {data.with.endDay ?? d}; last log shown)</span>}</p>
        <table className="ws-kv">
          <tbody>
            <tr><th scope="row">Blackout line at worst hour</th><td className="num">{log.lineWorst === null ? 'nobody dark' : `levels 1–${log.lineWorst} had power (${pad2(log.lineWorstHour)}:00)`}</td></tr>
            <tr><th scope="row">Trend of the line</th><td className="num">{log.trend > 0 ? '+' : ''}{log.trend.toFixed(1)} levels/day</td></tr>
            <tr><th scope="row">Supply worked out from the line</th><td className="num">{log.supplyEstimate === null ? '– (no line)' : `${fmtNum(log.supplyEstimate)} units`}</td></tr>
            <tr><th scope="row">Demand (residents’ count)</th><td className="num">{fmtNum(log.demand)} units</td></tr>
            <tr><th scope="row">Hollow-wide dark hours yesterday</th><td className="num">{log.hollowDarkHours}</td></tr>
            <tr><th scope="row">Save-power request</th><td className="num">{pct(log.shed, 1)}{log.eased ? ' (eased today)' : ''}</td></tr>
            <tr><th scope="row">Trip risk</th><td className={log.tripRisk ? 'bad' : 'ok'}>{log.tripRisk ? 'yes' : 'no'}</td></tr>
            <tr><th scope="row">Quiet days in a row</th><td className="num">{log.quietDays}</td></tr>
            <tr><th scope="row">Census / residents’ count</th><td className="num">{fmtNum(log.censusPeople)} / {fmtNum(log.selfPeople)}</td></tr>
            <tr><th scope="row">Deepest level: count ÷ census</th><td className="num">{log.deepRatio.toFixed(3)}</td></tr>
            <tr><th scope="row">Levels still dark at day end</th><td className="num">{log.darkNow.length ? log.darkNow.join(', ') : 'none'}</td></tr>
          </tbody>
        </table>
        {seen && <p className="ws-foot">Inputs read: {Object.entries(seen).map(([k, v]) => `${k} ${fmtNum(v)}`).join(' · ')}</p>}
      </div>
      <div className="ws-modcol">
        <p className="ws-sub">Predicted blackouts today ({log.blackouts.length})</p>
        <table className="ws-table">
          <thead><tr><th scope="col">Levels</th><th scope="col">Starts</th><th scope="col">In</th><th scope="col">Hours</th></tr></thead>
          <tbody>
            {log.blackouts.map((b, i) => <tr key={i}><td className="num">{b.from}–{b.to}</td><td className="num">{pad2(b.startClock)}:00</td><td className="num">{b.startsIn} h</td><td className="num">{b.hours}</td></tr>)}
            {!log.blackouts.length && <tr><td colSpan={4} className="ws-dim">None predicted.</td></tr>}
          </tbody>
        </table>
        <p className="ws-sub">Alerts sent, day {d} ({alerts.length})</p>
        <table className="ws-table">
          <thead><tr><th scope="col">Action</th><th scope="col">Levels</th><th scope="col">Hours</th><th scope="col">Amount</th><th scope="col">Text</th></tr></thead>
          <tbody>
            {alerts.map((a) => <tr key={a.id}><td>{a.action}</td><td className="num">{a.from}–{a.to}</td><td className="num">{a.hours}</td><td className="num">{a.amount === null ? '–' : pct(a.amount)}</td><td className="ws-evtext">{a.text}</td></tr>)}
            {!alerts.length && <tr><td colSpan={5} className="ws-dim">No alerts.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Observations({ data, day }: { data: TwinData; day: number }) {
  const rows = [];
  for (let d = day; d >= 1; d--) rows.push(d);
  return (
    <>
      <div className="ws-filters"><span className="ws-dim">What residents could see each day (the module reads only these). The Directorate’s meters are hidden from it.</span><Tag kind="sim" /></div>
      <table className="ws-table ws-obs">
        <thead>
          <tr><th scope="col" rowSpan={2}>Day</th>{SIDES.map((s) => <th key={s} scope="colgroup" colSpan={6} style={{ color: SIDE_COLOR[s] }}>{SIDE_SHORT[s]}</th>)}</tr>
          <tr>{SIDES.map((s) => ['Obs.', 'Dark rpt', 'Back rpt', 'Typed rpt', 'Head count', 'Census ÷ count'].map((h) => <th key={s + h} scope="col">{h}</th>))}</tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d}>
              <td className="num">{d}</td>
              {SIDES.map((s) => {
                const o = det(data, s).obs[d];
                if (!o) return <td key={s} colSpan={6} className="ws-dim">run ended</td>;
                const typed = Object.values(o.reports).reduce((a, b) => a + b, 0);
                return [
                  <td key={s + 'a'} className="num">{fmtNum(o.total)}</td>,
                  <td key={s + 'b'} className="num">{fmtNum(o.outageDark)}</td>,
                  <td key={s + 'c'} className="num">{fmtNum(o.outageBack)}</td>,
                  <td key={s + 'd'} className="num">{fmtNum(typed)}</td>,
                  <td key={s + 'e'} className="num">{fmtNum(o.selfPeople)}</td>,
                  <td key={s + 'f'} className="num">{o.selfPeople ? (o.censusPeople / o.selfPeople).toFixed(4) : '–'}</td>,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

type SortKey = 'i' | 'people' | 'delta' | 'ls' | 'power' | 'co2' | 'darkH' | 'svi' | 'growth';
const PAGE = 50;

function SectionsTable({ data, day, onSelect }: { data: TwinData; day: number; onSelect: (p: Pick) => void }) {
  const [side, setSide] = useState<SideKey>('without');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'darkH', desc: true });
  const [page, setPage] = useState(0);
  const x = det(data, side);
  const N = SECTION_COUNT;
  const rows = useMemo(() => {
    const r = Array.from({ length: N }, (_, i) => {
      const people = x.people[day * N + i], start = x.startPeople[i];
      const real = realSections?.rows[i];
      return {
        i, level: Math.floor(i / 8) + 1, col: i % 8, people, start, delta: start ? people / start - 1 : 0,
        ls: x.ls[day * N + i], power: x.power[day * N + i], co2: x.co2[day * N + i], darkH: x.darkH[day * N + i], warned: x.warned[day * N + i],
        svi: real?.svi ?? NaN, growth: real?.growthPerYear ?? NaN, county: real?.counties[0] ? `${real.counties[0].name}, ${real.counties[0].state}` : '–',
      };
    });
    const k = sort.key;
    r.sort((a, b) => (sort.desc ? -1 : 1) * ((a[k] as number) - (b[k] as number)));
    return r;
  }, [x, day, sort, N]);
  const pages = Math.ceil(rows.length / PAGE);
  const th = (key: SortKey, label: string, tip?: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'} title={tip}>
      <button type="button" onClick={() => { setSort((s) => ({ key, desc: s.key === key ? !s.desc : true })); setPage(0); }}>{label}{sort.key === key ? (sort.desc ? ' ▾' : ' ▴') : ''}</button>
    </th>
  );
  return (
    <>
      <div className="ws-filters">
        <span className="ws-seg" role="group" aria-label="Run for the sections table">
          {SIDES.map((s) => <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)} style={side === s ? { color: SIDE_COLOR[s] } : undefined}>{SIDE_SHORT[s]}</button>)}
        </span>
        <span className="ws-dim">400 sections, day {day}, worst-hour snapshot. Click a row to inspect it.</span>
        <Tag kind="sim" /><Tag kind="real" />
        <span className="ws-pager">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</button>
          <span>{page * PAGE + 1}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Next</button>
        </span>
      </div>
      <table className="ws-table ws-sections">
        <thead>
          <tr>
            {th('i', 'Section')}{th('people', 'Residents')}{th('delta', 'Δ start')}{th('ls', 'Life sup.', 'Life-support power share at the worst hour')}
            {th('power', 'Power')}{th('co2', 'CO₂ max')}{th('darkH', 'Dark h', 'Hours so far with life support under half')}
            <th scope="col">Alerts</th>{th('svi', 'SVI', 'Mean CDC SVI of its counties (real)')}{th('growth', 'Growth/yr', 'Census 2020–2024 (real)')}<th scope="col">Largest county (real)</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(page * PAGE, (page + 1) * PAGE).map((r) => (
            <tr key={r.i} className="ws-click" onClick={() => onSelect({ side, index: r.i })} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelect({ side, index: r.i }); }}>
              <td className="num">L{r.level}·C{r.col}</td>
              <td className="num">{fmtNum(r.people)}</td>
              <td className={`num ${r.delta < -0.001 ? 'bad' : ''}`}>{(r.delta * 100).toFixed(2)}%</td>
              <td className={`num ${r.ls < 0.5 ? 'bad' : ''}`}>{pct(r.ls)}</td>
              <td className="num">{pct(r.power)}</td>
              <td className={`num ${r.co2 >= 5000 ? 'bad' : ''}`}>{fmtNum(r.co2)}</td>
              <td className="num">{fmtNum(r.darkH)}</td>
              <td>{[r.warned & 1 ? 'warn' : '', r.warned & 2 ? 'save' : ''].filter(Boolean).join('+') || '–'}</td>
              <td className="num">{Number.isNaN(r.svi) ? '–' : r.svi.toFixed(3)}</td>
              <td className="num">{Number.isNaN(r.growth) ? '–' : `${(r.growth * 100).toFixed(2)}%`}</td>
              <td className="ws-evtext">{r.county}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
