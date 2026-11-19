// #/ — the results landing page.
import { useState } from 'react';
import type { Interval, ScenarioResult, ScenariosFile } from '../contracts.ts';
import type { SiteData } from '../data.ts';
import { href } from '../router.ts';
import { bounds, num, pct, rangeText, pctPoints } from '../format.ts';
import { scaleInterval, tCrit, tInterval } from '../stats.ts';
import { Sparkline } from '../charts.tsx';
import { Generated, Stat, displayName, scaleNote, seedRange } from '../parts.tsx';

/** Total deaths over every run (all disasters × all seeds), with a 95% interval from the per-seed totals. */
function totals(f: ScenariosFile, side: 'withoutDeaths' | 'withDeaths', stat: 'without' | 'with'): Interval {
  const seeds = f.seeds;
  const complete = f.scenarios.every((s) => seeds.every((seed) => s.perSeed.some((p) => p.seed === seed)));
  if (complete && seeds.length > 1) {
    const perSeed = seeds.map((seed) => f.scenarios.reduce((a, s) => a + (s.perSeed.find((p) => p.seed === seed)?.[side] ?? 0), 0));
    return scaleInterval(tInterval(perSeed), seeds.length);
  }
  // Fallback: add the means; combine the half-widths as independent errors.
  const n = Math.max(1, seeds.length);
  const mean = f.scenarios.reduce((a, s) => a + s[stat].deaths.mean, 0) * n;
  const half = Math.sqrt(f.scenarios.reduce((a, s) => a + ((s[stat].deaths.hi - s[stat].deaths.lo) / 2) ** 2, 0)) * n;
  return { mean, lo: mean - half, hi: mean + half };
}

