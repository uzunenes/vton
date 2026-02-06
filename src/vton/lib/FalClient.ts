/**
 * FAL.AI Client Wrapper
 * Provides timeout protection, abort handling, and structured error handling
 * for all fal.ai API calls.
 */

import { fal } from '@fal-ai/client';
import { env } from '@/vton/utils/environment';

// Configure fal client
fal.config({
  proxyUrl: '/api/fal/proxy',
});

/**
 * Custom error types for better error handling
 */
export class FalApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly modelPath?: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'FalApiError';
  }
}

export class TimeoutError extends FalApiError {
  constructor(modelPath: string, timeoutMs: number) {
    super(
      `Request to ${modelPath} timed out after ${timeoutMs}ms`,
      'TIMEOUT_ERROR',
      408,
      modelPath
    );
    this.name = 'TimeoutError';
  }
}

export class AbortError extends FalApiError {
  constructor(modelPath: string) {
    super(
      `Request to ${modelPath} was aborted`,
      'ABORT_ERROR',
      499,
      modelPath
    );
    this.name = 'AbortError';
  }
}

export class NetworkError extends FalApiError {
  constructor(modelPath: string, originalError: Error) {
    super(
      `Network error while calling ${modelPath}: ${originalError.message}`,
      'NETWORK_ERROR',
      0,
      modelPath,
      originalError
    );
    this.name = 'NetworkError';
  }
}

/**
 * Request options for fal.ai calls
 */
export interface FalRequestOptions {
  /** Custom timeout in milliseconds (overrides default) */
  timeout?: number;

  /** AbortController signal for manual cancellation */
  signal?: AbortSignal;

  /** Progress callback for long-running operations */
  onProgress?: (progress: number, message?: string) => void;

  /** Log callback for debug information */
  onLog?: (log: { message: string; level: string }) => void;

  /** Whether to enable detailed logs */
  logs?: boolean;
}

/**
 * Response wrapper with metadata
 */
export interface FalResponse<T> {
  data: T;
  requestId?: string;
  processingTimeMs: number;
}

/**
 * Enhanced FAL.AI client with timeout and error handling
 */
class FalClient {
  private defaultTimeout: number;
  private enableLogs: boolean;

  constructor() {
    this.defaultTimeout = env.apiTimeout;
    this.enableLogs = env.enableDebugLogs;
  }

  /**
   * Subscribe to a fal.ai model with timeout protection
   */
  async subscribe<T = unknown>(
    modelPath: string,
    input: Record<string, unknown>,
    options: FalRequestOptions = {}
  ): Promise<FalResponse<T>> {
    const timeout = options.timeout ?? this.defaultTimeout;
    const startTime = Date.now();

    // Create timeout abort controller
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, timeout);

    // Combine with user-provided signal if any
    const combinedSignal = options.signal
      ? this.combineSignals(options.signal, timeoutController.signal)
      : timeoutController.signal;

    try {
      if (this.enableLogs) {
        console.log(`[FalClient] Starting request to ${modelPath}`, {
          timeout,
          inputKeys: Object.keys(input),
        });
      }

      const result = await fal.subscribe(modelPath, {
        input,
        logs: options.logs ?? this.enableLogs,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS' && options.onProgress) {
            // Estimate progress based on queue position
            options.onProgress(50, 'Processing...');
          }
          if (this.enableLogs && options.onLog) {
            options.onLog({
              message: `Queue status: ${update.status}`,
              level: 'info',
            });
          }
        },
      });

      clearTimeout(timeoutId);

      const processingTimeMs = Date.now() - startTime;

      if (this.enableLogs) {
        console.log(`[FalClient] Request completed in ${processingTimeMs}ms`, {
          modelPath,
          hasResult: !!result,
        });
      }

      return {
        data: result as T,
        requestId: (result as { request_id?: string })?.request_id,
        processingTimeMs,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle different error types
      if (error instanceof Error) {
        // Check if aborted due to timeout
        if (timeoutController.signal.aborted) {
          throw new TimeoutError(modelPath, timeout);
        }

        // Check if manually aborted
        if (options.signal?.aborted) {
          throw new AbortError(modelPath);
        }

        // Network errors
        if (error.message.includes('fetch') ||
            error.message.includes('network') ||
            error.message.includes('ECONNREFUSED')) {
          throw new NetworkError(modelPath, error);
        }

        // Wrap other errors
        throw new FalApiError(
          error.message,
          'API_ERROR',
          undefined,
          modelPath,
          error
        );
      }

      throw error;
    }
  }

  /**
   * Upload a file to fal.ai storage
   */
  async uploadFile(file: Blob | File): Promise<string> {
    const startTime = Date.now();

    try {
      if (this.enableLogs) {
        console.log(`[FalClient] Uploading file`, {
          size: file.size,
          type: file.type,
        });
      }

      const url = await fal.storage.upload(file);

      if (this.enableLogs) {
        console.log(`[FalClient] File uploaded in ${Date.now() - startTime}ms`, {
          url: url.substring(0, 50) + '...',
        });
      }

      return url;
    } catch (error) {
      if (error instanceof Error) {
        throw new FalApiError(
          `Failed to upload file: ${error.message}`,
          'UPLOAD_ERROR',
          undefined,
          'storage.upload',
          error
        );
      }
      throw error;
    }
  }

  /**
   * Combine multiple AbortSignals into one
   */
  private combineSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        return controller.signal;
      }

      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller.signal;
  }

  /**
   * Check if an error is retryable
   */
  static isRetryableError(error: unknown): boolean {
    if (error instanceof TimeoutError) return true;
    if (error instanceof NetworkError) return true;

    if (error instanceof FalApiError) {
      // Retry on server errors (5xx)
      if (error.statusCode && error.statusCode >= 500) return true;
      // Retry on rate limiting
      if (error.statusCode === 429) return true;
    }

    return false;
  }

  /**
   * Get error code for error mapping
   */
  static getErrorCode(error: unknown): string {
    if (error instanceof FalApiError) {
      return error.code;
    }
    if (error instanceof Error) {
      if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
      if (error.message.includes('network')) return 'NETWORK_ERROR';
      if (error.message.includes('abort')) return 'ABORT_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }
}

/** Singleton fal client instance */
export const falClient = new FalClient();

/** Re-export fal for direct access when needed */
export { fal };
