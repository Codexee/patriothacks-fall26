// The persistent top navigation: Results · Model · Watch it run.
import { href, type Route } from './router.ts';

export function Nav({ route, compact = false }: { route: Route; compact?: boolean }) {
  const cur = route.page === 'disaster' ? 'results' : route.page === 'demoClassic' ? 'demo' : route.page;
  const items: [string, string, string][] = [
    ['results', href.results, 'Results'],
    ['model', href.model, 'Model'],
    ['demo', href.demo(), 'Watch it run'],
  ];
  return (
    <nav className={`site-nav${compact ? ' compact' : ''}`} aria-label="Main">
      <a className="brand" href={href.results}>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2 17h16M4 17V9l6-5 6 5v8M8 17v-4h4v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        <span>Residents’ System</span>
      </a>
      <ul>
        {items.map(([key, to, label]) => (
          <li key={key}><a href={to} aria-current={cur === key ? 'page' : undefined}>{label}</a></li>
        ))}
      </ul>
    </nav>
  );
}
