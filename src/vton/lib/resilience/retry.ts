/**
 * Retry with Exponential Backoff
 * Automatically retries failed operations with increasing delays
 *
 * Features:
 * - Exponential backoff (1s, 2s, 4s, 8s...)
 * - Jitter to prevent thundering herd
 * - Configurable retry conditions
 * - Abort signal support
 *
 * Usage:
 *   const result = await withRetry(() => apiCall(), { maxRetries: 3 });
 */

import { FalApiError, TimeoutError, NetworkError } from '../FalClient';
import { CircuitOpenError } from './CircuitBreaker';

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;

  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs: number;

  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs: number;

  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;

  /** Jitter factor 0-1, adds randomness to delay (default: 0.1) */
  jitterFactor: number;

  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;

  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;

  /** AbortSignal to cancel retries */
  signal?: AbortSignal;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * List of error types/messages that are considered retryable
 */
const RETRYABLE_ERROR_PATTERNS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENETUNREACH',
  'NetworkError',
  'TimeoutError',
  'fetch failed',
  'network error',
  'socket hang up',
  'ENOTFOUND',
  '429', // Rate limited
  '502', // Bad Gateway
  '503', // Service Unavailable
  '504', // Gateway Timeout
];

/**
 * Default function to determine if an error is retryable
 */
function defaultIsRetryable(error: unknown): boolean {
  // Never retry circuit open errors
  if (error instanceof CircuitOpenError) {
    return false;
  }

  // Timeout and network errors are retryable
  if (error instanceof TimeoutError) return true;
  if (error instanceof NetworkError) return true;

  // Check FalApiError status codes
  if (error instanceof FalApiError) {
    const statusCode = error.statusCode;
    if (statusCode) {
      // Retry on server errors and rate limiting
      if (statusCode >= 500 || statusCode === 429) return true;
      // Don't retry client errors
      if (statusCode >= 400 && statusCode < 500) return false;
    }
  }

  // Check error message patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    return RETRYABLE_ERROR_PATTERNS.some(pattern =>
      message.includes(pattern.toLowerCase()) ||
      name.includes(pattern.toLowerCase())
    );
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitterFactor: number
): number {
  // Exponential backoff
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter
  const jitter = cappedDelay * jitterFactor * Math.random();

  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Retry aborted'));
      }, { once: true });
    }
  });
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig: RetryConfig = { ...DEFAULT_CONFIG, ...config };
  const isRetryable = finalConfig.isRetryable || defaultIsRetryable;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    // Check if aborted
    if (finalConfig.signal?.aborted) {
      throw new Error('Retry aborted');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      const shouldRetry = isRetryable(error) && attempt < finalConfig.maxRetries;

      if (!shouldRetry) {
        throw error;
      }

      // Calculate delay
      const delay = calculateDelay(
        attempt,
        finalConfig.baseDelayMs,
        finalConfig.maxDelayMs,
        finalConfig.backoffMultiplier,
        finalConfig.jitterFactor
      );

      // Notify callback
      finalConfig.onRetry?.(attempt + 1, error, delay);

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Retry] Attempt ${attempt + 1}/${finalConfig.maxRetries} failed, retrying in ${delay}ms`, {
          error: (error as Error).message,
        });
      }

      // Wait before retry
      await sleep(delay, finalConfig.signal);
    }
  }

  throw lastError;
}

/**
 * Execute with retry and return detailed result
 */
export async function withRetryResult<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  const onRetry = config.onRetry;
  const trackedConfig = {
    ...config,
    onRetry: (attempt: number, error: unknown, delayMs: number) => {
      attempts = attempt;
      onRetry?.(attempt, error, delayMs);
    },
  };

  try {
    const data = await withRetry(fn, trackedConfig);
    return {
      success: true,
      data,
      attempts: attempts + 1,
      totalDelayMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error as Error,
      attempts: attempts + 1,
      totalDelayMs: Date.now() - startTime,
    };
  }
}

/**
 * Create a retryable version of a function
 */
export function createRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): T {
  return ((...args: Parameters<T>) => {
    return withRetry(() => fn(...args), config);
  }) as T;
}

/**
 * Decorator-style retry wrapper for class methods
 */
export function retryable(config: Partial<RetryConfig> = {}) {
  return function <T>(
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return withRetry(() => originalMethod.apply(this, args), config);
    };

    return descriptor;
  };
}
