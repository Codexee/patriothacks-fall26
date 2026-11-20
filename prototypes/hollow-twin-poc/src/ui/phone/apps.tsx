// The resident's phone: one app per built module (BUILT in product/names.ts), plus the Report app.
// To give a new module its own screen and icon, add an entry to CUSTOM below. A module with no entry still gets an
// app: the default icon, and a screen that lists its alerts for your level. Spec: .plans/phone-apps-spec.md.
import { type ReactNode, useEffect, useState } from 'react';
import { SECTIONS_PER_LEVEL, type Output, type ToolKey, type ToolSet } from '../../sim/types.ts';
import { SILENT } from '../../product/familyCheckIn.ts';
import type { Run } from '../../product/run.ts';
import { BUILT, moduleName } from '../../product/names.ts';

export type Alert = Extract<Output, { kind: 'alert' }>;

export interface AppScreenProps {
  run: Run;
  modules: ToolSet;
  section: { level: number; col: number };
  alerts: Alert[]; // this app's alerts for your level today
  /** Per section: dark right now, from residents' live outage reports (the hour on screen; between days, the last hour). */
  darkNow?: boolean[];
  onReport: (level: number, col: number, text: string) => void;
  queuedReports: number;
  locked: boolean;
}

export interface AppDef {
  key: string;
  name: string;
  short: string; // the label under the icon
  glyph: ReactNode;
  colors: [string, string]; // icon gradient, top to bottom
  module: ToolKey | null; // null for apps that are not modules (Report)
  Screen: (p: AppScreenProps) => ReactNode;
  /** Optional: this app's own notices (badge and banner) instead of the module's alerts for your level. */
  notices?: (run: Run) => Alert[];
}

const clock = (h: number) => `${String(h).padStart(2, '0')}:00`;

function Evidence({ items }: { items: string[] }) {
  return (
    <details className="evidence">
      <summary>Why? ({items.length})</summary>
      <ul>{items.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </details>
  );
}

function AlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return <p className="muted">No alerts today.</p>;
  return (
    <ul className="alerts">
      {alerts.map((a) => (
        <li key={a.id} className={`alert ${a.action}`}>
          <span className="tag">{a.action === 'prepare' ? 'Blackout coming' : a.action === 'shed' ? 'Save power' : a.action}</span>
          <span>{a.text}</span>
          <Evidence items={a.evidence} />
        </li>
      ))}
    </ul>
  );
}

function BlackoutWarningScreen({ run, modules, section, alerts }: AppScreenProps) {
  if (!modules.earlyWarning) {
    return <p className="phone-empty">Blackout Warning is off. Like everyone in the Hollow today, you find out about a blackout when the lights go out.</p>;
  }
  const bw = run.log?.blackoutWarning;
  const mine = bw?.blackouts.find((b) => section.level >= b.from && section.level <= b.to) ?? null;
  return (
    <>
      <section className="pa-hero">
        <h3>Next blackout on level {section.level}</h3>
        {bw?.firstDay ? (
          <p className="big-line bad">Possible today, most likely {clock(bw.firstDay.from)}–{clock(bw.firstDay.to % 24)}.</p>
        ) : mine ? (
          <p className="big-line bad">Today from about {clock(mine.startClock)}, lasting about {mine.hours} h.</p>
        ) : bw ? (
          <p className="big-line good">None expected today.</p>
        ) : <p className="muted">Gathering data. The first forecast comes tomorrow.</p>}
        {bw && bw.shed > 0 && (
          <p className="pa-ask">Switch off <b>{Math.round((run.log?.fairShare?.amount[section.level - 1] ?? bw.shed) * 100)}%</b> of non-essential power today{run.log?.fairShare ? ' (your level’s fair share)' : ''}. Air and fans stay on.</p>
        )}
      </section>
      <h3>Alerts for your level</h3>
      <AlertList alerts={alerts} />
    </>
  );
}

function ReportScreen({ run, section, onReport, queuedReports, locked }: AppScreenProps) {
  const [text, setText] = useState('');
  const day = run.sim.day;
  useEffect(() => { setText(''); }, [day]); // a new day starts with an empty report box (also after Reset)
  return (
    <>
      <p className="muted small">Optional. Residents report outages on their own; your report joins tomorrow's data.</p>
      <form className="report" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onReport(section.level, section.col, text.trim()); setText(''); } }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="Report text"
          placeholder={`Describe what is happening on level ${section.level}`} />
        <button type="submit" disabled={locked || !text.trim()}>Send report</button>
      </form>
      {queuedReports > 0 && <p className="muted small">{queuedReports} report(s) queued for tomorrow's data.</p>}
    </>
  );
}

