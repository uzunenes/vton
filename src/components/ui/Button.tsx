'use client';

/**
 * Accessible Button Component
 * Apple HIG compliant with full accessibility support
 *
 * Features:
 * - Multiple variants (primary, secondary, ghost)
 * - Size options (sm, md, lg)
 * - Loading state with spinner
 * - Full keyboard accessibility
 * - Focus visible styling
 * - Min touch target 44x44px
 */

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  /** Button style variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';

  /** Button size */
  size?: 'sm' | 'md' | 'lg';

  /** Show loading spinner */
  loading?: boolean;

  /** Icon to show before text */
  icon?: React.ReactNode;

  /** Icon to show after text */
  iconAfter?: React.ReactNode;

  /** Full width button */
  fullWidth?: boolean;

  /** Children content */
  children: React.ReactNode;
}

const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={clsx('animate-spin', className)}
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconAfter,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        whileHover={isDisabled ? undefined : { scale: 1.02 }}
        whileTap={isDisabled ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className={clsx(
          // Base styles
          'inline-flex items-center justify-center font-semibold rounded-xl transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black',

          // Minimum touch target (44x44px)
          'min-h-[44px] min-w-[44px]',

          // Size variants
          size === 'sm' && 'px-4 py-2 text-sm gap-1.5',
          size === 'md' && 'px-6 py-3 text-base gap-2',
          size === 'lg' && 'px-8 py-4 text-lg gap-2.5',

          // Style variants
          variant === 'primary' && [
            'bg-white text-black',
            'hover:bg-gray-100 active:bg-gray-200',
            'focus-visible:ring-white',
          ],
          variant === 'secondary' && [
            'bg-white/10 text-white border border-white/20',
            'hover:bg-white/20 active:bg-white/30',
            'focus-visible:ring-white/50',
          ],
          variant === 'ghost' && [
            'text-gray-400 bg-transparent',
            'hover:text-white hover:bg-white/5',
            'active:bg-white/10',
            'focus-visible:ring-white/30',
          ],
          variant === 'danger' && [
            'bg-red-500 text-white',
            'hover:bg-red-600 active:bg-red-700',
            'focus-visible:ring-red-500',
          ],

          // Disabled state
          isDisabled && 'opacity-50 cursor-not-allowed',

          // Full width
          fullWidth && 'w-full',

          className
        )}
        {...props}
      >
        {loading && (
          <LoadingSpinner className={clsx(
            size === 'sm' && 'w-3 h-3',
            size === 'md' && 'w-4 h-4',
            size === 'lg' && 'w-5 h-5',
          )} />
        )}

        {!loading && icon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}

        <span>{children}</span>

        {iconAfter && (
          <span className="flex-shrink-0" aria-hidden="true">
            {iconAfter}
          </span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

/**
 * Icon Button - Square button for icons only
 */
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'iconAfter'> {
  /** Icon to display */
  icon: React.ReactNode;

  /** Accessible label (required for icon-only buttons) */
  'aria-label': string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = 'md', className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size={size}
        className={clsx(
          // Square shape
          size === 'sm' && 'px-2 py-2',
          size === 'md' && 'px-3 py-3',
          size === 'lg' && 'px-4 py-4',
          'aspect-square',
          className
        )}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';
