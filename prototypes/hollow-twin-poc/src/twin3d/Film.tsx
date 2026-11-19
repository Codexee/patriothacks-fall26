// #/film/<id> — a 1920×1080 frame of the 3D twin for video capture. No Nav, no controls, no HTML counters.
// Deterministic and seekable: window.__film.seek(t) shows film time t (0..15 s) and resolves after the frame is
// rendered. Film time maps linearly to days 0..D; colors are interpolated between day frames. No wall clock is used.
import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { loadTwin } from './data.ts';
import type { TwinData } from './compute.ts';
import { TwinScene, type Clock } from './Scene.tsx';
import './twin3d.css';

export const FILM_FPS = 30;
export const FILM_DURATION = 15;

export interface FilmPoint { t: number; day: number; withoutDeaths: number; withDeaths: number; withoutDark: number; withDark: number }
export interface FilmApi {
  ready: Promise<void>;
  duration: number;
  seek(t: number): Promise<void>;
  /** For the capture script: what the footage shows, one point per day. */
  meta?: { id: string; seed: number; days: number; fps: number; duration: number; points: FilmPoint[] };
  error?: string;
}

declare global {
  interface Window { __film?: FilmApi }
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function Driver({ data, clock, onReady }: { data: TwinData; clock: React.MutableRefObject<Clock>; onReady: (seek: (t: number) => Promise<void>) => void }) {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    let chain = Promise.resolve();
    const seek = (t: number) => {
      chain = chain.then(async () => {
        const tt = Math.max(0, Math.min(FILM_DURATION, t));
        clock.current.day = (tt / FILM_DURATION) * data.days;
        clock.current.pulseT = tt;
        advance(tt * 1000);
        await nextFrame();
      });
      return chain;
    };
    seek(0).then(() => onReady(seek));
  }, [advance, data, clock, onReady]);
  return null;
}

export default function Film({ id }: { id: string }) {
  const [data, setData] = useState<TwinData | null>(null);
  const clock = useRef<Clock>({ day: 0, pulseT: 0, pulse: true });
  const api = useRef<{ resolve: () => void; reject: (e: Error) => void; seek: ((t: number) => Promise<void>) | null } | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('film-mode');
    let resolve!: () => void, reject!: (e: Error) => void;
    const ready = new Promise<void>((a, b) => { resolve = a; reject = b; });
    api.current = { resolve, reject, seek: null };
    const film: FilmApi = {
      ready,
      duration: FILM_DURATION,
      seek: (t) => (api.current?.seek ? api.current.seek(t) : ready.then(() => api.current!.seek!(t))),
    };
    window.__film = film;
    loadTwin(id).then(
      (d) => {
        film.meta = {
          id: d.id, seed: d.seed, days: d.days, fps: FILM_FPS, duration: FILM_DURATION,
          points: Array.from({ length: d.days + 1 }, (_, day) => ({
            t: Math.round((day / d.days) * FILM_DURATION * 1000) / 1000,
            day,
            withoutDeaths: Math.round(d.without.deaths[day]),
            withDeaths: Math.round(d.with.deaths[day]),
            withoutDark: d.without.dark[day],
            withDark: d.with.dark[day],
          })),
        };
        setData(d);
      },
      (e: unknown) => { film.error = String(e); reject(e instanceof Error ? e : new Error(String(e))); },
    );
    return () => { document.documentElement.classList.remove('film-mode'); delete window.__film; };
  }, [id]);

  const onReady = useRef((seek: (t: number) => Promise<void>) => {
    if (!api.current) return;
    api.current.seek = seek;
    api.current.resolve();
  }).current;

  return (
    <div className="film-frame">
      {data && (
        <Canvas
          frameloop="never"
          dpr={1}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          camera={{ fov: 28, position: [0, 0, 60] }}
        >
          <TwinScene data={data} clock={clock} film />
          <Driver data={data} clock={clock} onReady={onReady} />
        </Canvas>
      )}
    </div>
  );
}
