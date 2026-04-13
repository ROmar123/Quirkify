import { Component, ReactNode } from 'react';
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
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#FDF4FF' }}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full"
          >
            <div className="bg-white rounded-[2rem] border border-purple-100 p-8 shadow-xl text-center">
              {/* Error Icon */}
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #FEE2E2, #FECACA)' }}
              >
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </motion.div>
              
              {/* Error Title */}
              <h2 className="text-2xl font-black text-purple-900 mb-2">
                Oops! Something went wrong
              </h2>
              
              {/* Error Message */}
              <p className="text-purple-500 text-sm font-semibold mb-4">
                {this.state.error.message || 'An unexpected error occurred'}
              </p>
              
              {/* Error ID */}
              {this.state.errorId && (
                <div className="mb-6 p-3 bg-purple-50 rounded-xl">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">
                    Error Reference
                  </p>
                  <code className="text-xs font-mono text-purple-700">
                    {this.state.errorId}
                  </code>
                </div>
              )}
              
              {/* Stack Trace (dev only) */}
              {isDev && this.state.errorInfo && (
                <div className="mb-6 p-4 bg-gray-900 rounded-xl text-left overflow-hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <Bug className="w-4 h-4 text-gray-400" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Debug Info
                    </span>
                  </div>
                  <pre className="text-xs text-gray-300 font-mono overflow-x-auto max-h-32">
                    {this.state.error.stack}
                    {'\n\n'}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.reset}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
              </div>
            </div>
            
            {/* Support Link */}
            <p className="text-center mt-6 text-xs text-purple-400">
              If this keeps happening, please contact{' '}
              <a href="mailto:support@quirkify.co.za" className="text-purple-600 hover:underline">
                support@quirkify.co.za
              </a>
              {' '}with error reference: {this.state.errorId}
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


import { useState, useCallback } from 'react';
