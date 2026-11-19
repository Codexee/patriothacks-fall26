// Story mode: plays SCRIPT one time with no input. It drives the map and the clock directly each
// frame; React renders only when a caption or a panel changes.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Clock } from '../earth/clock.ts';
import { checkFirst, fmtInt, mainGroup } from '../earth/data.ts';
import type { Live, Scene } from '../earth/data.ts';
import type { EarthMap, View } from '../earth/map.ts';
import { CheckFirst, Timeline } from '../earth/panels.tsx';
import { SCRIPT, STORY_SECONDS } from './script.ts';
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
  let level: number | null = null, hours = 0, deepestCi = -1, people = 0;
  const long: number[] = [];
  live.replay.counties.forEach((rc, k) => {
    const ci = live.ci[k];
    if (ci < 0) return;
    const c = scene.counties[ci];
    if (rc.darkHours >= 1) people += c.dme ?? 0;
    if (rc.darkHours < 24) return;
    long.push(ci);
    const l = c.level ?? 0;
    if (level == null || l > level || (l === level && rc.darkHours > hours)) { level = l; hours = rc.darkHours; deepestCi = ci; }
  });
  // Frame the main group of dark counties: drop the few that are far from the others.
  const focus = mainGroup(scene, long);
  return { level, hours, people, deepestCi, focus: focus.length ? focus : long };
}

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

  useEffect(() => {
    const { replay } = live;
    const base: View = map.fit(facts.focus, 120);
    const mark = (m: ClockMark) => (m.at === 'peak' ? live.peakHour : replay.eventStartIndex) + (m.plus ?? 0);
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

  const { row, replay } = live;
  const warned = !replay.stub && !scene.library.stub && row?.leadHours != null;
  const listPeople = useMemo(
    () => checkFirst(scene, live).rows.slice(0, 3).reduce((s, r) => s + (r.county.dme ?? 0), 0),
    [scene, live],
  );

  return (
    <div className="st-root">
      <div className="st-veil" ref={veilRef} />
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
          <span>This is {row?.title ?? `the ${replay.ba} outage`}.</span>
        </p>
      )}
      {shown.caption === 'warned' && (
        <p className="st-caption st-earth" key="warned">
          <span>{warned ? `Warned ${Math.round(row!.leadHours!)} h before the first outage.` : 'Warning model: result pending.'}</span>
          {shown.list && <span className="st-second">Check these counties first: {fmtInt(listPeople)} people on powered medical equipment.</span>}
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
