// County brief: #/brief/<fips>. One page a county emergency office can print.
import { useEffect, useMemo, useState } from 'react';
import { dataUrl, earthName, hollowName, type County, type EventLibrary } from '../contracts.ts';
import type { MetricsV2 } from '../evidence/metrics.ts';
import { Compare, PastOutages, WhatYouGet } from './details.tsx';
import { countyInEvents, useAreaReplays } from './record.ts';
import { useRoute } from '../shell/router.ts';
import { getLiveRisk, type LiveRisk } from '../live/data.ts';
import { PageNav, fmtInt, fmtShare, fmtTime, ordinal, useJson } from './shared.tsx';
import './brief.css';


export function Names({ county }: { county: County }) {
  return (
    <span className="names">
      <span>{earthName(county)}</span>
      <span className="hollow">{hollowName(county)}</span>
    </span>
  );
}

function CountySearch({ counties, autoFocus }: { counties: County[]; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    if (/^\d+$/.test(s)) return counties.filter((c) => c.fips.startsWith(s)).slice(0, 8);
    const words = s.replace(/,/g, ' ').replace(/\bcounty\b/g, ' ').split(/\s+/).filter(Boolean);
    const scored: [number, County][] = [];
    for (const c of counties) {
      const name = c.name.toLowerCase();
      const st = c.state.toLowerCase();
      const ok = words.every((w) => name.includes(w) || st === w);
      if (ok) scored.push([(name.startsWith(words[0]) ? 0 : 1) * 1e9 - (c.pop ?? 0), c]);
    }
    return scored.sort((a, b) => a[0] - b[0]).slice(0, 8).map((x) => x[1]);
  }, [q, counties]);

  const go = (c: County) => {
    setQ('');
    window.location.hash = `#/brief/${c.fips}`;
  };
  return (
    <form
      className="csearch no-print"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (hits[0]) go(hits[0]);
      }}
    >
      <label htmlFor="county-q">Find a county</label>
      <input
        id="county-q"
        type="search"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Name or FIPS code, for example Harris TX or 48201"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim().length >= 2 && (
        <ul className="csearch-hits">
          {hits.length === 0 && <li className="dim">No county matches "{q.trim()}".</li>}
          {hits.map((c) => (
            <li key={c.fips}>
              <a href={`#/brief/${c.fips}`} onClick={() => setQ('')}>
                <Names county={c} />
                <span className="faint">FIPS {c.fips}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function RiskNow({ ba }: { ba: string | null }) {
  const [risk, setRisk] = useState<LiveRisk | null>(null);
  useEffect(() => {
    let live = true;
    setRisk(null);
    if (!ba) return;
    getLiveRisk(ba).then((r) => live && setRisk(r));
    return () => {
      live = false;
    };
  }, [ba]);

  let body;
  if (!ba) body = <p className="risk-none">No live data. This county has no balancing area on record.</p>;
  else if (!risk) body = <p className="dim">Checking live grid data for {ba}.</p>;
  else if (risk.kind === 'none')
    body = (
      <>
        <p className="risk-none">No live data</p>
        <p className="dim small">{risk.reason} When live data is available, this box shows the chance that an outage event starts in {ba} in the next 48 hours.</p>
      </>
    );
  else {
    const over = risk.threshold != null && risk.p >= risk.threshold;
    body = (
      <>
        <p className={`risk-value ${over ? 'over' : ''}`}>{fmtShare(risk.p)}</p>
        <p className="small">
          Chance, from the warning model, that an outage event starts in {ba} in the next 48 hours.{' '}
          {risk.threshold != null && (over
            ? <strong>This is at or above the alert threshold ({fmtShare(risk.threshold)}).</strong>
            : <>This is below the alert threshold ({fmtShare(risk.threshold)}).</>)}
        </p>
        <p className="dim small">Grid data to {fmtTime(risk.t + 3_600_000)}.</p>
      </>
    );
  }
  return (
    <aside className="risk" aria-label="Risk now">
      <h2>Risk now{ba ? ` in ${ba}` : ''}</h2>
      {body}
      <p className="small no-print"><a href={ba ? `#/live?ba=${ba}` : '#/live'}>Open the live page</a></p>
    </aside>
  );
}

/** 50 cells, one per Hollow level. Shade = how many of the area's counties are on that level. */
function LevelStrip({ county, peers }: { county: County; peers: County[] }) {
  const counts = new Array<number>(51).fill(0);
  for (const p of peers) if (p.level != null) counts[p.level]++;
  const max = Math.max(1, ...counts);
  return (
    <div className="levels" role="img" aria-label={`${hollowName(county)} of 50. Level 50 is the most vulnerable.`}>
      <div className="levels-cells">
        {counts.slice(1).map((n, i) => (
          <span key={i} className={i + 1 === county.level ? 'here' : ''} style={{ ['--n' as string]: n / max }} />
        ))}
      </div>
      <div className="levels-ends dim small">
        <span>Level 1, least vulnerable</span>
        <span>Level 50, most vulnerable</span>
      </div>
    </div>
  );
}

function CheckFirst({ county, peers }: { county: County; peers: County[] }) {
  if (!county.ba || peers.length < 2) return <p className="dim">No comparison: this county has no neighbors on record in its balancing area.</p>;
  const byDme = [...peers].filter((p) => p.dme != null).sort((a, b) => b.dme! - a.dme!);
  const byLevel = [...peers].filter((p) => p.level != null).sort((a, b) => b.level! - a.level! || (b.svi ?? 0) - (a.svi ?? 0));
  const dmeRank = county.dme == null ? null : byDme.findIndex((p) => p.fips === county.fips) + 1;
  // Counties on a deeper level than this one, plus 1. Ties share a rank.
  const levelRank = county.level == null ? null : byLevel.filter((p) => p.level! > county.level!).length + 1;
  const early =
    (dmeRank != null && dmeRank <= Math.max(3, Math.ceil(byDme.length * 0.1))) ||
    (levelRank != null && levelRank <= Math.ceil(byLevel.length * 0.25));
  const top = byDme.slice(0, 5);
  const rows = top.some((p) => p.fips === county.fips) || county.dme == null ? top : [...top, county];
  return (
    <div className="check">
      <div>
        <p>
          {county.ba} serves {fmtInt(peers.length)} counties.{' '}
          {dmeRank != null
            ? <>{earthName(county)} is <strong>{ordinal(dmeRank)} of {fmtInt(byDme.length)}</strong> by people on electricity-dependent medical equipment ({fmtInt(county.dme)}). </>
            : <>The number of people on electricity-dependent medical equipment is not known for this county. </>}
          {levelRank != null
            ? <>By vulnerability it is <strong>{ordinal(levelRank)} of {fmtInt(byLevel.length)}</strong> ({hollowName(county)}; a higher level is more vulnerable).</>
            : <>Its vulnerability level is not known.</>}
        </p>
        <p className={early ? 'verdict early' : 'verdict'}>
          {early
            ? `In a ${county.ba} emergency, check this county early: it is near the top of its area on one or both lists.`
            : `In a ${county.ba} emergency, the counties in the table have more people on powered equipment. Check them before this county.`}
        </p>
      </div>
      <table>
        <thead>
          <tr>
            <th className="num">Rank</th>
            <th>County in {county.ba}</th>
            <th className="num">On powered equipment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.fips} className={p.fips === county.fips ? 'me' : ''}>
              <td className="num">{byDme.findIndex((x) => x.fips === p.fips) + 1}</td>
              <td>{p.fips === county.fips ? <Names county={p} /> : <a href={`#/brief/${p.fips}`}><Names county={p} /></a>}</td>
              <td className="num">{fmtInt(p.dme)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Footer({ lib, className }: { lib: EventLibrary | null; className: string }) {
  return (
    <footer className={className}>
      <p><strong>This is a research prototype. It is not an official warning.</strong> For emergency decisions, use your utility and your emergency management agency.</p>
      <p>
        Sources: outages, ORNL EAGLE-I county records{lib ? ` ${lib.years[0]} to ${lib.years[1]}` : ''}; grid data, EIA Form 930; medical equipment, HHS emPOWER (Medicare users only);
        vulnerability, CDC/ATSDR SVI 2022; population, US Census. Counts are county totals. No data about a person is used.
      </p>
      <p>Made {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}. {window.location.href}</p>
    </footer>
  );
}

function Brief({ county, counties, lib, metrics }: { county: County; counties: County[]; lib: EventLibrary | null; metrics: MetricsV2 | null }) {
  const peers = useMemo(() => (county.ba ? counties.filter((c) => c.ba === county.ba) : [county]), [counties, county]);
  const events = useMemo(
    () => (lib && county.ba ? lib.events.filter((e) => e.ba === county.ba).sort((a, b) => (a.start < b.start ? 1 : -1)) : []),
    [lib, county.ba],
  );
  const replays = useAreaReplays(events);
  const areaFips = useMemo(() => new Set(peers.map((c) => c.fips)), [peers]);
  const rec = useMemo(() => countyInEvents(county.fips, events, replays, areaFips), [county.fips, events, replays, areaFips]);
  useEffect(() => {
    const before = document.title;
    document.title = `County brief: ${earthName(county)}`;
    return () => {
      document.title = before;
    };
  }, [county]);
  const dmeShare = county.dme != null && county.medicare ? county.dme / county.medicare : null;
  return (
    <article className="brief">
      <header className="brief-head">
        <div>
          <p className="kind dim">County outage brief</p>
          <h1>{earthName(county)}</h1>
          <p className="hollow-line">{hollowName(county)} <span className="faint">in the Hollow</span></p>
          <p className="dim small">FIPS {county.fips}. Balancing area {county.ba ?? 'not known'}{county.ba && `, with ${fmtInt(peers.length - 1)} other counties`}.</p>
          {county.level != null && (
            <p className="small no-print"><a href={`#/hollow?level=${county.level}&fips=${county.fips}`}>See {hollowName(county)} in the cross-section view</a></p>
          )}
        </div>
        <RiskNow ba={county.ba} />
      </header>

      <dl className="facts">
        <div>
          <dt>People</dt>
          <dd>{fmtInt(county.pop)}</dd>
        </div>
        <div>
          <dt>Electric customers</dt>
          <dd>{fmtInt(county.customers)}</dd>
        </div>
        <div className="lit">
          <dt>People on electricity-dependent medical equipment</dt>
          <dd>{fmtInt(county.dme)}</dd>
          {dmeShare != null && <dd className="sub">{fmtShare(dmeShare)} of {fmtInt(county.medicare)} Medicare users. Others are not counted.</dd>}
        </div>
        <div>
          <dt>Vulnerability</dt>
          <dd>{county.svi == null ? 'not known' : `${ordinal(Math.round(county.svi * 100))} percentile`}</dd>
          <dd className="sub">CDC Social Vulnerability Index, 2022. {hollowName(county)} of 50.</dd>
        </div>
      </dl>
      {county.level != null && <LevelStrip county={county} peers={peers} />}

      {lib && <WhatYouGet county={county} events={events} lib={lib} metrics={metrics} />}

      <section>
        <h2>Who to check first</h2>
        <CheckFirst county={county} peers={peers} />
      </section>

      <Compare county={county} peers={peers} all={counties} events={events} replays={replays} />

      <Footer lib={lib} className="brief-foot" />

      <section className="past">
        <h2>Past outages in {county.ba ?? 'its area'}: {earthName(county)}</h2>
        {lib ? <PastOutages county={county} lib={lib} events={events} replays={replays} rec={rec} /> : <p className="dim">Loading the event library.</p>}
        <p className="print-only small">This is a research prototype. It is not an official warning.</p>
      </section>
    </article>
  );
}

export default function Page() {
  const { parts } = useRoute();
  const fips = parts[1] ?? null;
  const counties = useJson<County[]>(dataUrl('counties.json'));
  const lib = useJson<EventLibrary>(dataUrl('events.json'));
  const metrics = useJson<MetricsV2>(`${import.meta.env.BASE_URL}models/metrics.json`);
  const county = useMemo(() => counties.data?.find((c) => c.fips === fips) ?? null, [counties.data, fips]);
  const examples = useMemo(
    () => (counties.data ? [...counties.data].sort((a, b) => (b.dme ?? 0) - (a.dme ?? 0)).slice(0, 6) : []),
    [counties.data],
  );

  return (
    <>
      <PageNav current="brief" />
      <main className="pg brief-page">
        {counties.data && (
          <div className="brief-tools no-print">
            <CountySearch counties={counties.data} autoFocus={!fips} />
            {county && <button type="button" className="btn" onClick={() => window.print()}>Print this brief</button>}
          </div>
        )}
        {counties.loading && <p className="dim">Loading counties.</p>}
        {counties.error && <p className="notice warn"><strong>The county file did not load.</strong> {counties.error}</p>}
        {counties.data && !fips && (
          <div className="brief-empty">
            <h1>County outage brief</h1>
            <p className="lede">One page for a county emergency office: who depends on power, how the county compares with its neighbors, and what past outages did. Search for a county above, or start with one of these.</p>
            <ul>
              {examples.map((c) => (
                <li key={c.fips}><a href={`#/brief/${c.fips}`}><Names county={c} /></a></li>
              ))}
            </ul>
          </div>
        )}
        {counties.data && fips && !county && (
          <p className="notice warn"><strong>No county has the FIPS code {fips}.</strong> Search by name above.</p>
        )}
        {county && counties.data && <Brief county={county} counties={counties.data} lib={lib.data} metrics={metrics.data} />}
      </main>
    </>
  );
}
