import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
  xl: 'w-16 h-16 border-4',
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
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className={cn(
        'border-t-transparent rounded-full',
        sizeClasses[size],
        className
      )}
      style={{ borderColor: '#A855F7', borderTopColor: 'transparent' }}
    />
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#FDF4FF' }}>
        {spinner}
        {text && (
          <p className="mt-4 text-sm font-semibold text-purple-500">{text}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      {spinner}
      {text && (
        <p className="mt-4 text-sm font-semibold text-purple-500">{text}</p>
      )}
    </div>
  );
}

// Skeleton loader for product cards
export function ProductSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05 }}
          className="bg-white rounded-3xl border border-purple-100 overflow-hidden"
        >
          {/* Image skeleton */}
          <div className="aspect-[3/4] bg-purple-50 animate-pulse" />
          {/* Content skeleton */}
          <div className="p-3 space-y-2">
            <div className="h-4 bg-purple-50 rounded animate-pulse" />
            <div className="h-3 bg-purple-50 rounded w-2/3 animate-pulse" />
            <div className="flex justify-between items-center pt-2">
              <div className="h-5 bg-purple-50 rounded w-16 animate-pulse" />
              <div className="h-8 w-8 bg-purple-50 rounded-full animate-pulse" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Skeleton loader for text content
export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-purple-50 rounded animate-pulse"
          style={{ width: `${100 - (i % 3) * 20}%` }}
        />
      ))}
    </div>
  );
}

// Error state component
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
      <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-50">
        <span className="text-2xl">😕</span>
      </div>
      <h3 className="text-lg font-black text-purple-900 mb-2">{title}</h3>
      <p className="text-sm text-purple-500 mb-6 max-w-xs mx-auto">{message}</p>
      <div className="flex gap-3 justify-center">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-2.5 rounded-2xl font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
          >
            Try Again
          </button>
        )}
        {onGoHome && (
          <button
            onClick={onGoHome}
            className="px-6 py-2.5 rounded-2xl font-bold text-purple-700 text-sm bg-purple-50 hover:bg-purple-100"
          >
            Go Home
          </button>
        )}
      </div>
    </div>
  );
}