export function Results({ data }: { data: SiteData }) {
  const f = data.scenarios.data;
  const cf = data.checkfirst.data;
  const nS = f.scenarios.length, nSeeds = f.seeds.length;
  const wo = totals(f, 'withoutDeaths', 'without');
  const wi = totals(f, 'withDeaths', 'with');
  const cut = wo.mean > 0 ? 1 - wi.mean / wo.mean : 0;
  const runs = nS * nSeeds;
  const stableWith = f.scenarios.reduce((a, s) => a + s.with.stableShare * nSeeds, 0);
  const stableWithout = f.scenarios.reduce((a, s) => a + s.without.stableShare * nSeeds, 0);
  const top = cf.test.rows[0];

  return (
    <>
      <header className="hero">
        <h1 tabIndex={-1} className="hero-line">
          Across {nS} disasters and {nSeeds} held-out seeds, Blackout Warning cut deaths from{' '}
          <span className="hero-num without">{num(wo.mean)}</span> to <span className="hero-num with">{num(wi.mean)}</span>.
        </h1>
        <dl className="hero-stats">
          <Stat label="Deaths without Blackout Warning" value={wo} tone="without" />
          <Stat label="Deaths with Blackout Warning" value={wi} tone="with" />
          <div className="stat">
            <dt>Share of deaths avoided</dt>
            <dd><span className="stat-num">{pct(cut, cut > 0.99 ? 2 : 1)}</span><span className="stat-ci">of the deaths without it</span></dd>
          </div>
        </dl>
        <p className="hero-note">
          Measured in the test world, not reported by the Directorate. Held-out seeds {seedRange(f.seeds)}, never used for tuning. Each total is the sum of {runs} runs ({nS} disasters × {nSeeds} seeds).
          The interval comes from the {nSeeds} per-seed totals (Student t, {nSeeds - 1} degrees of freedom, t = {tCrit(nSeeds - 1).toFixed(3)}).
          Stable Hollow at the end: {num(stableWith)} of {runs} runs with it, {num(stableWithout)} of {runs} without it.
        </p>
        <Strata f={f} />
        <p className="hero-note small">{scaleNote(f)}</p>
      </header>

      <section aria-labelledby="h-dis" className="block">
        <h2 id="h-dis">Disaster by disaster</h2>
        <p className="lede">Each disaster is shaped by real data. Each row is the mean of {nSeeds} runs per side; select a row for the daily chart and every seed.</p>
        <div className="dz-head" aria-hidden="true">
          <span>Disaster and its real data</span><span>Deaths per run, without</span><span>Deaths per run, with</span><span>Plant trips per run</span><span>Stable</span><span>Cumulative deaths</span>
        </div>
        <ol className="dz-list">
          {f.scenarios.map((s) => <DisasterRow key={s.id} s={s} />)}
        </ol>
      </section>

      <section aria-labelledby="h-models" className="block two-models">
        <h2 id="h-models">Two models</h2>
        <div className="cols">
          <div>
            <h3>Blackout Warning</h3>
            <p>
              It reads residents’ outage reports and head counts each day. It predicts which plants will overload, warns the
              sections at risk, and asks them to save power. Its {Object.keys(f.tune).length} constants were tuned on seeds 1–5,
              checked on seeds 6–10, then frozen:
            </p>
            <ul className="tune">
              {Object.entries(f.tune).map(([k, v]) => <li key={k}><code>{k}</code> = {v}</li>)}
            </ul>
            <p>The results above are its test.</p>
          </div>
          <div>
            <h3>{cf.name}</h3>
            <p>{cf.task}</p>
            {top && (
              <p>
                On the real outages of {cf.periods.test.replace(/\s*\(.*\)\s*$/, '')} ({num(cf.test.events)} events): {top.metric.split(' (')[0].toLowerCase()}{' '}
                <strong>{num(top.model, 3)}</strong>
                {top.history != null && <> against {num(top.history, 3)} for each area’s history</>}
                {top.chance != null && <> and {num(top.chance, 3)} for chance</>}.
              </p>
            )}
            <p><a className="text-link" href={href.model}>Read the model page</a></p>
          </div>
        </div>
      </section>

      <section aria-labelledby="h-test" className="block">
        <h2 id="h-test">How we test</h2>
        <ol className="steps">
          <li><h3>Train</h3><p>The check-first model learns from real US outages, {cf.periods.train}. Blackout Warning has no training step: its rules are written by hand.</p></li>
          <li><h3>Tune</h3><p>Blackout Warning’s constants are changed one at a time on seeds 1–5. The check-first model is chosen on {cf.periods.dev}.</p></li>
          <li><h3>Check</h3><p>A change is kept only if seeds 6–10 are no worse.</p></li>
          <li><h3>Test, once</h3><p>Seeds {seedRange(f.seeds)} and the real outages of {cf.periods.test.replace(/\s*\(.*\)\s*$/, '')} are run once, after every choice is frozen. Only test results are published here.</p></li>
        </ol>
        <div className="cols">
          <div>
            <h3>Residents’ data only</h3>
            <p>Both models read only what residents can see: their own outage reports, head counts and their own log of past blackouts. They never read the Directorate’s plant data, the weather or the simulation’s hidden state.</p>
          </div>
          <div>
            <h3>The simulation is the test world</h3>
            <p>The simulation stands in for the Hollow so the same disaster can run with and without Blackout Warning. It is not the product. Real data sets its demand, repair times, sections and plant losses; the rest is stated as a guess in the source code.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="h-limits" className="block">
        <h2 id="h-limits">Limits</h2>
        <ul className="limits">
          {simLimits(f).map((l) => <li key={l}>{l}</li>)}
          {cf.limits.slice(0, 2).map((l) => <li key={l}>Check-first model: {l}</li>)}
        </ul>
        <p><a className="text-link" href={href.model}>All model limits</a></p>
      </section>
      <Generated file={f} label={`Disaster results (${f.module}, set “${f.set}”)`} />
    </>
  );
}

function DisasterRow({ s }: { s: ScenarioResult }) {
  return (
    <li>
      <a className="dz-row" href={href.disaster(s.id)}>
        <span className="dz-name">
          <span className="dz-title">{displayName(s)}</span>
          <span className="dz-real">{s.realData}</span>
        </span>
        <span className="dz-cell without"><span className="dz-label">Deaths per run, without</span><Ci x={s.without.deaths} /></span>
        <span className="dz-cell with"><span className="dz-label">Deaths per run, with</span><Ci x={s.with.deaths} /></span>
        <span className="dz-cell"><span className="dz-label">Plant trips per run</span>{num(s.without.trips.mean)} without, {num(s.with.trips.mean)} with</span>
        <span className="dz-cell"><span className="dz-label">Stable</span>{pct(s.without.stableShare)} without, {pct(s.with.stableShare)} with</span>
        <span className="dz-spark">
          <Sparkline daily={s.daily} label={`Cumulative deaths over ${s.daily.length} days: ${num(s.without.deaths.mean)} without, ${num(s.with.deaths.mean)} with.`} />
        </span>
      </a>
    </li>
  );
}

