// #/demo/classic — the existing 2D cutaway App, unchanged, under a slim bar back to the results. (#/demo is the 3D twin.)
import { Suspense, lazy, useEffect } from 'react';
import type { SiteData } from '../data.ts';
import { Nav } from '../Nav.tsx';

const App = lazy(() => import('../../ui/App.tsx').then((m) => ({ default: m.App })));

export function Demo({ data, scenario }: { data: SiteData | null; scenario: string | null }) {
  const s = scenario ? data?.scenarios.data.scenarios.find((x) => x.id === scenario) : undefined;
  useEffect(() => {
    document.documentElement.classList.add('demo-mode');
    return () => document.documentElement.classList.remove('demo-mode');
  }, []);
  return (
    <div className="demo-host">
      <div className="demo-topbar">
        <Nav route={{ page: 'demoClassic', scenario }} compact />
        <span className="demo-hint">
          {s
            ? <>To run this disaster, press <kbd>T</kbd> to open the Test World panel, then choose “{s.name}” as the scenario.</>
            : <>The cutaway of the Hollow. Press <kbd>Space</kbd> for the next day, <kbd>T</kbd> for the Test World panel.</>}
        </span>
      </div>
      <main id="main" className="demo-main">
        <h1 className="sr-only" tabIndex={-1}>Watch it run</h1>
        <Suspense fallback={<p className="demo-loading">Loading the cutaway…</p>}>
          <App />
        </Suspense>
      </main>
    </div>
  );
}
