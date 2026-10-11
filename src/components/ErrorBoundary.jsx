import { Component } from 'react';

/**
 * Catches render errors below it so one failure never blanks the page.
 * Shows `fallback` (or a neutral loading message) and logs the error once.
 * Change `resetKey` to try rendering the children again.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[swish] A component failed to render:', error, info?.componentStack);
    this.props.onError?.(error);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="error-fallback" role="status" aria-live="polite">
            Loading…
          </div>
        )
      );
    }
    return this.props.children;
  }
}
