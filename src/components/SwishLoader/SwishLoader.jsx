import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import * as INLINE from './assets';
import bagSheet0 from './assets/bag-frames-0.webp';
import bagSheet1 from './assets/bag-frames-1.webp';
import groundSheet from './assets/ground-frames.webp';
import sealSheet from './assets/seal-frames.webp';
import { BAG_FRAMES, BAG_REST, BAG_SHEETS, GROUND, REST_FRAME, SEAL_FRAMES, SEAL_SHEET } from './frames';
import {
  TIMELINE,
  BACKDROP,
  BACKDROP_COLOR,
  LCD_GREEN,
  LED,
  STAGE,
  STREAK_COLOR,
  STREAKS,
} from './geometry';
import { BLOOM_STD, READOUT_CELLS, SEG_ON } from './readout';
import './SwishLoader.timeline.css';
import './SwishLoader.css';

// Bundlers return a URL string for image imports; Next.js returns { src }.
const assetUrl = (mod) => (typeof mod === 'string' ? mod : (mod && mod.src) || '');
const SHEET_URLS = [assetUrl(bagSheet0), assetUrl(bagSheet1)];
const GROUND_URL = assetUrl(groundSheet);
const SEAL_URL = assetUrl(sealSheet);

const INLINE_SOURCES = [INLINE.backdrop, INLINE.plate, INLINE.bagRest, INLINE.groundRest, INLINE.sealRest];
const FRAME_SOURCES = [...SHEET_URLS, GROUND_URL, SEAL_URL];
// If the footage is not decoded by then, start right away with the built-in fallback
// (never leave an empty scale on screen) and switch to the footage once it arrives.
const FRAME_TIMEOUT_MS = 700;
// Ground tiles are cropped 2 units inside their (fully feathered) edges, so texture filtering at
// the crop never samples the neighbouring tile — that showed as a faint outline at fractional scales.
const GROUND_INSET = 2;
// Top haze (stage y): fully backdrop above `from`, fully clear below `to`.
const TOP_FADE = { from: 0, to: 36 };

// Per-frame animations (visibility + glide), built once so renders allocate nothing.
const frameAnim = (k) => `swish-loader-o${k}`;
const glideAnim = (k) => `swish-loader-o${k}, swish-loader-g${k}`;
const GROUND_STYLES = BAG_FRAMES.map(([k]) => Object.freeze({ animationName: frameAnim(k) }));
const BAG_STYLES = BAG_FRAMES.map(([k]) => Object.freeze({ animationName: glideAnim(k) }));
const REST_GROUND_STYLE = Object.freeze({ animationName: frameAnim(REST_FRAME) });
const REST_BAG_STYLE = Object.freeze({ animationName: glideAnim(REST_FRAME) });
const STREAK_STYLES = STREAKS.map((_, i) => Object.freeze({ animationName: `swish-loader-sk${i}` }));
const DOT_STYLES = READOUT_CELLS.map((_, i) => Object.freeze({ animationName: `swish-loader-dot${i}` }));
const GLYPH_STYLES = READOUT_CELLS.map((_, i) => Object.freeze({ animationName: `swish-loader-gl${i}` }));

// useLayoutEffect on the client (pause before first paint), useEffect on the server (no warning).
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// The bag rests on the scale (fallback and footage identical) from just after it settles until the outro.
const REST_FROM = (TIMELINE.settled + 0.04) / TIMELINE.cycle;
const REST_TO = (TIMELINE.holdEnd - 0.08) / TIMELINE.cycle;

/** Milliseconds until the fallback bag is at rest (0 = now), read from its running animation. */
function msUntilRest(root) {
  try {
    const bag = root.querySelector('.swish-loader__fallback-bag');
    const anim = bag?.getAnimations?.().find((a) => a.animationName === 'swish-loader-bag-fallback');
    if (!anim || anim.playState === 'finished' || anim.playState === 'idle') return 0;
    const { progress, duration } = anim.effect.getComputedTiming();
    if (progress == null || !(duration > 0)) return 0;
    if (progress >= REST_FROM && progress <= REST_TO) return 0;
    const rate = Math.abs(anim.playbackRate) || 1;
    return Math.max(16, (((REST_FROM - progress + 1) % 1) * duration) / rate + 16);
  } catch {
    return 0; // no Web Animations API: swap now (at worst a single-frame change during the drop)
  }
}

