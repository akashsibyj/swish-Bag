import { useCallback, useEffect, useRef, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import SwishLoader from './components/SwishLoader';
import './App.css';

/** Read a URL switch once, never throwing (e.g. sandboxed iframes without `location`). */
function param(name) {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

// ?motion=always animates even when the OS asks for reduced motion
// (Windows turns that on in many Remote Desktop sessions).
const MOTION = param('motion') === 'always' ? 'always' : 'auto';
const MAX_AUTO_RESTARTS = 3;

/** The page: the Swish loader, centred on a full-screen backdrop, nothing else. */
export default function App() {
  // If the loader ever fails to render, show a quiet "Loading…" and remount it (a few times).
  const [run, setRun] = useState(0);
  const failures = useRef(0);
  const timer = useRef(0);
  const handleError = useCallback(() => {
    if (failures.current >= MAX_AUTO_RESTARTS) return;
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
        <SwishLoader key={run} motion={MOTION} className="app__loader" />
      </ErrorBoundary>
    </main>
  );
}
