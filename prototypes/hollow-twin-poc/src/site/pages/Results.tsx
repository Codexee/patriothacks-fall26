// #/ — the results landing page. Full-bleed bands, in order: hero (the result), the result over time,
// how Blackout Warning works, disaster by disaster, the check-first model, the 3D workstation, method and sources.
import { useState, type ReactNode } from 'react';
import type { DailyPoint, Interval, ScenarioResult, ScenariosFile } from '../contracts.ts';
import type { SiteData } from '../data.ts';
import { href } from '../router.ts';
import { bounds, num, pct, rangeText, pctPoints } from '../format.ts';
import { scaleInterval, tCrit, tInterval } from '../stats.ts';
import { DailyChart, Sparkline } from '../charts.tsx';
import { HeroVideo } from '../HeroVideo.tsx';
import { Pipeline } from '../Pipeline.tsx';
import { Generated, displayName, seedRange } from '../parts.tsx';

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

/** "19.8M–22.2M": an interval in compact form. */
function ciShort(x: Interval): string {
  const c = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${(v / 1e3).toFixed(1)}k` : num(v));
  return rangeText(c(Math.max(0, x.lo)), c(Math.max(0, x.hi)));
}

/** Cumulative deaths per day summed over every disaster and seed (daily values are per-run means × seeds). */
function allRunsDaily(f: ScenariosFile): DailyPoint[] {
  const n = f.seeds.length;
  const days = Math.max(...f.scenarios.map((s) => s.daily.length));
  return Array.from({ length: days }, (_, i) => {
    const at = (s: ScenarioResult) => s.daily[Math.min(i, s.daily.length - 1)];
    return {
      day: i + 1,
      withoutDeaths: f.scenarios.reduce((a, s) => a + at(s).withoutDeaths, 0) * n,
      withDeaths: f.scenarios.reduce((a, s) => a + at(s).withDeaths, 0) * n,
      withoutDarkSections: 0,
      withDarkSections: 0,
    };
  });
}

/** Sources behind the test world and the check-first model. URLs are the ones cited in the data files. */
const SOURCES: { name: string; use: string; url: string }[] = [
  { name: 'EIA-930 hourly grid data', use: 'Demand and the shape of every plant loss (ERCOT, TVA, CPLE, SPP)', url: 'https://www.eia.gov/electricity/gridmonitor/' },
  { name: 'EAGLE-I county outages, ORNL', use: 'Plant repair times', url: 'https://doi.org/10.6084/m9.figshare.24237376' },
  { name: 'CDC/ATSDR Social Vulnerability Index', use: '400 sections built from real US counties', url: 'https://www.atsdr.cdc.gov/place-health/php/svi/index.html' },
  { name: 'NIOSH Pocket Guide, CO₂', use: 'The cited air limit', url: 'https://www.cdc.gov/niosh/npg/npgd0103.html' },
  { name: 'The Geysers decline, Foulger et al. 1997', use: 'The aging-plant rate', url: 'https://doi.org/10.1029/96GL03152' },
];

export function Results({ data }: { data: SiteData }) {
  const f = data.scenarios.data;
  const [log, setLog] = useState(true);
  const nS = f.scenarios.length, nSeeds = f.seeds.length;
  const wo = totals(f, 'withoutDeaths', 'without');
  const wi = totals(f, 'withDeaths', 'with');
  const cut = wo.mean > 0 ? 1 - wi.mean / wo.mean : 0;
  const runs = nS * nSeeds;
  const stableWith = Math.round(f.scenarios.reduce((a, s) => a + s.with.stableShare * nSeeds, 0));
  const stableWithout = Math.round(f.scenarios.reduce((a, s) => a + s.without.stableShare * nSeeds, 0));
  const tripsWo = f.scenarios.reduce((a, s) => a + s.without.trips.mean, 0) / Math.max(1, nS);
  const tripsWi = f.scenarios.reduce((a, s) => a + s.with.trips.mean, 0) / Math.max(1, nS);
  const darkWo = f.scenarios.reduce((a, s) => a + s.without.darkMh.mean, 0) / Math.max(1, nS);
  const darkWi = f.scenarios.reduce((a, s) => a + s.with.darkMh.mean, 0) / Math.max(1, nS);
  // Scroll to a section and move keyboard focus to its heading, so the next Tab continues from there.
  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    document.querySelector<HTMLElement>(`#${id} h2`)?.focus({ preventScroll: true });
  };

  return (
    <>
      {/* ---------- Hero ---------- */}
      <header className="band hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Blackout Warning · test results · {nS} disasters × {nSeeds} held-out seeds</p>
            <h1 tabIndex={-1} className="hero-line">
              <span className="hl-pre">Deaths fell from</span>
              <span className="hl-num without">{num(wo.mean)}</span>
              <span className="hl-to">to <span className="with">{num(wi.mean)}</span>.</span>
            </h1>
            <p className="hero-lede">
              A forecasting model that reads only what residents of the Hollow can see, predicts which plants will overload,
              and asks sections to cut load before they trip. Tested on runs it was never tuned on.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn primary" onClick={() => goTo('how')}>How it works</button>
              <a className="btn" href={href.demoClassic()}>Watch it run</a>
            </div>
          </div>
          <div className="hero-media">
            <HeroVideo scenarios={f.scenarios} />
          </div>
        </div>
        <div className="wrap">
          <dl className="kpis">
            <div className="kpi">
              <dt>Deaths avoided</dt>
              <dd><span className="kpi-num saved">{pct(cut, cut > 0.99 ? 2 : 1)}</span><span className="kpi-sub" title="95% interval of total deaths, without → with Blackout Warning">95% CI <span className="without">{ciShort(wo)}</span> → <span className="with">{ciShort(wi)}</span></span></dd>
            </div>
            <div className="kpi">
              <dt>Stable at day 120</dt>
              <dd><span className="kpi-num">{stableWith}<small>/{runs}</small></span><span className="kpi-sub">runs with it · {stableWithout}/{runs} without</span></dd>
            </div>
            <div className="kpi">
              <dt>Plant trips per run</dt>
              <dd><span className="kpi-num"><span className="without">{num(tripsWo)}</span><span className="arrow" aria-label="to">→</span><span className="with">{num(tripsWi)}</span></span><span className="kpi-sub">mean of {nS} disasters</span></dd>
            </div>
            <div className="kpi">
              <dt>Hours without air, per run</dt>
              <dd><span className="kpi-num"><span className="without">{num(darkWo)}M</span><span className="arrow" aria-label="to">→</span><span className="with">{num(darkWi, darkWi < 10 ? 1 : 0)}M</span></span><span className="kpi-sub">person-hours, mean of {nS} disasters</span></dd>
            </div>
          </dl>
        </div>
      </header>

      {/* ---------- 01 The result over time ---------- */}
      <section aria-labelledby="h-res" className="band">
        <div className="wrap">
          <SectionHead n="01" id="h-res" title="Every run, day by day"
            note={`Cumulative deaths summed over all ${runs} runs per side. Same disasters, same seeds; the only difference is Blackout Warning.`}>
            <div className="toggle" role="group" aria-label="Vertical scale">
              <button type="button" aria-pressed={!log} onClick={() => setLog(false)}>Linear</button>
              <button type="button" aria-pressed={log} onClick={() => setLog(true)}>Log</button>
            </div>
          </SectionHead>
          <DailyChart daily={allRunsDaily(f)} keys={['withoutDeaths', 'withDeaths']} unit="deaths" log={log} height={300} title="Cumulative deaths, all disasters and seeds" />
          <p className="legend-line">
            <span className="key without"><i aria-hidden="true" />Without Blackout Warning</span>
            <span className="key with"><i aria-hidden="true" />With Blackout Warning</span>
          </p>
          <Strata f={f} />
          <p className="footnote">
            95% CI from the {nSeeds} per-seed totals, Student t ({nSeeds - 1} df, t = {tCrit(nSeeds - 1).toFixed(3)}). Each run simulates
            {' '}{(f.scale.simPeople / 1e6).toFixed(1)} M people standing for {(f.scale.hollowPeople / 1e9).toFixed(0)} billion (1 ≈ {num(f.scale.hollowPeople / Math.max(1, f.scale.simPeople))}).
          </p>
        </div>
      </section>

      {/* ---------- 02 How it works ---------- */}
      <section aria-labelledby="h-how" className="band alt" id="how">
        <div className="wrap">
          <SectionHead n="02" id="h-how" title="How Blackout Warning works"
            note="Once a day, from residents’ data only. No plant meters, no weather, no grid forecast." />
          <Pipeline tune={f.tune} />
        </div>
      </section>

      {/* ---------- 03 Disaster by disaster ---------- */}
      <section aria-labelledby="h-dis" className="band">
        <div className="wrap">
          <SectionHead n="03" id="h-dis" title="Disaster by disaster"
            note={`Each is shaped by a real grid failure. Mean of ${nSeeds} runs per side; select a row for daily charts and every seed.`} />
          <div className="dz-head" aria-hidden="true">
            <span>Disaster</span><span>Deaths without</span><span>Deaths with</span><span>Plant trips</span><span>Stable</span><span>Cumulative deaths</span>
          </div>
          <ol className="dz-list">
            {f.scenarios.map((s, i) => <DisasterRow key={s.id} s={s} i={i} />)}
          </ol>
        </div>
      </section>

      {/* ---------- 04 Method, sources, limits ---------- */}
      <section aria-labelledby="h-test" className="band alt">
        <div className="wrap">
          <SectionHead n="04" id="h-test" title="Method" note="Only held-out test runs appear on this page." />
          <div className="meta-grid three">
            <div>
              <h3 className="eyebrow">Protocol</h3>
              <ol className="proto">
                <li><b>Write</b>Rules are hand-written from what residents can observe. Nothing is trained.</li>
                <li><b>Tune</b>Its {Object.keys(f.tune).length} constants change one at a time on seeds 1–5.</li>
                <li><b>Check</b>A change is kept only if seeds 6–10 are no worse.</li>
                <li><b>Test once</b>Seeds {seedRange(f.seeds)}, after every choice is frozen. Only these runs are shown.</li>
              </ol>
              <p className="note">The simulation is the test world, not the product. Real data sets its demand, repair times, sections and plant losses.</p>
            </div>
            <div>
              <h3 className="eyebrow">Data sources</h3>
              <ul className="sources">
                {SOURCES.map((s) => (
                  <li key={s.name}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a><span>{s.use}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="eyebrow" id="h-limits">Limits</h3>
              <Limits items={simLimits(f)} shown={3} />
            </div>
          </div>
          <Generated file={f} label={`Results file (${f.module}, set “${f.set}”)`} />
        </div>
      </section>
    </>
  );
}

function SectionHead({ n, id, title, note, children }: { n: string; id: string; title: string; note?: string; children?: ReactNode }) {
  return (
    <div className="sec-head">
      <span className="sec-n" aria-hidden="true">{n}</span>
      <div className="sec-t">
        <h2 id={id} tabIndex={-1}>{title}</h2>
        {note && <p>{note}</p>}
      </div>
      {children && <div className="sec-x">{children}</div>}
    </div>
  );
}

/** The first few limits in full; the rest behind one disclosure, so the page stays short but nothing is hidden. */
export function Limits({ items, shown }: { items: string[]; shown: number }) {
  const head = items.slice(0, shown), rest = items.slice(shown);
  return (
    <>
      <ul className="limits">{head.map((l) => <li key={l}>{l}</li>)}</ul>
      {rest.length > 0 && (
        <details className="more">
          <summary>{rest.length} more</summary>
          <ul className="limits">{rest.map((l) => <li key={l}>{l}</li>)}</ul>
        </details>
      )}
    </>
  );
}

function DisasterRow({ s, i }: { s: ScenarioResult; i: number }) {
  return (
    <li>
      <a className="dz-row" href={href.disaster(s.id)}>
        <span className="dz-name">
          <span className="dz-title"><span className="dz-i" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{displayName(s)}</span>
          <span className="dz-real">{s.realData}</span>
        </span>
        <span className="dz-cell without"><span className="dz-label">Deaths without</span><Ci x={s.without.deaths} /></span>
        <span className="dz-cell with"><span className="dz-label">Deaths with</span><Ci x={s.with.deaths} /></span>
        <span className="dz-cell"><span className="dz-label">Plant trips</span><span className="dz-pair">{num(s.without.trips.mean)} <span className="arrow" aria-label="to">→</span> {num(s.with.trips.mean)}</span></span>
        <span className="dz-cell"><span className="dz-label">Stable</span><span className="dz-pair">{pct(s.without.stableShare)} <span className="arrow" aria-label="to">→</span> {pct(s.with.stableShare)}</span></span>
        <span className="dz-spark">
          <Sparkline daily={s.daily} label={`Cumulative deaths over ${s.daily.length} days: ${num(s.without.deaths.mean)} without, ${num(s.with.deaths.mean)} with.`} />
        </span>
      </a>
    </li>
  );
}

/** A mean, with its 95% interval under it. */
function Ci({ x }: { x: Interval }) {
  const [m, lo, hi] = bounds(x);
  return <><span className="dz-mean">{m}</span><span className="dz-ci" title="95% interval">{rangeText(lo, hi)}</span></>;
}

/** The bar fills in once per visit (the site's one authored motion), not on every return to this page. */
let revealed = false;

/** Deaths without, stacked by disaster, over the same bar for deaths with, on one scale. */
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
          <span className="strata-after">{num(withTotal)} · {pct(withTotal / total, 2)} of the bar above, same scale</span>
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
  const out: string[] = [
    `The intervals cover seed-to-seed variation (${f.seeds.length} seeds), not error in the simulation itself.`,
    'Blackout Warning keeps plants under 82% of output. The simulation does not count the cost of saving that much power.',
    'Several constants are guesses (air death rate, deaths a warning avoids, air per person, alert follow rate, trip chance at full load), each stated in src/data/real/airParams.ts.',
  ];
  if (warned.length) {
    const lo = Math.min(...warned), hi = Math.max(...warned);
    out.push(`Warned share is a weak measure: only ${pctPoints(lo)}–${pctPoints(hi)} of remaining blackout hours were warned, because most blackouts are prevented and the rest are short and sudden.`);
  }
  out.push(
    'Without Blackout Warning no scenario stabilizes: real peak demand (1.17 × mean) exceeds the plants’ margin (1.1 × mean).',
    'Aging and Crowding play 4 real years in 120 days. The aging rate (about 10% a year, The Geysers after its peak) is steep; plants today lose 1–2% a year.',
    'Real county growth is small (median about +0.5% a year), so Crowding changes little.',
    'Repair times come from EAGLE-I customer restorations after mostly wire damage. They stand in for plant repair time; they do not measure it.',
  );
  return out;
}
