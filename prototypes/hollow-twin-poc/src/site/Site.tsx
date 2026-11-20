// The results site: the product is the models and their measured results; the cutaway is the "Watch it run" page.
// Spec: .plans/results-site-spec.md. Every number comes from public/results/*.json (or a marked sample fixture).
import { Suspense, lazy, useEffect, useRef } from 'react';
import { useRoute } from './router.ts';
import { useSiteData } from './data.ts';
import { Nav } from './Nav.tsx';
import { SampleBanner, displayName } from './parts.tsx';
import { Results } from './pages/Results.tsx';
import { Disaster } from './pages/Disaster.tsx';
import { Model } from './pages/Model.tsx';
import { Demo } from './pages/Demo.tsx';
import { href } from './router.ts';
import './site.css';
import './landing.css';

// The 3D twin and its film frame load three.js, so they are split into their own chunks.
const Twin3D = lazy(() => import('../twin3d/Twin3D.tsx'));
const Film = lazy(() => import('../twin3d/Film.tsx'));

const TITLES: Record<string, string> = {
  results: 'Results',
  disaster: 'Disaster',
  model: 'Check-first model',
  demo: 'Watch it run (3D)',
  demoClassic: 'Watch it run',
  film: 'Film',
  missing: 'Page not found',
};

export function Site() {
  const route = useRoute();
  const data = useSiteData();
  const first = useRef(true);
  const key = route.page === 'disaster' ? `d:${route.id}` : route.page;

  // On a route change: go to the top and move focus to the new page's heading, so keyboard and screen-reader
  // users start at the new content. Not on the first load.
  useEffect(() => {
    if (!data) return;
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }));
  }, [key, data]);

  useEffect(() => {
    const name = route.page === 'disaster'
      ? (() => { const s = data?.scenarios.data.scenarios.find((x) => x.id === route.id); return s ? displayName(s) : TITLES.disaster; })()
      : TITLES[route.page];
    document.title = `${name}: Residents’ System`;
  }, [route, data]);

  if (route.page === 'film') return <Suspense fallback={null}><Film id={route.id} /></Suspense>;
  if (route.page === 'demoClassic') return <Demo data={data} scenario={route.scenario} />;

  return (
    <div className="site">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.querySelector<HTMLElement>('main h1')?.focus(); }}>Skip to the content</a>
      <Nav route={route} />
      <main id="main" className="site-main">
        {!data ? (
          <p className="loading wrap" role="status">Loading the results…</p>
        ) : (
          <>
            <div className="wrap"><SampleBanner data={data} /></div>
            <div key={key} className="route-enter">
            {route.page === 'results' && <Results data={data} />}
            {route.page === 'disaster' && <div className="wrap page"><Disaster data={data} id={route.id} /></div>}
            {route.page === 'model' && <div className="wrap page"><Model data={data} /></div>}
            {route.page === 'demo' && (
              <Suspense fallback={<p className="loading" role="status">Loading the 3D view…</p>}>
                <Twin3D data={data} scenario={route.scenario} />
              </Suspense>
            )}
            {route.page === 'missing' && (
              <section className="block wrap page">
                <h1 tabIndex={-1}>No page at “{route.hash}”</h1>
                <p><a className="text-link" href={href.results}>Go to the results</a></p>
              </section>
            )}
            </div>
          </>
        )}
      </main>
      <footer className="site-foot">
        <p className="wrap">Patriot HackFest Fall 2026 · Life underground. Deaths are simulated test-world results, not forecasts.</p>
      </footer>
    </div>
  );
}
