// UI branch: demo controls that float over the cutaway while the Test World panel is minimized, plus the Compare card
// and the end-of-run banner. Everything here calls the same handlers as the full panel.
import type { SimState } from '../sim/types.ts';
import type { RunResult } from './compare.ts';

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

export function DemoBar(p: DemoBarProps) {
  const t = p.state.totals;
  const locked = p.playing || p.busy !== null;
  const warned = t.blackoutPersonHours > 0 ? `${Math.round((t.warnedPersonHours / t.blackoutPersonHours) * 100)}%` : '–';
  return (
    <div className="demo-bar" role="toolbar" aria-label="Demo controls">
      <div className="db-group">
        <button className="primary" disabled={locked || !!p.state.end} onClick={p.onNextDay} title="Next day (Space)">
          {p.playing ? 'Playing…' : 'Next day'}
        </button>
        <button disabled={p.busy !== null || !!p.state.end} onClick={p.onSkipToEnd}>Skip to the end</button>
      </div>
      <div className="db-group">
        <button className={`switch ${p.systemOn ? 'on' : ''}`} role="switch" aria-checked={p.systemOn} disabled={locked}
          onClick={p.onToggleSystem} title="Blackout Warning on or off (S). Applies from the next day; press Reset to start over with it.">
          <span className="knob" aria-hidden />
          Blackout Warning {p.systemOn ? 'on' : 'off'}
          {p.systemOn !== p.systemNow && <span className="db-note">from next day</span>}
        </button>
        <button disabled={locked} onClick={p.onReset} title="Reset (R)">Reset</button>
      </div>
      <dl className="db-stats">
        <div><dt>Day</dt><dd>{p.state.day}{p.playing ? `, ${String(p.hour).padStart(2, '0')}:00` : ''}</dd></div>
        <div><dt>Deaths</dt><dd className={t.deaths > 0 ? 'bad' : ''}>{fmt(t.deaths)}</dd></div>
        <div><dt>Warned ahead</dt><dd className={t.blackoutPersonHours > 0 ? 'good' : ''}>{warned}</dd></div>
      </dl>
      <div className="db-group">
        <button disabled={locked} onClick={p.onCompare} title="Run the same disaster with and without the system">Compare</button>
        <button className="ghost" onClick={p.onOpenPanel} title="Open the full Test World panel (T)">Open test world</button>
      </div>
      <p className="db-keys" aria-label="Keyboard shortcuts"><kbd>Space</kbd> next day <kbd>S</kbd> system <kbd>R</kbd> reset <kbd>T</kbd> panel</p>
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
