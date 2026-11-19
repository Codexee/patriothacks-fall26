// Vercel serverless function: GET /api/eia?ba=ERCO
//
// Fetches hourly EIA-930 data for one balancing area from the EIA API v2 and returns it with the
// fields the browser needs. The API key stays on the server (environment variable EIA_API_KEY).
//
//   region: electricity/rto/region-data, last 31 days. Types: D (demand), DF (day-ahead demand
//           forecast), NG (net generation), TI (total interchange). The browser shows the last
//           7 days; the model feature "demand against its 30-day peak" needs the 31 days.
//           The region request ends 36 h after now, so it also returns the day-ahead forecast (DF)
//           for the coming hours. The model feature fc12 needs the forecast for the next 12 hours.
//   fuel:   electricity/rto/fuel-type-data, last 8 days (7 days plus room for the 6-hour change).
//
// Response: { ba, fetchedAt, source: "eia", region: [{period, type, value}], fuel: [{period, fueltype, value}] }
// `period` is the EIA value, unchanged: "YYYY-MM-DDTHH", UTC, end of the hour.
// Errors: { error: "..." } with status 400 (bad `ba`), 503 (no key) or 502 (EIA failed).
// A saved sample of the response is in app/src/live/sample/eia-ERCO.json.

declare const process: { env: Record<string, string | undefined> };

const EIA = 'https://api.eia.gov/v2/electricity/rto';
const CACHE_SECONDS = 600; // 10 minutes
const REGION_DAYS = 31;
const FUEL_DAYS = 8;

interface EiaBody {
  response?: { data?: Record<string, unknown>[] };
  error?: unknown;
}

const hourStamp = (d: Date) => d.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"

function json(body: unknown, status: number, cache: boolean): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache
        ? `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`
        : 'no-store',
    },
  });
}

async function eiaRows(route: string, ba: string, days: number, key: string, now: Date, aheadHours = 0): Promise<Record<string, unknown>[]> {
  const q = new URLSearchParams();
  q.set('api_key', key);
  q.set('frequency', 'hourly');
  q.set('data[0]', 'value');
  q.set('facets[respondent][]', ba);
  q.set('start', hourStamp(new Date(now.getTime() - days * 86_400_000)));
  q.set('end', hourStamp(new Date(now.getTime() + aheadHours * 3_600_000)));
  q.set('sort[0][column]', 'period');
  q.set('sort[0][direction]', 'asc');
  q.set('offset', '0');
  q.set('length', '5000');
  const res = await fetch(`${EIA}/${route}/data/?${q}`, { signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`EIA ${route} answered ${res.status}`);
  const body = (await res.json()) as EiaBody;
  const data = body.response?.data;
  if (!Array.isArray(data)) throw new Error(`EIA ${route} sent no data`);
  return data;
}

export async function GET(request: Request): Promise<Response> {
  const ba = (new URL(request.url).searchParams.get('ba') ?? '').toUpperCase();
  if (!/^[A-Z0-9]{2,6}$/.test(ba)) {
    return json({ error: 'Give a balancing area code, for example ?ba=ERCO' }, 400, false);
  }
  const key = process.env.EIA_API_KEY;
  if (!key) return json({ error: 'The server has no EIA_API_KEY' }, 503, false);

  try {
    const now = new Date();
    const [region, fuel] = await Promise.all([
      eiaRows('region-data', ba, REGION_DAYS, key, now, 36),
      eiaRows('fuel-type-data', ba, FUEL_DAYS, key, now),
    ]);
    return json(
      {
        ba,
        fetchedAt: now.toISOString(),
        source: 'eia',
        region: region.map((r) => ({ period: r.period, type: r.type, value: r.value })),
        fuel: fuel.map((r) => ({ period: r.period, fueltype: r.fueltype, value: r.value })),
      },
      200,
      true,
    );
  } catch (err) {
    // The message never includes the request URL, so the key cannot leak.
    const reason = err instanceof Error && err.name === 'TimeoutError' ? 'EIA did not answer in time' : err instanceof Error ? err.message : 'EIA request failed';
    return json({ error: reason }, 502, false);
  }
}
