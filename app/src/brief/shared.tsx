// Small pieces shared by the brief, evidence and live pages.
import { useEffect, useState } from 'react';
import './shared.css';

export function PageNav({ current }: { current: 'brief' | 'evidence' | 'live' }) {
  const link = (key: string, href: string, label: string) => (
    <a href={href} aria-current={current === key ? 'page' : undefined}>{label}</a>
  );
  return (
    <nav className="pnav" aria-label="Pages">
      {link('map', '#/', 'Map')}
      {link('brief', '#/brief', 'County brief')}
      {link('evidence', '#/evidence', 'Evidence')}
      {link('live', '#/live', 'Live')}
    </nav>
  );
}

/** Fetch JSON. Fails with a plain message when the file is missing (a dev server sends HTML instead). */
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new Error(`${url}: not found`);
  return (await res.json()) as T;
}

export interface Loaded<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

const cache = new Map<string, Promise<unknown>>();

/** Load a JSON file once per URL. `url = null` loads nothing. */
export function useJson<T>(url: string | null): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ data: null, error: null, loading: url != null });
  useEffect(() => {
    if (url == null) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let live = true;
    setState({ data: null, error: null, loading: true });
    let p = cache.get(url) as Promise<T> | undefined;
    if (!p) {
      p = fetchJson<T>(url);
      cache.set(url, p);
      p.catch(() => cache.delete(url));
    }
    p.then(
      (data) => live && setState({ data, error: null, loading: false }),
      (err: Error) => live && setState({ data: null, error: err.message, loading: false }),
    );
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}

const intFmt = new Intl.NumberFormat('en-US');
export const fmtInt = (n: number | null | undefined) => (n == null ? 'not known' : intFmt.format(Math.round(n)));

/** A share 0..1 as a percent. Small values keep one decimal. */
export function fmtShare(x: number | null | undefined): string {
  if (x == null) return 'not known';
  const pct = x * 100;
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

/** "YYYY-MM-DD HH:MM:SS" (UTC) -> ms. */
export const parseUtc = (s: string) => Date.parse(s.replace(' ', 'T') + 'Z');

const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const fmtDay = (ms: number) => dayFmt.format(ms);
export const fmtTime = (ms: number) => `${timeFmt.format(ms)} UTC`;

export function fmtHours(h: number): string {
  if (h < 48) return `${Math.round(h)} h`;
  const d = h / 24;
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} days`;
}

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};
