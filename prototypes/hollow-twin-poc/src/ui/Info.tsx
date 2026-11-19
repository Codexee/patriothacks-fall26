// UI branch: a small "i" that shows a description on hover or focus, and stays open when clicked.
import { useState, type ReactNode } from 'react';

export function Info({ children, label = 'More information' }: { children: ReactNode; label?: string }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  return (
    <span className="src info-wrap" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button type="button" className="info" aria-label={label} aria-expanded={open}
        onClick={() => setPinned((v) => !v)} onFocus={() => setHover(true)} onBlur={() => { setHover(false); setPinned(false); }}>
        ⓘ
      </button>
      {open && <span className="src-pop" role="note">{children}</span>}
    </span>
  );
}
