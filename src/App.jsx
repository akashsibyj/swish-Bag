import { useCallback, useEffect, useRef, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import SwishLoader from './components/SwishLoader';
import { FOOTAGE, MOTION } from './params';
import './App.css';

const MAX_AUTO_RESTARTS = 3;

/** Fade out the instant poster from index.html once the real loader is on screen. */
function hidePoster() {
  try {
    window.__swishPoster?.hide();
  } catch {
    /* the poster is only a head start; never let it break the page */
  }
}

/** The page: the Swish loader, centred on a full-screen backdrop, nothing else. */
export default function App() {
  // If the loader ever fails to render, show a quiet "Loading…" and remount it (a few times).
  const [run, setRun] = useState(0);
  const failures = useRef(0);
  const timer = useRef(0);
  const handleError = useCallback(() => {
    if (failures.current >= MAX_AUTO_RESTARTS) {
      // Give up quietly: the poster (if still up) offers a reload.
      try {
        window.__swishPoster?.fail();
      } catch {
        /* ignore */
      }
      return;
    }
    failures.current += 1;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRun((n) => n + 1), 1500);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <main className="app">
      <h1 className="visually-hidden">Swish</h1>
      <ErrorBoundary
        resetKey={run}
        onError={handleError}
        fallback={
          <div className="error-fallback" role="status" aria-live="polite">
            Loading…
          </div>
        }
      >
        <SwishLoader
          key={run}
          motion={MOTION}
          footage={FOOTAGE}
          onStart={hidePoster}
          className="app__loader"
        />
      </ErrorBoundary>
    </main>
  );
}
