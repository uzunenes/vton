/**
 * Performance Monitoring
 * Tracks Web Vitals and custom performance metrics
 *
 * Metrics tracked:
 * - LCP (Largest Contentful Paint)
 * - FID (First Input Delay)
 * - CLS (Cumulative Layout Shift)
 * - FCP (First Contentful Paint)
 * - TTFB (Time to First Byte)
 * - Custom pipeline metrics
 */

import { env } from '@/lib/config/environment';

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Web Vitals thresholds (in ms, except CLS which is unitless)
const THRESHOLDS: Record<string, [number, number]> = {
  LCP: [2500, 4000],      // Good < 2.5s, Poor > 4s
  FID: [100, 300],        // Good < 100ms, Poor > 300ms
  CLS: [0.1, 0.25],       // Good < 0.1, Poor > 0.25
  FCP: [1800, 3000],      // Good < 1.8s, Poor > 3s
  TTFB: [800, 1800],      // Good < 800ms, Poor > 1.8s
  INP: [200, 500],        // Good < 200ms, Poor > 500ms
};

/**
 * Get rating for a metric value
 */
export function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const [good, poor] = THRESHOLDS[name] || [1000, 3000];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Report a Web Vital metric
 */
export function reportWebVital(metric: {
  name: string;
  value: number;
  id: string;
}): void {
  const rating = getRating(metric.name, metric.value);

  // Log in development
  if (env.enableDebugLogs) {
    const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
    console.log(`[WebVital] ${emoji} ${metric.name}: ${metric.value.toFixed(2)} (${rating})`);
  }

  // Send to analytics in production
  if (env.isProduction && typeof window !== 'undefined') {
    // Google Analytics 4
    if ((window as Window & { gtag?: Function }).gtag) {
      (window as Window & { gtag?: Function }).gtag!('event', metric.name, {
        event_category: 'Web Vitals',
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      });
    }

    // Send to custom endpoint
    sendToAnalytics({
      type: 'web_vital',
      name: metric.name,
      value: metric.value,
      rating,
      id: metric.id,
    }).catch(console.error);
  }
}

/**
 * Custom performance marks
 */
const performanceMarks = new Map<string, number>();

/**
 * Start a performance measurement
 */
export function startMeasure(name: string): void {
  if (typeof performance !== 'undefined') {
    performanceMarks.set(name, performance.now());
    performance.mark(`${name}-start`);
  }
}

/**
 * End a performance measurement and report
 */
export function endMeasure(name: string, metadata?: Record<string, unknown>): number {
  if (typeof performance === 'undefined') return 0;

  const startTime = performanceMarks.get(name);
  if (!startTime) {
    console.warn(`[Performance] No start mark found for: ${name}`);
    return 0;
  }

  const duration = performance.now() - startTime;
  performanceMarks.delete(name);

  performance.mark(`${name}-end`);
  performance.measure(name, `${name}-start`, `${name}-end`);

  if (env.enableDebugLogs) {
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`, metadata);
  }

  // Report to analytics
  if (env.isProduction) {
    sendToAnalytics({
      type: 'custom_metric',
      name,
      value: duration,
      metadata,
    }).catch(console.error);
  }

  return duration;
}

/**
 * Measure async function execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<{ result: T; duration: number }> {
  startMeasure(name);
  try {
    const result = await fn();
    const duration = endMeasure(name, metadata);
    return { result, duration };
  } catch (error) {
    endMeasure(name, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Pipeline step performance tracker
 */
export interface StepPerformance {
  stepId: string;
  modelId: string;
  duration: number;
  success: boolean;
  timestamp: Date;
}

const stepPerformances: StepPerformance[] = [];

export function recordStepPerformance(perf: Omit<StepPerformance, 'timestamp'>): void {
  stepPerformances.push({
    ...perf,
    timestamp: new Date(),
  });

  if (env.enableDebugLogs) {
    const status = perf.success ? '✅' : '❌';
    console.log(`[StepPerf] ${status} ${perf.stepId} (${perf.modelId}): ${perf.duration}ms`);
  }
}

export function getStepPerformances(): StepPerformance[] {
  return [...stepPerformances];
}

export function clearStepPerformances(): void {
  stepPerformances.length = 0;
}

/**
 * Send data to analytics endpoint
 */
async function sendToAnalytics(data: Record<string, unknown>): Promise<void> {
  if (!env.isProduction) return;

  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
    });
  } catch (error) {
    // Silent fail - don't break the app for analytics
    console.error('[Analytics] Failed to send:', error);
  }
}

/**
 * Get performance summary
 */
export function getPerformanceSummary(): {
  steps: StepPerformance[];
  totalDuration: number;
  averageDuration: number;
  successRate: number;
} {
  const steps = getStepPerformances();
  const totalDuration = steps.reduce((sum, s) => sum + s.duration, 0);
  const successCount = steps.filter(s => s.success).length;

  return {
    steps,
    totalDuration,
    averageDuration: steps.length > 0 ? totalDuration / steps.length : 0,
    successRate: steps.length > 0 ? successCount / steps.length : 1,
  };
}
