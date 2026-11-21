// REBUILD: the product view — the Residents' System. A resident's phone for one section: a home screen with one app
// per built module (src/ui/phone/). Everything here comes from the system's own outputs, memory and log; none of it
// comes from the test world's hidden state. The council reasoning of each module is in the Modules panel.
import { type ToolSet } from '../sim/types.ts';
import type { Run } from '../product/run.ts';
import { BUILT, PROBLEMS, moduleName } from '../product/names.ts';
import { Info } from './Info.tsx';
import { Phone } from './phone/Phone.tsx';

export interface ProductViewProps {
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

export function ProductView(p: ProductViewProps) {
  return (
    <aside className="product" aria-label="Residents' System">
      <header className="pv-head">
        <h1>Residents' System <Info label="About the Residents' System">The app residents run for themselves. It sees only what residents have: their outage reports, their own head count and the Directorate's census. Never the hidden truth. Each solved problem becomes an app on the phone.</Info></h1>
        <div className="progress" aria-label="Progress through the 15 problems">
          {PROBLEMS.map((pr) => (
            <span key={pr.n} className={`dot ${pr.feature && BUILT.includes(pr.feature) ? 'done' : ''}`} title={`#${pr.n} ${pr.title}${pr.feature ? ` — ${moduleName(pr.feature)}` : ' — not built yet'}`}>{pr.n}</span>
          ))}
        </div>
      </header>
      <Phone {...p} />
    </aside>
  );
}
