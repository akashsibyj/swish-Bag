/**
 * Frame player for the bag footage (video frames 3-49).
 *
 * Earlier, each of the 47 frames (plus its shadow) was its own CSS-animated group. Browsers give
 * every animated element a compositing layer, so the bag alone cost ~100 layers; on a 3x phone
 * screen that is hundreds of MB of graphics memory, and iPhone Safari killed the page
 * ("A problem repeatedly occurred"). Now three reusable slots show whichever frames are visible
 * at the current moment, positioned with exactly the same measured keyframes (track.js).
 *
 * The clock is the running CSS animation of the stand-in bag, so the frames stay in perfect step
 * with everything else (pause, speed, play-once hold, loop) without a clock of their own.
 */
import { BAG_FRAMES, GROUND, SEAL_FRAMES } from './frames';
import { BAG_TRACK } from './track';

export const SLOT_COUNT = 3;
export const CLOCK_ANIMATION = 'swish-loader-bag-fallback';

/** Static per-frame attributes, computed once. */
export function buildFrames(groundInset) {
  return BAG_TRACK.map(([k, opacity, glide, pivot], i) => {
    const row = BAG_FRAMES[i];
    if (!row || row[0] !== k) throw new Error(`frame table mismatch at ${k}`);
    const [, x, y, w, h, sheet, sx, sy] = row;
    const seal = SEAL_FRAMES[k] || null;
    const col = i % GROUND.columns;
    const gRow = Math.floor(i / GROUND.columns);
    const gw = GROUND.width - 2 * groundInset;
    const gh = GROUND.height - 2 * groundInset;
    return {
      k,
      opacity,
      glide,
      pivot,
      sheet,
      bag: { x, y, width: w, height: h, viewBox: `${sx} ${sy} ${w} ${h}` },
      seal: seal && {
        x: seal[0],
        y: seal[1],
        width: seal[2],
        height: seal[3],
        viewBox: `${seal[4]} ${seal[5]} ${seal[2]} ${seal[3]}`,
      },
      groundViewBox: `${col * GROUND.width + groundInset} ${gRow * GROUND.height + groundInset} ${gw} ${gh}`,
    };
  });
}

/** Linear interpolation over [offset, ...values] stops; returns the values at progress p. */
function sample(stops, p, out) {
  const n = stops.length;
  let a = stops[0];
  let b = stops[n - 1];
  if (p <= a[0]) b = a;
  else if (p >= b[0]) a = b;
  else {
    for (let i = 1; i < n; i += 1) {
      if (p <= stops[i][0]) {
        a = stops[i - 1];
        b = stops[i];
        break;
      }
    }
  }
  const span = b[0] - a[0];
  const t = span > 0 ? (p - a[0]) / span : 1;
  for (let j = 1; j < a.length; j += 1) out[j - 1] = a[j] + (b[j] - a[j]) * t;
  return out;
}

