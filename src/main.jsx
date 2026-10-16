import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Start downloading the bag footage straight away, in parallel with the app bundle, so slow
// mobile connections spend as little time as possible on the stand-in bag. Only the set the
// loader will actually use (1x on phones and ordinary screens, 2x on large high-density ones).
import { pickSheets } from './components/SwishLoader/sheets';

try {
  const sheets = pickSheets('auto');
  for (const href of [...sheets.bag, sheets.ground, sheets.seal]) {
    if (typeof href !== 'string' || !href) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    document.head.appendChild(link);
  }
} catch (error) {
  console.warn('[swish] could not preload the footage:', error);
}

// Loaded lazily so that if the app bundle (or one of its assets) fails to load,
// the page shows a message with a retry button instead of going blank.
const App = lazy(() => import('./App'));

// Surface unexpected errors in the console with context instead of failing silently.
window.addEventListener('error', (event) => {
  console.error('[swish] Uncaught error:', event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[swish] Unhandled promise rejection:', event.reason);
});

function LoadFailed() {
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
      <Suspense fallback={<div className="page-message" aria-busy="true" />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>
);
