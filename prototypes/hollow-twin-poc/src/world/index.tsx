// STUB: the world workstream replaces this with the PixiJS cutaway.
import type { WorldProps } from '../sim/types.ts';
export function World({ frame }: WorldProps) {
  return <div style={{ color: '#ccc', padding: 16 }}>World stub: day {frame.day}, {frame.sections.length} sections</div>;
}
