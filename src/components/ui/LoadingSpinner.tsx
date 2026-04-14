import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { AlertTriangle } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-7 h-7 border-2',
  lg: 'w-10 h-10 border-3',
  xl: 'w-14 h-14 border-[3px]',
};

export function LoadingSpinner({
  size = 'md',
  className,
  text,
  fullScreen = false
}: LoadingSpinnerProps) {
  const spinner = (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      className={cn('border-t-transparent rounded-full', sizeClasses[size], className)}
      style={{ borderColor: '#e9d5ff', borderTopColor: '#a855f7' }}
    />
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        {spinner}
        {text && <p className="mt-4 text-sm font-medium text-gray-500">{text}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      {spinner}
      {text && <p className="mt-3 text-sm font-medium text-gray-500">{text}</p>}
    </div>
  );
}

export function ProductSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-[20px] border border-gray-100 overflow-hidden">
          <div className="aspect-[3/4] skeleton" style={{ borderRadius: 0 }} />
          <div className="p-3.5 space-y-2.5">
            <div className="skeleton h-3.5 rounded-lg" />
            <div className="skeleton h-3 rounded-lg w-2/3" />
            <div className="flex justify-between items-center pt-1">
              <div className="skeleton h-5 rounded-lg w-14" />
              <div className="skeleton h-7 w-7 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4 rounded-lg"
          style={{ width: `${100 - (i % 3) * 18}%` }}
        />
      ))}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onGoHome?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  onGoHome
}: ErrorStateProps) {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-red-50">
        <AlertTriangle className="w-6 h-6 text-red-400" />
      </div>
      <h3 className="text-base font-bold text-gray-800 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">{message}</p>
      <div className="flex gap-3 justify-center">
        {onRetry && (
          <button onClick={onRetry} className="btn-primary px-5 py-2.5 text-sm">
            Try Again
          </button>
        )}
        {onGoHome && (
          <button onClick={onGoHome} className="btn-secondary px-5 py-2.5 text-sm">
            Go Home
          </button>
        )}
      </div>
    </div>
  );
}
