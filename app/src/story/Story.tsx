// Story mode: plays SCRIPT one time with no input. It drives the map and the clock directly each
// frame; React renders only when a caption or a panel changes.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Clock } from '../earth/clock.ts';
import { checkFirst, fmtInt, mainGroup, parseUtc } from '../earth/data.ts';
import type { Live, Scene } from '../earth/data.ts';
import type { EarthMap, View } from '../earth/map.ts';
import { CheckFirst, Timeline } from '../earth/panels.tsx';
import { HollowView } from '../earth/HollowView.tsx';
import { buildSection, deepVsTop } from '../earth/hollow.ts';
import { HERO_FACTS, SCRIPT, STORY_SECONDS } from './script.ts';
import type { Beat, Camera, CaptionId, ClockMark } from './script.ts';
import './story.css';

/** The numbers in the captions. All of them come from the hero replay and the county table. */
export interface Facts {
  level: number | null;     // deepest level among the counties that were dark for 24 h or more
  hours: number;            // the longest dark time at that level
  people: number;           // sum of dme in the counties that were dark for 1 h or more
  deepestCi: number;        // the county the first caption is about
  focus: number[];          // counties that the camera frames
}

export function storyFacts(scene: Scene, live: Live): Facts {
  const ba = live.replay.ba;
  const dark: { ci: number; hours: number; own: boolean }[] = [];
  let people = 0;
  live.replay.counties.forEach((rc, k) => {
    const ci = live.ci[k];
    if (ci < 0 || rc.darkHours < 1) return;
    const c = scene.counties[ci];
    people += c.dme ?? 0;
    dark.push({ ci, hours: rc.darkHours, own: c.ba === ba });
  });
  // The counties the story is about: the ones dark for 24 h or more, when the event's own balancing
  // area has enough of them (Texas, Irma). Otherwise the balancing area's own dark counties (Elliott in
  // TVA, where the long outages of the same storm were in other states).
  const long = dark.filter((d) => d.hours >= 24);
  const own = dark.filter((d) => d.own);
  const pool = long.filter((d) => d.own).length >= 10 ? long : own.length ? own : dark;
  let level: number | null = null, hours = 0, deepestCi = -1;
  for (const d of pool) {
    const l = scene.counties[d.ci].level ?? 0;
    if (level == null || l > level || (l === level && d.hours > hours)) { level = l; hours = d.hours; deepestCi = d.ci; }
  }
  // Frame the main group: drop the few counties that are far from the others.
  const cis = pool.map((d) => d.ci);
  const focus = mainGroup(scene, cis);
  return { level, hours, people, deepestCi, focus: focus.length ? focus : cis };
}

/** The warning caption, from EventRow.leadHours (model with a weather forecast) and its caveat. */
export function warningLines(scene: Scene, live: Live): { main: string; fact: string | null; note: string | null } {
  const row = live.row;
  if (scene.library.stub || live.replay.stub || !row) return { main: 'Warning model: result pending.', fact: null, note: null };
  const note = 'With a weather forecast; backtest upper bound.';
  if (row.leadHours != null) {
    const f = row.hero ? HERO_FACTS[row.hero] : undefined;
    let fact: string | null = null;
    if (f && row.firstAlert) {
      const h = Math.round((parseUtc(f.utc) - parseUtc(row.firstAlert)) / 3600_000);
      if (h > 0) fact = f.line.replace('{h}', String(h));
    }
    return { main: `Warned ${Math.round(row.leadHours)} h before the first outage.`, fact, note };
  }
  if (row.leadHoursNoForecast != null) {
    return { main: `Warned ${Math.round(row.leadHoursNoForecast)} h before, without a weather forecast.`, fact: null, note: null };
  }
  return { main: 'The model did not warn this one.', fact: null, note: null };
}

const fmtHoursCap = (h: number) => (h < 10 ? h.toFixed(1) : String(Math.round(h)));

const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));

/** The two beats around time t that set `key`, and the position between them (0..1). */
function span<K extends keyof Beat>(key: K, t: number): { a: NonNullable<Beat[K]>; b: NonNullable<Beat[K]>; u: number } | null {
  let a: Beat | null = null, b: Beat | null = null;
  for (const beat of SCRIPT) {
    if (beat[key] === undefined) continue;
    if (beat.t <= t) a = beat; else { b = beat; break; }
  }
  if (!a) return null;
  if (!b) return { a: a[key]!, b: a[key]!, u: 0 };
  return { a: a[key]!, b: b[key]!, u: ease((t - a.t) / (b.t - a.t)) };
}
function latest<K extends keyof Beat>(key: K, t: number): Beat[K] | undefined {
  let v: Beat[K] | undefined;
  for (const beat of SCRIPT) if (beat.t <= t && beat[key] !== undefined) v = beat[key];
  return v;
}
const mix = (a: number, b: number, u: number) => a + (b - a) * u;

interface Shown { caption: CaptionId | null; chart: boolean; list: boolean; labels: 'hollow' | 'earth' | 'none' }