function decode(src) {
  if (!src) return Promise.reject(new Error('missing asset'));
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  if (typeof img.decode === 'function') return img.decode();
  return new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
}

/**
 * SwishLoader — the Swish loading reel: a kraft bag, sealed with two red tamper
 * tapes and a red FEEDBACK label carrying a QR code, drops onto the silver
 * scale trailing two grey speed streaks, rocks and settles; the LCD (standby LED
 * always lit) shows "....." as the tumbling bag's right side touches down and, once it has
 * settled, types S, W, i, S, H into its five 16-segment cells; SWiSH holds. When
 * looping, the bag and the display then fade out in place and the drop replays
 * (5.02 s).
 *
 * The bag is the reference video's own footage (print removed, cleaned and
 * super-resolved to 2×). Consecutive video frames cross-fade while gliding along
 * the measured path, so motion is continuous at 60/120 Hz. Everything runs as CSS
 * animations — no React renders while it plays.
 *
 * @param {object}   props
 * @param {boolean}  [props.loop=true]        Loop. false = play once and hold on SWISH.
 * @param {boolean}  [props.fullscreen=false] Fixed overlay covering the viewport.
 * @param {'auto'|'always'} [props.motion='auto'] 'auto' shows a still frame when the OS asks
 *                                            for reduced motion; 'always' animates regardless.
 * @param {number}   [props.speed=1]          Playback-rate multiplier.
 * @param {string}   [props.label="Loading"]  Accessible status text.
 * @param {Function} [props.onComplete]       Fires each time SWISH completes on the display.
 * @param {string|false} [props.quote]     Line shown under the loader (the reference project's
 *                                            "Still working… good food takes a moment."); false hides it.
 * @param {string}   [props.className]
 * @param {object}   [props.style]            e.g. { '--swish-size': '260px' } to set the loader's height.
 */
const DEFAULT_QUOTE = 'Still working… good food takes a moment.';

