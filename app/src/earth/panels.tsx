// The thin panels around the map: timeline (clock + risk chart), check-first list, event picker,
// hover card. Only the timeline reads the clock each frame, and it does that through refs.
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { earthName, hollowName } from '../contracts.ts';
import type { County, EventRow } from '../contracts.ts';
import type { Clock } from './clock.ts';
import { checkFirst, fmtDay, fmtHour, fmtHours, fmtInt, parseUtc, playable } from './data.ts';
import type { Live, Scene } from './data.ts';

export function useClockIndex(clock: Clock): number {
  return useSyncExternalStore(clock.subscribe, () => clock.index);
}
function useClockPlaying(clock: Clock): boolean {
  return useSyncExternalStore(clock.subscribe, () => clock.playing);
}
function useClockSpeed(clock: Clock): number {
  return useSyncExternalStore(clock.subscribe, () => clock.speed);
}

// ---------------------------------------------------------------- timeline

/** Plain name of the warning model that made the risk line. */
export function modelLabel(name: string | undefined, short = false): string {
  if (name === 'warn_fcst') return short ? 'model with a weather forecast' : 'model with a weather forecast (backtest: lead times are an upper bound)';
  if (name === 'warn_full') return 'model with observed weather';
  if (name === 'warn_grid') return 'grid-only model';
  return 'warning model';
}

/** Replay hour of the first alert (EventRow.firstAlert), or null when the model did not warn. */
export function firstAlertIndex(live: Live): number | null {
  const fa = live.row?.firstAlert;
  if (!fa || live.replay.stub) return null;
  const h = Math.round((parseUtc(fa) - parseUtc(live.replay.t0)) / 3600_000);
  return h >= 0 && h < live.replay.hours ? h : null;
}

const CW = 1000, CH = 84;   // chart coordinates (the SVG stretches to the panel width)