export function Story({ scene, live, map, clock }: { scene: Scene; live: Live; map: EarthMap; clock: Clock }) {
  const facts = useMemo(() => storyFacts(scene, live), [scene, live]);
  const [shown, setShown] = useState<Shown>({ caption: null, chart: false, list: false, labels: 'none' });
  const veilRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { replay } = live;
    const fit = map.fit(facts.focus, 120);
    // A small balancing area (TVA) must not fill the screen: the opening needs many levels in view.
    const base: View = { ...fit, zoom: Math.min(fit.zoom, 5.4) };
    const lead = live.row?.leadHours ?? live.row?.leadHoursNoForecast ?? 12;
    const mark = (m: ClockMark) =>
      (m.at === 'peak' ? live.peakHour : m.at === 'firstAlert' ? replay.eventStartIndex - lead : replay.eventStartIndex) + (m.plus ?? 0);
    const cam = (c: Camera): View => ({
      longitude: base.longitude, latitude: base.latitude + (c.north ?? 0),
      zoom: base.zoom + c.zoom, pitch: c.pitch, bearing: c.bearing,
    });
    const top = checkFirst(scene, live).rows[0];
    const labelCis = [facts.deepestCi, top ? scene.index.get(top.county.fips)! : -1]
      .filter((ci, i, all) => ci >= 0 && all.indexOf(ci) === i);

    map.setInteractive(false);
    clock.pause();
    document.documentElement.dataset.story = 'playing';
    let raf = 0;
    let current: Shown = { caption: null, chart: false, list: false, labels: 'none' };
    const start = performance.now();

    const frame = (now: number) => {
      const t = Math.min(STORY_SECONDS, (now - start) / 1000);

      map.setBelow(latest('below', t) ?? false);
      const c = span('camera', t);
      if (c) {
        const a = cam(c.a), b = cam(c.b);
        map.setView({
          longitude: mix(a.longitude, b.longitude, c.u), latitude: mix(a.latitude, b.latitude, c.u),
          zoom: mix(a.zoom, b.zoom, c.u), pitch: mix(a.pitch, b.pitch, c.u), bearing: mix(a.bearing, b.bearing, c.u),
        });
      }
      const k = span('clock', t);
      if (k) clock.set(mix(mark(k.a), mark(k.b), k.u));
      const bm = span('basemap', t);
      if (bm) map.setBasemap(mix(bm.a, bm.b, bm.u));
      const veil = span('veil', t);
      if (veil && veilRef.current) veilRef.current.style.opacity = String(mix(veil.a, veil.b, veil.u));
      const sc = span('section', t);
      if (sc && sectionRef.current) {
        const o = mix(sc.a, sc.b, sc.u);
        sectionRef.current.style.opacity = String(o);
        sectionRef.current.style.visibility = o > 0.001 ? 'visible' : 'hidden';
      }

      const next: Shown = {
        caption: latest('caption', t) ?? null, chart: latest('chart', t) ?? false,
        list: latest('list', t) ?? false, labels: latest('labels', t) ?? 'none',
      };
      if (next.caption !== current.caption || next.chart !== current.chart || next.list !== current.list || next.labels !== current.labels) {
        current = next;
        map.setLabels(next.labels === 'none' ? [] : labelCis, next.labels === 'hollow');
        setShown(next);
      }
      if (t < STORY_SECONDS) raf = requestAnimationFrame(frame);
      else document.documentElement.dataset.story = 'done';
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      delete document.documentElement.dataset.story;
      map.setBelow(false);
      map.setBasemap(1);
      map.setLabels([]);
      map.setInteractive(true);
    };
  }, [scene, live, map, clock, facts]);

  const { row } = live;
  const levels = useMemo(() => deepVsTop(scene, live, buildSection(scene, live)), [scene, live]);
  const warning = useMemo(() => warningLines(scene, live), [scene, live]);
  const check = useMemo(() => {
    const { rows } = checkFirst(scene, live);
    const top = rows.slice(0, 3);
    return { n: top.length, people: top.reduce((s, r) => s + (r.county.dme ?? 0), 0) };
  }, [scene, live]);

  return (
    <div className="st-root">
      <div className="st-veil" ref={veilRef} />
      <div className="st-section" ref={sectionRef}>
        <HollowView scene={scene} live={live} clock={clock} bare />
      </div>
      {shown.chart && <div className="st-chart"><Timeline live={live} clock={clock} bare /></div>}
      {shown.list && <div className="st-list"><CheckFirst scene={scene} live={live} count={3} /></div>}

      {shown.caption === 'hollow' && (
        <p className="st-caption st-hollow" key="hollow">
          <span>Level {facts.level ?? '?'} has been dark for {fmtInt(facts.hours)} hours.</span>
          <span>{fmtInt(facts.people)} people in the dark districts need powered oxygen or dialysis.</span>
        </p>
      )}
      {shown.caption === 'reveal' && (
        <p className="st-caption st-earth" key="reveal">
          <span>This is not 2087.</span>
          <span>This is {row?.title ?? `the ${live.replay.ba} outage`}.</span>
        </p>
      )}
      {shown.caption === 'levels' && (
        <p className="st-caption st-hollow" key="levels">
          {levels.deep > levels.top
            ? <>
                <span>The deepest 10 levels: {fmtHoursCap(levels.deep)} hours without power per person.</span>
                <span>The top 10 levels: {fmtHoursCap(levels.top)}.</span>
              </>
            : <>
                <span>This time the deep levels were not darker.</span>
                <span>Deepest 10 levels: {fmtHoursCap(levels.deep)} hours per person. Top 10: {fmtHoursCap(levels.top)}.</span>
              </>}
        </p>
      )}
      {shown.caption === 'warned' && (
        <p className="st-caption st-earth" key="warned">
          <span>{warning.main}</span>
          {warning.fact && <span>{warning.fact}</span>}
          {warning.note && <span className="st-note">{warning.note}</span>}
        </p>
      )}
      {shown.caption === 'check' && (
        <p className="st-caption st-earth" key="check">
          <span>Check these {check.n} counties first.</span>
          <span>{fmtInt(check.people)} people there use powered medical equipment.</span>
        </p>
      )}
      {shown.caption === 'proof' && (
        <p className="st-caption st-earth" key="proof">
          <span>{fmtInt(scene.library.count)} real outages since {scene.library.years[0]}.</span>
          <span><a href="#/evidence">See how the warning did on each one</a></span>
        </p>
      )}
    </div>
  );
}
