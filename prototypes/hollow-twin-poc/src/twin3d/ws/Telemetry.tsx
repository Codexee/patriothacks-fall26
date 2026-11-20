// Right dock, "Telemetry": per-day series for both runs up to the shown day, the plant table and the depth heat strips.
import { memo, useMemo, useState } from 'react';
import { LEVELS } from '../../sim/types.ts';
import type { TwinData } from '../compute.ts';
import { PLANTS } from '../detail.ts';
import type { SideKey } from '../Scene.tsx';
import { ChartBlock, HeatStrip, LineChart, fmtNum, compact, type Series } from './charts.tsx';
import { SIDES, SIDE_COLOR, SIDE_SHORT, det, pad2, pct, tripsPerDay } from './model.ts';

const RGB_HEAT: [number, number, number] = [240, 101, 79];

export const Telemetry = memo(function Telemetry({ data, day }: { data: TwinData; day: number }) {
  const [log, setLog] = useState(true);
  const [plantSide, setPlantSide] = useState<SideKey>('without');
  const D = data.days;
  const n = D + 1;
  const W = det(data, 'without'), Wi = det(data, 'with');

  const series = useMemo(() => {
    const warnedShare = (side: SideKey) => {
      const x = det(data, side);
      return Array.from({ length: n }, (_, d) => {
        if (d === 0) return 0;
        const b = x.blackoutPH[d] - x.blackoutPH[d - 1];
        return b > 0 ? (x.warnedPH[d] - x.warnedPH[d - 1]) / b : 0;
      });
    };
    return {
      warned: { without: warnedShare('without'), with: warnedShare('with') },
      shed: Array.from({ length: n }, (_, d) => Wi.log[d]?.shed ?? (d > 0 ? NaN : 0)),
      trips: { without: tripsPerDay(W), with: tripsPerDay(Wi) },
    };
  }, [data, n, W, Wi]);
  // Carry the module's last request over days it did not run (after a stable end).
  const shed = useMemo(() => { const s = series.shed.slice(); for (let d = 1; d < s.length; d++) if (Number.isNaN(s[d])) s[d] = s[d - 1]; return s; }, [series.shed]);

  const both = (get: (side: SideKey) => ArrayLike<number>, extra: Partial<Series> = {}): Series[] =>
    SIDES.map((side) => ({ values: get(side), color: SIDE_COLOR[side], label: side, upto: day, ...extra }));
  const val = (side: SideKey, v: string) => <span key={side} style={{ color: SIDE_COLOR[side] }}>{v}</span>;
  const pair = (f: (side: SideKey) => string) => <>{val('without', f('without'))} · {val('with', f('with'))}</>;

  const servedNow = (side: SideKey) => {
    const s = det(data, side).served;
    let a = 0; for (let h = 0; h < 24; h++) a += s[day * 24 + h];
    return a / 24;
  };
  const heatMax = 24;
  const ps = det(data, plantSide);

  return (
    <div className="ws-dock-body">
      <ChartBlock title="Deaths, cumulative" tags={['sim']} values={pair((s) => fmtNum(data[s].deaths[day]))}
        tools={<label className="ws-chk"><input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /> log</label>}>
        <LineChart series={both((s) => data[s].deaths)} n={n} cursor={day} log={log} />
      </ChartBlock>

      <ChartBlock title="Dark sections at the day’s worst hour" tags={['sim']} values={pair((s) => `${data[s].dark[day]}/400`)}>
        <LineChart series={both((s) => data[s].dark, { step: true })} n={n} cursor={day} yMax={400} />
      </ChartBlock>

      <ChartBlock title="Plants online, lowest hour" tags={['sim']} values={pair((s) => `${det(data, s).plantsMin[day]}/6 · ${fmtNum(det(data, s).plantHours[day])} plant-h off`)}>
        <LineChart series={both((s) => det(data, s).plantsMin, { step: true })} n={n} cursor={day} yMax={6} />
      </ChartBlock>

      <ChartBlock title="Capacity vs full demand, last hour of day (÷ normal demand)" tags={['sim']}
        values={<>{val('without', `cap ${pct(W.capacity[day])}`)} · {val('with', `cap ${pct(Wi.capacity[day])}`)} · <span className="ws-dim">dem {pct(W.demand[day])}</span></>}>
        <LineChart series={[...both((s) => det(data, s).capacity), { values: W.demand, color: '#b0aa9e', label: 'demand', upto: day, dashed: true }]} n={n} cursor={day} yMax={1.3} fmt={(v) => pct(v)} />
      </ChartBlock>

      <ChartBlock title="Share of demand served, hourly" tags={['sim', 'derived']} values={pair((s) => `${pct(servedNow(s))} day mean`)}>
        <LineChart series={both((s) => det(data, s).served, { upto: day * 24 + 23 })} n={n * 24} cursor={day * 24 + 12} yMax={1} fmt={(v) => pct(v)} height={52} />
      </ChartBlock>

      <ChartBlock title="Save-power request (share of non-essential load)" tags={['module']} values={val('with', Wi.log[day] ? pct(Wi.log[day]!.shed, 1) : day ? `${pct(shed[day], 1)} (held)` : '–')}>
        <LineChart series={[{ values: shed, color: SIDE_COLOR.with, label: 'shed', upto: day, step: true }]} n={n} cursor={day} yMax={1} fmt={(v) => pct(v)} height={46} />
      </ChartBlock>

      <ChartBlock title="Warned share of blackout person-hours, per day" tags={['sim']} values={pair((s) => pct(series.warned[s][day]))}>
        <LineChart series={both((s) => series.warned[s], { step: true })} n={n} cursor={day} yMax={1} fmt={(v) => pct(v)} height={46} />
      </ChartBlock>

      <ChartBlock title="Plant trips per day" tags={['sim']} values={pair((s) => `${series.trips[s].slice(0, day + 1).reduce((a, b) => a + b, 0)} so far`)}>
        <LineChart series={both((s) => series.trips[s], { step: true })} n={n} cursor={day} height={40} />
      </ChartBlock>

      <figure className="ws-cblock">
        <figcaption>
          <span className="ws-ctitle">Plants, end of day {day}</span>
          <span className="ws-tag sim">SIM</span>
          <span className="ws-seg" role="group" aria-label="Run for the plant table">
            {SIDES.map((s) => <button key={s} type="button" aria-pressed={plantSide === s} onClick={() => setPlantSide(s)} style={plantSide === s ? { color: SIDE_COLOR[s] } : undefined}>{SIDE_SHORT[s]}</button>)}
          </span>
        </figcaption>
        <table className="ws-table">
          <thead><tr><th>#</th><th>Lvl</th><th>Health</th><th>Loss left</th><th>Status</th><th>Trips</th><th>Off h</th></tr></thead>
          <tbody>
            {Array.from({ length: PLANTS }, (_, k) => {
              const o = (day * PLANTS + k) * 3;
              const on = ps.plant[o + 2] === 1;
              const until = ps.plantUntil[day * PLANTS + k];
              return (
                <tr key={k}>
                  <td>{k + 1}</td>
                  <td className="num">{[8, 18, 27, 34, 41, 47][k]}</td>
                  <td className="num">{pct(ps.plant[o], 1)}</td>
                  <td className="num">{pct(ps.plant[o + 1])}</td>
                  <td className={on ? 'ok' : 'bad'}>{on ? 'online' : `off → D${Math.floor(until / 24) + 1} ${pad2(until % 24)}:00`}</td>
                  <td className="num">{ps.plantTrips[day * PLANTS + k]}</td>
                  <td className="num">{fmtNum(ps.plantOff[day * PLANTS + k])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="ws-foot">Health: aging. Loss left: share the disaster leaves (EIA-930 shape). Off h: from trip times and repair ends.</p>
      </figure>

      <figure className="ws-cblock">
        <figcaption><span className="ws-ctitle">Dark hours by level × day</span><span className="ws-tag sim">SIM</span><span className="ws-cvals ws-dim">0–{heatMax} h</span></figcaption>
        <div className="ws-heats">
          {SIDES.map((s) => (
            <div key={s} className="ws-heatcol">
              <span style={{ color: SIDE_COLOR[s] }}>{SIDE_SHORT[s]}</span>
              <HeatStrip values={det(data, s).levelDark} days={n} rows={LEVELS} upto={day} max={heatMax} rgb={RGB_HEAT} />
            </div>
          ))}
          <div className="ws-heatax" aria-hidden="true"><span>L1</span><span>L25</span><span>L50</span></div>
        </div>
        <p className="ws-foot">Rows: levels 1 (top) to 50. Columns: days 0–{D}. Brighter = more dark-hour equivalents that day ({compact(heatMax)} = dark all day).</p>
      </figure>
    </div>
  );
});
