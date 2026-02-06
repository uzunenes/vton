'use client';

/**
 * Error Boundary Component
 * Catches React errors and displays user-friendly fallback UI
 *
 * Features:
 * - Catches all React rendering errors
 * - Displays contextual error messages
 * - Provides recovery actions
 * - Reports errors to monitoring (when enabled)
 *
 * Usage:
 *   <ErrorBoundary fallback={<CustomError />}>
 *     <YourComponent />
 *   </ErrorBoundary>
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, Home, WifiOff, Clock, Camera, Upload, HelpCircle } from 'lucide-react';
import { getUserFriendlyError, formatErrorForLogging, type UserFriendlyError } from '@/lib/errors';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom fallback component */
  fallback?: React.ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Whether to show technical details (dev mode) */
  showDetails?: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error
    const logData = formatErrorForLogging(error);
    console.error('[ErrorBoundary] Caught error:', logData);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Call error callback
    this.props.onError?.(error, errorInfo);

    // TODO: Report to Sentry when enabled
    // captureError(error, { componentStack: errorInfo.componentStack });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const userError = this.state.error
        ? getUserFriendlyError(this.state.error)
        : getUserFriendlyError(new Error('Unknown error'));

      return (
        <ErrorFallback
          error={userError}
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
          technicalDetails={
            this.props.showDetails
              ? this.state.error?.stack
              : undefined
          }
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Icon mapping for error types
 */
const ErrorIcon: React.FC<{ icon?: UserFriendlyError['icon']; className?: string }> = ({
  icon,
  className = 'w-10 h-10'
}) => {
  const iconClass = `${className} text-current`;

  switch (icon) {
    case 'network':
      return <WifiOff className={iconClass} />;
    case 'timeout':
      return <Clock className={iconClass} />;
    case 'camera':
      return <Camera className={iconClass} />;
    case 'upload':
      return <Upload className={iconClass} />;
    case 'processing':
      return <RefreshCw className={iconClass} />;
    case 'auth':
    case 'generic':
    default:
      return <AlertCircle className={iconClass} />;
  }
};

/**
 * Error Fallback UI Component
 */
export function ErrorFallback({
  error,
  onRetry,
  onGoHome,
  technicalDetails,
}: {
  error: UserFriendlyError;
  onRetry?: () => void;
  onGoHome?: () => void;
  technicalDetails?: string;
}) {
  // Color scheme based on severity
  const severityColors = {
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      icon: 'text-blue-400',
    },
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
      text: 'text-yellow-400',
      icon: 'text-yellow-400',
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      text: 'text-red-400',
      icon: 'text-red-400',
    },
  };

  const colors = severityColors[error.severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center"
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 15, delay: 0.1 }}
        className={`w-20 h-20 ${colors.bg} ${colors.border} border rounded-full flex items-center justify-center mb-6`}
      >
        <div className={colors.icon}>
          <ErrorIcon icon={error.icon} />
        </div>
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold text-white mb-2"
      >
        {error.title}
      </motion.h2>

      {/* Message */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-gray-400 max-w-md mb-8 leading-relaxed"
      >
        {error.message}
      </motion.p>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap gap-4 justify-center"
      >
        {error.recoverable && onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label={error.actionLabel || 'Try again'}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            {error.actionLabel || 'Try Again'}
          </button>
        )}

        {error.secondaryActionLabel && (
          <button
            onClick={error.action?.startsWith('mailto:')
              ? () => window.location.href = error.action!
              : onGoHome
            }
            className="flex items-center gap-2 px-6 py-3 border border-white/20 text-white rounded-xl hover:bg-white/5 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label={error.secondaryActionLabel}
          >
            {error.secondaryActionLabel === 'Contact Support' ? (
              <HelpCircle className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Home className="w-4 h-4" aria-hidden="true" />
            )}
            {error.secondaryActionLabel}
          </button>
        )}

        {!error.secondaryActionLabel && onGoHome && (
          <button
            onClick={onGoHome}
            className="flex items-center gap-2 px-6 py-3 border border-white/20 text-white rounded-xl hover:bg-white/5 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Go to home page"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Go Home
          </button>
        )}
      </motion.div>

      {/* Technical Details (dev mode) */}
      {technicalDetails && (
        <motion.details
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 w-full max-w-2xl text-left"
        >
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 transition-colors">
            Technical Details
          </summary>
          <pre className="mt-2 p-4 bg-black/50 border border-white/10 rounded-lg text-xs text-gray-500 overflow-auto max-h-48">
            {technicalDetails}
          </pre>
        </motion.details>
      )}
    </motion.div>
  );
}

/**
 * Hook to manually trigger error boundary
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  if (error) {
    throw error;
  }

  return {
    showBoundary: (error: Error) => setError(error),
    resetBoundary: () => setError(null),
  };
}

/**
 * Higher-order component for error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
