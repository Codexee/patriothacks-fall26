// "How Blackout Warning works": the module's daily steps (src/product/earlyWarning.ts) as a flow, and an illustration
// of the blackout line. (The frozen constants are listed in the #/demo workstation's inspector, so not here.) The steps and meanings are taken from the module's
// own comments; the constant values come from scenarios.json (`tune`), never from this file.

const STEPS: { title: string; body: string; param?: string }[] = [
  { title: 'Read the blackout line', body: 'From yesterday’s outage reports, find how many levels from the top had power, hour by hour.' },
  { title: 'Infer plant output', body: 'Power reaches upper levels first, so the line implies the supply: the needs of every level above it.' },
  { title: 'Measure the trend', body: 'Compare with the day before at the same hours. Is supply rising or falling?', param: 'maxTrend' },
  { title: 'Forecast today', body: 'Yesterday’s line plus the trend gives today’s line, hour by hour: which levels go dark, when, for how long.' },
  { title: 'Ask for a load cut', body: 'Request enough non-essential saving that plants stop running at their limit, where they trip.', param: 'safeLoad' },
];

const asPct = (k: string, v: number) => (k === 'safeLoad' || k === 'assumedCompliance' ? `${Math.round(v * 100)}%` : k === 'maxTrend' ? `±${Math.round(v * 100)}%/day` : `+${Math.round(v * 100)}%`);

export function Pipeline({ tune }: { tune: Record<string, number> }) {
  return (
    <>
      <ol className="flow" aria-label="Blackout Warning, once a day">
        <li className="flow-io">
          <span className="flow-k">Inputs</span>
          <ul>
            <li>Residents’ outage reports</li>
            <li>Residents’ head count</li>
            <li>Directorate census</li>
          </ul>
        </li>
        {STEPS.map((s, i) => (
          <li key={s.title} className="flow-step">
            <span className="flow-k">{String(i + 1).padStart(2, '0')}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
            {s.param && tune[s.param] != null && <code className="flow-param">{s.param} = {tune[s.param]}</code>}
          </li>
        ))}
        <li className="flow-io out">
          <span className="flow-k">Output</span>
          <p>Plants stay under {tune.safeLoad != null ? asPct('safeLoad', tune.safeLoad) : 'their limit'} of output. No trip, no Hollow-wide blackout.</p>
        </li>
      </ol>

      <figure className="shaft-fig">
        <ShaftIllustration />
        <figcaption>
          <span className="eyebrow">Illustration · why residents’ reports are enough</span>
          Residents cannot see the plants, but they can see which levels are dark. Power reaches the upper levels first,
          so the deepest lit level tells them how much power the plants are making. When that line rises day over day,
          supply is falling, and the levels between the two lines are next.
        </figcaption>
      </figure>
    </>
  );
}

/** A schematic shaft of 50 levels: lit above yesterday's blackout line, dark below, with today's forecast line. */
function ShaftIllustration() {
  const levels = 50, top = 18, rowH = 4.6, w = 300, x0 = 40, sw = 150;
  const yesterday = 37, today = 30; // illustrative levels, not data
  const y = (l: number) => top + (l - 1) * rowH;
  return (
    <svg className="shaft" viewBox={`0 0 ${w + 120} ${top + levels * rowH + 24}`} role="img"
      aria-label="Illustration: a shaft of 50 levels. Levels 1 to 37 had power yesterday and levels below were dark. Yesterday's blackout line is at level 37; today's forecast line is at level 30, so levels 31 to 37 are at risk.">
      {Array.from({ length: levels }, (_, i) => {
        const l = i + 1;
        const cls = l <= today ? 'lit' : l <= yesterday ? 'risk' : 'dark';
        return <rect key={l} x={x0} y={y(l)} width={sw} height={rowH - 2} className={`lv ${cls}`} />;
      })}
      {[1, 25, 50].map((l) => (
        <text key={l} x={x0 - 12} y={y(l) + rowH / 2 + 1} className="lv-tick" textAnchor="end" dominantBaseline="middle">L{l}</text>
      ))}
      <line x1={x0 - 6} x2={x0 + sw + 14} y1={y(yesterday + 1) - 1} y2={y(yesterday + 1) - 1} className="ln-y" />
      <text x={x0 + sw + 20} y={y(yesterday + 1) - 1} className="lv-lab" dominantBaseline="middle">yesterday’s line · L{yesterday}</text>
      <line x1={x0 - 6} x2={x0 + sw + 14} y1={y(today + 1) - 1} y2={y(today + 1) - 1} className="ln-t" />
      <text x={x0 + sw + 20} y={y(today + 1) - 1} className="lv-lab t" dominantBaseline="middle">forecast today · L{today}</text>
      <text x={x0 + sw + 20} y={y((today + yesterday) / 2 + 1)} className="lv-sub" dominantBaseline="middle">at risk: warn early</text>
      <text x={x0} y={top - 7} className="lv-sub">power enters from the top</text>
    </svg>
  );
}