function SwishLoader({
  loop = true,
  fullscreen = false,
  motion = 'auto',
  speed = 1,
  label = 'Loading',
  onComplete,
  quote = DEFAULT_QUOTE,
  className,
  style,
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ids = {
    bloom: `swish-bloom-${uid}`,
    led: `swish-led-${uid}`,
    top: `swish-top-${uid}`,
    topFade: `swish-topfade-${uid}`,
    streak: (i) => `swish-streak${i}-${uid}`,
    ground: `swish-ground-${uid}`,
    seal: `swish-seal-${uid}`,
    sheet: (i) => `swish-sheet${i}-${uid}`,
  };
  const rootRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  const framesReadyRef = useRef(false);
  const motionRef = useRef(motion);
  motionRef.current = motion;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Hold at t = 0 (an empty scale, exactly like the first video frame) until the
  // layers are decoded. If the footage is slow or unavailable, start with the
  // built-in fallback (the resting bag moved along the measured path) and switch
  // to the footage as soon as it is decoded AND the bag is at rest, where both
  // look identical — so the swap is never visible.
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof Image === 'undefined') return undefined;
    let cancelled = false;
    let started = false;
    let startTimer = 0;
    let swapTimer = 0;
    let waitingForVisible = false;

    const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const start = () => {
      if (cancelled || started) return;
      // Never start in a background tab or minimised window: it would play unseen and
      // the viewer would arrive mid-way through. Start (from t = 0) once it is visible.
      if (isHidden()) {
        waitingForVisible = true;
        return;
      }
      started = true;
      clearTimeout(startTimer);
      root.removeAttribute('data-pending');
    };
    const startWithFallback = () => {
      if (cancelled || started) return;
      root.setAttribute('data-fallback', '');
      start();
    };
    // Fallback -> footage, only while the bag is resting on the scale.
    const trySwap = () => {
      clearTimeout(swapTimer);
      if (cancelled || !framesReadyRef.current || !root.hasAttribute('data-fallback')) return;
      const wait = root.hasAttribute('data-pending') ? 0 : msUntilRest(root);
      if (wait <= 0) root.removeAttribute('data-fallback');
      else swapTimer = setTimeout(trySwap, wait);
    };
    // The start timeout only counts while the page is visible: a tab opened in the
    // background (or a minimised / occluded window) starts at t = 0 once it is seen,
    // with the footage, instead of mid-way through in fallback mode.
    const armTimeout = () => {
      if (cancelled || started || startTimer) return;
      startTimer = setTimeout(startWithFallback, FRAME_TIMEOUT_MS);
    };
    const onVisibility = () => {
      if (isHidden()) return;
      if (waitingForVisible) start();
      else armTimeout();
    };

    root.setAttribute('data-pending', '');

    const inline = Promise.all(INLINE_SOURCES.map((src) => decode(src).catch(() => undefined)));
    const frames = Promise.all(FRAME_SOURCES.map(decode));
    frames.then(
      () => {
        framesReadyRef.current = true;
        trySwap();
      },
      (error) => {
        framesReadyRef.current = false;
        console.warn('[swish] bag footage unavailable, using the built-in fallback:', error);
      }
    );

    if (motionRef.current !== 'always' && prefersReducedMotion()) {
      // Reduced motion shows a still frame built from the inline layers only.
      startWithFallback();
    } else {
      inline.then(() => frames).then(start, startWithFallback);
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
      if (!isHidden()) armTimeout();
    }

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      clearTimeout(swapTimer);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const handleMarker = useCallback((event) => {
    if (event.animationName !== 'swish-loader-mark') return;
    const root = rootRef.current;
    if (root && framesReadyRef.current) root.removeAttribute('data-fallback');
    try {
      onCompleteRef.current?.();
    } catch (error) {
      // A failing callback must never stop the animation.
      console.error('[swish] onComplete callback threw:', error);
    }
  }, []);

  // Invalid props fall back to safe values instead of breaking the animation.
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? Math.min(Math.max(speed, 0.1), 10) : 1;
  const rootStyle = {
    '--swish-ts': 1 / safeSpeed,
    backgroundColor: BACKDROP_COLOR,
    ...(style && typeof style === 'object' ? style : null),
  };

  return (
    <div
      ref={rootRef}
      className={[
        'swish-loader',
        loop ? 'swish-loader--loop' : 'swish-loader--once',
        fullscreen && 'swish-loader--fullscreen',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={rootStyle}
      data-motion={motion === 'always' ? 'always' : undefined}
      role="status"
      aria-live="polite"
    >
      <span className="swish-loader__sr">{label}</span>
      <span
        className="swish-loader__marker"
        aria-hidden="true"
        onAnimationStart={handleMarker}
        onAnimationIteration={handleMarker}
      />

      {/* The frame is the loader's footprint (bag + scale), centred in the box. The scene's SVG is
          positioned around it and overflows it, so the backdrop and the falling bag extend past it. */}
      <div className="swish-loader__frame">
      <svg
        className="swish-loader__stage"
        viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* bloom under the lit segments: one blur merged UNDER the untouched glyphs, so edges stay crisp */}
          <filter id={ids.bloom} filterUnits="userSpaceOnUse" x="296" y="584" width="290" height="76">
            <feGaussianBlur stdDeviation={BLOOM_STD} result="bloom" />
            <feMerge>
              <feMergeNode in="bloom" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* top haze: opaque above the video frame, clear 36 units into it */}
          <linearGradient id={ids.topFade} gradientUnits="userSpaceOnUse" x1="0" y1={TOP_FADE.from} x2="0" y2={TOP_FADE.to}>
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0.72" />
            <stop offset="0.7" stopColor="#fff" stopOpacity="0.2" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask
            id={ids.top}
            maskUnits="userSpaceOnUse"
            x={BACKDROP.x}
            y={BACKDROP.y}
            width={BACKDROP.width}
            height={TOP_FADE.to - BACKDROP.y}
          >
            <rect
              x={BACKDROP.x}
              y={BACKDROP.y}
              width={BACKDROP.width}
              height={TOP_FADE.to - BACKDROP.y}
              fill={`url(#${ids.topFade})`}
            />
          </mask>
          <radialGradient id={ids.led}>
            <stop offset="0" stopColor={LCD_GREEN} stopOpacity="0.55" />
            <stop offset="0.35" stopColor={LCD_GREEN} stopOpacity="0.22" />
            <stop offset="1" stopColor={LCD_GREEN} stopOpacity="0" />
          </radialGradient>
          {STREAKS.map((streak, i) => (
            <linearGradient
              key={i}
              id={ids.streak(i)}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={streak.y1}
              x2="0"
              y2={streak.y2}
            >
              {streak.stops.map(([offset, opacity]) => (
                <stop key={offset} offset={offset} stopColor={STREAK_COLOR} stopOpacity={opacity} />
              ))}
            </linearGradient>
          ))}
          {BAG_SHEETS.map((sheet, i) => (
            <image key={i} id={ids.sheet(i)} href={SHEET_URLS[i]} width={sheet.width} height={sheet.height} />
          ))}
          <image id={ids.ground} href={GROUND_URL} width={GROUND.sheet.width} height={GROUND.sheet.height} />
          <image id={ids.seal} href={SEAL_URL} width={SEAL_SHEET.width} height={SEAL_SHEET.height} />
        </defs>

        <image
          href={INLINE.backdrop}
          x={BACKDROP.x}
          y={BACKDROP.y}
          width={BACKDROP.width}
          height={BACKDROP.height}
          preserveAspectRatio="none"
        />
        <image href={INLINE.plate} x="0" y="0" width={STAGE.width} height={STAGE.height} />

        {/* scale top: the bag's shadow and reflection, frame by frame */}
        <g className="swish-loader__unshadow">
          {BAG_FRAMES.map(([k], i) => {
            const col = i % GROUND.columns;
            const row = Math.floor(i / GROUND.columns);
            return (
              <g key={k} className="swish-loader__f" style={GROUND_STYLES[i]}>
                <svg
                  x={GROUND.x + GROUND_INSET}
                  y={GROUND.y + GROUND_INSET}
                  width={GROUND.width - 2 * GROUND_INSET}
                  height={GROUND.height - 2 * GROUND_INSET}
                  viewBox={`${col * GROUND.width + GROUND_INSET} ${row * GROUND.height + GROUND_INSET} ${
                    GROUND.width - 2 * GROUND_INSET
                  } ${GROUND.height - 2 * GROUND_INSET}`}
                >
                  <use href={`#${ids.ground}`} />
                </svg>
              </g>
            );
          })}
          <g className="swish-loader__f swish-loader__rest swish-loader__rest-ground" style={REST_GROUND_STYLE}>
            <image
              href={INLINE.groundRest}
              x={GROUND.x}
              y={GROUND.y}
              width={GROUND.width}
              height={GROUND.height}
            />
          </g>
          {/* fallback shadow: runs on the same clock as everything else, shown only in fallback mode */}
          <g className="swish-loader__fallback-ground">
            <image
              href={INLINE.groundRest}
              x={GROUND.x}
              y={GROUND.y}
              width={GROUND.width}
              height={GROUND.height}
            />
          </g>
        </g>

        {/* LCD: a fixed five-cell 16-segment readout ("SWiSH", small i). Each cell holds a
            placeholder pip and its letter; revealing a cell cross-fades the two in place. */}
        <g className="swish-loader__clear">
          <g className="swish-loader__readout" fill={SEG_ON} filter={`url(#${ids.bloom})`}>
            {READOUT_CELLS.map((cell, i) => (
              <g key={i} transform={`translate(${cell.cx.toFixed(3)} ${cell.cy.toFixed(3)})`}>
                <polygon className="swish-loader__dot" style={DOT_STYLES[i]} points={cell.dot} />
                <g className="swish-loader__glyph" style={GLYPH_STYLES[i]}>
                  {cell.segments.map((pts, n) => (
                    <polygon key={n} points={pts} />
                  ))}
                </g>
              </g>
            ))}
          </g>
        </g>

        {/* standby LED: always lit, left end of the display glass */}
        <g className="swish-loader__led">
          <circle cx={LED.x} cy={LED.y} r={LED.halo} fill={`url(#${ids.led})`} />
          <circle cx={LED.x} cy={LED.y} r={LED.r} fill={LCD_GREEN} />
          <circle cx={LED.x} cy={LED.y} r={LED.r * 0.5} fill="#d2ffe0" opacity="0.8" />
        </g>

        {/* the bag: each video frame fades in over the previous one while both glide */}
        <g className="swish-loader__bag">
          {/* grey speed streaks off the bag's upper corners, behind the bag, during the fall */}
          <g className="swish-loader__streaks">
            {STREAKS.map((streak, i) => (
              <g key={i} className="swish-loader__streak" style={STREAK_STYLES[i]}>
                <line
                  x1={streak.x}
                  y1={streak.y1}
                  x2={streak.x}
                  y2={streak.y2}
                  stroke={`url(#${ids.streak(i)})`}
                  strokeWidth={streak.width}
                />
              </g>
            ))}
          </g>
          {BAG_FRAMES.map(([k, x, y, w, h, sheet, sx, sy], i) => {
            const seal = SEAL_FRAMES[k];
            return (
              <g key={k} className="swish-loader__f swish-loader__glide" style={BAG_STYLES[i]}>
                <svg x={x} y={y} width={w} height={h} viewBox={`${sx} ${sy} ${w} ${h}`}>
                  <use href={`#${ids.sheet(sheet)}`} />
                </svg>
                {/* tamper tapes + FEEDBACK/QR label, registered to this frame of the bag */}
                {seal && (
                  <svg x={seal[0]} y={seal[1]} width={seal[2]} height={seal[3]} viewBox={`${seal[4]} ${seal[5]} ${seal[2]} ${seal[3]}`}>
                    <use href={`#${ids.seal}`} />
                  </svg>
                )}
              </g>
            );
          })}
          <g className="swish-loader__f swish-loader__glide swish-loader__rest swish-loader__rest-bag" style={REST_BAG_STYLE}>
            <image
              href={INLINE.bagRest}
              x={BAG_REST.x}
              y={BAG_REST.y}
              width={BAG_REST.width}
              height={BAG_REST.height}
            />
            <image
              href={INLINE.sealRest}
              x={BAG_REST.x}
              y={BAG_REST.y}
              width={BAG_REST.width}
              height={BAG_REST.height}
            />
          </g>
          {/* Fallback bag (the resting bag moved along the measured path) for while the footage is
              still downloading. It is a SEPARATE layer that animates on the shared clock from the
              start and is only made visible in fallback mode: switching to the footage just flips
              visibility, so no animation is ever restarted and nothing can fall out of step. */}
          <g className="swish-loader__fallback-bag">
            <image
              href={INLINE.bagRest}
              x={BAG_REST.x}
              y={BAG_REST.y}
              width={BAG_REST.width}
              height={BAG_REST.height}
            />
            <image
              href={INLINE.sealRest}
              x={BAG_REST.x}
              y={BAG_REST.y}
              width={BAG_REST.width}
              height={BAG_REST.height}
            />
          </g>
        </g>

        {/* The video frame's top edge cuts the bag as it enters. When the box is taller than
            880:720 that edge sits below the top of the screen, so the backdrop is laid back over
            everything above it, fading out just inside the frame: the bag falls in out of the
            haze at any aspect ratio, never from a hard line. */}
        <image
          className="swish-loader__top"
          href={INLINE.backdrop}
          x={BACKDROP.x}
          y={BACKDROP.y}
          width={BACKDROP.width}
          height={BACKDROP.height}
          preserveAspectRatio="none"
          mask={`url(#${ids.top})`}
        />
      </svg>

      </div>

      {typeof quote === 'string' && quote.trim() !== '' && (
        <p className="swish-loader__quote" aria-hidden="true">
          {quote}
        </p>
      )}
    </div>
  );
}

export default memo(SwishLoader);
