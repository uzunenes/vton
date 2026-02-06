'use client';

/**
 * Empty State Component
 * Displays when content is not yet available
 *
 * Features:
 * - Contextual messaging
 * - Action buttons
 * - Animated entrance
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  ImageIcon,
  Camera,
  Sparkles,
  Upload,
  Video,
  Shirt,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export type EmptyStateType =
  | 'garment'
  | 'camera'
  | 'result'
  | 'video'
  | 'generic';

export interface EmptyStateProps {
  /** Type of empty state (determines icon and default text) */
  type?: EmptyStateType;

  /** Custom title */
  title?: string;

  /** Custom description */
  description?: string;

  /** Primary action label */
  actionLabel?: string;

  /** Primary action callback */
  onAction?: () => void;

  /** Secondary action label */
  secondaryLabel?: string;

  /** Secondary action callback */
  onSecondaryAction?: () => void;

  /** Custom icon */
  icon?: React.ReactNode;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

const defaults: Record<EmptyStateType, { icon: React.ReactNode; title: string; description: string }> = {
  garment: {
    icon: <Shirt className="w-full h-full" />,
    title: 'No Garment Selected',
    description: 'Upload a garment image to begin your virtual try-on experience.',
  },
  camera: {
    icon: <Camera className="w-full h-full" />,
    title: 'Camera Ready',
    description: 'Position yourself in front of the camera to capture your pose.',
  },
  result: {
    icon: <Sparkles className="w-full h-full" />,
    title: 'Output Channel Ready',
    description: 'Your virtual try-on results will appear here.',
  },
  video: {
    icon: <Video className="w-full h-full" />,
    title: 'Video Preview',
    description: 'Your runway video will be generated after the try-on process.',
  },
  generic: {
    icon: <ImageIcon className="w-full h-full" />,
    title: 'No Content',
    description: 'Content will appear here once available.',
  },
};

export function EmptyState({
  type = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  icon,
  size = 'md',
}: EmptyStateProps) {
  const defaultContent = defaults[type];
  const displayTitle = title || defaultContent.title;
  const displayDescription = description || defaultContent.description;
  const displayIcon = icon || defaultContent.icon;

  const sizes = {
    sm: {
      container: 'p-6',
      iconWrapper: 'w-12 h-12 mb-4',
      iconInner: 'w-6 h-6',
      title: 'text-sm font-medium',
      description: 'text-xs',
      buttonSize: 'sm' as const,
    },
    md: {
      container: 'p-10',
      iconWrapper: 'w-16 h-16 mb-6',
      iconInner: 'w-8 h-8',
      title: 'text-base font-semibold',
      description: 'text-sm',
      buttonSize: 'md' as const,
    },
    lg: {
      container: 'p-16',
      iconWrapper: 'w-24 h-24 mb-8',
      iconInner: 'w-12 h-12',
      title: 'text-xl font-bold',
      description: 'text-base',
      buttonSize: 'lg' as const,
    },
  };

  const s = sizes[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex flex-col items-center justify-center text-center ${s.container}`}
    >
      {/* Icon */}
      <div
        className={`${s.iconWrapper} rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center`}
      >
        <div className={`${s.iconInner} text-white/10`}>
          {displayIcon}
        </div>
      </div>

      {/* Title */}
      <p className={`${s.title} text-white/30 tracking-tight`}>
        {displayTitle}
      </p>

      {/* Description */}
      {displayDescription && (
        <p className={`${s.description} text-white/10 mt-2 max-w-xs leading-relaxed`}>
          {displayDescription}
        </p>
      )}

      {/* Actions */}
      {(actionLabel || secondaryLabel) && (
        <div className="flex flex-wrap gap-3 mt-6 justify-center">
          {actionLabel && onAction && (
            <Button
              variant="primary"
              size={s.buttonSize}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && onSecondaryAction && (
            <Button
              variant="secondary"
              size={s.buttonSize}
              onClick={onSecondaryAction}
            >
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Inline Empty Hint - Subtle empty state for inline use
 */
export function EmptyHint({
  text,
  icon,
}: {
  text: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-white/20">
      {icon && <span className="w-4 h-4">{icon}</span>}
      <span className="text-xs font-medium uppercase tracking-widest">{text}</span>
    </div>
  );
}
