/**
 * User Analytics
 * Tracks user journey and interactions for product insights
 *
 * Events tracked:
 * - Session lifecycle (start, complete, abandon)
 * - Step progression
 * - User interactions (uploads, approvals)
 * - Error occurrences
 */

import { env } from '@/lib/config/environment';

/**
 * Analytics event types
 */
export type AnalyticsEventType =
  | 'session_start'
  | 'session_complete'
  | 'session_abandoned'
  | 'garment_uploaded'
  | 'pose_captured'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'step_retried'
  | 'approval_given'
  | 'approval_rejected'
  | 'variant_selected'
  | 'video_played'
  | 'result_downloaded'
  | 'error_occurred';

/**
 * Analytics event payload
 */
export interface AnalyticsEvent {
  type: AnalyticsEventType;
  sessionId?: string;
  stepId?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

// Event queue for batching
const eventQueue: AnalyticsEvent[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_QUEUE_SIZE = 20;

/**
 * Track an analytics event
 */
export function trackEvent(
  type: AnalyticsEventType,
  data?: Record<string, unknown>
): void {
  const event: AnalyticsEvent = {
    type,
    timestamp: new Date(),
    ...data,
  };

  // Log in development
  if (env.enableDebugLogs) {
    console.log('[Analytics]', type, data);
  }

  // Only send to server in production
  if (!env.isProduction) return;

  // Add to queue
  eventQueue.push(event);

  // Flush if queue is full
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushEvents();
  } else if (!flushTimeout) {
    // Schedule flush
    flushTimeout = setTimeout(flushEvents, FLUSH_INTERVAL);
  }
}

/**
 * Flush event queue to server
 */
async function flushEvents(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (eventQueue.length === 0) return;

  const events = [...eventQueue];
  eventQueue.length = 0;

  try {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events,
        metadata: {
          url: typeof window !== 'undefined' ? window.location.href : '',
          referrer: typeof document !== 'undefined' ? document.referrer : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          screenSize: typeof window !== 'undefined'
            ? `${window.innerWidth}x${window.innerHeight}`
            : '',
        },
      }),
    });
  } catch (error) {
    // Re-queue events on failure (up to max size)
    const requeue = events.slice(0, MAX_QUEUE_SIZE - eventQueue.length);
    eventQueue.unshift(...requeue);
    console.error('[Analytics] Failed to flush events:', error);
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (eventQueue.length > 0) {
      // Use sendBeacon for reliable delivery on page unload
      const data = JSON.stringify({ events: eventQueue });
      navigator.sendBeacon?.('/api/analytics/events', data);
    }
  });
}

/**
 * Convenience functions for common events
 */
export const analytics = {
  // Session events
  sessionStart: (sessionId: string) =>
    trackEvent('session_start', { sessionId }),

  sessionComplete: (sessionId: string, data?: { totalCost?: number; duration?: number }) =>
    trackEvent('session_complete', { sessionId, data }),

  sessionAbandoned: (sessionId: string, lastStep?: string) =>
    trackEvent('session_abandoned', { sessionId, data: { lastStep } }),

  // Upload events
  garmentUploaded: (sessionId: string, category: string) =>
    trackEvent('garment_uploaded', { sessionId, data: { category } }),

  poseCaptured: (sessionId: string) =>
    trackEvent('pose_captured', { sessionId }),

  // Step events
  stepStarted: (sessionId: string, stepId: string, modelId?: string) =>
    trackEvent('step_started', { sessionId, stepId, data: { modelId } }),

  stepCompleted: (sessionId: string, stepId: string, duration: number, modelId?: string) =>
    trackEvent('step_completed', { sessionId, stepId, data: { duration, modelId } }),

  stepFailed: (sessionId: string, stepId: string, error: string) =>
    trackEvent('step_failed', { sessionId, stepId, data: { error } }),

  stepRetried: (sessionId: string, stepId: string, attempt: number) =>
    trackEvent('step_retried', { sessionId, stepId, data: { attempt } }),

  // Approval events
  approvalGiven: (sessionId: string, stepId: string, variant?: string) =>
    trackEvent('approval_given', { sessionId, stepId, data: { variant } }),

  approvalRejected: (sessionId: string, stepId: string, feedback?: string) =>
    trackEvent('approval_rejected', { sessionId, stepId, data: { feedback } }),

  // Interaction events
  variantSelected: (sessionId: string, variant: string) =>
    trackEvent('variant_selected', { sessionId, data: { variant } }),

  videoPlayed: (sessionId: string) =>
    trackEvent('video_played', { sessionId }),

  resultDownloaded: (sessionId: string, type: 'image' | 'video') =>
    trackEvent('result_downloaded', { sessionId, data: { type } }),

  // Error events
  errorOccurred: (sessionId: string, error: string, context?: string) =>
    trackEvent('error_occurred', { sessionId, data: { error, context } }),
};

/**
 * Funnel tracking for conversion analysis
 */
export interface FunnelStep {
  name: string;
  completed: boolean;
  timestamp?: Date;
  duration?: number;
}

export class FunnelTracker {
  private steps: FunnelStep[] = [];
  private sessionId: string;
  private startTime: Date;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.startTime = new Date();

    // Initialize funnel steps
    this.steps = [
      { name: 'garment_upload', completed: false },
      { name: 'pose_capture', completed: false },
      { name: 'segmentation', completed: false },
      { name: 'vton', completed: false },
      { name: 'approval', completed: false },
      { name: 'video', completed: false },
      { name: 'download', completed: false },
    ];
  }

  markCompleted(stepName: string): void {
    const step = this.steps.find(s => s.name === stepName);
    if (step && !step.completed) {
      step.completed = true;
      step.timestamp = new Date();
      step.duration = step.timestamp.getTime() - this.startTime.getTime();
    }
  }

  getConversionRate(): number {
    const completed = this.steps.filter(s => s.completed).length;
    return completed / this.steps.length;
  }

  getDropOffStep(): string | null {
    for (let i = 0; i < this.steps.length; i++) {
      if (!this.steps[i].completed) {
        return this.steps[i].name;
      }
    }
    return null;
  }

  getSummary(): {
    sessionId: string;
    steps: FunnelStep[];
    conversionRate: number;
    dropOffStep: string | null;
    totalDuration: number;
  } {
    const lastCompletedStep = [...this.steps]
      .reverse()
      .find(s => s.completed);

    return {
      sessionId: this.sessionId,
      steps: this.steps,
      conversionRate: this.getConversionRate(),
      dropOffStep: this.getDropOffStep(),
      totalDuration: lastCompletedStep?.duration || 0,
    };
  }
}
