/** URL switches for the demo page, read once and never throwing (e.g. sandboxed iframes). */
function param(name) {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

// ?motion=always animates even when the OS asks for reduced motion
// (Windows turns that on in many Remote Desktop sessions).
export const MOTION = param('motion') === 'always' ? 'always' : 'auto';

// ?footage=off|1x|2x forces the bag footage choice (default: picked by screen and network).
const FOOTAGE_PARAM = param('footage');
export const FOOTAGE = ['off', '1x', '2x'].includes(FOOTAGE_PARAM) ? FOOTAGE_PARAM : 'auto';
