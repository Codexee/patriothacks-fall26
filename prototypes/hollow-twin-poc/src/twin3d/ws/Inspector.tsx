// Left dock, "Model inspector": Blackout Warning's parameters, the disaster's parameters, the world's inputs and
// where every input comes from. All values are read from the code and data files at run time.
import { memo, type ReactNode } from 'react';
import type { Scenario } from '../../sim/types.ts';
import { TUNE, EASE, TRIP_ZONE } from '../../product/earlyWarning.ts';
import { ENGINE_CONSTANTS } from '../../sim/engine.ts';
import { grid, outages, sections, air } from '../../data/real/index.ts';
import { Bars, Curve, Tag, fmtNum, type TagKind } from './charts.tsx';
import { LOSS_SHAPE_KEYS, plantLosses } from './model.ts';

function Section({ title, tags, children, open = true }: { title: string; tags?: TagKind[]; children: ReactNode; open?: boolean }) {
  return (
    <details className="ws-sec" open={open}>
      <summary><span>{title}</span>{tags?.map((t) => <Tag key={t} kind={t} />)}</summary>
      <div className="ws-sec-body">{children}</div>
    </details>
  );
}

function KV({ rows }: { rows: [ReactNode, ReactNode, TagKind?, string?][] }) {
  return (
    <table className="ws-kv">
      <tbody>
        {rows.map(([k, v, tag, note], i) => (
          <tr key={i} title={note}>
            <th scope="row">{k}</th>
            <td className="num">{v}</td>
            <td className="tagcell">{tag && <Tag kind={tag} />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};

function histogram(xs: number[], edges: number[]): number[] {
  const out = new Array<number>(edges.length - 1).fill(0);
  for (const x of xs) for (let b = 0; b < edges.length - 1; b++) if (x >= edges[b] && (x < edges[b + 1] || b === edges.length - 2)) { out[b]++; break; }
  return out;
}

const REPAIR_EDGES = [0, 6, 12, 18, 24, 30, 36, 48, 72, 96];
const GROWTH_EDGES = [-0.02, -0.01, -0.005, 0, 0.005, 0.01, 0.015, 0.02, 0.03, 0.05];

export const Inspector = memo(function Inspector({ scenario, seedNote }: { scenario: Scenario; seedNote: ReactNode }) {
  const losses = plantLosses(scenario);
  const shapeKeys = LOSS_SHAPE_KEYS[scenario.id] ?? [];
  const repair = outages?.repairHours ?? [];
  const rows = sections?.rows ?? [];
  const countyParts = rows.reduce((a, r) => a + (r.countyCount ?? r.counties.length), 0);
  const dme = rows.reduce((a, r) => a + r.dme, 0);
  const growth = rows.map((r) => r.growthPerYear);
  const C = ENGINE_CONSTANTS;
  const tuneNote = 'Chosen on tuning seeds 1–5, kept only if check seeds 6–10 were no worse, then frozen before the held-out test (REBUILD.md Step 2)';

  return (
    <div className="ws-dock-body">
      <Section title="Run" tags={['sim']}>
        <p className="ws-small">{seedNote}</p>
      </Section>

      <Section title="Blackout Warning parameters" tags={['module']}>
        <p className="ws-sub">TUNE: tuned on seeds 1–5, checked on 6–10, frozen</p>
        <KV rows={[
          ['safeLoad', TUNE.safeLoad, 'tuned', `${tuneNote}. Keep plants below this share of their output (first guess 0.88).`],
          ['assumedCompliance', TUNE.assumedCompliance, 'tuned', `${tuneNote}. Share of residents expected to follow a request (first guess 0.85).`],
          ['maxTrend', TUNE.maxTrend, 'tuned', 'Supply trend cap per day. Tuning changed nothing; first guess kept.'],
          ['tripStep', TUNE.tripStep, 'tuned', 'Extra saving after a Hollow-wide blackout. Tuning changed nothing; first guess kept.'],
        ]} />
        <p className="ws-sub">EASE: how the request steps down</p>
        <KV rows={[
          ['afterQuietDays', EASE.afterQuietDays, 'set', 'Quiet days before each step down (3 days caused extra trips)'],
          ['step', EASE.step, 'set'],
          ['floorMargin', EASE.floorMargin, 'set'],
          ['floorDays', EASE.floorDays, 'set'],
          ['TRIP_ZONE', TRIP_ZONE, 'set', 'Above this share of the estimated supply, plants are close to tripping'],
        ]} />
        <p className="ws-sub">Reads only: residents’ outage reports, residents’ head count, the Directorate’s census, typed reports.</p>
      </Section>

      <Section title={`Disaster: ${scenario.id}`} tags={['real']}>
        <p className="ws-small">{scenario.summary}</p>
        <KV rows={[
          ['Run length (data)', `${scenario.days} days`],
          ['minDays', scenario.minDays ?? '–', undefined, 'The run cannot end as stable before this day'],
          ['agingPerDay', scenario.agingPerDay !== undefined ? scenario.agingPerDay.toFixed(5) : `${C.agingPerDay} (default)`, scenario.agingPerDay !== undefined ? 'real' : 'guess'],
          ['growthYears', scenario.growthYears ?? 0, scenario.growthYears ? 'real' : undefined],
          ['Plant losses', losses.length || 'none'],
        ]} />
        {losses.map((l, i) => {
          const key = shapeKeys[i] ?? shapeKeys[0];
          const st = key && key !== 'cascade' ? grid?.lossShapes?.[key]?.stats : undefined;
          return (
            <div key={i} className="ws-loss">
              <p className="ws-sub">Plant {l.plant + 1} (level {C.plantLevels[l.plant]}): from day {l.startDay}, {l.hours} h <Tag kind="real" /></p>
              <Curve values={l.loss} color="var(--without)" />
              <p className="ws-axisnote"><span>share of the plant lost, hourly</span><span>peak {fmtNum(Math.max(...l.loss) * 100)}%</span></p>
              {st && (
                <KV rows={[
                  ['EIA-930 area / fuel', `${st.ba} ${st.fuel}`, 'real'],
                  ['Reference output', `${fmtNum(st.refMW)} MW`, 'real'],
                  ['Peak loss', `${fmtNum(st.peakLossMW)} MW (${fmtNum(st.peakLossShare * 100)}%)`, 'real'],
                  ['Peak at', st.peakAt, 'real'],
                  ['Window', `${st.start.slice(0, 10)} – ${st.end.slice(0, 10)} (${st.hours} h)`, 'real'],
                ]} />
              )}
            </div>
          );
        })}
        {scenario.growthYears ? (
          <div className="ws-loss">
            <p className="ws-sub">Section growth per year, 400 sections (Census 2020–2024) <Tag kind="real" /></p>
            <Bars values={histogram(growth, GROWTH_EDGES)} color="var(--saved)" labels={['−2%', '+5%']} />
            <p className="ws-axisnote"><span>median {(quantile(growth, 0.5) * 100).toFixed(2)}%/yr</span><span>{scenario.growthYears} years in 120 days</span></p>
          </div>
        ) : null}
        <p className="ws-sub">Demand week (168 h, mean 1): ERCOT 2023 calm weeks <Tag kind="real" /></p>
        {grid && <Curve values={grid.demandWeek} color="var(--dust)" height={30} fill={false} />}
        {grid && <p className="ws-axisnote"><span>min {grid.demandWeek.reduce((a, b) => Math.min(a, b), 9).toFixed(2)}</span><span>max {grid.demandWeek.reduce((a, b) => Math.max(a, b), 0).toFixed(2)}</span></p>}
        <p className="ws-src">Source: <a href={scenario.source.url} target="_blank" rel="noreferrer">{scenario.source.label}</a></p>
      </Section>

      <Section title="World inputs" tags={['real', 'guess']}>
        <p className="ws-sub">Plant repair time after a trip: EAGLE-I, {repair.length} quantiles of 100 events <Tag kind="real" /></p>
        <Bars values={histogram(repair, REPAIR_EDGES)} color="var(--with)" labels={['0 h', '96 h+']} />
        <p className="ws-axisnote"><span>median {fmtNum(quantile(repair, 0.5))} h</span><span>p90 {fmtNum(quantile(repair, 0.9))} h · max {Math.max(...repair)} h</span></p>
        <KV rows={[
          ['CO₂ danger line', `${fmtNum(C.airDanger)} ppm`, air.airDanger ? 'cited' : 'guess', air.airDanger?.source.label],
          ['Air death rate', `${C.airDeath} /h per 1,000 ppm`, air.airDeath ? 'cited' : 'guess', 'No study gives an hourly death share per ppm (src/data/real/airParams.ts)'],
          ['Deaths avoided if prepared', C.preparedSave, air.preparedSave ? 'cited' : 'guess'],
          ['Air per resident', `${C.volPerPerson} m³`, air.volPerPerson ? 'cited' : 'guess', 'Scaled so CO₂ rises about 300 ppm/h with the fans off'],
          ['Alert follow rate', `${C.followBase} + ${C.followTrust} × trust`, air.followBase ? 'cited' : 'guess'],
          ['Trip chance at full load', `${C.stressTrip} /h`, outages?.stressTrip ? 'real' : 'guess', 'EAGLE-I counts customers out, not plant trips'],
          ['Capacity margin', `${C.capacityMargin} × normal demand`, 'guess'],
          ['Life-support share of load', C.criticalResShare, 'guess'],
          ['Blackout line', `life support < ${C.blackout * 100}%`, 'set'],
          ['Stable after', `${C.stableDays} days without a blackout`, 'set'],
        ]} />
      </Section>

      <Section title="Data provenance" tags={['real']} open={false}>
        <ul className="ws-prov">
          {grid && <li><b>EIA-930</b> hourly grid data: demand week from 36 calm ERCOT weeks of 2023 (168 h); {Object.keys(grid.lossShapes ?? {}).length + 1} plant-loss shapes ({grid.cascadeLoss.length} h ERCOT 2021{Object.entries(grid.lossShapes ?? {}).map(([k, v]) => `, ${v.loss.length} h ${k}`).join('')}). <a href={grid.source.url} target="_blank" rel="noreferrer">eia.gov</a></li>}
          {outages && <li><b>EAGLE-I</b> county outages 2015–2024: 100 large, sudden events → {outages.repairHours.length} restoration-time quantiles. <a href={outages.source.url} target="_blank" rel="noreferrer">figshare</a></li>}
          {sections && <li><b>CDC SVI 2022</b>: 3,133 counties sorted into 50 levels; {fmtNum(countyParts)} county parts in 400 sections. <a href={sections.source.url} target="_blank" rel="noreferrer">atsdr.cdc.gov</a></li>}
          {sections && <li><b>HHS emPOWER</b>: {fmtNum(dme)} power-dependent residents across the sections (real count, unscaled).</li>}
          {sections && <li><b>Census</b> county estimates 2020–2024: growth per section, median {(quantile(growth, 0.5) * 100).toFixed(2)}%/yr.</li>}
          {air.airDanger && <li><b>OSHA PEL / NIOSH REL</b>: CO₂ 5,000 ppm. <a href={air.airDanger.source.url} target="_blank" rel="noreferrer">cdc.gov/niosh</a></li>}
          <li><b>Aging rate</b>: The Geysers, about 10%/yr (Foulger et al. 1997).</li>
        </ul>
      </Section>
    </div>
  );
});
