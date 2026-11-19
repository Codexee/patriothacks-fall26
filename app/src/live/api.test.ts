// The Vercel function app/api/eia.ts, run locally with fetch mocked (no account, no network).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../api/eia.ts';
import { toHourRows, type EiaPayload } from './data.ts';

const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process;
const call = (qs: string) => GET(new Request(`https://example.test/api/eia${qs}`));

describe('api/eia', () => {
  const saved = proc.env.EIA_API_KEY;
  beforeEach(() => {
    delete proc.env.EIA_API_KEY;
  });
  afterEach(() => {
    if (saved === undefined) delete proc.env.EIA_API_KEY;
    else proc.env.EIA_API_KEY = saved;
    vi.unstubAllGlobals();
  });

  it('answers 400 for a bad balancing area code', async () => {
    proc.env.EIA_API_KEY = 'test-key';
    for (const qs of ['', '?ba=', '?ba=E', '?ba=ERCO;DROP', '?ba=TOOLONGCODE']) {
      const res = await call(qs);
      expect(res.status, qs).toBe(400);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('answers 503 without a key', async () => {
    const res = await call('?ba=ERCO');
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/EIA_API_KEY/);
  });

  it('answers 200 with region and fuel rows from a mocked EIA response', async () => {
    proc.env.EIA_API_KEY = 'test-key';
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      const data = url.includes('/region-data/')
        ? [
            { period: '2026-11-18T05', respondent: 'ERCO', type: 'D', value: '47872' },
            { period: '2026-11-18T05', respondent: 'ERCO', type: 'DF', value: 47800 },
          ]
        : [{ period: '2026-11-18T05', respondent: 'ERCO', fueltype: 'NG', value: '20000' }];
      return new Response(JSON.stringify({ response: { data } }), { status: 200 });
    });
    const res = await call('?ba=erco');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=600, s-maxage=600');
    const body = (await res.json()) as EiaPayload;
    expect(body.ba).toBe('ERCO');
    expect(body.source).toBe('eia');
    expect(body.region).toEqual([
      { period: '2026-11-18T05', type: 'D', value: '47872' },
      { period: '2026-11-18T05', type: 'DF', value: 47800 },
    ]);
    expect(body.fuel).toEqual([{ period: '2026-11-18T05', fueltype: 'NG', value: '20000' }]);
    // The browser can read it.
    expect(toHourRows(body)[0]).toMatchObject({ demand: 47872, forecast: 47800, gen_gas: 20000 });
    // Both EIA routes were called with the key and the area; the key never reaches the response.
    expect(urls.some((u) => u.includes('/region-data/') && u.includes('api_key=test-key') && u.includes('ERCO'))).toBe(true);
    expect(urls.some((u) => u.includes('/fuel-type-data/'))).toBe(true);
    expect(JSON.stringify(body)).not.toContain('test-key');
  });

  it('answers 502 when EIA fails, without the key in the message', async () => {
    proc.env.EIA_API_KEY = 'test-key';
    vi.stubGlobal('fetch', async () => new Response('down', { status: 500 }));
    const res = await call('?ba=ERCO');
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toContain('test-key');
  });
});
