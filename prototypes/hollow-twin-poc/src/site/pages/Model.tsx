// #/model — the residents-only check-first model, from checkfirst.json.
import type { MetricRow } from '../contracts.ts';
import type { SiteData } from '../data.ts';
import { href } from '../router.ts';
import { num } from '../format.ts';
import { BigMetric, ShareBars } from '../charts.tsx';
import { Generated, SourceLink, metricName } from '../parts.tsx';
import { Limits } from './Results.tsx';

export function Model({ data }: { data: SiteData }) {
  const m = data.checkfirst.data;
  const plainOf = new Map(m.inputs.map((i) => [i.name, i.hollowEquivalent]));
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Model 2 · residents’ data only · tested on real US outages</p>
        <h1 tabIndex={-1}>{m.name.replace(/\s*\(.*\)\s*$/, '')}</h1>
        <p className="lede">{m.task}</p>
        <dl className="facts spec">
          <div><dt>Method</dt><dd>{m.method}</dd></div>
          <div><dt>Train</dt><dd>{m.periods.train}</dd></div>
          <div><dt>Choose (dev)</dt><dd>{m.periods.dev}</dd></div>
          <div><dt>Test</dt><dd>{m.periods.test}</dd></div>
        </dl>
        <SourceLink source={m.source} />
      </header>

      <section aria-labelledby="h-test" className="block">
        <div className="block-head">
          <h2 id="h-test">Test result</h2>
          <p>{num(m.test.events)} real outage events ({num(m.test.areaEvents)} area-events) never seen in training. History ranks areas by their own past dark hours; chance is random.</p>
        </div>
        <div className="cf-metrics model-metrics">{m.test.rows.map((r) => <BigMetric key={r.metric} r={r} />)}</div>
        <details className="more">
          <summary>Table view</summary>
          <MetricTable caption={`Test set, ${m.periods.test}`} rows={m.test.rows} />
        </details>
        <details className="more">
          <summary>Dev set, used to choose the model</summary>
          <MetricTable caption={`Dev set, ${m.periods.dev} (${num(m.dev.events)} events, ${num(m.dev.areaEvents)} area-events)`} rows={m.dev.rows} />
        </details>
      </section>

      {m.comparison && (
        <section aria-labelledby="h-cmp" className="block">
          <div className="block-head">
            <h2 id="h-cmp">Against a model with weather</h2>
            <p>The same model given weather and grid-operator data, same test period. The difference is the cost of using residents’ data only.</p>
          </div>
          <CompareTable residents={m.test.rows} weather={m.comparison.rows} />
        </section>
      )}

      <div className="pair">
      <section aria-labelledby="h-imp" className="block">
        <div className="block-head">
          <h2 id="h-imp">What it relies on</h2>
          <p>Share of total tree gain, top inputs.</p>
        </div>
        <ShareBars items={m.importance.map((i) => ({ label: i.feature, share: i.share, note: plainOf.get(i.feature) }))} />
      </section>

      <section aria-labelledby="h-inputs" className="block">
        <div className="block-head">
          <h2 id="h-inputs">Inputs</h2>
          <p>{m.inputs.length} inputs, each with a source residents have in the Hollow.</p>
        </div>
        <details className="more">
          <summary>All {m.inputs.length} inputs, with their Hollow equivalent</summary>
        <div className="table-wrap">
          <table className="inputs-table">
            <caption className="sr-only">Every input the model reads, with its Hollow equivalent.</caption>
            <thead><tr><th scope="col">Input</th><th scope="col">In the real data</th><th scope="col">In the Hollow</th></tr></thead>
            <tbody>
              {m.inputs.map((i) => (
                <tr key={i.name}><th scope="row"><code>{i.name}</code></th><td>{i.plain}</td><td>{i.hollowEquivalent}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        </details>
        <h3>Excluded: residents do not have it</h3>
        <ul className="limits">{m.excluded.map((e) => <li key={e}>{e}</li>)}</ul>
      </section>

      </div>

      <div className="pair">
      {m.example && (
        <section aria-labelledby="h-ex" className="block">
          <div className="block-head">
            <h2 id="h-ex">Example: {m.example.event.split(/[,(]/)[0].trim()} <span className="h-note">{m.example.date}</span></h2>
            <p>{m.example.event}</p>
          </div>
          <div className="table-wrap">
            <table className="seed-table ex-table">
              <caption className="sr-only">Predicted and actual hours without power, top areas by the model’s rank.</caption>
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
        <div className="block-head"><h2 id="h-lim">Limits</h2></div>
        <Limits items={m.limits} shown={3} />
        <p><a className="text-link" href={href.results}>← Back to the results</a></p>
      </section>
      </div>
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
            <tr key={r.metric}><th scope="row" title={r.metric}>{metricName(r.metric)}</th><td>{cell(r.model)}</td><td>{cell(r.history)}</td><td>{cell(r.chance)}</td><td>{r.better}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareTable({ residents, weather }: { residents: MetricRow[]; weather: MetricRow[] }) {
  return (
    <div className="table-wrap">
      <table className="seed-table cmp-table">
        <caption className="sr-only">Test set: residents-only model against the model with weather and grid-operator inputs.</caption>
        <thead><tr><th scope="col">Metric</th><th scope="col">Residents-only</th><th scope="col">With weather</th><th scope="col">Difference</th><th scope="col">History</th></tr></thead>
        <tbody>
          {residents.map((r) => {
            const w = weather.find((x) => x.metric === r.metric);
            const d = w ? r.model - w.model : null;
            // Positive = residents-only is better, whichever direction the metric runs.
            const better = d == null ? null : r.better === 'higher' ? d : -d;
            return (
              <tr key={r.metric}>
                <th scope="row" title={r.metric}>{metricName(r.metric)}</th>
                <td className="with">{cell(r.model)}</td>
                <td>{w ? cell(w.model) : 'n/a'}</td>
                <td className={better == null ? '' : better >= 0 ? 'ok' : 'bad'}>{d == null ? 'n/a' : `${d >= 0 ? '+' : '−'}${num(Math.abs(d), digits(r.model))}`}</td>
                <td>{cell(r.history)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
