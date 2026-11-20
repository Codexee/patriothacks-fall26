// The resident's phone: status bar, home screen of apps, an open app, notification banners and badges.
// Everything shown comes from the system's own outputs and log (never the test world's hidden state).
// Spec: .plans/phone-apps-spec.md.
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { ToolSet } from '../../sim/types.ts';
import type { Run } from '../../product/run.ts';
import { APPS, alertsFor, type Alert, type AppDef } from './apps.tsx';
import './phone.css';

export interface PhoneProps {
  run: Run;
  modules: ToolSet;
  hour: number;
  playing: boolean;
  section: { level: number; col: number };
  onPickSection: (s: { level: number; col: number }) => void;
  homeLocked: boolean;
  onToggleLock: () => void;
  onReport: (level: number, col: number, text: string) => void;
  queuedReports: number;
  locked: boolean;
  darkNow?: boolean[];
}

const sig = (a: Alert) => `${a.action}:${a.from}-${a.to}`;
const clock = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

export function Phone(p: PhoneProps) {
  const { run, section } = p;
  const day = run.sim.day;
  const [open, setOpen] = useState<string | null>(null);
  const [origin, setOrigin] = useState({ x: 50, y: 30 });
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [banner, setBanner] = useState<{ app: AppDef; alert: Alert; key: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const prev = useRef<{ day: number; alerts: Alert[] }>({ day, alerts: [] });
  const screenRef = useRef<HTMLDivElement>(null);

  const perApp = APPS.map((app) => ({ app, alerts: alertsFor(app, run, section.level) }));
  const openApp = perApp.find((x) => x.app.key === open) ?? null;

  // A new day: show a banner when an alert for your level is new, or the save-power ask went up. Reset clears all.
  useEffect(() => {
    if (day === 0) { setSeen(new Set()); setBanner(null); prev.current = { day, alerts: [] }; return; }
    if (prev.current.day === day) return;
    const before = prev.current.alerts;
    const today = perApp.flatMap((x) => x.alerts.map((alert) => ({ app: x.app, alert })));
    const fresh = today.find(({ alert }) => {
      const old = before.find((b) => sig(b) === sig(alert));
      if (!old) return true;
      return alert.action === 'shed' && (alert.amount ?? 0) > (old.amount ?? 0) + 0.005;
    });
    prev.current = { day, alerts: today.map((x) => x.alert) };
    if (fresh && fresh.app.key !== open) setBanner({ ...fresh, key: day });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4500);
    return () => clearTimeout(t);
  }, [banner]);

  // An open app reads its alerts, so they never count as unread.
  useEffect(() => {
    if (!openApp || openApp.alerts.every((a) => seen.has(a.id))) return;
    setSeen((s) => new Set([...s, ...openApp.alerts.map((a) => a.id)]));
  }, [openApp, seen]);

  const launch = (key: string, from?: Element | null) => {
    const scr = screenRef.current?.getBoundingClientRect();
    const r = from?.getBoundingClientRect();
    if (scr && r) setOrigin({ x: ((r.left + r.width / 2 - scr.left) / scr.width) * 100, y: ((r.top + r.height / 2 - scr.top) / scr.height) * 100 });
    else setOrigin({ x: 50, y: 8 });
    setBanner(null);
    setSheet(false);
    setOpen(key);
  };

  const shown = p.playing ? p.hour : 7; // between days, the phone shows the morning, when the alerts arrive

  return (
    <div className="ph" role="region" aria-label="A resident's phone">
      <div className="ph-body">
        <div className="ph-screen" ref={screenRef}>
          <div className="ph-status">
            <span className="ph-time">{clock(shown)}</span>
            <span className="ph-notch" aria-hidden />
            <span className="ph-right">
              <button type="button" className={`ph-chip ${p.homeLocked ? 'on' : ''}`} onClick={() => setSheet((v) => !v)}
                aria-label={`Home: level ${section.level}, section ${section.col + 1}${p.homeLocked ? ', locked' : ''}. Change`}>
                L{section.level}·S{section.col + 1}
                {p.homeLocked && <svg viewBox="0 0 12 12" aria-hidden><path d="M3.5 5V3.8a2.5 2.5 0 0 1 5 0V5" fill="none" stroke="currentColor" strokeWidth="1.3" /><rect x="2.5" y="5" width="7" height="5" rx="1" fill="currentColor" /></svg>}
              </button>
              <svg className="ph-sig" viewBox="0 0 16 10" aria-hidden><g fill="currentColor"><rect x="0" y="7" width="3" height="3" rx="0.6" /><rect x="4.3" y="5" width="3" height="5" rx="0.6" /><rect x="8.6" y="2.5" width="3" height="7.5" rx="0.6" /><rect x="12.9" y="0" width="3" height="10" rx="0.6" opacity="0.4" /></g></svg>
              <svg className="ph-bat" viewBox="0 0 22 10" aria-hidden><rect x="0.5" y="0.5" width="18" height="9" rx="2.5" fill="none" stroke="currentColor" opacity="0.5" /><rect x="2" y="2" width="12" height="6" rx="1.3" fill="currentColor" /><rect x="19.5" y="3.3" width="1.6" height="3.4" rx="0.8" fill="currentColor" opacity="0.5" /></svg>
            </span>
          </div>

          {banner && (
            <button type="button" key={banner.key} className={`ph-banner ${banner.alert.action}`} onClick={() => launch(banner.app.key)}>
              <span className="ph-icon sm" style={{ '--c1': banner.app.colors[0], '--c2': banner.app.colors[1] } as CSSProperties}>{banner.app.glyph}</span>
              <span className="ph-bn-text">
                <span className="ph-bn-top"><b>{banner.app.name}</b><span>now</span></span>
                <span className="ph-bn-msg">{banner.alert.text}</span>
              </span>
            </button>
          )}

          <div className={`ph-home ${open ? 'behind' : ''}`} aria-hidden={!!open}>
            <p className="ph-date"><span>Day {day}</span>Level {section.level}, section {section.col + 1}</p>
            <ul className="ph-grid">
              {perApp.map(({ app, alerts }) => {
                const unread = alerts.filter((a) => !seen.has(a.id)).length;
                return (
                  <li key={app.key}>
                    <button type="button" className="ph-app" tabIndex={open ? -1 : 0} onClick={(e) => launch(app.key, e.currentTarget.querySelector<HTMLElement>('.ph-icon'))}
                      aria-label={`${app.name}${unread ? `, ${unread} new alert${unread === 1 ? '' : 's'}` : ''}`}>
                      <span className={`ph-icon ${unread ? 'ring' : ''}`} style={{ '--c1': app.colors[0], '--c2': app.colors[1] } as CSSProperties}>
                        {app.glyph}
                        {unread > 0 && <span className="ph-badge" key={`${day}-${unread}`}>{unread}</span>}
                      </span>
                      <span className="ph-label">{app.short}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="ph-more">More apps arrive as more of the 15 problems are solved.</p>
          </div>

          {openApp && (
            <section key={openApp.app.key} className="ph-app-view" style={{ transformOrigin: `${origin.x}% ${origin.y}%` }} aria-label={openApp.app.name}>
              <header className="pa-head">
                <button type="button" className="pa-back" onClick={() => setOpen(null)}>‹ Home</button>
                <span className="ph-icon xs" style={{ '--c1': openApp.app.colors[0], '--c2': openApp.app.colors[1] } as CSSProperties}>{openApp.app.glyph}</span>
                <h2>{openApp.app.name}</h2>
              </header>
              <div className="pa-body">
                <openApp.app.Screen run={run} modules={p.modules} section={section} alerts={openApp.alerts}
                  onReport={p.onReport} queuedReports={p.queuedReports} locked={p.locked} darkNow={p.darkNow} />
              </div>
            </section>
          )}

          {sheet && (
            <div className="ph-sheet-wrap" onClick={(e) => { if (e.target === e.currentTarget) setSheet(false); }}>
              <div className="ph-sheet" role="dialog" aria-label="Your home">
                <span className="ph-grab" aria-hidden />
                <h3>Your home</h3>
                <div className="ph-sheet-row">
                  <label>Level
                    <input type="number" min={1} max={50} value={section.level}
                      onChange={(e) => p.onPickSection({ level: Math.min(50, Math.max(1, +e.target.value || 1)), col: section.col })} />
                  </label>
                  <label>Section
                    <input type="number" min={1} max={8} value={section.col + 1}
                      onChange={(e) => p.onPickSection({ level: section.level, col: Math.min(7, Math.max(0, (+e.target.value || 1) - 1)) })} />
                  </label>
                </div>
                <button type="button" className={`ph-lock ${p.homeLocked ? 'on' : ''}`} onClick={p.onToggleLock} aria-pressed={p.homeLocked}>
                  {p.homeLocked ? 'Locked: hovering the cutaway does not move your home' : 'Unlocked: hovering the cutaway moves your home'}
                </button>
                <button type="button" className="ph-done" onClick={() => setSheet(false)}>Done</button>
              </div>
            </div>
          )}

          <button type="button" className="ph-homebar" onClick={() => { setOpen(null); setSheet(false); }} aria-label="Go to the home screen" disabled={!open && !sheet} />
        </div>
      </div>
    </div>
  );
}
