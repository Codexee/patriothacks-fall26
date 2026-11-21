// The resident's phone inside the 3D workstation. It replays the "with" side's run (same disaster, seed and modules
// as the worker), one Run per day, so the phone shows exactly what HollowGuard sent on the day on screen.
// Clicking a section in the 3D view moves the phone's home there unless the home is locked.
import { useEffect, useRef, useState } from 'react';
import { createRun, stepRun, type Run } from '../../product/run.ts';
import { Phone } from '../../ui/phone/Phone.tsx';
import { WITH_TOOLS, eventsAt, toolsAt, type Plan } from '../compute.ts';
import '../../ui/phone/phone-host.css';

/** Runs for days 0..day of one disaster and seed, computed a few days per frame and kept for scrubbing back. */
function useRuns(id: string, seed: number | null, day: number, plan: Plan): Run | null {
  const cache = useRef<{ key: string; runs: Run[] }>({ key: '', runs: [] });
  const [, bump] = useState(0);
  const key = `${id}:${seed}:${JSON.stringify(plan)}`;
  if (cache.current.key !== key) cache.current = { key, runs: seed === null ? [] : [createRun(id, seed, WITH_TOOLS)] };

  useEffect(() => {
    let raf = 0;
    const work = () => {
      const c = cache.current;
      if (c.key !== key || c.runs.length === 0) return;
      const t0 = performance.now();
      while (c.runs.length <= day && performance.now() - t0 < 12) {
        const last = c.runs[c.runs.length - 1];
        if (last.sim.end) break;
        const d = last.sim.day + 1;
        c.runs.push(stepRun(last, toolsAt(plan, d), eventsAt(plan, d)).run);
      }
      bump((n) => n + 1);
      const last = c.runs[c.runs.length - 1];
      if (c.runs.length <= day && !last.sim.end) raf = requestAnimationFrame(work);
    };
    raf = requestAnimationFrame(work);
    return () => cancelAnimationFrame(raf);
  }, [key, day]);

  const runs = cache.current.runs;
  return runs.length ? runs[Math.min(day, runs.length - 1)] : null;
}

export function PhoneDock({ id, seed, day, pick, note, plan = [], onReport }: {
  id: string; seed: number | null; day: number; pick: number | null; note?: string | null; plan?: Plan;
  /** Sends a resident's report into the run (the 3D view). Without it, Report is read-only here. */
  onReport?: (level: number, col: number, text: string) => void;
}) {
  const run = useRuns(id, seed, day, plan);
  const [section, setSection] = useState({ level: 39, col: 2 });
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (pick !== null && !locked) setSection({ level: Math.floor(pick / 8) + 1, col: pick % 8 });
  }, [pick, locked]);

  return (
    <div className="ph-host">
      {note !== null && <p className="ph-host-note">{note ?? `Level ${section.level}, day ${day}. Click a section to move in.`}</p>}
      {run ? (
        <Phone run={run} modules={toolsAt(plan, day)} hour={7} playing={false} section={section} onPickSection={setSection}
          homeLocked={locked} onToggleLock={() => setLocked((v) => !v)}
          onReport={onReport ?? (() => {})} queuedReports={plan.filter((p) => p.report && p.day === day + 1).length}
          locked={!onReport} lockedNote="Open Watch it run to send a report into the test world." />
      ) : <p className="ph-host-note">Loading…</p>}
    </div>
  );
}