// ---------- Family Check-In (problem #8) ----------
// A sample family on other levels. Each relative's status comes from the sim's check-ins for their section
// (SIMULATED), read the same way the module reads them.
const RELATIVES = [
  { name: 'Mom', level: 44, col: 5 },
  { name: 'Brother', level: 12, col: 2 },
  { name: 'Aunt', level: 50, col: 1 },
];
type RelStatus = { tone: 'ok' | 'relayed' | 'silent' | 'none' | 'wait'; label: string; detail: string };

function relativeStatus(run: Run, r: (typeof RELATIVES)[number], darkNow?: boolean[]): RelStatus {
  const i = (r.level - 1) * SECTIONS_PER_LEVEL + r.col;
  const m = run.memory;
  // While their level is dark, nothing is shown: the family's status appears once the power is back.
  if (darkNow ? darkNow[i] : m.outDark[i]) return { tone: 'wait', label: 'Waiting', detail: `Level ${r.level} is in a blackout. Their status shows here once the power is back.` };
  const x = m.checkins?.[i];
  if (!x || x.day !== run.sim.day - 1 || x.expected <= 0) return { tone: 'none', label: 'No news yet', detail: 'Check-ins start after the first night.' };
  const dark = m.outDark[i];
  const share = x.received / x.expected;
  if (share >= SILENT) {
    return dark
      ? { tone: 'relayed', label: 'OK', detail: `Level ${r.level} was dark last night. Their check-in hopped phone to phone up to a level with power.` }
      : { tone: 'ok', label: 'OK', detail: `Checked in last night.` };
  }
  if (!dark) return { tone: 'silent', label: 'Few check-ins', detail: `Only ${Math.round(share * 100)}% of families on their section checked in.` };
  if (x.received === 0) return { tone: 'silent', label: 'No news', detail: `Level ${r.level} was dark and nothing got through. Check-ins wait until the power is back.` };
  const checked = run.log?.familyCheckIn?.checks.includes(i);
  return { tone: 'silent', label: 'Silent', detail: checked
    ? `Level ${r.level} was dark and their section went quiet. A household nearby that checked in OK was asked to knock on their door.`
    : `Level ${r.level} was dark and their section went quiet. No household nearby checked in OK, so no one could be sent.` };
}

function familyNotices(run: Run): Alert[] {
  if (!run.sim.tools.kin) return [];
  return RELATIVES.flatMap((r) => {
    const s = relativeStatus(run, r);
    if (s.tone !== 'silent') return [];
    return [{ kind: 'alert', id: `fam-${run.sim.day}-${r.level}`, module: 'kin', action: 'prepare', from: r.level, to: r.level, hours: 24,
      text: `${r.name} (level ${r.level}): ${s.label.toLowerCase()}. ${s.detail}`, evidence: [] } as Alert];
  });
}

