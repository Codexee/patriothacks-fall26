// The guided tour: a 90-second walk through the site with one caption per step. "Play the tour" on the results
// page starts it. Each step opens a page, scrolls to one element and outlines it, then moves on by itself.
// The person can pause, go back, skip or stop at any time (Esc stops).
import { useCallback, useEffect, useRef, useState } from 'react';
import { href } from './router.ts';

interface Step { hash: string; target: string; caption: string; ms: number }

const STEPS: Step[] = [
  { hash: href.results, target: '.hero-line', ms: 10000,
    caption: 'Total deaths in 70 test runs: 7 disasters, 10 seeds each. None of these runs was used for tuning.' },
  { hash: href.results, target: '#app', ms: 13000,
    caption: 'HollowGuard is a phone app. Each app answers one problem and reads only what residents can see. The bars show what each app saves.' },
  { hash: href.results, target: '#real', ms: 11000,
    caption: 'The disasters copy real US plant losses, hour by hour: here, the coal and wind losses of 2021 and 2022.' },
  { hash: href.results, target: '#h-res', ms: 10000,
    caption: 'Every run, day by day. Same disasters, same seeds. The only difference is HollowGuard.' },
  { hash: href.results, target: '#how', ms: 11000,
    caption: 'Residents cannot see the plants. They can see which levels are dark. Blackout Warning turns that into a forecast.' },
  { hash: href.demo('twoplants'), target: '.ws-view', ms: 12000,
    caption: 'Two plants fail at once. Left: the Hollow without HollowGuard. Right: with it. Same seed.' },
  { hash: href.demo('twoplants'), target: '.ws-left', ms: 12000,
    caption: 'The phone shows what one resident gets that day: blackout warnings, boil-water notices, family check-ins.' },
  { hash: href.model, target: 'main h1', ms: 11000,
    caption: 'A second model ranks which areas to check first. It uses residents’ data only and was tested once, on real 2023–2024 outages.' },
];

const START = 'hg:tour';
/** Starts the tour from anywhere on the site. */
export function startTour() { window.dispatchEvent(new Event(START)); }

export function Tour() {
  const [i, setI] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [left, setLeft] = useState(0);
  const lit = useRef<Element | null>(null);

  const stop = useCallback(() => { setI(null); setPaused(false); }, []);
  /** Go to step n and restart its clock in the same render, so the clock never reads 0 for a new step. */
  const go = useCallback((n: number) => { setLeft(STEPS[n].ms); setI(n); }, []);

  useEffect(() => {
    const on = () => { setPaused(false); go(0); };
    window.addEventListener(START, on);
    return () => window.removeEventListener(START, on);
  }, [go]);

  // Open the step's page, then wait for its element, scroll to it and outline it.
  useEffect(() => {
    lit.current?.classList.remove('tour-lit');
    lit.current = null;
    if (i === null) return;
    const s = STEPS[i];
    if (location.hash !== s.hash && !(s.hash === href.results && (location.hash === '' || location.hash === '#'))) location.hash = s.hash;
    let tries = 0;
    const find = setInterval(() => {
      const el = document.querySelector(s.target);
      if (el || ++tries > 40) {
        clearInterval(find);
        if (!el) return;
        el.classList.add('tour-lit');
        lit.current = el;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      }
    }, 100);
    return () => clearInterval(find);
  }, [i]);

  // The step clock. It stops while paused.
  useEffect(() => {
    if (i === null || paused) return;
    const t = setInterval(() => setLeft((ms) => ms - 100), 100);
    return () => clearInterval(t);
  }, [i, paused]);
  useEffect(() => {
    if (i === null || left > 0) return;
    if (i < STEPS.length - 1) go(i + 1); else stop();
  }, [left, i, stop, go]);

  useEffect(() => {
    if (i === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') stop(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [i, stop]);

  if (i === null) return null;
  const s = STEPS[i];
  const done = 1 - Math.max(0, left) / s.ms;
  return (
    <div className="tour" role="dialog" aria-label="Guided tour" aria-live="polite">
      <div className="tour-bar" aria-hidden="true"><span style={{ transform: `scaleX(${done})` }} /></div>
      <p className="tour-cap">{s.caption}</p>
      <div className="tour-ctl">
        <span className="tour-n">{i + 1} / {STEPS.length}</span>
        <button type="button" onClick={() => go(Math.max(0, i - 1))} disabled={i === 0}>Back</button>
        <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? 'Play' : 'Pause'}</button>
        <button type="button" onClick={() => (i < STEPS.length - 1 ? go(i + 1) : stop())}>{i < STEPS.length - 1 ? 'Next' : 'Finish'}</button>
        <button type="button" className="tour-x" onClick={stop} aria-label="Stop the tour">✕</button>
      </div>
    </div>
  );
}
