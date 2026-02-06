'use client';

/**
 * Loading State Component
 * Displays animated loading indicator with optional progress
 *
 * Features:
 * - Animated spinner
 * - Progress bar (optional)
 * - Screen reader announcements
 * - Customizable messaging
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  /** Title text */
  title?: string;

  /** Description text */
  description?: string;

  /** Progress percentage (0-100) */
  progress?: number;

  /** Show minimal spinner only */
  minimal?: boolean;

  /** Custom icon */
  icon?: React.ReactNode;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({
  title = 'Processing',
  description = 'Please wait while we work our magic...',
  progress,
  minimal = false,
  icon,
  size = 'md',
}: LoadingStateProps) {
  const sizes = {
    sm: {
      container: 'py-8',
      spinner: 'w-12 h-12',
      innerIcon: 'w-5 h-5',
      title: 'text-base',
      description: 'text-xs',
      progressBar: 'w-32',
    },
    md: {
      container: 'py-16',
      spinner: 'w-20 h-20',
      innerIcon: 'w-8 h-8',
      title: 'text-xl',
      description: 'text-sm',
      progressBar: 'w-48',
    },
    lg: {
      container: 'py-24',
      spinner: 'w-28 h-28',
      innerIcon: 'w-12 h-12',
      title: 'text-2xl',
      description: 'text-base',
      progressBar: 'w-64',
    },
  };

  const s = sizes[size];

  if (minimal) {
    return (
      <div
        className="flex items-center justify-center p-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="w-6 h-6 text-white animate-spin" />
        <span className="sr-only">{title}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`flex flex-col items-center justify-center ${s.container}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Animated Spinner */}
      <div className={`relative ${s.spinner} mb-6`}>
        {/* Outer ring - static */}
        <div className="absolute inset-0 border-4 border-white/5 rounded-full" />

        {/* Spinning ring */}
        <motion.div
          className="absolute inset-0 border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />

        {/* Inner icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {icon || <Sparkles className={`${s.innerIcon} text-white/20`} aria-hidden="true" />}
        </div>
      </div>

      {/* Title */}
      <h2 className={`${s.title} font-semibold text-white mb-2`}>
        {title}
      </h2>

      {/* Description */}
      <p className={`${s.description} text-gray-400 text-center max-w-md mb-6`}>
        {description}
      </p>

      {/* Progress Bar */}
      {progress !== undefined && (
        <div className={`${s.progressBar}`}>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center tabular-nums">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Screen reader announcement */}
      <span className="sr-only">
        {progress !== undefined
          ? `${title}: ${Math.round(progress)}% complete`
          : `${title}: Loading...`}
      </span>
    </motion.div>
  );
}

/**
 * Skeleton Loading Placeholder
 */
export interface SkeletonProps {
  /** Width class (e.g., 'w-full', 'w-32') */
  width?: string;

  /** Height class (e.g., 'h-4', 'h-8') */
  height?: string;

  /** Border radius class */
  rounded?: string;

  /** Additional classes */
  className?: string;
}

export function Skeleton({
  width = 'w-full',
  height = 'h-4',
  rounded = 'rounded',
  className,
}: SkeletonProps) {
  return (
    <div
      className={`${width} ${height} ${rounded} bg-white/5 animate-pulse ${className || ''}`}
      aria-hidden="true"
    />
  );
}

/**
 * Image Skeleton - Maintains aspect ratio
 */
export function ImageSkeleton({
  aspectRatio = '3/4',
  className,
}: {
  aspectRatio?: string;
  className?: string;
}) {
  return (
    <div
      className={`bg-white/5 animate-pulse rounded-2xl ${className || ''}`}
      style={{ aspectRatio }}
      aria-hidden="true"
    />
  );
}
