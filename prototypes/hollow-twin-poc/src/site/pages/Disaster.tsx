// #/disaster/<id> — one disaster: the daily charts, every seed, the source and a link to watch it run.
import { useState } from 'react';
import type { SiteData } from '../data.ts';
import { href } from '../router.ts';
import { interval, num, pct, pctPoints } from '../format.ts';
import { DailyChart } from '../charts.tsx';
import { SourceLink, Stat, displayName, scaleNote, seedRange } from '../parts.tsx';

export function Disaster({ data, id }: { data: SiteData; id: string }) {
  const f = data.scenarios.data;
  const i = f.scenarios.findIndex((s) => s.id === id);
  const [log, setLog] = useState(false);
  if (i < 0) {
    return (
      <section className="block">
        <h1 tabIndex={-1}>No disaster with the id “{id}”</h1>
        <p>The results file has these disasters: {f.scenarios.map((s) => s.id).join(', ')}.</p>
        <p><a className="text-link" href={href.results}>Back to the results</a></p>
      </section>
    );
  }
  const s = f.scenarios[i];
  const prev = f.scenarios[(i - 1 + f.scenarios.length) % f.scenarios.length];
  const next = f.scenarios[(i + 1) % f.scenarios.length];
  const n = f.seeds.length;
  const stableWith = s.perSeed.filter((p) => p.withStable).length;

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><a href={href.results}>Results</a> <span aria-hidden="true">/</span> <span aria-current="page">{displayName(s)}</span></nav>
      <header className="page-head">
        <h1 tabIndex={-1}>{displayName(s)}</h1>
        <p className="subtitle">{s.name}</p>
        <p className="lede">{s.summary}</p>
        <p className="real-data"><span>Real data:</span> {s.realData}</p>
        <SourceLink source={s.source} />
        <a className="button" href={href.demo(s.id)}>Watch it run</a>
      </header>

      <section aria-labelledby="h-num" className="block">
        <h2 id="h-num">Results on held-out seeds {seedRange(f.seeds)}</h2>
        <dl className="stat-grid">
          <Stat label="Deaths per run, without" value={s.without.deaths} tone="without" />
          <Stat label="Deaths per run, with" value={s.with.deaths} tone="with" />
          <Stat label="Deaths avoided per run" value={s.livesSaved} tone="saved" count={false} />
          <Stat label="Plant trips per run, without" value={s.without.trips} />
          <Stat label="Plant trips per run, with" value={s.with.trips} />
          <Stat label="Million person-hours without air and fans, with" value={s.with.darkMh} digits={s.with.darkMh.mean < 10 ? 1 : 0}>
            <span className="stat-ci">without: {interval(s.without.darkMh, s.without.darkMh.mean < 10 ? 1 : 0)}</span>
          </Stat>
          <Stat label="Day the run ended, with" value={s.with.endDay}>
            <span className="stat-ci">without: day {num(s.without.endDay.mean)} (the cap is 120)</span>
          </Stat>
          <div className="stat">
            <dt>Stable Hollow at the end</dt>
            <dd><span className="stat-num">{stableWith} of {s.perSeed.length}</span><span className="stat-ci">runs with it; {pct(s.without.stableShare)} without it</span></dd>
          </div>
          <div className="stat">
            <dt>Blackout hours that were warned</dt>
            <dd><span className="stat-num">{pctPoints(s.with.warnedPct)}</span><span className="stat-ci">{s.with.warnedPct == null ? 'no blackouts with it' : 'with it, all seeds pooled'}</span></dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="h-chart" className="block">
        <div className="chart-head">
          <h2 id="h-chart">Cumulative deaths, mean of {n} seeds</h2>
          <div className="toggle" role="group" aria-label="Vertical scale">
            <button type="button" aria-pressed={!log} onClick={() => setLog(false)}>Linear</button>
            <button type="button" aria-pressed={log} onClick={() => setLog(true)}>Log</button>
          </div>
        </div>
        {!log && s.with.deaths.mean < s.without.deaths.mean / 100 && (
          <p className="chart-note">On the linear scale the “with” line stays near 0. Select Log to see its shape.</p>
        )}
        <DailyChart daily={s.daily} keys={['withoutDeaths', 'withDeaths']} unit="deaths" log={log} title={`Cumulative deaths per day, ${displayName(s)}`} />
        <Legend />
      </section>

      <section aria-labelledby="h-dark" className="block">
        <h2 id="h-dark">Sections without air and fans, at each day’s worst hour</h2>
        <p className="lede">The test world has 400 sections (50 levels × 8). Mean of {n} seeds.</p>
        <DailyChart daily={s.daily} keys={['withoutDarkSections', 'withDarkSections']} unit="dark sections" title={`Dark sections per day, ${displayName(s)}`} />
        <Legend />
      </section>

      <section aria-labelledby="h-seeds" className="block">
        <h2 id="h-seeds">Every seed</h2>
        <div className="table-wrap">
          <table className="seed-table">
            <caption>Deaths per run for each held-out seed. A seed fixes the random events, so both sides see the same disaster.</caption>
            <thead><tr><th scope="col">Seed</th><th scope="col">Deaths without</th><th scope="col">Deaths with</th><th scope="col">Deaths avoided</th><th scope="col">Stable with</th></tr></thead>
            <tbody>
              {s.perSeed.map((p) => (
                <tr key={p.seed}>
                  <th scope="row">{p.seed}</th>
                  <td className="without">{num(p.withoutDeaths)}</td>
                  <td className="with">{num(p.withDeaths)}</td>
                  <td>{num(p.withoutDeaths - p.withDeaths)}</td>
                  <td>{p.withStable ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hero-note small">{scaleNote(f)}</p>
      </section>

      <nav className="pager" aria-label="Other disasters">
        <a href={href.disaster(prev.id)}><span>Previous</span>{displayName(prev)}</a>
        <a href={href.disaster(next.id)}><span>Next</span>{displayName(next)}</a>
      </nav>
    </>
  );
}

function Legend() {
  return (
    <p className="legend-line">
      <span className="key without"><i aria-hidden="true" />Without Blackout Warning</span>
      <span className="key with"><i aria-hidden="true" />With Blackout Warning</span>
    </p>
  );
}
