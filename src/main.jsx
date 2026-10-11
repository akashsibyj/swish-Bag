import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

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
