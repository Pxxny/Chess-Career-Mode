import { temporaryCareer } from "@/utils/temporaryCareer";
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

const hasRetriedOnLoad = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("retry-load");
const moduleLoadError = /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|loading chunk.+failed|unable to preload css/i;

/** Stops a render error from unmounting the whole app (the "blank dark screen"). */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logError(this.props.scope, `render failed: ${error.message}`, { stack: error.stack, componentStack: info.componentStack });
    if (this.props.scope === "app" && !temporaryCareer && !hasRetriedOnLoad && moduleLoadError.test(error.message)) this.reset();
  }

  reset = (): void => {
    if (this.props.scope === 'app' && moduleLoadError.test(this.state.error?.message ?? '')) {
      // React.lazy keeps a rejected import for this document. A fresh navigation
      // also asks an older service worker for a distinct URL after a deployment.
      const next = new URL(window.location.href);
      if (temporaryCareer) next.searchParams.set('temporary', '1');
      next.searchParams.set('retry-load', String(Date.now()));
      window.location.replace(next);
      return;
    }
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const reload = this.props.scope === "app" && moduleLoadError.test(error.message);
    const retry = (
      <button
        type="button"
        onClick={this.reset}
        className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold text-ink hover:border-gold-500"
      >
        {reload ? "Reload game" : "Try again"}
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
        <p className="font-display text-2xl font-bold text-gold-400">{reload ? "Game files could not load" : "Something went wrong"}</p>
        <p className="text-sm text-ink-muted">{reload
          ? temporaryCareer
            ? "Reloading will end this temporary career."
            : "Reload to request a fresh copy of the game. Your saved careers are kept."
          : <>The screen “{this.props.scope}” failed to display. Your saved career is not affected.</>}</p>
        <p className="break-words text-xs text-ink-faint">{error.message}</p>
        {retry}
      </div>
    );
  }
}
