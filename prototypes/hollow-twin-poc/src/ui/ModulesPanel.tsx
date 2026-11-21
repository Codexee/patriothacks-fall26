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
  if (bw.firstDay) {
    return (
      <>
        <p>First day: no outage reports yet. Residents cannot see the plants, so nobody knows how much power they can make.</p>
        <p>Use is highest between <b>{clock(bw.firstDay.from)}</b> and <b>{clock(bw.firstDay.to % 24)}</b> today, most at about {clock(bw.firstDay.peakHour)} ({Math.round((bw.firstDay.peakMult - 1) * 100)}% above normal, public hourly grid data). Plants trip when they are pushed hardest, so the module <b className="warn-text">warned every level</b> that a blackout is most likely then.</p>
        <p className="muted">No power saving asked yet. From tomorrow, the outage reports show what the plants really made.</p>
      </>
    );
  }
  return (
    <>
      <p>Head count: the Directorate's census says <b>{fmt(bw.censusPeople)}</b>; residents counted <b>{fmt(bw.selfPeople)}</b> in the app
        {bw.selfPeople > bw.censusPeople * 1.01 && <> (<b className="bad">+{Math.round((bw.selfPeople / Math.max(1, bw.censusPeople) - 1) * 100)}%</b>, +{Math.round((bw.deepRatio - 1) * 100)}% on level 50)</>}. Power needs use the residents' count.</p>
      <p>Blackout line yesterday: {bw.lineWorst === null
        ? <b>no level lost power</b>
        : <>at {clock(bw.lineWorstHour)} only the top <b>{bw.lineWorst}</b> levels had power ({bw.trend < 0 ? `moving up ${-bw.trend} levels a day` : bw.trend > 0 ? `moving down ${bw.trend} levels a day` : 'not moving'})</>}.
        {bw.hollowDarkHours > 0 && <> The whole Hollow went dark for <b className="bad">{bw.hollowDarkHours} h</b> (plants tripped).</>}</p>
      {bw.supplyEstimate !== null && <p>So the plants made about <b>{fmt(bw.supplyEstimate)}</b> units at the worst hour, for a need of <b>{fmt(bw.demand)}</b>.</p>}
      {bw.shed > 0
        ? <p className="warn-text">{bw.eased ? `No blackouts for ${bw.quietDays} days in a row: eased the request by 5 points.` : bw.lineWorst === null && bw.hollowDarkHours === 0 ? `Quiet for ${bw.quietDays} day${bw.quietDays === 1 ? '' : 's'}: keeping the request (it eases by 5 points after every 5 quiet days in a row).` : 'Plants are running at their limit.'} Asked everyone to switch off {Math.round(bw.shed * 100)}% of non-essential load today.</p>
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

/** Problem #2: Fair Share. */
function FairShareCard({ run }: CardProps) {
  const fs = run.log?.fairShare;
  if (!fs) return <p className="muted">No power saving asked today (or no outage reports yet): nothing to share.</p>;
  const relieved = fs.darkShare.filter((d) => d > 0).length;
  return (
    <>
      <p>Blackout Warning asks for <b>{Math.round(fs.request * 100)}%</b> of non-essential load in total. Fair Share keeps that total and shares it by what each level lost yesterday.</p>
      <p>Level 1 is asked for <b>{Math.round(fs.top * 100)}%</b>, level 50 for <b>{Math.round(fs.deep * 100)}%</b>.{relieved > 0 ? <> <b>{relieved}</b> levels that were dark yesterday are asked for less.</> : ' No level was dark yesterday, so everyone is asked for the same.'}</p>
    </>
  );
}

/** Problem #4: Water Safety. */
function WaterSafetyCard({ run }: CardProps) {
  const ws = run.log?.waterSafety;
  if (!ws) return <p className="muted">Gathering data. Complaints are counted from the first day.</p>;
  return ws.suspects.length
    ? <p className="warn-text">Water complaints around the recycler{ws.suspects.length === 1 ? '' : 's'} on level {ws.suspects.join(', ')} are over 3 times the typical rate. Told those levels to boil their water{ws.crews ? `; sent ${ws.crews} repair crew${ws.crews === 1 ? '' : 's'}` : ' (a crew is already on it)'}.</p>
    : <p className="good">No recycler stands out: complaints are at the typical rate ({ws.typical.toFixed(2)} per 1,000 residents in 2 days).</p>;
}

/** Problem #3: Cooling. */
function CoolingCard({ run }: CardProps) {
  const co = run.log?.cooling;
  if (!co) return <p className="muted">Heat reports are counted from the first day.</p>;
  return (
    <>
      <p>{co.hot.length ? <>Overheating (heat reports per 1,000 in 2 days): {co.hot.map((h) => `L${h.level} (${h.per1000.toFixed(1)})`).join(', ')}.</> : 'No level is overheating.'}</p>
      <p>{co.moves.length ? <>Crews moved {co.moves.length} fan{co.moves.length === 1 ? '' : 's'} today: {co.moves.map((mv) => `L${mv.from} → L${mv.to}`).join(', ')}.</> : 'No fan moves today.'} {co.received} levels have received a fan so far.</p>
    </>
  );
}

/** Problem #9: Outbreak Tracker. */
function OutbreakCard({ run }: CardProps) {
  const ob = run.log?.outbreak;
  if (!ob) return <p className="muted">Cough reports are counted from the first day.</p>;
  return (
    <>
      <p>In 2 days residents reported <b>{fmt(ob.residentsCount)}</b> coughs; clinics saw <b>{fmt(ob.clinicCount)}</b> cases. The Directorate counts <b>{ob.official === null ? '—' : fmt(ob.official)}</b> sick.</p>
      {ob.hotspots.length ? <p className="warn-text">Hot spots: level {ob.hotspots.join(', ')}. Told them and the levels next to them to isolate the sick.</p> : <p className="good">No hot spot: coughs are at the typical rate.</p>}
    </>
  );
}

/** Problem #12: Food Sharing. */
function FoodSharingCard({ run }: CardProps) {
  const fd = run.log?.foodSharing;
  if (!fd) return <p className="muted">Gathering data. The census counts food stores every day.</p>;
  const low = fd.lowest[0];
  return (
    <>
      <p>Least food: level <b>{low?.level}</b> with <b>{low?.runway.toFixed(1)}</b> days in store. {fd.needy} level{fd.needy === 1 ? ' is' : 's are'} running out.</p>
      {fd.transfers.length ? <p className="warn-text">Asked for {fd.transfers.length} deliveries today: {fd.transfers.map((t) => `L${t.from} → L${t.to}`).join(', ')}.</p> : <p className="good">No deliveries needed today.</p>}
      {fd.grow && <p>Building a grow-lamp farm on level <b>{fd.grow}</b>.</p>}
    </>
  );
}

/** Problem #7: Off-Network Messaging. */
function OffNetworkCard({ run }: CardProps) {
  const on = run.log?.offNetwork;
  if (!on) return <p className="muted">Planning starts after the first day of reports.</p>;
  return (
    <>
      <p>{on.networkDownHours > 0 ? <><b className="bad">The network was cut for {on.networkDownHours} h yesterday.</b> Alerts and check-ins went over the phone mesh.</> : 'The network was up yesterday.'}</p>
      <p>Placed <b>{on.relays}</b> battery relays. If the network is cut today, the mesh reaches <b>{Math.round(on.reachAfter * 100)}%</b> of sections ({Math.round(on.reachBefore * 100)}% without them). {on.darkSections} sections were dark at the end of yesterday and cannot charge phones.</p>
    </>
  );
}

/** Problem #8: Family Check-In. */
function FamilyCheckInCard({ run }: CardProps) {
  const fc = run.log?.familyCheckIn;
  if (!fc) return <p className="muted">Gathering data. The first check-ins arrive after the first night.</p>;
  const levels = [...new Set(fc.checks.map((i) => Math.floor(i / 8) + 1))].sort((a, b) => a - b);
  return (
    <>
      <p>Last night <b>{fmt(fc.received)}</b> of <b>{fmt(fc.expected)}</b> split families checked in{fc.noNews > 0 && <> (<b className="bad">{fmt(fc.noNews)}</b> with no news)</>}.</p>
      <p>{fc.darkSections > 0
        ? <><b>{fc.darkSections}</b> sections were dark at the end of the day. <b>{fmt(fc.relayed)}</b> check-ins from them hopped phone to phone up to a level with power.</>
        : 'No section was dark at the end of the day.'}</p>
      {fc.silent.length > 0
        ? <p className="warn-text">{fc.silent.length} dark section{fc.silent.length === 1 ? '' : 's'} went silent (under 70% checked in). Neighbors who checked in OK were asked to knock on {fc.checks.length}{levels.length > 0 && <> (levels {levels.slice(0, 10).join(', ')}{levels.length > 10 ? '…' : ''})</>}.</p>
        : <p className="good">No dark section went silent.</p>}
    </>
  );
}

/** Each built module: its card, and what its info icon explains. */
const MODULE_CARDS: Partial<Record<ToolKey, { card: (p: CardProps) => ReactNode; about: string }>> = {
  fairShare: {
    card: FairShareCard,
    about: "Blackout Warning asks every level for the same cut. Fair Share keeps the same total saving, so the plants are protected just as much, but shares it by what each level lost yesterday (from outage reports): a level dark all day is asked for 40% of what a level that kept power is asked for. Residents do this themselves; it does not assume any control of the Directorate's power dispatch. The 40% is a design choice, not a measured number.",
  },
  snow: {
    card: WaterSafetyCard,
    about: "After John Snow's 1854 cholera map. The app counts residents' reports of bad water per 1,000 residents around each recycler the census lists, over 2 days. A recycler whose levels complain at 3 times the typical rate (and at least 6 reports) is the likely source: those levels are told to boil their water, and the residents' repair crew is sent (again after 4 days if complaints continue). Assumption: a recycler serves its own level and 2 levels above and below. No sensors or tap meters. In the test world a recycler starts failing on level 38, and recyclers without power make worse water.",
  },
  layout: {
    card: CoolingCard,
    about: "The deep levels are closer to hot rock, and cooling runs on power, so blackouts and power saving make them hotter. Above a wet-bulb of 31 °C people start to die (Vecellio et al. 2022). The app counts residents' 'too hot' reports per 1,000 residents by level (2 days), and sends crews to move a fan from a level with no heat reports to the hottest level, at most 2 a day. No temperature sensors. Thresholds are design choices.",
  },
  ledger: {
    card: OutbreakCard,
    about: "A lung sickness spreads faster in crowded and dark (unventilated) sections and is deadlier far from a clinic. The app puts residents' cough reports and clinic counts side by side per level, next to the Directorate's public number. Levels where coughs run at 3 times the typical rate (and at least 8 reports) and the levels next to them are told to isolate the sick. Thresholds are design choices.",
  },
  larder: {
    card: FoodSharingCard,
    about: "Section councils count the days of food in store every day (census). The app follows each level's count and how fast it falls. A level under 18 days and falling, or under 10 days, gets deliveries from levels with over 20 days and not falling (residents carry them, up to 3 a day), and the level that would run out first gets a grow-lamp farm. These thresholds are design choices, not measured values. In the test world the Directorate diverts the farms of levels 40–50 to the upper levels on day 12.",
  },
  lantern: {
    card: OffNetworkCard,
    about: "The brief says the Directorate controls the network and can shut it down. When it does, residents' phones still pass messages to phones in neighboring sections (on a level, and up and down the stairwell), but only where they can charge: dark sections (from outage reports) cannot relay. Every day, before any shutdown, the app places the council's battery relays where the mesh would break, so it still reaches every level from the council's base. Assumptions: phones in neighboring sections can reach each other; the council owns 40 relays (a guess). The brief gives no shutdown schedule, so the published results have no shutdowns: cut the network from the Test World panel to see it.",
  },
  kin: {
    card: FamilyCheckInCard,
    about: "Households tap 'We're OK' in the app. A dark level's network relay has no power, so without the app its families go unheard until the power is back. With the app, check-ins hop phone to phone up to the first level with power (assumption: phones on adjacent levels can reach each other); if the whole Hollow is dark, they wait. A dark section where under 70% of families checked in counts as silent, and a household nearby that checked in OK is asked to knock on their door. In the test world that cuts deaths there by 25% for a day: a guess, no study gives this number. Families split across levels: one per 40 residents (also a guess).",
  },
  earlyWarning: {
    card: BlackoutWarningCard,
    about: "Power goes to the upper levels first, so the line where residents report blackouts shows how much power the plants make. Yesterday's line, and how it moved since the day before, predicts today's. Power needs come from residents' own head count. No plant meters, no forecast. On day 1, before any reports, it warns every level of the busiest hours, when a blackout is most likely; it makes no guess about the plants. The power-saving request keeps the plants under 82% of their output; after 5 quiet days in a row it eases by 5 points. In the test world, air harm starts at 5,000 ppm CO₂, the OSHA and NIOSH workplace limit (NIOSH Pocket Guide). How many residents follow an alert, and how much a warning saves, are still first guesses: no study gives comparable numbers.",
  },
};

export interface ModulesPanelProps {
  run: Run;
  running: ToolSet; // modules running in the Hollow today
  pending: ToolSet; // the choice for the next day
  locked: boolean;
  onToggleModule: (k: ToolKey) => void;
  onReset: () => void;
  open: boolean;
  onToggle: () => void;
}

/** The solution modules: switch each one on or off, and see what it worked out today. Minimizes to a slim strip. */
export function ModulesPanel(p: ModulesPanelProps) {
  const [collapsed, setCollapsed] = useState<Partial<Record<ToolKey, boolean>>>({});
  const changed = BUILT.some((k) => p.pending[k] !== p.running[k]);
  const solved = PROBLEMS.filter((pr) => pr.feature && BUILT.includes(pr.feature)).length;

  if (!p.open) {
    return (
      <aside className="modules min" aria-label="Solution modules (minimized)">
        <button className="mod-expand" onClick={p.onToggle} title="Open the Modules panel (M)" aria-label="Open the Modules panel">
          <span aria-hidden>‹</span>
          <span className="mod-tab-label">Modules</span>
        </button>
        <div className="mod-chips">
          {BUILT.map((k) => {
            const pr = PROBLEMS.find((x) => x.feature === k);
            return (
              <button key={k} className={`mod-chip ${p.pending[k] ? 'on' : ''}`} aria-pressed={p.pending[k]} disabled={p.locked}
                onClick={() => p.onToggleModule(k)}
                title={`${moduleName(k)}: ${p.pending[k] ? 'on' : 'off'}${p.pending[k] !== p.running[k] ? ' (from next day)' : ''}. Click to switch.`}>
                <span className="dot" aria-hidden />#{pr?.n ?? '?'}
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside className="modules" aria-label="Solution modules">
      <header className="mods-head">
        <h1>Solution modules <Info label="About the solution modules">The features of the Residents' System, one per Hollow problem. Switch each one on or off here; the change applies from the next day, and Reset starts the Hollow over with your choice. Each card shows what the module worked out from today's data.</Info></h1>
        <button className="ghost" onClick={p.onToggle} title="Minimize (M)">Minimize</button>
      </header>
      <p className="mods-progress">{solved} of 15 Hollow problems solved</p>
      {changed && (
        <p className="mods-pending">Your changes apply from the next day. <button onClick={p.onReset} disabled={p.locked}>Reset to start over with them</button></p>
      )}
      {BUILT.map((k) => {
        const def = MODULE_CARDS[k];
        const pr = PROBLEMS.find((x) => x.feature === k);
        const on = p.running[k], next = p.pending[k];
        const shut = collapsed[k] ?? false;
        return (
          <section key={k} className={`mod-card ${on ? 'on' : 'off'}`}>
            <header className="mc-head">
              <button className="mc-toggle" aria-expanded={!shut} onClick={() => setCollapsed((c) => ({ ...c, [k]: !shut }))}>
                <span className="mc-caret" aria-hidden>{shut ? '▸' : '▾'}</span>
                <span className="mc-title">{moduleName(k)}</span>
                {pr && <span className="mc-num" title={pr.title}>#{pr.n}</span>}
              </button>
              {def && <Info label={`How ${moduleName(k)} works`}>{def.about}</Info>}
              <button className={`switch ${next ? 'on' : ''}`} role="switch" aria-checked={next} disabled={p.locked}
                onClick={() => p.onToggleModule(k)} title={`${moduleName(k)} ${next ? 'on' : 'off'} (S switches all)`}>
                <span className="knob" aria-hidden />{next ? 'On' : 'Off'}
              </button>
            </header>
            {pr && <p className="mc-problem">{pr.title}</p>}
            {!shut && (
              <div className="mc-body">
                {!on ? <p className="muted">{next ? 'Starts tomorrow, or press Reset to run the Hollow with it from day 0.' : 'Off. Switch it on to run the Hollow with it.'}</p>
                  : def ? def.card({ run: p.run }) : <p className="muted">No view for this module yet.</p>}
              </div>
            )}
          </section>
        );
      })}
      {p.run.log?.seen && (
        <p className="muted small mods-data">Data received today: {Object.entries(p.run.log.seen).map(([key, v]) => `${v} ${key}`).join(', ')}</p>
      )}
      <p className="muted small mods-next">More modules arrive as more of the 15 problems are solved.</p>
    </aside>
  );
}
