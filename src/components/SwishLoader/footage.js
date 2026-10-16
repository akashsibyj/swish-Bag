/**
 * Bag footage download policy — keeps the loader light on poor connections.
 *
 * The footage (the bag's video frames in four sprite atlases) only matters for the drop itself.
 * Once the bag rests on the scale, the picture is built from small images already inside the
 * JavaScript bundle. So:
 *
 *  - Two resolutions: 1x (~460 KB) covers phones and ordinary desktop screens; 2x (~1.1 MB) is
 *    only used where it is actually visible (large loader on a high-density screen, fast network).
 *  - 'off' on Save-Data, 2G, a measured slow connection or reduced motion: nothing is downloaded,
 *    the built-in stand-in bag plays straight away.
 *  - Downloads are low priority and cancellable, so a loader that no longer needs the footage
 *    (the drop already started without it) hands the bandwidth back to the page it is loading for.
 *
 * Every function here is defensive: any failure means "no footage", never an exception.
 */
import bag0x2 from './assets/bag-frames-0.webp';
import bag1x2 from './assets/bag-frames-1.webp';
import groundx2 from './assets/ground-frames.webp';
import sealx2 from './assets/seal-frames.webp';
import bag0x1 from './assets/1x/bag-frames-0.webp';
import bag1x1 from './assets/1x/bag-frames-1.webp';
import groundx1 from './assets/1x/ground-frames.webp';
import sealx1 from './assets/1x/seal-frames.webp';

// Bundlers return a URL string for image imports; Next.js returns { src }.
const assetUrl = (mod) => (typeof mod === 'string' ? mod : (mod && mod.src) || '');

/** Atlas URLs per tier, in the order [bag sheet 0, bag sheet 1, ground, seal]. */
export const FOOTAGE_URLS = Object.freeze({
  '1x': Object.freeze([bag0x1, bag1x1, groundx1, sealx1].map(assetUrl)),
  '2x': Object.freeze([bag0x2, bag1x2, groundx2, sealx2].map(assetUrl)),
});
const TIER_BYTES = { '1x': 470e3, '2x': 1110e3 };
export const TIERS = ['off', '1x', '2x'];

/** Loader height for a box of w x h CSS px (shared with the component's sizing). */
export function frameHeightFor(w, h) {
  return Math.min(Math.max(190, 0.44 * Math.min(w, h)), 360, 0.72 * h, (0.84 * w * 510) / 470);
}

function connection() {
  try {
    const c = typeof navigator !== 'undefined' ? navigator.connection : null;
    return c ? { saveData: !!c.saveData, type: String(c.effectiveType || '') } : {};
  } catch {
    return {};
  }
}

/**
 * Download speed (bytes/s) measured from this page's own scripts and styles so far, or null when
 * unknown (nothing big enough loaded yet, everything came from cache, or no Resource Timing).
 * Works in every browser, including Safari, which has no Network Information API.
 */
export function measuredThroughput() {
  try {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return null;
    let bytes = 0;
    let ms = 0;
    for (const e of performance.getEntriesByType('resource')) {
      if (!/\.(m?js|css)(\?|$)/.test(e.name)) continue;
      const size = e.encodedBodySize || 0;
      // Skip cache hits (no transfer) and tiny files (dominated by latency, not bandwidth).
      if (size < 8000 || e.transferSize === 0) continue;
      const t = e.responseEnd - e.responseStart;
      if (!(t > 0)) continue;
      bytes += size;
      ms += t;
    }
    if (bytes < 8000 || ms < 30) return null; // too fast to measure: treat as a good connection
    return (bytes / ms) * 1000;
  } catch {
    return null;
  }
}

