import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('Error caught by boundary:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }

      return (
        <div className="max-w-lg mx-auto px-4 py-32 text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-red-50">
            <div className="text-2xl font-black text-red-600">!</div>
          </div>
          <h2 className="text-2xl font-black text-red-600 mb-3">Something went wrong</h2>
          <p className="text-red-500 text-sm font-semibold mb-2">{this.state.error.message}</p>
          <p className="text-xs text-red-400 mb-6 max-h-32 overflow-y-auto font-mono">
            {this.state.error.stack}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 rounded-full font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Return to Store
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
