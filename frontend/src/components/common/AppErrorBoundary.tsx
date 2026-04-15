import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "./ErrorState";

interface AppErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Unhandled UI render error", error, errorInfo);
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKey && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="space-y-3">
          <ErrorState message="This page hit an unexpected UI error. Try reloading the page section." />
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
          >
            Retry page render
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
