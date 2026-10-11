/**
 * Stage geometry and timeline constants, measured from the reference video.
 * All coordinates are in the video's own pixel space (880 × 720), which is the
 * SVG viewBox, so every layer lines up 1:1 with the source frames.
 */

export const STAGE = { width: 880, height: 720 };

/** Timeline (seconds). Measured from the reference video (24 fps); the outro is custom. */
export const TIMELINE = {
  cycle: 5.02,
  streaks: [0.3, 0.895], // grey speed lines during the fall, gone before contact (0.917 s)
  landing: 22 / 24, // first contact with the scale (0.917 s)
  dotsIn: 1.13, // "....." lights as the bag tumbles and its right side comes down onto the scale (1.125 s)
  reveal: [2.1, 2.38, 2.66, 2.94, 3.22], // once the bag has settled: S, W, i, S, H, each pip cross-fading into its letter (0.14 s)
  settled: 50 / 24, // bag fully at rest (2.083 s)
  wordmark: 3.36, // "SWiSH" complete — onComplete fires here
  holdEnd: 4.62, // SWiSH held until here; play-once mode holds forever
  fadedOut: 4.92, // looping: bag, its shadow and the display faded out in place; the drop replays
};

/** The scale's display glass (dark area of the plate). The readout is laid out inside it (readout.js). */
export const GLASS = { x: 308.75, y: 595.5, width: 263.25, height: 53.25 };
/** Lit segment colour, shared by the readout and the standby LED (the reference project's #2FE8AC). */
export const LCD_GREEN = '#2FE8AC';
/** Standby LED: always lit, at the left end of the display glass (glass spans x 308.75–572, y 595.5–648.75). */
export const LED = { x: 329, y: 622, r: 2.6, halo: 9 };

/**
 * Grey speed streaks during the fall, in resting-bag coordinates: two short vertical lines above
 * each upper corner of the bag (an inner and a slightly lower outer one), transparent at both
 * ends and strongest just above the bag. They are painted behind the bag and follow its upper
 * corners along the measured path (keyframes swish-loader-sk<i>, in this order).
 */
const TRAIL = [[0, 0], [0.4, 0.45], [0.78, 1], [1, 0]];
export const STREAKS = [
  { x: 312, y1: 120, y2: 292, width: 2, stops: TRAIL },
  { x: 296, y1: 178, y2: 338, width: 1.6, stops: TRAIL },
  { x: 566, y1: 104, y2: 290, width: 1.8, stops: TRAIL },
  { x: 582, y1: 166, y2: 334, width: 1.5, stops: TRAIL },
];
export const STREAK_COLOR = '#2b2c2e';

/** Backdrop extension: 3× the stage in each direction, centred on it. */
export const BACKDROP = { x: -880, y: -720, width: 2640, height: 2160 };
export const BACKDROP_COLOR = '#d0d0d2';
