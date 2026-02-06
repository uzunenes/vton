'use client';

/**
 * Error State Component
 * Displays errors with recovery actions
 * Re-exports ErrorFallback from ErrorBoundary for convenience
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  RefreshCw,
  Home,
  WifiOff,
  Clock,
  Camera,
  Upload,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getUserFriendlyError, type UserFriendlyError } from '@/lib/errors';

export interface ErrorStateProps {
  /** Error object or error code */
  error: Error | string;

  /** Retry callback */
  onRetry?: () => void;

  /** Go home callback */
  onGoHome?: () => void;

  /** Custom action callback */
  onCustomAction?: () => void;

  /** Custom action label */
  customActionLabel?: string;

  /** Show technical details */
  showDetails?: boolean;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Icon mapping for error types
 */
const ErrorIcon: React.FC<{ icon?: UserFriendlyError['icon']; className?: string }> = ({
  icon,
  className = 'w-10 h-10'
}) => {
  const props = { className };

  switch (icon) {
    case 'network':
      return <WifiOff {...props} />;
    case 'timeout':
      return <Clock {...props} />;
    case 'camera':
      return <Camera {...props} />;
    case 'upload':
      return <Upload {...props} />;
    case 'processing':
      return <RefreshCw {...props} />;
    case 'auth':
    case 'generic':
    default:
      return <AlertCircle {...props} />;
  }
};

/**
 * Severity color mapping
 */
const severityColors = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-400',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    icon: 'text-yellow-400',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: 'text-red-400',
  },
};

export function ErrorState({
  error,
  onRetry,
  onGoHome,
  onCustomAction,
  customActionLabel,
  showDetails = false,
  size = 'md',
}: ErrorStateProps) {
  // Convert error to user-friendly format
  const userError: UserFriendlyError = typeof error === 'string'
    ? getUserFriendlyError(new Error(error))
    : getUserFriendlyError(error);

  const colors = severityColors[userError.severity];

  const sizes = {
    sm: {
      container: 'py-8 px-4',
      iconWrapper: 'w-14 h-14 mb-4',
      icon: 'w-7 h-7',
      title: 'text-lg',
      description: 'text-sm',
      buttonSize: 'sm' as const,
    },
    md: {
      container: 'py-16 px-6',
      iconWrapper: 'w-20 h-20 mb-6',
      icon: 'w-10 h-10',
      title: 'text-2xl',
      description: 'text-base',
      buttonSize: 'md' as const,
    },
    lg: {
      container: 'py-24 px-8',
      iconWrapper: 'w-28 h-28 mb-8',
      icon: 'w-14 h-14',
      title: 'text-3xl',
      description: 'text-lg',
      buttonSize: 'lg' as const,
    },
  };

  const s = sizes[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`flex flex-col items-center justify-center text-center ${s.container}`}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 15, delay: 0.1 }}
        className={`${s.iconWrapper} ${colors.bg} ${colors.border} border rounded-full flex items-center justify-center`}
      >
        <div className={colors.icon}>
          <ErrorIcon icon={userError.icon} className={s.icon} />
        </div>
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={`${s.title} font-bold text-white mb-2`}
      >
        {userError.title}
      </motion.h2>

      {/* Message */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className={`${s.description} text-gray-400 max-w-md leading-relaxed`}
      >
        {userError.message}
      </motion.p>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap gap-4 justify-center mt-8"
      >
        {userError.recoverable && onRetry && (
          <Button
            variant="primary"
            size={s.buttonSize}
            onClick={onRetry}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            {userError.actionLabel || 'Try Again'}
          </Button>
        )}

        {customActionLabel && onCustomAction && (
          <Button
            variant="secondary"
            size={s.buttonSize}
            onClick={onCustomAction}
            iconAfter={<ChevronRight className="w-4 h-4" />}
          >
            {customActionLabel}
          </Button>
        )}

        {onGoHome && (
          <Button
            variant="ghost"
            size={s.buttonSize}
            onClick={onGoHome}
            icon={<Home className="w-4 h-4" />}
          >
            Go Home
          </Button>
        )}
      </motion.div>

      {/* Technical Details */}
      {showDetails && error instanceof Error && error.stack && (
        <motion.details
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 w-full max-w-2xl text-left"
        >
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 transition-colors">
            Technical Details
          </summary>
          <pre className="mt-2 p-4 bg-black/50 border border-white/10 rounded-lg text-xs text-gray-500 overflow-auto max-h-48 font-mono">
            {error.stack}
          </pre>
        </motion.details>
      )}
    </motion.div>
  );
}

/**
 * Inline Error - Compact error display for forms/inputs
 */
export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      <span className="text-sm text-red-400 flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-red-400 hover:text-red-300 underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Toast Error - For temporary error notifications
 */
export function ToastError({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-red-500/90 backdrop-blur-lg rounded-xl shadow-lg"
      role="alert"
    >
      <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
      <span className="text-sm text-white font-medium">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-white/60 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </motion.div>
  );
}
