// STUB: the ui workstream replaces this with the fixed panel, controls, hover card and compare view.
import { useState } from 'react';
import { sim } from '../sim/index.ts';
import { NO_TOOLS } from '../sim/types.ts';
import { World } from '../world/index.tsx';
export function App() {
  const [state, setState] = useState(() => sim.createState(sim.scenarios[0].id, 1, NO_TOOLS));
  return (
    <div style={{ background: '#0b0b10', minHeight: '100vh' }}>
      <button onClick={() => setState(sim.stepDay(state, []).state)}>Next day</button>
      <World frame={state.lastFrame} onHover={() => {}} />
    </div>
  );
}