function reducedMotion() {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Which footage to use: 'off' | '1x' | '2x'.
 * @param {object} [o]
 * @param {number} [o.frameHeight] loader height in CSS px (defaults to one sized for the window)
 * @param {'auto'|'always'} [o.motion]
 * @param {'auto'|'off'|'1x'|'2x'} [o.request] a forced choice (prop / URL switch)
 */
export function chooseTier({ frameHeight, motion = 'auto', request = 'auto' } = {}) {
  try {
    if (request === 'off' || request === '1x' || request === '2x') return request;
    if (motion !== 'always' && reducedMotion()) return 'off'; // a still frame needs no footage
    const net = connection();
    if (net.saveData || net.type === 'slow-2g' || net.type === '2g') return 'off';
    const speed = measuredThroughput();
    // The footage must arrive within about a second to be used at all; if even the 1x set would
    // take over ~3 s, don't spend the visitor's bandwidth on it.
    if (speed != null && TIER_BYTES['1x'] / speed > 3) return 'off';

    const w = typeof window !== 'undefined' ? window.innerWidth || 0 : 0;
    const h = typeof window !== 'undefined' ? window.innerHeight || 0 : 0;
    const fh = frameHeight > 0 ? frameHeight : w > 0 && h > 0 ? frameHeightFor(w, h) : 360;
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    // Atlas pixels per screen pixel: the 1x set has one pixel per stage unit.
    const density = (fh / 510) * dpr;
    const fast = net.type !== '3g' && (speed == null || TIER_BYTES['2x'] / speed < 1.2);
    return density > 1.25 && fast ? '2x' : '1x';
  } catch {
    return '1x';
  }
}

// ---------------------------------------------------------------------------------------------
// Shared, cancellable downloads (one per tier). Several loaders on a page, React StrictMode's
// double mount and the early start from the app entry all share the same request.
// ---------------------------------------------------------------------------------------------

const loads = new Map();
const UNCLAIMED_MS = 15000; // started early but no loader claimed it: give the bandwidth back

function decodeImage(src) {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.decoding = 'async';
      img.onerror = () => reject(new Error(`could not load ${src}`));
      img.src = src;
      if (typeof img.decode === 'function') img.decode().then(() => resolve(img), reject);
      else img.onload = () => resolve(img);
    } catch (error) {
      reject(error);
    }
  });
}

function fetchOne(url, signal) {
  // fetch + blob URL: the download can be cancelled and runs at low priority where supported.
  // Falls back to a plain image URL wherever that path is unavailable.
  if (typeof fetch !== 'function' || typeof URL === 'undefined' || !URL.createObjectURL) {
    return decodeImage(url).then(() => url);
  }
  let init = { signal, credentials: 'same-origin' };
  try {
    init = { ...init, priority: 'low' };
  } catch {
    /* ignore */
  }
  return fetch(url, init)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res.blob();
    })
    .then((blob) => {
      if (signal?.aborted) throw new Error('aborted');
      const objectUrl = URL.createObjectURL(blob);
      return decodeImage(objectUrl).then(
        () => objectUrl,
        (error) => {
          try {
            URL.revokeObjectURL(objectUrl);
          } catch {
            /* ignore */
          }
          throw error;
        }
      );
    });
}

function startLoad(tier) {
  const urls = FOOTAGE_URLS[tier];
  let controller = null;
  try {
    controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  } catch {
    controller = null;
  }
  const load = {
    tier,
    users: 0,
    done: false,
    failed: false,
    cancelled: false,
    urls: null,
    timer: 0,
    ready: null,
  };
  load.ready = Promise.all(urls.map((u) => fetchOne(u, controller?.signal))).then(
    (resolved) => {
      load.done = true;
      load.urls = resolved;
      return resolved;
    },
    (error) => {
      load.failed = true;
      throw error;
    }
  );
  load.ready.catch(() => {}); // handled by whoever awaits it; never an unhandled rejection
  load.cancel = () => {
    if (load.done || load.cancelled) return;
    load.cancelled = true;
    try {
      controller?.abort();
    } catch {
      /* ignore */
    }
    loads.delete(tier);
  };
  loads.set(tier, load);
  return load;
}

/** Start downloading a tier early (e.g. from the app entry) without claiming it. */
export function prefetchFootage(tier) {
  try {
    if (!FOOTAGE_URLS[tier] || typeof window === 'undefined') return null;
    let load = loads.get(tier);
    if (!load) load = startLoad(tier);
    if (!load.users && !load.timer) {
      load.timer = setTimeout(() => {
        load.timer = 0;
        if (!load.users) load.cancel();
      }, UNCLAIMED_MS);
    }
    return load;
  } catch {
    return null;
  }
}

/** The tier already being downloaded (from an early start), if any. */
export function pendingTier() {
  for (const [tier, load] of loads) if (!load.cancelled && !load.failed) return tier;
  return null;
}

/** Claim a tier's download. Call release() when it is no longer wanted. */
export function acquireFootage(tier) {
  try {
    if (!FOOTAGE_URLS[tier] || typeof window === 'undefined') return null;
    let load = loads.get(tier);
    if (!load || load.cancelled || load.failed) load = startLoad(tier);
    load.users += 1;
    clearTimeout(load.timer);
    load.timer = 0;
    let released = false;
    return {
      tier,
      ready: load.ready,
      release() {
        if (released) return;
        released = true;
        load.users = Math.max(0, load.users - 1);
        // Deferred, so an immediate re-claim (React StrictMode remount) keeps the download.
        clearTimeout(load.timer);
        load.timer = setTimeout(() => {
          load.timer = 0;
          if (!load.users) load.cancel();
        }, 250);
      },
    };
  } catch {
    return null;
  }
}
