// REBUILD: the product view — HollowGuard. A resident's phone for one section: a home screen with one app
// per built module (src/ui/phone/). Everything here comes from the system's own outputs, memory and log; none of it
// comes from the test world's hidden state. The council reasoning of each module is in the Modules panel.
import { type ToolSet } from '../sim/types.ts';
import type { Run } from '../product/run.ts';

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
    <aside className="product" aria-label="HollowGuard">
      <header className="pv-head">
        <h1>HollowGuard <Info label="About HollowGuard">The app residents run for themselves. It sees only what residents have: their outage reports, their own head count and the Directorate's census. Never the hidden truth. Each solved problem becomes an app on the phone.</Info></h1>
      </header>
      <Phone {...p} />
    </aside>
  );
}
