// The main screen: the US county map that is also the Hollow.
// Routes: #/ (calm map + event picker), #/event/<id> (replay), #/?story=<hero> (story mode),
// #/hollow and #/hollow/<id> (the same, as a cross-section of the Hollow). The map, the clock and the
// replay stay loaded when the view changes, so the event and the clock position are kept.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoute } from '../shell/router.ts';
import { Clock } from './clock.ts';
import { findHero, loadReplay, loadScene, mainGroup, prepareLive } from './data.ts';
import type { Live, Scene } from './data.ts';
import { EarthMap, HOME } from './map.ts';
import type { HoverInfo, View } from './map.ts';
import { CheckFirst, EventPicker, HoverCard, Timeline, useClockIndex } from './panels.tsx';
import { HollowView } from './HollowView.tsx';
import { AssistToggle, Counters, ModelCard, officialFor } from './assist.tsx';
import type { Assist } from './assist.tsx';
import { checkFirst } from './data.ts';
import './hollow.css';
import { Story } from '../story/Story.tsx';
import { HERO_FACTS } from '../story/script.ts';
import './earth.css';

export default function Page() {
  const route = useRoute();
  const storySlug = route.query.get('story');
  const section = route.parts[0] === 'hollow';
  const routeEvent = route.parts[0] === 'event' || section ? route.parts[1] ?? null : null;

  const stageRef = useRef<HTMLDivElement>(null);
  const flight = useRef(0);
  const clock = useMemo(() => new Clock(), []);
  const [scene, setScene] = useState<Scene | null>(null);
  const [map, setMap] = useState<EarthMap | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [assist, setAssist] = useState<Assist>('with');

  useEffect(() => {
    let on = true;
    loadScene().then((s) => { if (on) setScene(s); }, () => { if (on) setProblem('The map data did not load. Reload the page.'); });
    return () => { on = false; };
  }, []);

  useEffect(() => {
    if (!scene || !stageRef.current) return;
    const m = new EarthMap(stageRef.current, scene);
    m.onHover = setHover;
    setMap(m);
    const off = clock.subscribe(() => m.setHour(clock.hour));
    return () => { off(); m.destroy(); setMap(null); };
  }, [scene, clock]);

  // Which event to show. Story mode finds its hero through EventRow.hero.
  // If no hero has data, the page shows the calm map.
  const story = storySlug != null && (!scene || findHero(scene.library, storySlug) != null);
  const eventId = useMemo(() => {
    if (!scene) return null;
    return story ? findHero(scene.library, storySlug)?.id ?? null : routeEvent;
  }, [scene, story, storySlug, routeEvent]);

  useEffect(() => {
    if (!scene || !map) return;
    let on = true;
    cancelAnimationFrame(flight.current);
    const flyTo = (to: View, ms = 1400) => {
      const from = map.view;
      const start = performance.now();
      const step = (now: number) => {
        const u = Math.min(1, (now - start) / ms);
        const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
        const mixv = (a: number, b: number) => a + (b - a) * e;
        map.setView({
          longitude: mixv(from.longitude, to.longitude), latitude: mixv(from.latitude, to.latitude),
          zoom: mixv(from.zoom, to.zoom), pitch: mixv(from.pitch, to.pitch), bearing: mixv(from.bearing, to.bearing),
        });
        if (u < 1) flight.current = requestAnimationFrame(step);
      };
      flight.current = requestAnimationFrame(step);
    };

    setProblem(null);
    if (!eventId) {
      clock.reset(1);
      map.setLive(null);
      setLive(null);
      if (!story) flyTo(HOME);
      return;
    }
    loadReplay(eventId).then((replay) => {
      if (!on) return;
      const next = prepareLive(scene, replay);
      map.setLive(next);
      clock.reset(replay.hours, Math.max(0, replay.eventStartIndex - 24));
      setLive(next);
      if (story) return;   // the story script moves the camera and the clock
      const dark = replay.counties.map((c, k) => (c.darkHours >= 12 ? next.ci[k] : -1)).filter((ci) => ci >= 0);
      const fit = map.fit(mainGroup(scene, dark.length ? dark : Array.from(next.ci).filter((ci) => ci >= 0)), 60);
      flyTo({ ...fit, zoom: Math.max(3.6, fit.zoom - 0.55), latitude: fit.latitude - 0.6, pitch: 48, bearing: 0 });
      clock.play();
    }, () => {
      if (!on) return;
      map.setLive(null);
      setLive(null);
      setProblem('No replay data for this event. Select another event.');
    });
    return () => { on = false; cancelAnimationFrame(flight.current); };
  }, [scene, map, eventId, story, clock]);

  const showFair = !!(live?.row?.hero && HERO_FACTS[live.row.hero]?.loadShed);
  const official = useMemo(() => (live ? officialFor(live) : null), [live]);
  const withTool = assist === 'with';
  const checkCis = useMemo(
    () => (scene && live && withTool ? checkFirst(scene, live).rows.slice(0, 4).map((r) => scene.index.get(r.county.fips)!) : []),
    [scene, live, withTool],
  );
  useEffect(() => { map?.setAssist(withTool || !!story); }, [map, withTool, story]);

  const pointAt = (fips: string | null) => {
    if (!map || !scene) return;
    const ci = fips ? scene.index.get(fips) : undefined;
    map.setLabels(ci == null ? [] : [ci]);
  };

  return (
    <main className={`em-page${story ? ' em-story' : ''}${section && !story ? ' em-section' : ''}`}>
      <div
        className="em-stage" ref={stageRef}
        onPointerDown={() => cancelAnimationFrame(flight.current)}
        onWheel={() => cancelAnimationFrame(flight.current)}
      />
      <div className="em-vignette" />

      {!story && (
        <header className="em-top">
          <a className="em-brand" href="#/">Before, During, After</a>
          {live && <span className="em-event-title">{live.row?.title ?? `${live.replay.ba} outage`}</span>}
          <ViewToggle section={section} eventId={eventId} />
          <nav>
            {live && <a href={section ? '#/hollow' : '#/'}>All outages</a>}
            <a href="#/evidence">Evidence</a>
            <a href="#/live">Live</a>
          </nav>
        </header>
      )}

      {!story && section && scene && (!eventId || live) && (
        <div className={`em-xsec${live ? ' em-xsec-live' : ''}`}>
          <HollowView
            key={live?.replay.id ?? 'calm'} scene={scene} live={live} clock={clock} onHover={setHover} showFair={showFair}
            highlight={checkCis} aside={live && withTool ? <ModelCard scene={scene} live={live} bar /> : null}
          />
        </div>
      )}
      {!story && scene && !live && !eventId && <EventPicker scene={scene} base={section ? '#/hollow/' : '#/event/'} />}
      {!story && scene && live && (
        <div className="em-strip">
          <AssistToggle value={assist} onChange={setAssist} />
          <Counters scene={scene} live={live} clock={clock} assist={assist} />
        </div>
      )}
      {!story && !section && scene && live && withTool && (
        <div className="em-right">
          <CheckFirst scene={scene} live={live} onPoint={pointAt} />
          <ModelCard scene={scene} live={live} />
        </div>
      )}
      {!story && live && <Timeline live={live} clock={clock} assist={withTool} official={official} />}
      {story && scene && map && live && <Story key={live.replay.id} scene={scene} live={live} map={map} clock={clock} />}

      {problem && <p className="em-problem" role="alert">{problem} <a href="#/">Back to the map</a></p>}
      {!scene && !problem && <p className="em-loading">Loading 3,142 counties</p>}
      {!story && !section && scene && (
        <p className="em-legend">
          Depth = Hollow level (vulnerability){live ? ' + hours dark' : ''}. Brightness = electric customers{live ? '; dark = power out' : ''}.
          {' '}Surface smoothed for display; hover for the exact county values.
        </p>
      )}
      <p className="em-credit">Basemap © OpenStreetMap contributors © CARTO</p>

      {!story && hover && scene && map && (
        <Hover scene={scene} map={map} hover={hover} clock={clock} live={live} />
      )}
    </main>
  );
}

function Hover({ scene, map, hover, clock, live }: { scene: Scene; map: EarthMap; hover: HoverInfo; clock: Clock; live: Live | null }) {
  useClockIndex(clock);   // render again when the hour changes, so "customers out now" stays current
  return (
    <HoverCard
      county={scene.counties[hover.ci]} x={hover.x} y={hover.y}
      out={map.outNow(hover.ci)} inReplay={live != null && live.slot[hover.ci] >= 0}
    />
  );
}

/** Surface map / Hollow cross-section. Links keep the event; the clock stays where it is. */
function ViewToggle({ section, eventId }: { section: boolean; eventId: string | null }) {
  const tail = eventId ? `/${eventId}` : '';
  return (
    <div className="em-toggle" role="group" aria-label="View">
      <a href={eventId ? `#/event/${eventId}` : '#/'} aria-current={!section ? 'page' : undefined}>Surface map</a>
      <a href={`#/hollow${tail}`} aria-current={section ? 'page' : undefined}>Hollow cross-section</a>
    </div>
  );
}
