// "Built on real-world data": the real records behind the test world and the forecasts, with the real hourly
// plant losses drawn from EIA-930 (src/data/real/grid.ts, built by scripts/build_grid.py), and the check-first
// model's score on real outages (checkfirst.json).
import { grid, sections } from '../data/real/index.ts';
import type { CheckFirstFile } from './contracts.ts';
import { href } from './router.ts';
import { num } from './format.ts';

/** Which disaster each real plant loss shapes. */
const LOSSES: { key: 'elliottTva' | 'elliottCple' | 'sppWind'; title: string; used: string }[] = [
  { key: 'elliottTva', title: 'TVA coal, Winter Storm Elliott', used: 'Plant 4 in “Winter Storm Elliott” and “Two plants”' },
  { key: 'elliottCple', title: 'Duke Energy Progress East coal, same storm', used: 'Plant 5 in “Two plants lost at once”' },
  { key: 'sppWind', title: 'Southwest Power Pool wind, Feb 2021', used: 'Plant 6 in “Slow two-week plant loss”' },
];

export function Tag({ kind }: { kind: 'real' }) {
  return <span className={`dtag ${kind}`}>Real data</span>;
}

export function RealData({ checkfirst }: { checkfirst: CheckFirstFile }) {
  const top10 = checkfirst.test.rows.find((r) => r.metric.startsWith('Top-10'));
  const counties = new Set((sections?.rows ?? []).flatMap((s) => s.counties.map((c) => c.fips))).size;
  return (
    <>
      <ul className="rd-curves">
        {LOSSES.map((l) => {
          const s = grid?.lossShapes?.[l.key];
          if (!s) return null;
          return (
            <li key={l.key}>
              <Tag kind="real" />
              <h3>{l.title}</h3>
              <Curve loss={s.loss} label={`${s.source.label}: hourly output lost, ${s.stats.start} to ${s.stats.end}. Peak ${num(s.stats.peakLossMW)} MW.`} />
              <p className="rd-stat"><b>{num(s.stats.peakLossMW)} MW</b> lost at peak ({Math.round(s.stats.peakLossShare * 100)}%), {s.stats.start.slice(0, 10)} to {s.stats.end.slice(0, 10)}</p>
              <p className="rd-used">→ {l.used}</p>
            </li>
          );
        })}
      </ul>
      <dl className="rd-facts">
        <div><dt><Tag kind="real" /> Weekly demand</dt><dd>ERCOT hourly demand, 36 calm weeks of 2023 (EIA-930)</dd></div>
        <div><dt><Tag kind="real" /> Repair times</dt><dd>EAGLE-I county outages, 2015–2024 (ORNL)</dd></div>
        <div><dt><Tag kind="real" /> 400 sections</dt><dd>{num(counties)} US counties, with their CDC vulnerability scores</dd></div>
        {top10 && (
          <div><dt><Tag kind="real" /> Check-first model</dt>
            <dd>Tested once on real 2023–2024 outages: top-10 overlap <b>{top10.model.toFixed(3)}</b>, against {top10.history?.toFixed(3)} for history. <a className="text-link" href={href.model}>Model</a></dd></div>
        )}
      </dl>
    </>
  );
}

/** The real hourly loss as an area: 0 at the bottom, the peak at the top. */
function Curve({ loss, label }: { loss: number[]; label: string }) {
  const w = 240, h = 56, n = loss.length;
  const max = Math.max(1e-9, ...loss);
  const pts = loss.map((v, i) => `${((i / (n - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 4)).toFixed(1)}`);
  return (
    <svg className="rd-curve" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} preserveAspectRatio="none">
      <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} />
      <polyline points={pts.join(' ')} />
    </svg>
  );
}
