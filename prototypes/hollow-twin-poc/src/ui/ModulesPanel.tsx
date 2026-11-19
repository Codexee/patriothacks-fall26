// UI branch: the Modules panel. One card per feature of the Residents' System, with what it worked out today. It can be
// minimized to a slim tab. To add a module as more problems are solved: build it in src/product/, add its key to
// BUILT (product/names.ts), and add a card component to MODULE_CARDS below.
import { type ReactNode, useState } from 'react';
import type { ToolKey, ToolSet } from '../sim/types.ts';
import type { Run } from '../product/run.ts';
import { BUILT, PROBLEMS, moduleName } from '../product/names.ts';
import { Info } from './Info.tsx';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const clock = (h: number) => `${String(h).padStart(2, '0')}:00`;

interface CardProps { run: Run }

/** Problem #1: Blackout Warning. */
function BlackoutWarningCard({ run }: CardProps) {
  const bw = run.log?.blackoutWarning;
  if (!bw) return <p className="muted">Gathering data. The first forecast comes after the first day.</p>;
  return (
    <>
      <p>Head count: the Directorate's census says <b>{fmt(bw.censusPeople)}</b>; residents counted <b>{fmt(bw.selfPeople)}</b> in the app
        {bw.selfPeople > bw.censusPeople && <> (<b className="bad">+{Math.round((bw.selfPeople / Math.max(1, bw.censusPeople) - 1) * 100)}%</b>, +{Math.round((bw.deepRatio - 1) * 100)}% on level 50)</>}. Power needs use the residents' count.</p>
      <p>Blackout line yesterday: {bw.lineWorst === null
        ? <b>no level lost power</b>
        : <>at {clock(bw.lineWorstHour)} only the top <b>{bw.lineWorst}</b> levels had power ({bw.trend < 0 ? `moving up ${-bw.trend} levels a day` : bw.trend > 0 ? `moving down ${bw.trend} levels a day` : 'not moving'})</>}.
        {bw.hollowDarkHours > 0 && <> The whole Hollow went dark for <b className="bad">{bw.hollowDarkHours} h</b> (plants tripped).</>}</p>
      {bw.supplyEstimate !== null && <p>So the plants made about <b>{fmt(bw.supplyEstimate)}</b> units at the worst hour, for a need of <b>{fmt(bw.demand)}</b>.</p>}
      {bw.shed > 0
        ? <p className="warn-text">{bw.lineWorst === null && bw.hollowDarkHours === 0 ? 'Keeping the request (residents cannot see the plants, so a quiet day is no proof the power is back):' : 'Plants are running at their limit.'} Asked everyone to switch off {Math.round(bw.shed * 100)}% of non-essential load today.</p>
        : <p className="good">No blackouts yesterday: no power saving needed.</p>}
      <h4>Blackouts predicted (today)</h4>
      {bw.blackouts.length === 0 ? <p className="muted">None.</p> : (
        <table className="bo-table">
          <thead><tr><th>Levels</th><th>Starts</th><th>Lasts</th></tr></thead>
          <tbody>
            {bw.blackouts.map((b) => (
              <tr key={b.from}><td>{b.from === b.to ? b.from : `${b.from}–${b.to}`}</td><td>about {clock(b.startClock)}</td><td>{b.hours} h</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {bw.darkNow.length > 0 && <p className="small bad">Still without power at the end of yesterday (outage reports): levels {bw.darkNow.join(', ')}</p>}
    </>
  );
}

/** Each built module: its card, and what its info icon explains. */
const MODULE_CARDS: Partial<Record<ToolKey, { card: (p: CardProps) => ReactNode; about: string }>> = {
  earlyWarning: {
    card: BlackoutWarningCard,
    about: "Power goes to the upper levels first, so the line where residents report blackouts shows how much power the plants make. Yesterday's line, and how it moved since the day before, predicts today's. Power needs come from residents' own head count. No plant meters, no forecast.",
  },
};

export function ModulesPanel({ run, modules, open, onToggle }: { run: Run; modules: ToolSet; open: boolean; onToggle: () => void }) {
  const [collapsed, setCollapsed] = useState<Partial<Record<ToolKey, boolean>>>({});
  const onCount = BUILT.filter((k) => modules[k]).length;
  if (!open) {
    return (
      <aside className="modules min" aria-label="Modules (minimized)">
        <button className="mod-tab" onClick={onToggle} title="Open the Modules panel (M)" aria-label="Open the Modules panel">
          <span className="mod-tab-count">{onCount}/{BUILT.length}</span>
          <span className="mod-tab-label">Modules</span>
        </button>
      </aside>
    );
  }
  return (
    <aside className="modules" aria-label="Modules">
      <header className="mods-head">
        <h1>Modules <Info label="About the modules">The features of the Residents' System, one per Hollow problem. Each card shows what the module worked out from today's data. Turn modules on or off in the demo bar or the Test World panel.</Info></h1>
        <button className="ghost" onClick={onToggle} title="Minimize (M)">Minimize</button>
      </header>
      {BUILT.map((k) => {
        const def = MODULE_CARDS[k];
        const pr = PROBLEMS.find((x) => x.feature === k);
        const on = modules[k];
        const shut = collapsed[k] ?? false;
        return (
          <section key={k} className={`mod-card ${on ? 'on' : 'off'}`}>
            <header className="mc-head">
              <button className="mc-toggle" aria-expanded={!shut} onClick={() => setCollapsed((c) => ({ ...c, [k]: !shut }))}>
                <span className="mc-caret" aria-hidden>{shut ? '▸' : '▾'}</span>
                <span className="mc-title">{moduleName(k)}</span>
              </button>
              {pr && <span className="mc-num" title={pr.title}>#{pr.n}</span>}
              {def && <Info label={`How ${moduleName(k)} works`}>{def.about}</Info>}
              <span className={`mc-state ${on ? 'on' : ''}`}>{on ? 'On' : 'Off'}</span>
            </header>
            {!shut && (
              <div className="mc-body">
                {!on ? <p className="muted">Off. Turn it on (S, or the switch in the demo bar) and press Reset to run the Hollow with it.</p>
                  : def ? def.card({ run }) : <p className="muted">No view for this module yet.</p>}
              </div>
            )}
          </section>
        );
      })}
      {run.log?.seen && (
        <p className="muted small mods-data">Data received today: {Object.entries(run.log.seen).map(([key, v]) => `${v} ${key}`).join(', ')}</p>
      )}
      <p className="muted small mods-next">More modules arrive as more of the 15 problems are solved.</p>
    </aside>
  );
}
