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
          <p className="pa-ask">Switch off <b>{Math.round(bw.shed * 100)}%</b> of non-essential power today. Air and fans stay on.</p>
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

function DefaultScreen({ alerts }: AppScreenProps) {
  return (<><h3>Alerts for your level</h3><AlertList alerts={alerts} /></>);
}

const Bolt = <svg viewBox="0 0 24 24" aria-hidden><path d="M13.2 2 5 13.4h5.6L9.8 22 19 10.2h-5.7z" fill="currentColor" /></svg>;
const Bubble = <svg viewBox="0 0 24 24" aria-hidden><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="currentColor" /><path d="M12 7v5M12 14.2v.3" stroke="#0b1622" strokeWidth="2.2" strokeLinecap="round" /></svg>;
const People = <svg viewBox="0 0 24 24" aria-hidden><g fill="currentColor"><circle cx="8.5" cy="8" r="3.2" /><circle cx="16.5" cy="9" r="2.6" /><path d="M2.5 19c.4-3.6 3-5.8 6-5.8s5.6 2.2 6 5.8z" /><path d="M14.6 13.6c.6-.2 1.2-.3 1.9-.3 2.6 0 4.6 1.9 5 5.7h-5.3c-.2-2.2-.8-4-1.6-5.4z" /></g></svg>;
const Grid = <svg viewBox="0 0 24 24" aria-hidden><g fill="currentColor"><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></g></svg>;

/** Modules with their own icon and screen. */
const CUSTOM: Partial<Record<ToolKey, Omit<AppDef, 'key' | 'name' | 'module'>>> = {
  earlyWarning: { short: 'Blackout', glyph: Bolt, colors: ['#ffd36b', '#f08a24'], Screen: BlackoutWarningScreen },
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
