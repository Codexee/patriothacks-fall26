// Hash router with no library. Routes: #/ · #/disaster/<id> · #/model · #/demo[?scenario=<id>] (the 2D cutaway; #/demo/classic is the same page) ·
// #/demo/3d[?scenario=<id>] (the 3D workstation) · #/film/<id> (a 1920×1080 frame for video capture)
import { useEffect, useState } from 'react';

export type Route =
  | { page: 'results' }
  | { page: 'disaster'; id: string }
  | { page: 'model' }
  | { page: 'demo'; scenario: string | null }
  | { page: 'demoClassic'; scenario: string | null }
  | { page: 'film'; id: string }
  | { page: 'missing'; hash: string };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { page: 'results' };
  if (parts[0] === 'disaster' && parts[1]) return { page: 'disaster', id: parts[1] };
  if (parts[0] === 'model' && parts.length === 1) return { page: 'model' };
  if (parts[0] === 'demo' && parts.length === 1) return { page: 'demoClassic', scenario: new URLSearchParams(query).get('scenario') };
  if (parts[0] === 'demo' && parts[1] === '3d' && parts.length === 2) return { page: 'demo', scenario: new URLSearchParams(query).get('scenario') };
  if (parts[0] === 'demo' && parts[1] === 'classic' && parts.length === 2) return { page: 'demoClassic', scenario: new URLSearchParams(query).get('scenario') };
  if (parts[0] === 'film' && parts[1] && parts.length === 2) return { page: 'film', id: parts[1] };
  return { page: 'missing', hash: raw };
}

export const href = {
  results: '#/',
  model: '#/model',
  disaster: (id: string) => `#/disaster/${encodeURIComponent(id)}`,
  demo: (scenario?: string) => (scenario ? `#/demo/3d?scenario=${encodeURIComponent(scenario)}` : '#/demo/3d'),
  demoClassic: (scenario?: string) => (scenario ? `#/demo?scenario=${encodeURIComponent(scenario)}` : '#/demo'),
  film: (id: string) => `#/film/${encodeURIComponent(id)}`,
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
