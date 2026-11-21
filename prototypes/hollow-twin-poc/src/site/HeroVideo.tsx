// The homepage film: a 15 s HyperFrames render per disaster (video/, `render --batch`), copied to public/films/.
// Autoplays muted and loops beside the headline; a dropdown switches the disaster; a button pauses it.
// Under prefers-reduced-motion it does not autoplay: the poster shows and the button starts it.
import { useEffect, useRef, useState } from 'react';
import type { ScenarioResult } from './contracts.ts';
import { displayName } from './parts.tsx';
import { href } from './router.ts';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function HeroVideo({ scenarios }: { scenarios: ScenarioResult[] }) {
  const [id, setId] = useState(scenarios[0]?.id ?? 'twoplants');
  const [playing, setPlaying] = useState(!reduced());
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const s = scenarios.find((x) => x.id === id) ?? scenarios[0];

  // A new disaster loads a new file; keep the play state the visitor chose.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    setFailed(false);
    v.load();
    if (playing) v.play().catch(() => setPlaying(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
    else { v.pause(); setPlaying(false); }
  }

  if (!s) return null;
  return (
    <figure className="hero-video">
      <div className="hv-frame">
        {failed ? (
          <p className="hv-missing">The film for “{displayName(s)}” is not rendered yet.</p>
        ) : (
          <video
            ref={ref}
            key={id}
            src={`films/${id}.mp4`}
            poster={`films/${id}.jpg`}
            muted
            loop
            playsInline
            autoPlay={playing}
            preload="metadata"
            aria-label={`Film, 15 seconds, no sound: ${displayName(s)}. Left, the Hollow without HollowGuard; right, with it. Same disaster, same seed.`}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <figcaption className="hv-bar">
        <label className="hv-pick">
          <span>Disaster</span>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {scenarios.map((x) => <option key={x.id} value={x.id}>{displayName(x)}</option>)}
          </select>
        </label>
        <button type="button" className="hv-play" onClick={toggle} aria-pressed={playing} disabled={failed}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <a className="hv-link" href={href.demo(id)}>Run it in 3D</a>
      </figcaption>
    </figure>
  );
}
