// REBUILD: the names people see for each feature of HollowGuard, and the step-by-step progress through
// the track's 15 problems. The code keys (earlyWarning, …) stay the same; only these labels appear on screen.
import type { ToolKey } from '../sim/types.ts';

export const MODULE_NAMES: Record<ToolKey, string> = {
  earlyWarning: 'Blackout Warning',
  fairShare: 'Fair Share',
  ledger: 'Outbreak Tracker',
  snow: 'Water Safety',
  lantern: 'Off-Network Messaging',
  kin: 'Family Check-In',
  layout: 'Cooling',
  larder: 'Food Sharing',
  witness: 'Surface Truth',
};

/** Features built so far in the rebuild, in the order they were added. */
export const BUILT: ToolKey[] = ['earlyWarning', 'fairShare', 'snow', 'lantern', 'kin', 'ledger', 'larder']; // Cooling ('layout') is built but not shipped: no measurable effect (Nov 20)

/** The track's 15 problems, and the feature that answers each one once it is built. */
export const PROBLEMS: { n: number; title: string; feature: ToolKey | null }[] = [
  { n: 1, title: 'Warn before the power or air cuts out', feature: 'earlyWarning' },
  { n: 2, title: 'Share power, water and food fairly', feature: 'fairShare' },
  { n: 3, title: 'Keep the deep levels livable (heat)', feature: null },
  { n: 4, title: 'Catch bad water', feature: 'snow' },
  { n: 5, title: 'Keep flooded tunnels safe', feature: null },
  { n: 6, title: 'Find or share space', feature: null },
  { n: 7, title: 'Organize without the network', feature: 'lantern' },
  { n: 8, title: 'Reconnect families', feature: 'kin' },
  { n: 9, title: 'Track the real outbreak', feature: 'ledger' },
  { n: 10, title: 'Get care to people who cannot reach it', feature: null },
  { n: 11, title: 'Life without sunlight', feature: null },
  { n: 12, title: 'Grow and share food', feature: 'larder' },
  { n: 13, title: 'Prove whether the surface is safe', feature: null },
  { n: 14, title: 'Decide who goes up first, and how', feature: null },
  { n: 15, title: 'Plan the move up', feature: null },
];

/** The name to show for a feature key (or the key itself, if unknown). */
export function moduleName(key: string): string {
  return (MODULE_NAMES as Record<string, string>)[key] ?? key;
}
