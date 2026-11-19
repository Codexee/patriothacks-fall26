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
        <span className="stat-ci">95% interval {rangeText(lo, hi)}</span>
        {children}
      </dd>
    </div>
  );
}

export function SourceLink({ source }: { source: Source }) {
  return (
    <p className="source">
      Source: <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>. {source.detail}
    </p>
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
  return `Each run simulates about ${(f.scale.simPeople / 1e6).toFixed(1)} million people, who stand for the Hollow’s ${(f.scale.hollowPeople / 1e9).toFixed(0)} billion (1 simulated person ≈ ${Math.round(per).toLocaleString('en-US')}). Deaths are in simulated people.`;
}

/** The part of a scenario name before a colon or a parenthesis: "Aging plants (4 years …)" → "Aging plants". */
export function shortName(name: string): string {
  return name.split(/[:(]/)[0].trim() || name;
}
