import { lazy, Suspense } from 'react';
import { useRoute } from './router.ts';
import './theme.css';

const Earth = lazy(() => import('../earth/Page.tsx'));
const Brief = lazy(() => import('../brief/Page.tsx'));
const Evidence = lazy(() => import('../evidence/Page.tsx'));
const Live = lazy(() => import('../live/Page.tsx'));
const Legacy = lazy(() => import('../ui/App.tsx').then((m) => ({ default: m.App })));

export function Shell() {
  const { parts } = useRoute();
  const Page =
    parts[0] === 'brief' ? Brief
    : parts[0] === 'evidence' ? Evidence
    : parts[0] === 'live' ? Live
    : parts[0] === 'legacy' ? Legacy
    : Earth;
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
