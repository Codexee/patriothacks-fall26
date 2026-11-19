// #/model — the residents-only check-first model, from checkfirst.json.
import type { MetricRow } from '../contracts.ts';
import type { SiteData } from '../data.ts';
import { href } from '../router.ts';
import { num } from '../format.ts';
import { MetricBars, ShareBars } from '../charts.tsx';
import { Generated, SourceLink } from '../parts.tsx';

export function Model({ data }: { data: SiteData }) {
  const m = data.checkfirst.data;
  const plainOf = new Map(m.inputs.map((i) => [i.name, i.hollowEquivalent]));
  return (
    <>
      <header className="page-head">
        <h1 tabIndex={-1}>{m.name}</h1>
        <p className="lede">{m.task}</p>
        <dl className="facts">
          <div><dt>Method</dt><dd>{m.method}</dd></div>
          <div><dt>Train</dt><dd>{m.periods.train}</dd></div>
          <div><dt>Choose (dev)</dt><dd>{m.periods.dev}</dd></div>
          <div><dt>Test</dt><dd>{m.periods.test}</dd></div>
        </dl>
        <SourceLink source={m.source} />
      </header>

      <section aria-labelledby="h-test" className="block">
        <h2 id="h-test">Test result</h2>
        <p className="lede">
          {num(m.test.events)} real outage events and {num(m.test.areaEvents)} area-events the model never saw during training or choice.
          “History” ranks each area by its own past mean dark hours. “Chance” is a random ranking.
        </p>
        <MetricBars rows={m.test.rows} />
        <MetricTable caption={`Test set, ${m.periods.test}`} rows={m.test.rows} />
        <MetricTable caption={`Dev set, ${m.periods.dev} (${num(m.dev.events)} events, ${num(m.dev.areaEvents)} area-events), used to choose the model`} rows={m.dev.rows} />
      </section>

      <section aria-labelledby="h-inputs" className="block">
        <h2 id="h-inputs">Inputs, and what residents would use in the Hollow</h2>
        <div className="table-wrap">
          <table className="inputs-table">
            <caption>Every input the model reads. Each one has a source that residents control.</caption>
            <thead><tr><th scope="col">Input</th><th scope="col">In the real data</th><th scope="col">In the Hollow</th></tr></thead>
            <tbody>
              {m.inputs.map((i) => (
                <tr key={i.name}><th scope="row"><code>{i.name}</code></th><td>{i.plain}</td><td>{i.hollowEquivalent}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Excluded, because residents do not have it</h3>
        <ul className="limits">{m.excluded.map((e) => <li key={e}>{e}</li>)}</ul>
      </section>

      {m.comparison && (
        <section aria-labelledby="h-cmp" className="block">
          <h2 id="h-cmp">For reference: the model with weather</h2>
          <p className="lede">{m.comparison.label}. Same test period. The difference is the cost of using residents’ data only.</p>
          <MetricBars rows={m.comparison.rows} labels={['With weather', 'History', 'Chance']} />
          <CompareTable residents={m.test.rows} weather={m.comparison.rows} />
        </section>
      )}

      <section aria-labelledby="h-imp" className="block">
        <h2 id="h-imp">What the model uses most</h2>
        <p className="lede">Share of the total gain in the trees, for the top inputs.</p>
        <ShareBars items={m.importance.map((i) => ({ label: i.feature, share: i.share, note: plainOf.get(i.feature) }))} />
      </section>

      {m.example && (
        <section aria-labelledby="h-ex" className="block">
          <h2 id="h-ex">Example: {m.example.event}, {m.example.date}</h2>
          <p className="lede">The model’s first areas to check, in its order, with the real dark hours.</p>
          <div className="table-wrap">
            <table className="seed-table ex-table">
              <caption>Predicted and actual hours without power, top areas by the model’s rank.</caption>
              <thead><tr><th scope="col">Rank</th><th scope="col">Area</th><th scope="col">Predicted hours</th><th scope="col">Actual hours</th></tr></thead>
              <tbody>
                {m.example.topAreas.map((a, i) => (
                  <tr key={a.name}><td>{i + 1}</td><th scope="row">{a.name}</th><td>{num(a.predictedHours, 1)}</td><td>{num(a.actualHours, 1)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="h-lim" className="block">
        <h2 id="h-lim">Limits</h2>
        <ul className="limits">{m.limits.map((l) => <li key={l}>{l}</li>)}</ul>
        <p><a className="text-link" href={href.results}>Back to the disaster results</a></p>
      </section>
      <Generated file={m} label="Model results" />
    </>
  );
}

const digits = (v: number | null) => (v == null ? 0 : Math.abs(v) > 1.5 ? 2 : 3);
const cell = (v: number | null) => (v == null ? 'n/a' : num(v, digits(v)));

function MetricTable({ caption, rows }: { caption: string; rows: MetricRow[] }) {
  return (
    <div className="table-wrap">
      <table className="seed-table">
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Metric</th><th scope="col">Model</th><th scope="col">History</th><th scope="col">Chance</th><th scope="col">Better</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metric}><th scope="row">{r.metric}</th><td>{cell(r.model)}</td><td>{cell(r.history)}</td><td>{cell(r.chance)}</td><td>{r.better}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareTable({ residents, weather }: { residents: MetricRow[]; weather: MetricRow[] }) {
  return (
    <div className="table-wrap">
      <table className="seed-table">
        <caption>Test set: residents-only model against the model with weather and grid-operator inputs.</caption>
        <thead><tr><th scope="col">Metric</th><th scope="col">Residents-only</th><th scope="col">With weather</th></tr></thead>
        <tbody>
          {residents.map((r) => {
            const w = weather.find((x) => x.metric === r.metric);
            return <tr key={r.metric}><th scope="row">{r.metric}</th><td>{cell(r.model)}</td><td>{w ? cell(w.model) : 'n/a'}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
