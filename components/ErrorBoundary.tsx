import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  declare state: Readonly<State>;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Comtra] Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen w-full bg-[#ff90e8] flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold text-black mb-2">Something went wrong</h2>
            <p className="text-sm text-black/80 mb-4 font-mono break-all">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-black text-white text-sm font-medium rounded hover:opacity-90"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