export function Timeline({ live, clock, bare = false }: { live: Live; clock: Clock; bare?: boolean }) {
  const { replay } = live;
  const playing = useClockPlaying(clock);
  const speed = useClockSpeed(clock);
  const headRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const relRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const t0 = useMemo(() => parseUtc(replay.t0), [replay]);
  const last = Math.max(1, replay.hours - 1);

  useEffect(() => {
    const paint = () => {
      const x = (clock.hour / last) * 100;
      if (headRef.current) headRef.current.style.left = `${x}%`;
      if (timeRef.current) timeRef.current.textContent = fmtHour(t0 + clock.index * 3600_000);
      if (relRef.current) {
        const d = clock.index - replay.eventStartIndex;
        relRef.current.textContent = d < 0 ? `${-d} h before the first outage` : `${d} h after the first outage`;
      }
    };
    paint();
    return clock.subscribe(paint);
  }, [clock, replay, t0, last]);

  const paths = useMemo(() => {
    const x = (h: number) => (h / last) * CW;
    const top = Math.max(1, ...live.share);
    let area = `M0,${CH}`;
    for (let h = 0; h < replay.hours; h++) area += `L${x(h).toFixed(1)},${(CH - (live.share[h] / top) * (CH - 10)).toFixed(1)}`;
    area += `L${CW},${CH}Z`;
    let risk: string | null = null;
    let thresholdY: number | null = null;
    if (replay.risk && !replay.stub) {
      const top2 = Math.max(0.001, (replay.alertThreshold ?? 0) * 1.6, ...replay.risk.map((p) => p ?? 0));
      const y = (p: number) => CH - 4 - (p / top2) * (CH - 12);
      let pen = false;
      risk = '';
      replay.risk.forEach((p, h) => {
        if (p == null) { pen = false; return; }
        risk += `${pen ? 'L' : 'M'}${x(h).toFixed(1)},${y(p).toFixed(1)}`;
        pen = true;
      });
      if (replay.alertThreshold != null) thresholdY = y(replay.alertThreshold);
    }
    const alertIdx = firstAlertIndex(live);
    return { area, risk, thresholdY, startX: x(replay.eventStartIndex), alertIdx, alertX: alertIdx == null ? null : x(alertIdx) };
  }, [live, replay, last]);
  const model = modelLabel(replay.warnModel);

  const scrub = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    clock.set(((e.clientX - r.left) / r.width) * last);
  };

  return (
    <div className={`em-timeline${bare ? ' em-bare' : ''}`}>
      {!bare && (
        <div className="em-transport">
          <button className="em-play" onClick={() => clock.toggle()} aria-label={playing ? 'Pause the replay' : 'Play the replay'}>
            {playing
              ? <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.6" height="12" /><rect x="9.4" y="2" width="3.6" height="12" /></svg>
              : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" /></svg>}
          </button>
          <label className="em-speed">
            <span className="em-sr">Replay speed</span>
            <select value={speed} onChange={(e) => clock.setSpeed(Number(e.target.value))}>
              {[4, 12, 24, 48].map((s) => <option key={s} value={s}>{s} h per second</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="em-chart">
        <div className="em-readout">
          <span className="em-time" ref={timeRef} />
          <span className="em-rel" ref={relRef} />
        </div>
        <div
          className="em-track" ref={trackRef}
          onPointerDown={(e) => { if (bare) return; e.currentTarget.setPointerCapture(e.pointerId); clock.pause(); scrub(e); }}
          onPointerMove={(e) => { if (!bare && e.buttons === 1) scrub(e); }}
        >
          <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" aria-hidden="true">
            <path className="em-area" d={paths.area} />
            {paths.thresholdY != null && <line className="em-threshold" x1="0" x2={CW} y1={paths.thresholdY} y2={paths.thresholdY} />}
            {paths.risk && <path className="em-risk" d={paths.risk} />}
            <line className="em-start" x1={paths.startX} x2={paths.startX} y1="0" y2={CH} />
            {paths.alertX != null && <line className="em-alert" x1={paths.alertX} x2={paths.alertX} y1="0" y2={CH} />}
          </svg>
          <span className="em-start-label" style={{ left: `${(replay.eventStartIndex / last) * 100}%` }}>first outage</span>
          {paths.alertIdx != null && (
            <span className="em-alert-label" style={{ right: `${100 - (paths.alertIdx / last) * 100}%` }}>first alert</span>
          )}
          {paths.risk
            ? <span className="em-chart-note">{bare
                ? `${replay.ba} risk, ${modelLabel(replay.warnModel, true)}`
                : `Risk of an outage event in ${replay.ba}, ${model}${paths.thresholdY != null ? '. Dashed line: alert level' : ''}`}</span>
            : <span className="em-chart-note em-pending">Risk of an outage event in {replay.ba}: model output pending</span>}
          <div className="em-head" ref={headRef} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- check first

export function CheckFirst({ scene, live, count = 4, onPoint }: {
  scene: Scene; live: Live; count?: number; onPoint?: (fips: string | null) => void;
}) {
  const { rows, observed } = useMemo(() => checkFirst(scene, live), [scene, live]);
  const top = rows.slice(0, count);
  const people = top.reduce((s, r) => s + (r.county.dme ?? 0), 0);
  return (
    <aside className="em-check" aria-label="Check first">
      <h2>Check first</h2>
      <p className="em-check-sub">
        {observed ? 'Observed' : 'Predicted'} hours dark × people on powered medical equipment{observed ? ' (model output pending)' : ''}.
        {' '}These {top.length} counties: {fmtInt(people)} people.
      </p>
      <ol>
        {top.map((r) => (
          <li key={r.county.fips}>
            <a
              href={`#/brief/${r.county.fips}`}
              onMouseEnter={() => onPoint?.(r.county.fips)} onMouseLeave={() => onPoint?.(null)}
              onFocus={() => onPoint?.(r.county.fips)} onBlur={() => onPoint?.(null)}
            >
              <span className="em-names-2">
                <span className="em-earth">{earthName(r.county)}</span>
                <span className="em-hollow">
                  {hollowName(r.county)}, {observed
                    ? `${Math.round(r.hours)} h dark (observed)`
                    : `${fmtHours(r.hours)} h predicted, ${Math.round(r.observedHours)} h observed`}
                </span>
              </span>
              <span className="em-dme">{fmtInt(r.county.dme)}</span>
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}

// ---------------------------------------------------------------- event picker (calm map)

export function EventPicker({ scene, base = '#/event/' }: { scene: Scene; base?: string }) {
  const { heroes, others } = useMemo(() => playable(scene.library), [scene]);
  const label = (e: EventRow) => e.title ?? `${e.ba}, ${fmtDay(e.start)}`;
  return (
    <section className="em-picker" aria-label="Replay a real outage">
      <h1>Depth is vulnerability.</h1>
      <p className="em-lede">
        Every US county, drawn as a level of the Hollow. The deeper a county goes, the less it can absorb a
        long outage. Replay a real outage to see who stayed dark.
      </p>
      <div className="em-heroes">
        {heroes.map((e) => (
          <a key={e.id} className="em-hero" href={`${base}${e.id}`}>
            <span className="em-hero-title">{label(e)}</span>
            <span className="em-hero-sub">{fmtInt(e.peakCustomersOut)} customers out at the peak</span>
          </a>
        ))}
        {heroes.length === 0 && <p className="em-lede">No replay is available yet.</p>}
      </div>
      {others.length > 0 && (
        <label className="em-more">
          <span className="em-sr">Other outages</span>
          <select value="" onChange={(e) => { if (e.target.value) window.location.hash = `${base}${e.target.value}`; }}>
            <option value="">{others.length} more outages</option>
            {others.map((e) => (
              <option key={e.id} value={e.id}>{fmtDay(e.start)}, {e.ba}, {fmtInt(e.peakCustomersOut)} out</option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- hover card

export function HoverCard({ county, x, y, out, inReplay }: { county: County; x: number; y: number; out: number; inReplay: boolean }) {
  const left = x > window.innerWidth - 340 ? x - 296 : x + 18;
  const top = y > window.innerHeight - 260 ? y - 214 : y + 18;
  return (
    <div className="em-hover" style={{ transform: `translate(${left}px, ${top}px)` }} role="status">
      <div className="em-earth">{earthName(county)}</div>
      <div className="em-hollow">{hollowName(county)}</div>
      <dl>
        <dt>Population</dt><dd>{fmtInt(county.pop)}</dd>
        <dt>Electric customers</dt><dd>{fmtInt(county.customers)}</dd>
        <dt>On powered medical equipment</dt><dd>{fmtInt(county.dme)}</dd>
        <dt>Customers out now</dt>
        <dd className={out >= 10 ? 'em-out' : ''}>{inReplay ? `${out < 1 && out > 0 ? out.toFixed(1) : Math.round(out)}%` : '0%'}</dd>
      </dl>
    </div>
  );
}
