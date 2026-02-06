/**
 * Environment Configuration
 * Centralized configuration management for all environments
 *
 * Usage:
 *   import { getEnvironmentConfig, env } from '@/vton/utils/environment';
 *   const config = getEnvironmentConfig();
 *   // or use the singleton
 *   if (env.useMock) { ... }
 */

export type AppMode = "development" | "staging" | "production";

export interface EnvironmentConfig {
  /** Current application mode */
  mode: AppMode;

  /** Enable mock mode for development/testing */
  useMock: boolean;

  /** API request timeout in milliseconds */
  apiTimeout: number;

  /** Maximum retry attempts for failed requests */
  maxRetries: number;

  /** Enable debug logging */
  enableDebugLogs: boolean;

  /** Enable cost tracking for API calls */
  enableCostTracking: boolean;

  /** Sentry DSN for error tracking (production) */
  sentryDsn?: string;

  /** Enable A/B comparison between VTON models */
  enableABComparison: boolean;

  /** Video generation duration in seconds */
  videoDuration: 5 | 10;

  /** Output directory for session files */
  outputDirectory: string;
}

/**
 * Parse environment variables and return typed configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const mode = (import.meta.env.VITE_APP_MODE || "development") as AppMode;
  const isProduction = mode === "production";

  return {
    mode,

    // Mock mode: disabled in production, configurable otherwise
    useMock: isProduction ? false : import.meta.env.VITE_USE_MOCK === "true",

    // API settings
    apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT || "60000", 10),
    maxRetries: parseInt(import.meta.env.VITE_MAX_RETRIES || "3", 10),

    // Debug settings
    enableDebugLogs: !isProduction,
    enableCostTracking:
      isProduction || import.meta.env.VITE_ENABLE_COST_TRACKING === "true",

    // Monitoring
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,

    // Feature flags
    enableABComparison: import.meta.env.VITE_ENABLE_AB_COMPARISON === "true",

    // Pipeline settings
    videoDuration: parseInt(
      import.meta.env.VITE_VIDEO_DURATION || "5",
      10,
    ) as 5 | 10,
    outputDirectory: import.meta.env.VITE_OUTPUT_DIRECTORY || "outputs",
  };
}

/**
 * Singleton instance for easy access
 * Re-evaluates on each access to support hot-reloading in development
 */
class EnvironmentConfigSingleton {
  private _config: EnvironmentConfig | null = null;
  private _lastAccess: number = 0;
  private readonly CACHE_DURATION = 1000; // 1 second cache in production

  get config(): EnvironmentConfig {
    const now = Date.now();
    const isProduction =
      typeof window !== "undefined" && import.meta.env.MODE === "production";

    // Cache config in production to avoid repeated parsing
    if (
      isProduction &&
      this._config &&
      now - this._lastAccess < this.CACHE_DURATION
    ) {
      return this._config;
    }

    this._config = getEnvironmentConfig();
    this._lastAccess = now;
    return this._config;
  }

  // Convenience getters
  get mode(): AppMode {
    return this.config.mode;
  }
  get useMock(): boolean {
    return this.config.useMock;
  }
  get apiTimeout(): number {
    return this.config.apiTimeout;
  }
  get maxRetries(): number {
    return this.config.maxRetries;
  }
  get enableDebugLogs(): boolean {
    return this.config.enableDebugLogs;
  }
  get enableCostTracking(): boolean {
    return this.config.enableCostTracking;
  }
  get sentryDsn(): string | undefined {
    return this.config.sentryDsn;
  }
  get enableABComparison(): boolean {
    return this.config.enableABComparison;
  }
  get videoDuration(): 5 | 10 {
    return this.config.videoDuration;
  }
  get outputDirectory(): string {
    return this.config.outputDirectory;
  }

  get isProduction(): boolean {
    return this.config.mode === "production";
  }
  get isDevelopment(): boolean {
    return this.config.mode === "development";
  }
  get isStaging(): boolean {
    return this.config.mode === "staging";
  }
}

/** Global environment configuration singleton */
export const env = new EnvironmentConfigSingleton();

/**
 * Get pipeline configuration derived from environment
 */
export function getPipelineConfig() {
  const config = getEnvironmentConfig();

  return {
    enableSegmentation: true,
    enableABComparison: true,
    enableFaceRestoration: false,
    enableVideo: true,
    videoDuration: config.videoDuration,
    outputDirectory: config.outputDirectory,
    useMock: config.useMock,
  };
}