function set(el, name, value) {
  if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/**
 * Starts the player. Returns a stop() function. Never throws: on any failure it reports through
 * onFail (the caller switches to the built-in stand-in bag) and stops.
 *
 * @param {object} o
 * @param {Element} o.clockEl       element running the CLOCK_ANIMATION
 * @param {object[]} o.bagSlots     [{ g, svg, use, sealSvg }] x SLOT_COUNT, bottom to top
 * @param {object[]} o.groundSlots  [{ g, svg }] x SLOT_COUNT
 * @param {object[]} o.frames       from buildFrames()
 * @param {(sheet:number)=>string} o.sheetHref
 * @param {(error:Error)=>void} o.onFail
 */
export function startFramePlayer({ clockEl, bagSlots, groundSlots, frames, sheetHref, onFail }) {
  let raf = 0;
  let stopped = false;
  let clock = null;
  let missing = 0;
  const glide = [0, 0, 0];
  const op = [0];
  const visible = [];
  const shown = new Array(SLOT_COUNT).fill(-2);
  const hasRaf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';

  const hideSlot = (s) => {
    if (shown[s] === -1) return;
    shown[s] = -1;
    set(bagSlots[s]?.g, 'display', 'none');
    set(groundSlots[s]?.g, 'display', 'none');
  };

  const showSlot = (s, idx, p) => {
    const f = frames[idx];
    const bag = bagSlots[s];
    const ground = groundSlots[s];
    if (!bag || !ground) return;
    if (shown[s] !== idx) {
      shown[s] = idx;
      set(bag.svg, 'x', String(f.bag.x));
      set(bag.svg, 'y', String(f.bag.y));
      set(bag.svg, 'width', String(f.bag.width));
      set(bag.svg, 'height', String(f.bag.height));
      set(bag.svg, 'viewBox', f.bag.viewBox);
      set(bag.use, 'href', sheetHref(f.sheet));
      if (f.seal) {
        set(bag.sealSvg, 'x', String(f.seal.x));
        set(bag.sealSvg, 'y', String(f.seal.y));
        set(bag.sealSvg, 'width', String(f.seal.width));
        set(bag.sealSvg, 'height', String(f.seal.height));
        set(bag.sealSvg, 'viewBox', f.seal.viewBox);
        set(bag.sealSvg, 'display', 'inline');
      } else {
        set(bag.sealSvg, 'display', 'none');
      }
      set(ground.svg, 'viewBox', f.groundViewBox);
      set(bag.g, 'display', 'inline');
      set(ground.g, 'display', 'inline');
    }
    sample(f.opacity, p, op);
    const o = op[0] >= 0.999 ? '1' : op[0].toFixed(3);
    set(bag.g, 'opacity', o);
    set(ground.g, 'opacity', o);
    sample(f.glide, p, glide);
    set(
      bag.g,
      'transform',
      `translate(${glide[0].toFixed(2)} ${glide[1].toFixed(2)}) rotate(${glide[2].toFixed(3)}) translate(${-f.pivot[0]} ${-f.pivot[1]})`
    );
  };

  const render = (p) => {
    visible.length = 0;
    for (let i = 0; i < frames.length; i += 1) {
      sample(frames[i].opacity, p, op);
      if (op[0] > 0.001) visible.push(i);
    }
    // Never more than SLOT_COUNT at once (the data has at most two); keep the topmost.
    const from = Math.max(0, visible.length - SLOT_COUNT);
    for (let s = 0; s < SLOT_COUNT; s += 1) {
      const idx = visible[from + s];
      if (idx === undefined) hideSlot(s);
      else showSlot(s, idx, p);
    }
  };

  const findClock = () => {
    const list = clockEl?.getAnimations?.() || [];
    return list.find((a) => a.animationName === CLOCK_ANIMATION) || null;
  };

  const tick = () => {
    raf = 0;
    if (stopped) return;
    try {
      if (!clock || clock.playState === 'idle') clock = findClock();
      if (!clock) {
        // Reduced motion (no animations at all): the resting frame is shown by CSS. Keep looking
        // for a little while in case styles arrive late, then stop.
        for (let s = 0; s < SLOT_COUNT; s += 1) hideSlot(s);
        missing += 1;
        if (missing < 120) raf = window.requestAnimationFrame(tick);
        return;
      }
      missing = 0;
      const timing = clock.effect?.getComputedTiming?.();
      const p = timing && Number.isFinite(timing.progress) ? timing.progress : timing?.currentIteration == null ? 1 : 0;
      render(Math.min(1, Math.max(0, p)));
      // A finished play-once loader holds its last frame: nothing left to do.
      if (clock.playState === 'finished') return;
    } catch (error) {
      stopped = true;
      try {
        onFail?.(error);
      } catch {
        /* ignore */
      }
      return;
    }
    raf = window.requestAnimationFrame(tick);
  };

  if (!hasRaf || typeof clockEl?.getAnimations !== 'function') {
    // No Web Animations API (very old browsers): use the CSS-only stand-in bag.
    try {
      onFail?.(new Error('Web Animations API unavailable'));
    } catch {
      /* ignore */
    }
    return () => {};
  }
  tick();
  return () => {
    stopped = true;
    if (raf) window.cancelAnimationFrame(raf);
  };
}
