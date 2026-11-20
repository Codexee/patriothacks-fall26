// The persistent top navigation: Results · Model · Watch it run.
import { href, type Route } from './router.ts';

export function Nav({ route, compact = false }: { route: Route; compact?: boolean }) {
  const cur = route.page === 'disaster' ? 'results' : route.page === 'demoClassic' ? 'demo' : route.page;
  const items: [string, string, string][] = [
    ['results', href.results, 'Results'],
    ['model', href.model, 'Model'],
    ['demo', href.demoClassic(), 'Watch it run'],
  ];
  return (
    <nav className={`site-nav${compact ? ' compact' : ''}`} aria-label="Main">
      <a className="brand" href={href.results}>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 1.5v13M13 1.5v13M3 5h10M3 8h10M3 11h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg>
        <span>Residents’ System</span>
        <small aria-hidden="true">THE HOLLOW · 2087</small>
      </a>
      <ul>
        {items.map(([key, to, label]) => (
          <li key={key}><a href={to} aria-current={cur === key ? 'page' : undefined}>{label}</a></li>
        ))}
      </ul>
    </nav>
  );
}
