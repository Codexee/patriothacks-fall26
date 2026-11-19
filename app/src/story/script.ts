// The story script. It is data: each beat gives a time and the values that apply from that time.
// Number values (camera, clock, basemap, veil) move smoothly from one beat to the next beat that
// sets them. The other values change at the time of their beat.
//
// The script contains no event id and no numbers of an event. The player fills the captions from
// the hero event that the URL selects, so the same script plays Texas 2021 when its data arrives.

import type { HeroSlug } from '../contracts.ts';

export interface Camera {
  zoom: number;      // added to the zoom that puts the dark counties in the frame
  pitch: number;     // degrees; in the "below" part this is the angle of the look upward
  bearing: number;
  north?: number;    // move the look-at point north, in degrees of latitude
}

/** Clock positions are relative to the event, so they fit any replay. */
export type ClockMark =
  | { at: 'peak'; plus?: number }          // the hour with the most customers out
  | { at: 'firstOutage'; plus?: number }   // plus = hours; negative = before
  | { at: 'firstAlert'; plus?: number };   // the first alert (leadHours, else leadHoursNoForecast, else 12 h before the outage)

export type CaptionId = 'hollow' | 'reveal' | 'levels' | 'warned' | 'check' | 'proof';

export interface Beat {
  t: number;                 // seconds from the start
  camera?: Camera;
  clock?: ClockMark;
  basemap?: number;          // 0 = the Hollow, 1 = the Earth basemap
  veil?: number;             // 0..1 dark cover, for the move through the surface
  below?: boolean;           // true = the camera is below the surface and looks up
  labels?: 'hollow' | 'earth' | 'none';
  caption?: CaptionId | null;
  chart?: boolean;           // the risk line
  list?: boolean;            // the check-first list
  section?: number;          // 0..1 opacity of the Hollow cross-section over the map
}

export const STORY_SECONDS = 35.5;

export const SCRIPT: Beat[] = [
  // (a) 0-8 s. The Hollow: below the surface, the districts hang at their depths.
  { t: 0, below: true, basemap: 0, veil: 1, section: 0, labels: 'hollow', caption: 'hollow', chart: false, list: false,
    camera: { zoom: 1.0, pitch: 62, bearing: -14 }, clock: { at: 'peak' } },
  { t: 1.2, veil: 0 },
  { t: 8, veil: 0, camera: { zoom: 0.8, pitch: 69, bearing: 4 }, clock: { at: 'peak', plus: 8 } },

  // (b) 8-14 s. The camera goes up through the surface. The basemap and the Earth names come in.
  { t: 9.5, veil: 1, camera: { zoom: 0.72, pitch: 86, bearing: 8 }, caption: null, labels: 'none' },
  { t: 9.5, below: false, caption: 'reveal' },
  { t: 10.5, veil: 0, basemap: 0, labels: 'earth' },
  { t: 13, basemap: 1 },
  { t: 14, camera: { zoom: 0.2, pitch: 47, bearing: 0, north: 0.4 }, clock: { at: 'peak', plus: 8 }, section: 0, labels: 'none', caption: null },

  // (b2) 14-19.6 s. The same counties as the levels of the Hollow. The event plays; the levels go dark.
  { t: 14.7, section: 1, clock: { at: 'firstOutage', plus: -6 } },
  { t: 15.0, caption: 'levels' },
  { t: 19.0, section: 1, clock: { at: 'peak', plus: 24 } },
  { t: 19.6, section: 0, camera: { zoom: 0.2, pitch: 47, bearing: 0, north: 0.4 } },

  // (c) 19.6-29.4 s. Back to 72 h before the first outage. The clock plays to the first alert, where
  // the risk line crosses the alert level and the warning caption comes in. Then the outage plays.
  { t: 19.6, chart: true, caption: null },
  { t: 20.8, clock: { at: 'firstOutage', plus: -72 } },
  { t: 23.2, clock: { at: 'firstAlert' }, caption: 'warned' },
  { t: 26.8, caption: 'check', list: true },
  { t: 29.4, camera: { zoom: 0.05, pitch: 42, bearing: -5, north: 0.4 }, clock: { at: 'peak', plus: 30 } },

  // (d) 29.4-35.5 s. The proof.
  { t: 29.4, caption: 'proof' },
  { t: 35.5, camera: { zoom: -0.12, pitch: 36, bearing: -9, north: 0.4 }, clock: { at: 'peak', plus: 72 } },
];

/** Facts about one hero event that are not in the data files. Each one has its source. The player
 *  shows `line` after the warning caption, and fills {h} with the hours from the first alert to `utc`.
 *  The replay shows `utc` as the first official action (the "Without" view). */
export interface HeroFact {
  utc: string;        // time of the first official action, UTC
  action: string;     // what that action was, for the replay ("ERCOT load-shed order")
  line: string;       // story caption line after the warning; {h} = hours from the first alert to utc
  source: string;
  loadShed: boolean;  // rotating outages were ordered: show "Directorate's rule vs fair rotation"
}

export const HERO_FACTS: Partial<Record<HeroSlug, HeroFact>> = {
  texas2021: {
    // ERCOT declared EEA3 and ordered rotating outages on Feb 15, 2021 at 01:25 CST (07:25 UTC).
    // Source: ERCOT, "Review of February 2021 Extreme Cold Weather Event" (Feb 24, 2021), and the
    // FERC-NERC February 2021 Cold Weather Outages report (Nov 2021).
    utc: '2021-02-15 07:25:00',
    action: 'ERCOT load-shed order',
    loadShed: true,
    line: '{h} hours before the grid operator ordered blackouts.',
    source: 'ERCOT EEA3, Feb 15 2021 01:25 CST',
  },
};
