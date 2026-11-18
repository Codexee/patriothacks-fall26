// PROTOTYPE: the names people see for each module of the Residents' System, named after the problem it solves.
// The code keys (earlyWarning, snow, …) stay the same; only these labels appear on screen.
import type { ToolKey } from '../sim/types.ts';

export const MODULE_NAMES: Record<ToolKey, string> = {
  earlyWarning: 'Blackout Warning',
  fairShare: 'Fair Rationing',
  ledger: 'Truth Check',
  snow: 'Water Safety',
  lantern: 'Off-Network Messaging',
  kin: 'Family Check-In',
  layout: 'Cooling',
  larder: 'Food Sharing',
  witness: 'Surface Truth',
};

/** The name to show for a module key (or the key itself, if unknown). */
export function moduleName(key: string): string {
  return (MODULE_NAMES as Record<string, string>)[key] ?? key;
}
