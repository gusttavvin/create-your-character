import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * A safety net for the classroom.
 *
 * Anything that throws while drawing a character used to unmount the whole app and leave
 * the teacher staring at a blank white page in front of her pupils. Now the mistake is
 * caught here: the page says what happened in words a child can read and offers a way
 * back, and the real error still goes to the console for us to fix.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Something broke while drawing:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash">
        <p className="crash-face" aria-hidden>
          🙈
        </p>
        <h1>Oops! Something got tangled.</h1>
        <p>The picture stopped working, but nothing you saved was lost.</p>
        <div className="crash-actions">
          <button type="button" className="btn btn-fun" onClick={() => window.location.reload()}>
            ↻ Try again
          </button>
          <a className="btn" href="/">
            🏠 Back to the games
          </a>
        </div>
      </div>
    );
  }
}
