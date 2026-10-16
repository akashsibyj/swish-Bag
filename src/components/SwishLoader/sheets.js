/**
 * Which resolution of the bag footage to use.
 *
 * The footage atlases come in two sizes. Decoded, the 2x set takes ~105 MB of image memory and
 * the 1x set ~27 MB. Phones only ever show the loader small (about 190 px tall), where 1x already
 * gives at least one image pixel per screen pixel, and iPhone Safari closes a page outright
 * ("A problem repeatedly occurred") when it runs out of memory. So 2x is used only where it is
 * visible: a large loader on a high-density screen, on a device that is not short of memory.
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

const SETS = {
  '1x': Object.freeze({ tier: '1x', bag: [assetUrl(bag0x1), assetUrl(bag1x1)], ground: assetUrl(groundx1), seal: assetUrl(sealx1) }),
  '2x': Object.freeze({ tier: '2x', bag: [assetUrl(bag0x2), assetUrl(bag1x2)], ground: assetUrl(groundx2), seal: assetUrl(sealx2) }),
};

/** Loader height (CSS px) for a w x h box — the same rule the component uses to size itself. */
export function frameHeightFor(w, h) {
  return Math.min(Math.max(190, 0.44 * Math.min(w, h)), 360, 0.72 * h, (0.84 * w * 510) / 470);
}

/**
 * @param {'auto'|'1x'|'2x'} [request]
 * @param {number} [frameHeight] loader height in CSS px, if known
 * @returns {{tier:'1x'|'2x', bag:string[], ground:string, seal:string}}
 */
export function pickSheets(request = 'auto', frameHeight) {
  if (request === '1x' || request === '2x') return SETS[request];
  try {
    if (typeof window === 'undefined') return SETS['1x'];
    const w = window.innerWidth || 0;
    const h = window.innerHeight || 0;
    const fh = frameHeight > 0 ? frameHeight : w > 0 && h > 0 ? frameHeightFor(w, h) : 190;
    const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    const memory = typeof navigator !== 'undefined' ? Number(navigator.deviceMemory) || 0 : 0;
    const touchPhone = Math.min(window.screen?.width || w, window.screen?.height || h) < 600;
    // 1x atlas pixels per screen pixel; above ~1.25 the 2x set is visibly sharper.
    const density = (fh / 510) * dpr;
    if (density > 1.25 && !touchPhone && (memory === 0 || memory >= 4)) return SETS['2x'];
  } catch {
    /* fall through to the light set */
  }
  return SETS['1x'];
}
