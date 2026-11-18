// PROTOTYPE debug: per-day summary of one run. node --experimental-strip-types src/sim/debug.ts [tools] [scenario]
import { ALL_TOOLS, NO_TOOLS, type ToolSet } from './types.ts';
import { sim } from './index.ts';

const proc = (globalThis as unknown as { process: { argv: string[] } }).process;
const which = proc.argv[2] ?? 'none';
const tools: ToolSet = which === 'all' ? ALL_TOOLS : which === 'none' ? NO_TOOLS : { ...NO_TOOLS, [which]: true };
let st = sim.createState(proc.argv[3] ?? 'texas2021', 1, tools);
while (!st.end) {
  const r = sim.stepDay(st, []);
  st = r.state;
  const f = st.lastFrame.sections;
  const live = f.filter((x) => !x.lost);
  const deep = f.filter((x) => x.level >= 41);
  const avg = (a: typeof f, k: 'power' | 'co2' | 'wetBulb' | 'infected' | 'water' | 'food') => a.reduce((s, x) => s + x[k], 0) / Math.max(1, a.length);
  const mx = (k: 'co2' | 'wetBulb') => Math.max(...live.map((x) => x[k]));
  const levelsLost = new Set(f.filter((x) => x.lost).map((x) => x.level));
  console.log(
    `d${st.day} pop ${(st.totals.population / st.totals.startPopulation * 100).toFixed(1)}% plants ${st.lastFrame.plantsOnline} ` +
    `pow ${avg(live, 'power').toFixed(2)} deepPow ${avg(deep, 'power').toFixed(2)} co2max ${mx('co2').toFixed(0)} wbMax ${mx('wetBulb').toFixed(1)} ` +
    `inf ${(avg(live, 'infected') * 100).toFixed(2)}% deepInf ${(avg(deep, 'infected') * 100).toFixed(2)}% water ${avg(live, 'water').toFixed(2)} food ${avg(live, 'food').toFixed(1)} ` +
    `lostSec ${st.totals.sectionsLost} lostLv ${[...levelsLost].length} trust ${st.trust}`,
  );
}
console.log(st.end);
