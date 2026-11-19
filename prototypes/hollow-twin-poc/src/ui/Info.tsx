// UI branch: a small "i" that shows a description on hover or focus, and stays open when clicked.
// The popup is drawn on top of the whole page (a portal with fixed position) and kept inside the window, so a
// neighboring panel or a scrolling container can never cover or cut it.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const WIDTH = 300, GAP = 8, MARGIN = 10;

export function Info({ children, label = 'More information' }: { children: ReactNode; label?: string }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const open = hover || pinned;

  // Place the popup under the icon (or above it when there is no room), clamped to the window.
  useLayoutEffect(() => {
    if (!open || !btn.current) { setPos(null); return; }
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const h = pop.current?.offsetHeight ?? 120;
      const w = Math.min(WIDTH, window.innerWidth - 2 * MARGIN);
      const left = Math.max(MARGIN, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - MARGIN));
      const below = r.bottom + GAP;
      const top = below + h > window.innerHeight - MARGIN ? Math.max(MARGIN, r.top - GAP - h) : below;
      setPos({ left, top });
    };
    place();
    const raf = requestAnimationFrame(place); // again once the popup's real height is known
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open]);

  return (
    <span className="src info-wrap" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button ref={btn} type="button" className="info" aria-label={label} aria-expanded={open}
        onClick={() => setPinned((v) => !v)} onFocus={() => setHover(true)} onBlur={() => { setHover(false); setPinned(false); }}>
        ⓘ
      </button>
      {open && createPortal(
        <span ref={pop} className="src-pop info-pop" role="note"
          style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: Math.min(WIDTH, window.innerWidth - 2 * MARGIN) }}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}
