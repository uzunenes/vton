/**
 * Circuit Breaker Pattern
 * Prevents cascade failures by stopping requests to failing services
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 *
 * Usage:
 *   const breaker = new CircuitBreaker({ failureThreshold: 5 });
 *   const result = await breaker.execute(() => apiCall());
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of failures before circuit opens (default: 5) */
  failureThreshold: number;

  /** Number of successes in HALF_OPEN to close circuit (default: 2) */
  successThreshold: number;

  /** Time in ms to wait in OPEN state before testing (default: 30000) */
  timeout: number;

  /** Time window in ms for counting failures (default: 60000) */
  monitoringWindow: number;

  /** Optional name for logging/debugging */
  name?: string;

  /** Callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  monitoringWindow: 60000,
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number | null = null;
  private failureTimestamps: number[] = [];
  private config: CircuitBreakerConfig;

  // Stats
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      if (this.lastFailureTime &&
          Date.now() - this.lastFailureTime >= this.config.timeout) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new CircuitOpenError(
          this.config.name || 'CircuitBreaker',
          this.getRemainingTimeout()
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute with a fallback value if circuit is open
   */
  async executeWithFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return fallback;
      }
      throw error;
    }
  }

  /**
   * Record a successful operation
   */
  private onSuccess(): void {
    this.totalSuccesses++;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      // Clear old failures outside monitoring window
      this.cleanupOldFailures();
      this.failures = 0;
    }
  }

  /**
   * Record a failed operation
   */
  private onFailure(): void {
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.failureTimestamps.push(this.lastFailureTime);

    // Clean up old failures
    this.cleanupOldFailures();

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN immediately opens the circuit
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      this.failures = this.failureTimestamps.length;

      if (this.failures >= this.config.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }

  /**
   * Clean up failures outside the monitoring window
   */
  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.config.monitoringWindow;
    this.failureTimestamps = this.failureTimestamps.filter(ts => ts > cutoff);
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'HALF_OPEN') {
      this.successes = 0;
    } else if (newState === 'OPEN') {
      this.successes = 0;
    }

    this.config.onStateChange?.(oldState, newState);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[CircuitBreaker${this.config.name ? `:${this.config.name}` : ''}] ${oldState} -> ${newState}`);
    }
  }

  /**
   * Reset the circuit breaker to CLOSED state
   */
  private reset(): void {
    this.transitionTo('CLOSED');
    this.failures = 0;
    this.successes = 0;
    this.failureTimestamps = [];
  }

  /**
   * Manually force the circuit to OPEN state
   */
  forceOpen(): void {
    this.transitionTo('OPEN');
    this.lastFailureTime = Date.now();
  }

  /**
   * Manually force the circuit to CLOSED state
   */
  forceClose(): void {
    this.reset();
  }

  /**
   * Get remaining time until circuit attempts to close
   */
  private getRemainingTimeout(): number {
    if (this.state !== 'OPEN' || !this.lastFailureTime) {
      return 0;
    }
    return Math.max(0, this.config.timeout - (Date.now() - this.lastFailureTime));
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Check if circuit is allowing requests
   */
  isAvailable(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') return true;
    if (this.state === 'OPEN' && this.lastFailureTime) {
      return Date.now() - this.lastFailureTime >= this.config.timeout;
    }
    return false;
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  public readonly retryAfterMs: number;
  public readonly circuitName: string;

  constructor(circuitName: string, retryAfterMs: number) {
    super(`Circuit breaker "${circuitName}" is OPEN. Retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.retryAfterMs = retryAfterMs;
  }
}

// Pre-configured circuit breakers for different services
export const circuitBreakers = {
  segmentation: new CircuitBreaker({
    name: 'segmentation',
    failureThreshold: 3,
    timeout: 30000,
  }),

  vton: new CircuitBreaker({
    name: 'vton',
    failureThreshold: 3,
    timeout: 45000,
  }),

  video: new CircuitBreaker({
    name: 'video',
    failureThreshold: 2,
    timeout: 60000, // Longer timeout for video (expensive operation)
  }),
};
