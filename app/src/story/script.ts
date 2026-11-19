// The story script. It is data: each beat gives a time and the values that apply from that time.
// Number values (camera, clock, basemap, veil) move smoothly from one beat to the next beat that
// sets them. The other values change at the time of their beat.
//
// The script contains no event id and no numbers of an event. The player fills the captions from
// the hero event that the URL selects, so the same script plays Texas 2021 when its data arrives.

export interface Camera {
  zoom: number;      // added to the zoom that puts the dark counties in the frame
  pitch: number;     // degrees; in the "below" part this is the angle of the look upward
  bearing: number;
  north?: number;    // move the look-at point north, in degrees of latitude
}

/** Clock positions are relative to the event, so they fit any replay. */
export type ClockMark =
  | { at: 'peak'; plus?: number }          // the hour with the most customers out
  | { at: 'firstOutage'; plus?: number };  // plus = hours; negative = before

export type CaptionId = 'hollow' | 'reveal' | 'warned' | 'proof';

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
}

export const STORY_SECONDS = 30;

export const SCRIPT: Beat[] = [
  // (a) 0-8 s. The Hollow: below the surface, the districts hang at their depths.
  { t: 0, below: true, basemap: 0, veil: 1, labels: 'hollow', caption: 'hollow', chart: false, list: false,
    camera: { zoom: 1.0, pitch: 62, bearing: -14 }, clock: { at: 'peak' } },
  { t: 1.2, veil: 0 },
  { t: 8, veil: 0, camera: { zoom: 0.8, pitch: 69, bearing: 4 }, clock: { at: 'peak', plus: 8 } },

  // (b) 8-14 s. The camera goes up through the surface. The basemap and the Earth names come in.
  { t: 9.5, veil: 1, camera: { zoom: 0.72, pitch: 86, bearing: 8 }, caption: null, labels: 'none' },
  { t: 9.5, below: false, caption: 'reveal' },
  { t: 10.5, veil: 0, basemap: 0, labels: 'earth' },
  { t: 13, basemap: 1 },
  { t: 14, camera: { zoom: 0.2, pitch: 47, bearing: 0, north: 0.4 }, clock: { at: 'peak', plus: 8 } },

  // (c) 14-24 s. Back to 72 h before the first outage; the warning; then the outage plays.
  { t: 14, caption: 'warned', chart: true, labels: 'none' },
  { t: 16.4, clock: { at: 'firstOutage', plus: -72 } },
  { t: 17.2, clock: { at: 'firstOutage', plus: -72 }, list: true },
  { t: 24, camera: { zoom: 0.05, pitch: 42, bearing: -5, north: 0.4 }, clock: { at: 'peak', plus: 30 } },

  // (d) 24-30 s. The proof.
  { t: 24, caption: 'proof' },
  { t: 30, camera: { zoom: -0.12, pitch: 36, bearing: -9, north: 0.4 }, clock: { at: 'peak', plus: 72 } },
];
