import type { CSSProperties, NamedExoticComponent } from 'react';

export interface SwishLoaderProps {
  /** Default false: plays once (bag drops, settles, SWiSH is typed) and holds the finished frame. true loops every 5.02 s (the bag and display fade out in place and the drop replays). */
  loop?: boolean;
  /** Fixed overlay covering the viewport. Default false (fills its parent; the loader is centred in it). */
  fullscreen?: boolean;
  /** 'auto' (default) shows a still frame when the OS asks for reduced motion; 'always' animates regardless. */
  motion?: 'auto' | 'always';
  /** Playback-rate multiplier (2 = twice as fast), clamped to 0.1–10. Default 1. */
  speed?: number;
  /** Accessible status text. Default "Loading". */
  label?: string;
  /** Fires each time SWISH completes on the display (3.36 s into each cycle). */
  onComplete?: () => void;
  /** Fires once, when the animation (or the reduced-motion still frame) starts. */
  onStart?: () => void;
  /**
   * Bag footage. 'auto' (default) picks the 1x (~460 KB) or 2x (~1.1 MB) set by screen size and
   * network, and none on Save-Data, 2G or a measured slow connection; 'off' always uses the
   * built-in bag (no download). The footage is cancelled if the drop starts without it.
   */
  footage?: 'auto' | 'off' | '1x' | '2x';
  /** Line shown under the loader. Default "Still working… good food takes a moment."; false hides it. */
  quote?: string | false;
  className?: string;
  /** Passed to the root. Set `'--swish-size'` (a CSS length) to choose the loader's height. */
  style?: CSSProperties;
}

declare const SwishLoader: NamedExoticComponent<SwishLoaderProps>;
export default SwishLoader;
export { SwishLoader };
