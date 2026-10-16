import { StrictMode, Suspense, lazy, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary';
// Only the small download-policy module, not the loader itself (that comes with the App chunk).
import { chooseTier, prefetchFootage } from './components/SwishLoader/footage';
import { FOOTAGE, MOTION } from './params';

/** The static poster in index.html (instant first paint); absent if index.html was replaced. */
const poster = () => (typeof window !== 'undefined' && window.__swishPoster) || null;

// Start the bag footage now, in parallel with the App chunk, if (and only if) it can arrive in
// time: the tier is chosen from the screen and the measured network, and nothing is downloaded
// on Save-Data, 2G or a slow connection (the built-in bag plays instead).
try {
  const tier = chooseTier({ motion: MOTION, request: FOOTAGE });
  if (tier !== 'off') prefetchFootage(tier);
} catch (error) {
  console.warn('[swish] could not start the footage download:', error);
}

/** Wait for a stylesheet (the App chunk's CSS), adding it if it is not on the page yet. */
function ensureStylesheet(href) {
  return new Promise((resolve, reject) => {
    try {
      const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')];
      const existing = sheets.find((link) => link.getAttribute('href') === href);
      if (existing?.sheet) return resolve();
      if (existing) existing.remove(); // a failed earlier attempt
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.crossOrigin = '';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`could not load ${href}`));
      document.head.appendChild(link);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * The App chunk, with retries: a dropped request on a flaky connection must not end the page.
 * Browsers remember a failed module download for the life of the page, so retries load the
 * chunk under a fresh URL (its URL is recorded in index.html at build time). As a last resort
 * the page reloads itself once; after that the poster offers a Reload button.
 */
function loadApp() {
  const chunk = (typeof window !== 'undefined' && window.__swishApp) || null;
  const attempt = (n) => {
    if (n === 0 || !chunk || typeof chunk.js !== 'string') return import('./App');
    return Promise.all((chunk.css || []).map(ensureStylesheet)).then(
      () => import(/* @vite-ignore */ `${chunk.js}?retry=${n}`)
    );
  };
  const run = (n, delay) =>
    attempt(n).catch((error) => {
      if (n >= 3) throw error;
      console.warn(`[swish] app chunk failed to load, retrying (${3 - n} left):`, error);
      return new Promise((resolve) => setTimeout(resolve, delay)).then(() => run(n + 1, delay * 2));
    });
  return run(0, 700).catch((error) => {
    try {
      const key = 'swish-reloaded';
      const last = Number(sessionStorage.getItem(key)) || 0;
      if (Date.now() - last > 60000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return new Promise(() => {}); // the page is going away
      }
    } catch {
      /* storage blocked: fall through to the message */
    }
    throw error;
  });
}

// Loaded lazily so its styles never block the poster's first paint, and so a failed download
// shows a message with a reload button instead of a blank page.
const App = lazy(loadApp);

// Surface unexpected errors in the console with context instead of failing silently.
window.addEventListener('error', (event) => {
  if (event.error || event.message) console.error('[swish] Uncaught error:', event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[swish] Unhandled promise rejection:', event.reason);
});

function LoadFailed() {
  // The poster (if still up) shows its own reload prompt on top of this message.
  useEffect(() => {
    try {
      poster()?.fail();
    } catch {
      /* ignore */
    }
  }, []);
  return (
    <div className="page-message" role="alert">
      <p>The Swish loader could not be loaded.</p>
      <button type="button" className="page-message__button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}

let container = document.getElementById('root');
if (!container) {
  // index.html was edited without the mount point — create one rather than crash.
  container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary fallback={<LoadFailed />}>
      {/* While the App chunk downloads, the poster in index.html is what the visitor sees. */}
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>
);