function FamilyScreen({ run, modules, section, darkNow }: AppScreenProps) {
  const [sent, setSent] = useState<number | null>(null);
  const day = run.sim.day;
  if (!modules.kin) {
    return <p className="phone-empty">Family Check-In is off. When your relatives' level goes dark, its network goes with it, and you hear nothing until the power is back.</p>;
  }
  const m = run.memory;
  const me = (section.level - 1) * SECTIONS_PER_LEVEL + section.col;
  const myDark = m.outDark[me];
  let litAbove = false;
  for (let l = 1; l < section.level && !litAbove; l++) {
    let lit = 0;
    for (let c = 0; c < SECTIONS_PER_LEVEL; c++) if (!m.outDark[(l - 1) * SECTIONS_PER_LEVEL + c]) lit++;
    if (lit > SECTIONS_PER_LEVEL / 2) litAbove = true;
  }
  const fc = run.log?.familyCheckIn;
  return (
    <>
      <button type="button" className={`fam-ok ${sent === day ? 'done' : ''}`} onClick={() => setSent(day)}>
        {sent === day ? '✓ We’re OK: sent' : 'We’re OK'}
      </button>
      {sent === day && (
        <p className="muted small">{!myDark ? 'Sent to your family over the network.'
          : litAbove ? 'Your level is dark: your check-in hops phone to phone up to the first level with power, then goes out.'
            : 'The whole Hollow is dark: your check-in waits on your phone and goes out when the power comes back.'}</p>
      )}
      <h3>Your family <span className="sim-tag">SIMULATED</span></h3>
      <ul className="fam-list">
        {RELATIVES.map((r) => {
          const s = relativeStatus(run, r, darkNow);
          return (
            <li key={r.name} className={`fam-row ${s.tone}`}>
              <span className="fam-av" aria-hidden>{r.name[0]}</span>
              <span className="fam-main">
                <span className="fam-top"><b>{r.name}</b><span className="muted">Level {r.level}</span><span className={`fam-pill ${s.tone}`}>{s.label}</span></span>
                <span className="fam-detail">{s.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {fc && (
        <p className="muted small">Last night across the Hollow: {fc.received.toLocaleString('en-US')} of {fc.expected.toLocaleString('en-US')} families checked in, {fc.relayed.toLocaleString('en-US')} of them from dark levels. Neighbors were asked to check on {fc.checks.length} silent section{fc.checks.length === 1 ? '' : 's'}.</p>
      )}
    </>
  );
}

// ---------- Fair Share (problem #2) ----------
function FairShareScreen({ run, modules, section, alerts }: AppScreenProps) {
  if (!modules.fairShare) return <p className="phone-empty">Fair Share is off. Every level is asked for the same cut, even the levels that already lost their air.</p>;
  const fs = run.log?.fairShare;
  if (!fs) return <p className="muted">No power saving today, or no outage reports yet: nothing to share.</p>;
  const mine = fs.amount[section.level - 1];
  const darkH = Math.round(fs.darkShare[section.level - 1] * 24);
  return (
    <>
      <section className="pa-hero">
        <h3>Level {section.level}'s share today</h3>
        <p className="big-line">Switch off {Math.round(mine * 100)}%</p>
        <p className="muted small">Hollow-wide request: {Math.round(fs.request * 100)}%. {darkH > 0 ? `Your level was dark for about ${darkH} h yesterday, so you are asked for less.` : 'Your level kept its power yesterday, so you carry a little more.'}</p>
      </section>
      <h3>Every level today</h3>
      <div className="fs-bars" role="img" aria-label={`Requests by level, from ${Math.round(fs.top * 100)}% on level 1 to ${Math.round(fs.deep * 100)}% on level 50`}>
        {fs.amount.map((a, l) => (
          <span key={l} className={`fs-bar ${l === section.level - 1 ? 'me' : ''} ${fs.darkShare[l] > 0 ? 'dark' : ''}`} style={{ height: `${Math.max(4, a * 100)}%` }} title={`Level ${l + 1}: ${Math.round(a * 100)}%`} />
        ))}
      </div>
      <p className="fs-axis"><span>Level 1</span><span>Level 50</span></p>
      <h3>Alerts for your level</h3>
      <AlertList alerts={alerts} />
    </>
  );
}

// ---------- Off-Network Messaging (problem #7) ----------
function OffNetworkScreen({ run, modules, section }: AppScreenProps) {
  if (!modules.lantern) return <p className="phone-empty">Off-Network Messaging is off. If the Directorate cuts the network, the residents' alerts and check-ins reach no one.</p>;
  const on = run.log?.offNetwork;
  if (!on) return <p className="muted">Planning starts after the first day of reports.</p>;
  const me = (section.level - 1) * SECTIONS_PER_LEVEL + section.col;
  const down = on.networkDownHours > 0;
  return (
    <>
      <section className={`pa-hero ${down ? 'net-down' : ''}`}>
        <h3>Network</h3>
        <p className={`big-line ${down ? 'bad' : 'good'}`}>{down ? `Cut for ${on.networkDownHours} h yesterday` : 'Up'}</p>
        <p className="muted small">{down ? 'Alerts and check-ins went phone to phone over the mesh.' : 'If it is cut, messages go phone to phone. The plan below is ready before that happens.'}</p>
      </section>
      <h3>If the network is cut today</h3>
      <p>The phone mesh reaches <b>{Math.round(on.reachAfter * 100)}%</b> of sections ({Math.round(on.reachBefore * 100)}% without the council's {on.relays} battery relays).</p>
      <p className={on.reach[me] ? 'good' : 'bad'}>{on.reach[me] ? `Your home (level ${section.level}) is on the mesh.` : `Your home (level ${section.level}) is off the mesh: go to a lit section to send or receive.`}</p>
      <div className="mesh-map" role="img" aria-label={`Mesh coverage: ${Math.round(on.reachAfter * 100)}% of sections`}>
        {on.reach.map((r, i) => <span key={i} className={`mesh-cell ${r ? 'on' : ''} ${i === me ? 'me' : ''}`} />)}
      </div>
      <p className="fs-axis"><span>Level 1</span><span>Level 50</span></p>
    </>
  );
}

// ---------- Water Safety (problem #4) ----------
function WaterScreen({ run, modules, section, alerts }: AppScreenProps) {
  if (!modules.snow) return <p className="phone-empty">Water Safety is off. Nobody connects the stomach aches on your level to the recycler that serves it.</p>;
  const ws = run.log?.waterSafety;
  const boil = alerts.find((a) => a.action === 'boilWater');
  return (
    <>
      <section className={`pa-hero ${boil ? 'net-down' : ''}`}>
        <h3>Water on level {section.level}</h3>
        <p className={`big-line ${boil ? 'bad' : 'good'}`}>{boil ? 'Boil before drinking' : 'No warning'}</p>
        <p className="muted small">{boil ? boil.text : 'Report bad-tasting water or stomach sickness in the Report app: complaints are how the app finds a failing recycler.'}</p>
      </section>
      {ws && (
        <>
          <h3>Complaints around each recycler (2 days)</h3>
          <ul className="ws-list">
            {ws.rows.map((r) => (
              <li key={r.level} className={ws.suspects.includes(r.level) ? 'bad' : ''}>
                <span>Recycler L{r.level}</span>
                <span className="ws-bar"><i style={{ width: `${Math.min(100, (r.per1000 / Math.max(0.01, ws.typical * 4)) * 100)}%` }} /></span>
                <span>{r.reports}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {boil && <Evidence items={boil.evidence} />}
    </>
  );
}

// ---------- Food Sharing (problem #12) ----------
function FoodScreen({ run, modules, section }: AppScreenProps) {
  if (!modules.larder) return <p className="phone-empty">Food Sharing is off. A level cut off from its farms finds out it is hungry when the stores are empty.</p>;
  const fd = run.log?.foodSharing;
  const h = run.memory.runway?.[section.level - 1] ?? [];
  const mine = h.length ? h[h.length - 1] : null;
  const trend = h.length > 1 ? (h[h.length - 1] - h[0]) / (h.length - 1) : 0;
  const giving = fd?.transfers.filter((t) => t.from === section.level) ?? [];
  const getting = fd?.transfers.filter((t) => t.to === section.level) ?? [];
  return (
    <>
      <section className="pa-hero">
        <h3>Food on level {section.level}</h3>
        <p className={`big-line ${mine !== null && mine < 10 ? 'bad' : 'good'}`}>{mine === null ? 'No count yet' : `${mine.toFixed(1)} days in store`}</p>
        <p className="muted small">{mine === null ? 'The census counts food stores every day.' : trend < -0.05 ? `Falling about ${(-trend).toFixed(1)} days a day.` : 'Steady.'}</p>
      </section>
      {getting.map((t, i) => <p key={'g' + i} className="good">Delivery today: {t.days} days of food from level {t.from}.</p>)}
      {giving.map((t, i) => <p key={'v' + i} className="warn-text">Your level has a surplus: please carry {t.days} days of food to level {t.to} today.</p>)}
      {fd?.grow === section.level && <p className="good">A grow-lamp farm is being built on your level.</p>}
      {fd && (
        <>
          <h3>Lowest food stores</h3>
          <ul className="ws-list">
            {fd.lowest.map((r) => (
              <li key={r.level} className={r.runway < 10 ? 'bad' : ''}>
                <span>Level {r.level}</span>
                <span className="ws-bar"><i style={{ width: `${Math.min(100, (r.runway / 30) * 100)}%` }} /></span>
                <span>{r.runway.toFixed(0)} d</span>
              </li>
            ))}
          </ul>
          <p className="muted small">{fd.transfers.length ? `${fd.transfers.length} deliveries today` : 'No deliveries needed today'}{fd.grow ? `; a new farm on level ${fd.grow}` : ''}.</p>
        </>
      )}
    </>
  );
}

function DefaultScreen({ alerts }: AppScreenProps) {
  return (<><h3>Alerts for your level</h3><AlertList alerts={alerts} /></>);
}

const Bolt = <svg viewBox="0 0 24 24" aria-hidden><path d="M13.2 2 5 13.4h5.6L9.8 22 19 10.2h-5.7z" fill="currentColor" /></svg>;
const Bubble = <svg viewBox="0 0 24 24" aria-hidden><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="currentColor" /><path d="M12 7v5M12 14.2v.3" stroke="#0b1622" strokeWidth="2.2" strokeLinecap="round" /></svg>;
const People = <svg viewBox="0 0 24 24" aria-hidden><g fill="currentColor"><circle cx="8.5" cy="8" r="3.2" /><circle cx="16.5" cy="9" r="2.6" /><path d="M2.5 19c.4-3.6 3-5.8 6-5.8s5.6 2.2 6 5.8z" /><path d="M14.6 13.6c.6-.2 1.2-.3 1.9-.3 2.6 0 4.6 1.9 5 5.7h-5.3c-.2-2.2-.8-4-1.6-5.4z" /></g></svg>;
const Scale = <svg viewBox="0 0 24 24" aria-hidden><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M7 21h10M4 7h16" /><path d="M4 7l-2.5 6a3 3 0 0 0 5 0zM20 7l-2.5 6a3 3 0 0 0 5 0z" /></g></svg>;
const Antenna = <svg viewBox="0 0 24 24" aria-hidden><g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" /></g></svg>;
const Drop = <svg viewBox="0 0 24 24" aria-hidden><path d="M12 2.5c-3.6 4.6-6.5 8.3-6.5 11.8a6.5 6.5 0 0 0 13 0C18.5 10.8 15.6 7.1 12 2.5z" fill="currentColor" /></svg>;
const Sprout = <svg viewBox="0 0 24 24" aria-hidden><g fill="currentColor"><path d="M11 21v-8.5C11 8.4 7.9 5.5 3.5 5.5c0 4.3 3 7.4 7.5 7.4" /><path d="M13 21v-6.3c0-3.4 2.6-6 6.5-6 0 3.6-2.6 6.3-6.5 6.3" /><rect x="10.5" y="11" width="3" height="10.5" rx="1.2" /></g></svg>;
const Grid = <svg viewBox="0 0 24 24" aria-hidden><g fill="currentColor"><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></g></svg>;

/** Modules with their own icon and screen. */
const CUSTOM: Partial<Record<ToolKey, Omit<AppDef, 'key' | 'name' | 'module'>>> = {
  earlyWarning: { short: 'Blackout', glyph: Bolt, colors: ['#ffd36b', '#f08a24'], Screen: BlackoutWarningScreen },
  fairShare: { short: 'Fair Share', glyph: Scale, colors: ['#7ee0c3', '#1f9a7a'], Screen: FairShareScreen },
  snow: { short: 'Water', glyph: Drop, colors: ['#7fe3ff', '#1f86c9'], Screen: WaterScreen },
  lantern: { short: 'Mesh', glyph: Antenna, colors: ['#ffa7c4', '#d4467a'], Screen: OffNetworkScreen },
  larder: { short: 'Food', glyph: Sprout, colors: ['#c2f27a', '#5aa82a'], Screen: FoodScreen },
  kin: { short: 'Family', glyph: People, colors: ['#b9a2ff', '#6a4fe0'], Screen: FamilyScreen, notices: familyNotices },
};

const REPORT: AppDef = {
  key: 'report', name: 'Report a problem', short: 'Report', glyph: Bubble, colors: ['#8fd0ff', '#3a7bd5'], module: null, Screen: ReportScreen,
};

/** Every app on the home screen, in order: each built module, then Report. */
export const APPS: AppDef[] = [
  ...BUILT.map((k): AppDef => {
    const c = CUSTOM[k];
    return {
      key: k, name: moduleName(k), module: k,
      short: c?.short ?? moduleName(k).split(' ')[0],
      glyph: c?.glyph ?? Grid,
      colors: c?.colors ?? ['#9aa7ff', '#5b63d6'],
      Screen: c?.Screen ?? DefaultScreen,
      notices: c?.notices,
    };
  }),
  REPORT,
];

/** An app's notices: its own (for example Family), or the module's alerts for your level from what the system sent today. */
export function alertsFor(app: AppDef, run: Run, level: number): Alert[] {
  if (app.notices) return app.notices(run);
  if (!app.module) return [];
  return run.outputs.filter((o): o is Alert => o.kind === 'alert' && o.module === app.module && level >= o.from && level <= o.to);
}
