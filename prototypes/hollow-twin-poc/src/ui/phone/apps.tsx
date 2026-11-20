// The resident's phone: one app per built module (BUILT in product/names.ts), plus the Report app.
// To give a new module its own screen and icon, add an entry to CUSTOM below. A module with no entry still gets an
// app: the default icon, and a screen that lists its alerts for your level. Spec: .plans/phone-apps-spec.md.
import { type ReactNode, useEffect, useState } from 'react';
import type { Output, ToolKey, ToolSet } from '../../sim/types.ts';
import type { Run } from '../../product/run.ts';
import { BUILT, moduleName } from '../../product/names.ts';

export type Alert = Extract<Output, { kind: 'alert' }>;

export interface AppScreenProps {
  run: Run;
  modules: ToolSet;
  section: { level: number; col: number };
  alerts: Alert[]; // this app's alerts for your level today
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
        {mine ? (
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

function DefaultScreen({ alerts }: AppScreenProps) {
  return (<><h3>Alerts for your level</h3><AlertList alerts={alerts} /></>);
}

const Bolt = <svg viewBox="0 0 24 24" aria-hidden><path d="M13.2 2 5 13.4h5.6L9.8 22 19 10.2h-5.7z" fill="currentColor" /></svg>;
const Bubble = <svg viewBox="0 0 24 24" aria-hidden><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="currentColor" /><path d="M12 7v5M12 14.2v.3" stroke="#0b1622" strokeWidth="2.2" strokeLinecap="round" /></svg>;
const Grid = <svg viewBox="0 0 24 24" aria-hidden><g fill="currentColor"><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></g></svg>;

/** Modules with their own icon and screen. */
const CUSTOM: Partial<Record<ToolKey, Omit<AppDef, 'key' | 'name' | 'module'>>> = {
  earlyWarning: { short: 'Blackout', glyph: Bolt, colors: ['#ffd36b', '#f08a24'], Screen: BlackoutWarningScreen },
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
    };
  }),
  REPORT,
];

/** An app's alerts for a level, from what the system sent today. */
export function alertsFor(app: AppDef, outputs: Output[], level: number): Alert[] {
  if (!app.module) return [];
  return outputs.filter((o): o is Alert => o.kind === 'alert' && o.module === app.module && level >= o.from && level <= o.to);
}
