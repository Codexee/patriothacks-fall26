// The settings panel (⚙) of the 3D workstation: switch apps on or off, and break things in the test world.
// Every change goes into a plan with a day (src/twin3d/compute.ts): app switches act on the "with" side from the
// day on screen; a break happens the next day, on both sides. The run is computed again from day 0 with the plan,
// so the days before the change do not change. The apps are not told about a break; they have to notice it.
import { useState } from 'react';
import { NO_TOOLS, type ToolKey, type ToolSet, type WorldEvent } from '../../sim/types.ts';
import { BUILT, PROBLEMS, moduleName } from '../../product/names.ts';
import { toolsAt, type Plan } from '../compute.ts';

const describe = (e: WorldEvent): string => {
  switch (e.type) {
    case 'tripPlant': return `Plant ${e.plant + 1} trips`;
    case 'breakRecycler': return `Recycler on level ${e.level} breaks`;
    case 'outbreak': return `Outbreak starts on level ${e.level}`;
    case 'cutNetwork': return `Network cut for ${e.hours} h`;
    case 'divertFarms': return `Farms on levels ${e.from}–${e.to} diverted`;
  }
};

export function TestWorld({ plan, day, D, pending, onPlan, onClose }: {
  plan: Plan; day: number; D: number; pending: boolean; onPlan: (p: Plan) => void; onClose: () => void;
}) {
  const [plant, setPlant] = useState(0);
  const [level, setLevel] = useState(38);
  const tools = toolsAt(plan, day);
  const next = Math.min(D, day + 1);
  const clampLevel = (v: number) => Math.min(50, Math.max(1, Math.round(v) || 1));

  const setApp = (k: ToolKey, on: boolean) => {
    const t: ToolSet = { ...NO_TOOLS, ...Object.fromEntries(BUILT.map((b) => [b, b === k ? on : tools[b]])) };
    onPlan([...plan.filter((p) => !(p.tools && p.day === day)), { day, tools: t }]);
  };
  const brk = (event: WorldEvent) => onPlan([...plan, { day: next, event }]);

  return (
    <div className="ws-tw" role="dialog" aria-label="Test world settings">
      <header className="ws-tw-h">
        <h2>Test world</h2>
        {pending && <span className="ws-dim" role="status">Running…</span>}
        <button type="button" className="ws-btn" onClick={onClose} aria-label="Close settings">✕</button>
      </header>

      <section>
        <h3>Apps <span className="ws-dim">· “with” side, from day {day}</span></h3>
        <ul className="ws-tw-apps">
          {BUILT.map((k) => (
            <li key={k}>
              <label>
                <input type="checkbox" checked={!!tools[k]} onChange={(e) => setApp(k, e.target.checked)} />
                <span>#{PROBLEMS.find((p) => p.feature === k)?.n} {moduleName(k)}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Break something <span className="ws-dim">· day {next}, both sides</span></h3>
        <p className="ws-dim">The apps are not told. They have to notice it from residents’ reports.</p>
        <div className="ws-tw-row">
          <select value={plant} onChange={(e) => setPlant(+e.target.value)} aria-label="Plant">
            {[0, 1, 2, 3, 4, 5].map((k) => <option key={k} value={k}>Plant {k + 1}</option>)}
          </select>
          <button type="button" className="ws-btn" disabled={day >= D} onClick={() => brk({ type: 'tripPlant', plant })}>Trip the plant</button>
        </div>
        <div className="ws-tw-row">
          <label className="ws-tw-lvl">Level <input type="number" min={1} max={50} value={level} onChange={(e) => setLevel(clampLevel(+e.target.value))} /></label>
          <button type="button" className="ws-btn" disabled={day >= D} onClick={() => brk({ type: 'breakRecycler', level })}>Break its recycler</button>
          <button type="button" className="ws-btn" disabled={day >= D} onClick={() => brk({ type: 'outbreak', level })}>Start an outbreak</button>
        </div>
        <div className="ws-tw-row">
          <button type="button" className="ws-btn" disabled={day >= D} onClick={() => brk({ type: 'cutNetwork', hours: 24 })}>Cut the network (24 h)</button>
        </div>
      </section>

      <section>
        <h3>Your changes</h3>
        {plan.length === 0 ? <p className="ws-dim">None. This is the standard test run.</p> : (
          <>
            <ol className="ws-tw-log">
              {plan.map((p, i) => (
                <li key={i}>Day {p.day}: {p.event ? describe(p.event) : p.report ? `report from level ${p.report.level}: “${p.report.text.slice(0, 40)}${p.report.text.length > 40 ? '…' : ''}”` : `apps on: ${BUILT.filter((k) => p.tools?.[k]).map(moduleName).join(', ') || 'none'}`}</li>
              ))}
            </ol>
            <button type="button" className="ws-btn" onClick={() => onPlan([])}>Undo all</button>
          </>
        )}
      </section>
    </div>
  );
}
