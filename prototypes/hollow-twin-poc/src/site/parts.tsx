// Small shared pieces for the site pages.
import type { ReactNode } from 'react';
import type { Interval, ScenariosFile, Source } from './contracts.ts';
import type { SiteData } from './data.ts';
import { bounds, rangeText, shortDate } from './format.ts';

/** A value with its 95% interval: "1,234" large, "95% interval 900–1,600" under it. */
export function Stat({ label, value, digits = 0, count = true, tone, children }: {
  label: string; value: Interval; digits?: number; count?: boolean; tone?: 'without' | 'with' | 'saved'; children?: ReactNode;
}) {
  const [m, lo, hi] = bounds(value, digits, count);
  return (
    <div className={`stat ${tone ?? ''}`}>
      <dt>{label}</dt>
      <dd>
        <span className="stat-num">{m}</span>
        <span className="stat-ci">95% CI {rangeText(lo, hi)}</span>
        {children}
      </dd>
    </div>
  );
}

export function SourceLink({ source }: { source: Source }) {
  return (
    <div className="source">
      <p>Source: <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></p>
      {source.detail.length > 160 ? (
        <details>
          <summary>How this data was used</summary>
          <p>{source.detail.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, mo, d) => new Date(+y, +mo - 1, +d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}</p>
        </details>
      ) : <p className="source-detail">{source.detail}</p>}
    </div>
  );
}

export function SampleBanner({ data }: { data: SiteData }) {
  const files = [data.scenarios, data.checkfirst].filter((f) => f.sample);
  if (!files.length) return null;
  return (
    <div className="sample-banner" role="status">
      <strong>Sample data.</strong>{' '}
      {files.map((f, i) => (
        <span key={f.path}>{i ? ' ' : ''}<code>{f.path}</code> was not loaded ({f.reason}).</span>
      ))}{' '}
      The numbers below are placeholders, not measured results. Run the producers to write the real files.
    </div>
  );
}

export function seedRange(seeds: number[]): string {
  if (!seeds.length) return 'none';
  const s = [...seeds].sort((a, b) => a - b);
  const contiguous = s.every((v, i) => i === 0 || v === s[i - 1] + 1);
  return contiguous && s.length > 2 ? `${s[0]}–${s[s.length - 1]}` : s.join(', ');
}

export function Generated({ file, label }: { file: { generated: string }; label: string }) {
  return <p className="generated">{label} generated {shortDate(file.generated)}.</p>;
}

export function scaleNote(f: ScenariosFile): string {
  const per = f.scale.hollowPeople / Math.max(1, f.scale.simPeople);
  return `Each run simulates ${(f.scale.simPeople / 1e6).toFixed(1)} million people standing for the Hollow’s ${(f.scale.hollowPeople / 1e9).toFixed(0)} billion (1 ≈ ${Math.round(per).toLocaleString('en-US')}). Deaths are in simulated people.`;
}

/** The part of a scenario name before a colon or a parenthesis: "Aging plants (4 years …)" → "Aging plants". */
export function shortName(name: string): string {
  return name.split(/[:(]/)[0].trim() || name;
}

/** Short display titles. The full scenario name (with its real source) stays on the disaster page as the subtitle. */
const DISPLAY: Record<string, string> = {
  twoplants: 'Two plants lost at once',
  elliott: 'Plant loss, Winter Storm Elliott',
  cascade: 'Plant loss, Texas, Feb 2021',
  slowloss: 'Slow two-week plant loss',
  aging: 'Aging plants',
  crowding: 'Crowding',
  baseline: 'Baseline',
};
export function displayName(s: { id: string; name: string }): string {
  return DISPLAY[s.id] ?? shortName(s.name);
}

/** A metric label without its parenthetical: "Top-10 overlap (share of …)" → "Top-10 overlap". A short unit such as "(h)" stays. */
export function metricName(m: string): string {
  const i = m.indexOf(' (');
  if (i < 0) return m;
  return metricNote(m) == null ? m : m.slice(0, i);
}
/** The explanatory parenthetical of a metric label, or null when there is none (or it is only a unit). */
export function metricNote(m: string): string | null {
  const i = m.indexOf(' (');
  if (i < 0) return null;
  const note = m.slice(i + 2).replace(/\)$/, '');
  return note.length <= 4 ? null : note;
}
