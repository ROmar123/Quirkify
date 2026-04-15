import { Component, ReactNode, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
  errorId: string | null;
}

// Generate a unique error ID for reporting
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('[ErrorBoundary] Error caught:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    
    this.setState({ errorInfo });
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Could send to error tracking service here
    this.reportError(error, errorInfo);
  }
  
  private reportError(error: Error, errorInfo: { componentStack: string }) {
    // In production, send to your error tracking service
    if (import.meta.env.PROD) {
      // Example: Sentry, LogRocket, etc.
      console.error('[ErrorBoundary] Reporting error:', {
        errorId: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      const isDev = import.meta.env.DEV;
      
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4 bg-gray-50">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full"
          >
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center bg-red-50"
              >
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </motion.div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-500 text-sm mb-5 leading-relaxed">
                {this.state.error.message || 'An unexpected error occurred. Try refreshing the page.'}
              </p>

              {this.state.errorId && (
                <div className="mb-5 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 inline-block">
                  <code className="text-[10px] font-mono text-gray-400">
                    ref: {this.state.errorId}
                  </code>
                </div>
              )}

              {isDev && this.state.errorInfo && (
                <div className="mb-5 p-4 bg-gray-900 rounded-xl text-left overflow-hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <Bug className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Debug</span>
                  </div>
                  <pre className="text-xs text-gray-300 font-mono overflow-x-auto max-h-32 whitespace-pre-wrap">
                    {this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
                  </pre>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button onClick={this.reset} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button onClick={this.handleGoHome} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
              </div>
            </div>

            <p className="text-center mt-4 text-xs text-gray-400">
              Persisting issue? Email{' '}
              <a href="mailto:support@quirkify.co.za" className="text-quirky hover:underline">
                support@quirkify.co.za
              </a>
            </p>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for async error handling in functional components
export function useAsyncError() {
  const [error, setError] = useState<Error | null>(null);
  
  const handleError = useCallback((err: unknown) => {
    if (err instanceof Error) {
      setError(err);
    } else {
      setError(new Error(String(err)));
    }
  }, []);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return { error, handleError, clearError };
}