/** A mean, with its 95% interval on the next line. */
function Ci({ x }: { x: Interval }) {
  const [m, lo, hi] = bounds(x);
  return <><span className="dz-mean">{m}</span><span className="dz-ci">95% interval {rangeText(lo, hi)}</span></>;
}

/** The hero bar fills in once per visit (the site's one authored motion), not on every return to this page. */
let revealed = false;

/** The hero chart: deaths without, stacked by disaster, over the same bar for deaths with, on one scale. */
function Strata({ f }: { f: ScenariosFile }) {
  const [reveal] = useState(() => { const first = !revealed; revealed = true; return first; });
  const n = f.seeds.length;
  // Exact per-seed sums when present (the JSON means are rounded), so the bar matches the headline total.
  const sum = (s: ScenariosFile['scenarios'][number], k: 'withoutDeaths' | 'withDeaths', mean: number) =>
    s.perSeed.length === n ? s.perSeed.reduce((a, r) => a + r[k], 0) : mean * n;
  const parts = f.scenarios.map((s) => ({ id: s.id, name: displayName(s), wo: sum(s, 'withoutDeaths', s.without.deaths.mean), wi: sum(s, 'withDeaths', s.with.deaths.mean) }));
  const total = Math.max(1, parts.reduce((a, p) => a + p.wo, 0));
  const withTotal = parts.reduce((a, p) => a + p.wi, 0);
  return (
    <figure className={reveal ? 'strata reveal' : 'strata'} aria-label={`Bar chart. Deaths without Blackout Warning, by disaster: ${parts.map((p) => `${p.name} ${num(p.wo)}`).join('; ')}. Deaths with it: ${num(withTotal)}, ${pct(withTotal / total, 2)} of the bar above.`}>
      <div className="strata-row">
        <span className="strata-label">Without</span>
        <div className="strata-bar">
          {parts.map((p, i) => (
            <span key={p.id} className={`stratum s${i % 7}`} style={{ flexGrow: p.wo }} title={`${p.name}: ${num(p.wo)}`} />
          ))}
        </div>
      </div>
      <div className="strata-row">
        <span className="strata-label">With</span>
        <div className="strata-bar thin">
          <span className="stratum with" style={{ width: `max(2px, ${(withTotal / total) * 100}%)` }} />
          <span className="strata-after">{num(withTotal)}, {pct(withTotal / total, 2)} of the bar above, on the same scale</span>
        </div>
      </div>
      <figcaption className="strata-key">
        {parts.map((p, i) => <span key={p.id}><i className={`stratum s${i % 7}`} aria-hidden="true" />{p.name}</span>)}
      </figcaption>
    </figure>
  );
}

function simLimits(f: ScenariosFile): string[] {
  const warned = f.scenarios.map((s) => s.with.warnedPct).filter((x): x is number => x != null);
  const out: string[] = [];
  if (warned.length) {
    const lo = Math.min(...warned), hi = Math.max(...warned);
    out.push(`Warned share is a weak measure here: with Blackout Warning only ${pctPoints(lo)}–${pctPoints(hi)} of the remaining blackout hours were warned, because most blackouts are prevented and the few left are short and sudden.`);
  }
  out.push(
    'Blackout Warning keeps plants under 82% of their output. The simulation does not count the cost of saving that much power.',
    'Without Blackout Warning the Hollow does not stabilize in any scenario: real peak demand (1.17 × mean) is above the plants’ capacity margin (1.1 × mean).',
    'Aging and Crowding play 4 real years in 120 days. The aging rate (about 10% a year, The Geysers after its peak) is a steep rate; plants today lose 1–2% a year.',
    'Real county growth is small (median about +0.5% a year), so Crowding changes little.',
    'Repair times come from EAGLE-I, which measures customers getting power back after mostly storm damage to wires. They stand in for plant repair time; they do not measure it.',
    'The air death rate, the share of deaths a warning avoids, air volume per person, the alert follow rate and the plant trip chance at full load are guesses, each stated in src/data/real/airParams.ts.',
    `The intervals cover seed-to-seed variation in the simulation (${f.seeds.length} seeds). They do not cover error in the simulation itself.`,
  );
  return out;
}
