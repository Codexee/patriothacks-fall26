// UI branch: demo controls that float over the cutaway while the Test World panel is minimized, plus the Compare card
// and the end-of-run banner. Everything here calls the same handlers as the full panel.
import type { SimState } from '../sim/types.ts';
import type { RunResult } from './compare.ts';
import { Info } from './Info.tsx';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export interface DemoBarProps {
  state: SimState;
  hour: number;
  playing: boolean;
  busy: string | null;
  systemOn: boolean; // the choice for the next day
  systemNow: boolean; // what is running today
  onNextDay: () => void;
  onSkipToEnd: () => void;
  onToggleSystem: () => void;
  onReset: () => void;
  onCompare: () => void;
  onOpenPanel: () => void;
}

/** One compact row: play, the system switch, three numbers, and icons for the rest. */
export function DemoBar(p: DemoBarProps) {
  const t = p.state.totals;
  const locked = p.playing || p.busy !== null;
  const warned = t.blackoutPersonHours > 0 ? `${Math.round((t.warnedPersonHours / t.blackoutPersonHours) * 100)}%` : '–';
  return (
    <div className="demo-bar" role="toolbar" aria-label="Demo controls">
      <button className="primary db-play" disabled={locked || !!p.state.end} onClick={p.onNextDay} title="Next day (Space)">
        {p.playing ? 'Playing…' : '▶ Next day'}
      </button>
      <button className="db-icon" disabled={p.busy !== null || !!p.state.end} onClick={p.onSkipToEnd} title="Skip to the end" aria-label="Skip to the end">⏭</button>
      <button className={`switch ${p.systemOn ? 'on' : ''}`} role="switch" aria-checked={p.systemOn} disabled={locked} onClick={p.onToggleSystem}
        title={`Blackout Warning ${p.systemOn ? 'on' : 'off'} (S). Applies from the next day; Reset starts over with it.`}>
        <span className="knob" aria-hidden />Warning
        {p.systemOn !== p.systemNow && <span className="db-note">from next day</span>}
      </button>
      <button className="db-icon" disabled={locked} onClick={p.onReset} title="Reset (R)" aria-label="Reset">↺</button>
      <span className="db-sep" aria-hidden />
      <span className="db-stat">Day <b>{p.state.day}</b>{p.playing && <span className="muted"> {String(p.hour).padStart(2, '0')}:00</span>}</span>
      <span className="db-stat" title="Deaths so far"><b className={t.deaths > 0 ? 'bad' : ''}>{fmt(t.deaths)}</b> dead</span>
      <span className="db-stat" title="Share of blackout hours that residents had been warned about">
        <b className={t.blackoutPersonHours > 0 ? 'good' : ''}>{warned}</b> warned
      </span>
      <span className="db-sep" aria-hidden />
      <button className="db-icon" disabled={locked} onClick={p.onCompare} title="Compare the same disaster with and without the system" aria-label="Compare">⇄</button>
      <button className="db-icon" onClick={p.onOpenPanel} title="Open the full Test World panel (T)" aria-label="Open test world">⚙</button>
      <Info label="Keyboard shortcuts">
        <kbd>Space</kbd> next day, <kbd>S</kbd> Blackout Warning on or off, <kbd>R</kbd> reset, <kbd>T</kbd> open or minimize the Test World panel.
      </Info>
    </div>
  );
}

export function CompareCard({ result, busy, onClose }: { result: { without: RunResult; withTools: RunResult } | null; busy: string | null; onClose: () => void }) {
  const col = (title: string, r: RunResult, sys: boolean) => (
    <div className={`cc-col ${sys ? 'sys' : ''}`}>
      <h3>{title}</h3>
      <div className={`cc-big ${r.end?.kind === 'stable' ? 'good' : 'bad'}`}>{fmt(r.deaths)}</div>
      <div className="muted small">deaths</div>
      <div>{r.end ? (r.end.kind === 'stable' ? `Stable on day ${r.days}` : `Never stable (${r.days} days)`) : 'Still running'}</div>
      <div className="muted small">{r.blackoutHours > 0 ? `${r.warnedPct}% of blackout hours warned ahead` : 'No blackouts'}</div>
    </div>
  );
  return (
    <div className="compare-card" role="dialog" aria-label="Same disaster, with and without the system">
      <header><h2>Same disaster: with and without the system</h2><button className="ghost" onClick={onClose} aria-label="Close">Close</button></header>
      {result ? (
        <div className="cc-cols">{col('Without', result.without, false)}{col('With the Residents\' System', result.withTools, true)}</div>
      ) : <p className="muted">{busy ?? 'Running both versions…'} This takes about 30 seconds.</p>}
    </div>
  );
}

export function EndBanner({ state, onKeepPlaying, onReset }: { state: SimState; onKeepPlaying: () => void; onReset: () => void }) {
  const end = state.end;
  if (!end) return null;
  const text = end.kind === 'lost'
    ? (end.reason.startsWith('Survived to the') ? `Never stabilized in ${end.day} days` : `Hollow lost on day ${end.day}: ${end.reason.toLowerCase()}`)
    : state.keepGoing ? `Still stable at the ${end.day}-day limit (first stable on day ${state.stableDay})` : `Stable Hollow on day ${end.day}`;
  return (
    <div className={`end-banner ${end.kind}`} role="status">
      <span>{text}</span>
      <div className="eb-actions">
        {end.kind === 'stable' && !state.keepGoing && <button onClick={onKeepPlaying}>Keep playing</button>}
        <button className="ghost" onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}
