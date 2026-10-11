/**
 * The scale's LCD readout: a fixed five-cell, 16-segment display reading "SWiSH" with a small i,
 * built to the reference project's segment geometry, colour and proportional spacing
 * (SWISH_LOADING_ANIMATION_SPEC / loader/swish-loader.js), scaled to this scale's glass.
 *
 *      -A1- -A2-
 *     |\   |   /|      S  A1 A2 F G1 G2 C D1 D2
 *     F H  I  J B      W  F E B C I L D1 D2
 *     |  \ | /  |      i  L + tittle (DOT_HI)
 *      -G1- -G2-       H  F E B C G1 G2
 *     |  / | \  |      .  DOT_LO (the placeholder pip)
 *     E K  L  M C
 *     |/   |   \|
 *      -D1- -D2-
 *
 * Every cell is fixed: a placeholder pip and its letter share the cell, so revealing a letter is a
 * cross-fade in place and nothing on the display ever moves. Pure data, computed once at import.
 */
import { GLASS } from './geometry';

/** Lit segment colour, sampled by the reference project. */
export const SEG_ON = '#2FE8AC';
// The last letter lands "hot" (#6BFFD8, the reference's blown-out core): keyframes swish-loader-hot.

const GLYPHS = ['S', 'W', 'i', 'S', 'H'];
const GLYPH_H = 0.6 * GLASS.height;
const GLYPH_W = 0.76 * GLYPH_H;
const SEG_T = 0.13 * GLYPH_H;
const SEG_GAP = 0.2 * SEG_T;
const SEG_CHAMFER = 0.62;
const LETTER_GAP = 0.22 * GLYPH_H;

/** Bloom under the lit segments (user units, so it scales with the artwork). */
export const BLOOM_STD = SEG_T * 0.62;

function segBar(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const h = SEG_T / 2;
  const c = SEG_CHAMFER * h;
  const ax = x0 + ux * SEG_GAP;
  const ay = y0 + uy * SEG_GAP;
  const L = len - 2 * SEG_GAP;
  const at = (along, across) => [ax + ux * along + px * across, ay + uy * along + py * across];
  return [at(c, -h), at(L - c, -h), at(L, -h + c), at(L, h - c), at(L - c, h), at(c, h), at(0, h - c), at(0, -h + c)];
}

function segDot(cx, cy) {
  const h = SEG_T / 2;
  return [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]];
}

const GW = GLYPH_W / 2;
const GH = GLYPH_H / 2;
const XL = -GW + SEG_T / 2;
const XR = GW - SEG_T / 2;
const YT = -GH + SEG_T / 2;
const YB = GH - SEG_T / 2;

/**
 * Vertical segments as [x, top, bottom] on the segment grid. On a raw 16-segment grid a vertical
 * ends at the centre line of the top/bottom bars, so a letter WITHOUT those bars (the stem of i,
 * the legs of H, the tops of W) stops short of the others and sits off the line. Where a letter
 * has no bar on that row, its verticals are carried out to the glyph's outer edge instead, so
 * every letter - and the i - shares one baseline and one cap height.
 */
const VERTICALS = { F: [XL, YT, 0], E: [XL, 0, YB], B: [XR, YT, 0], C: [XR, 0, YB], I: [0, YT, 0], L: [0, 0, YB] };
const HORIZONTALS = {
  A1: [XL, YT, 0, YT],
  A2: [0, YT, XR, YT],
  G1: [XL, 0, 0, 0],
  G2: [0, 0, XR, 0],
  D1: [XL, YB, 0, YB],
  D2: [0, YB, XR, YB],
};

function segmentsFor(keys) {
  const hasTop = keys.includes('A1') || keys.includes('A2');
  const hasBottom = keys.includes('D1') || keys.includes('D2');
  return keys.map((key) => {
    if (key === 'DOT_HI') return segDot(0, YT);
    if (key === 'DOT_LO') return segDot(0, YB);
    if (HORIZONTALS[key]) return segBar(...HORIZONTALS[key]);
    const [x, y0, y1] = VERTICALS[key];
    // segBar pulls each end back by SEG_GAP; start that far outside so the tip lands on the edge.
    const top = y0 === YT && !hasTop ? -GH - SEG_GAP : y0;
    const bottom = y1 === YB && !hasBottom ? GH + SEG_GAP : y1;
    return segBar(x, top, x, bottom);
  });
}

const SEG_MAP = {
  S: ['A1', 'A2', 'F', 'G1', 'G2', 'C', 'D1', 'D2'],
  W: ['F', 'E', 'B', 'C', 'I', 'L', 'D1', 'D2'],
  i: ['L', 'DOT_HI'],
  H: ['F', 'E', 'B', 'C', 'G1', 'G2'],
  '.': ['DOT_LO'],
};

const points = (pts) => pts.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ');

/** Proportional but fixed grid: a constant gap between glyphs ("i" is one stem wide), centred on the glass. */
const CELL_INK = GLYPHS.map((ch) => (ch === 'i' ? SEG_T : GLYPH_W));
const CELL_CX = (() => {
  const total = CELL_INK.reduce((a, b) => a + b, 0) + LETTER_GAP * (GLYPHS.length - 1);
  let x = GLASS.x + GLASS.width / 2 - total / 2;
  return CELL_INK.map((w) => {
    const cx = x + w / 2;
    x += w + LETTER_GAP;
    return cx;
  });
})();

/**
 * Placeholder pips are EVENLY spaced across the word (first to last letter centre), so "....."
 * reads as an even row even though the letter cells are proportional (the i is one stem wide).
 * Each pip still sits inside its own letter's footprint, so the letter replaces it in place.
 */
const DOT_X = GLYPHS.map((_, i) => CELL_CX[0] + ((CELL_CX[GLYPHS.length - 1] - CELL_CX[0]) * i) / (GLYPHS.length - 1));

/** The five cells: centre, the letter's segment polygons and the placeholder pip, relative to the centre. */
export const READOUT_CELLS = GLYPHS.map((ch, i) => ({
  letter: ch,
  cx: CELL_CX[i],
  cy: GLASS.y + GLASS.height / 2,
  segments: segmentsFor(SEG_MAP[ch]).map(points),
  dot: points(segDot(DOT_X[i] - CELL_CX[i], YB)),
}));
