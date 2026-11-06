import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from '@/utils/log';

interface ErrorBoundaryProps {
  /** Name used in diagnostics and in the message shown to the player */
  scope: string;
  children: ReactNode;
  /** Called when the player presses "Try again" */
  onReset?: () => void;
  /** Small inline fallback (for a single field) instead of the full-screen one */
  compact?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Stops a render error from unmounting the whole app (the "blank dark screen"). */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logError(this.props.scope, `render failed: ${error.message}`, { stack: error.stack, componentStack: info.componentStack });
  }

  reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const retry = (
      <button
        type="button"
        onClick={this.reset}
        className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold text-ink hover:border-gold-500"
      >
        Try again
      </button>
    );

    if (this.props.compact) {
      return (
        <div role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          <p>This part could not be displayed ({this.props.scope}). Your other choices are kept.</p>
          <p className="mt-1 break-words text-xs text-red-300/80">{error.message}</p>
          <div className="mt-2">{retry}</div>
        </div>
      );
    }

    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-2xl font-bold text-gold-400">Something went wrong</p>
        <p className="text-sm text-ink-muted">The screen “{this.props.scope}” failed to display. Your saved career is not affected.</p>
        <p className="break-words text-xs text-ink-faint">{error.message}</p>
        {retry}
      </div>
    );
  }
}
