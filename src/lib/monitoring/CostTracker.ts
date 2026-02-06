/**
 * Cost Tracker
 * Tracks API costs per session for budget monitoring
 *
 * Model Costs (as of 2026):
 * - SAM3 Segmentation: $0.005/run
 * - FASHN v1.5 VTON: $0.05/run
 * - FASHN v1.6 VTON (Legacy): $0.05/run
 * - CAT-VTON (Legacy): $0.03/run
 * - Kling O3 Pro Video (5s): $2.50/run
 * - Kling 2.0 Video (5s): $1.00/run (Legacy)
 */

import { env } from '@/lib/config/environment';

export interface CostEntry {
  sessionId: string;
  stepId: string;
  modelId: string;
  cost: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface CostSummary {
  totalCost: number;
  costByStep: Record<string, number>;
  costByModel: Record<string, number>;
  entryCount: number;
}

// Model cost configuration
const MODEL_COSTS: Record<string, number> = {
  // Segmentation
  'sam3-image': 0.005,
  'sam2-image': 0.02,  // Legacy
  'sam2-auto': 0.02,   // Legacy

  // VTON
  'fashn-v1.5': 0.05,
  'fashn-v1.6': 0.05,  // Legacy
  'cat-vton': 0.03,    // Legacy
  'leffa': 0.04,       // Legacy
  'idm-vton': 0.03,    // Legacy

  // Video
  'kling-o3-pro': 2.50,
  'kling-o3-standard': 2.00,    // Legacy
  'kling-v2-master': 1.00,      // Legacy
  'kling-v2-master-10s': 2.00,  // Legacy
  'minimax-hailuo': 0.50,       // Legacy

  // Mock (no cost)
  'mock-sam3': 0,
  'mock-sam2': 0,  // Legacy
  'mock-vton': 0,
  'mock-kling': 0,
};

export class CostTracker {
  private entries: CostEntry[] = [];
  private sessionId: string;
  private enabled: boolean;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.enabled = env.enableCostTracking;
  }

  /**
   * Record a model call with its associated cost
   */
  recordModelCall(
    stepId: string,
    modelId: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.enabled) return;

    const cost = this.getModelCost(modelId);

    this.entries.push({
      sessionId: this.sessionId,
      stepId,
      modelId,
      cost,
      timestamp: new Date(),
      metadata,
    });

    if (env.enableDebugLogs) {
      console.log(`[CostTracker] Recorded: ${modelId} = $${cost.toFixed(2)}`);
    }
  }

  /**
   * Get cost for a specific model
   */
  getModelCost(modelId: string): number {
    // Normalize model ID
    const normalizedId = modelId.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Direct match
    if (MODEL_COSTS[normalizedId] !== undefined) {
      return MODEL_COSTS[normalizedId];
    }

    // Partial match
    for (const [key, cost] of Object.entries(MODEL_COSTS)) {
      if (normalizedId.includes(key) || key.includes(normalizedId)) {
        return cost;
      }
    }

    // Default cost for unknown models
    console.warn(`[CostTracker] Unknown model: ${modelId}, using default cost`);
    return 0.05;
  }

  /**
   * Get total cost for this session
   */
  getTotalCost(): number {
    return this.entries.reduce((sum, entry) => sum + entry.cost, 0);
  }

  /**
   * Get cost breakdown by step
   */
  getCostByStep(): Record<string, number> {
    return this.entries.reduce((acc, entry) => {
      acc[entry.stepId] = (acc[entry.stepId] || 0) + entry.cost;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get cost breakdown by model
   */
  getCostByModel(): Record<string, number> {
    return this.entries.reduce((acc, entry) => {
      acc[entry.modelId] = (acc[entry.modelId] || 0) + entry.cost;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get all entries
   */
  getEntries(): CostEntry[] {
    return [...this.entries];
  }

  /**
   * Get cost summary
   */
  getSummary(): CostSummary {
    return {
      totalCost: this.getTotalCost(),
      costByStep: this.getCostByStep(),
      costByModel: this.getCostByModel(),
      entryCount: this.entries.length,
    };
  }

  /**
   * Format total cost for display
   */
  formatTotalCost(): string {
    return `$${this.getTotalCost().toFixed(2)}`;
  }

  /**
   * Check if cost exceeds a threshold
   */
  exceedsThreshold(threshold: number): boolean {
    return this.getTotalCost() > threshold;
  }

  /**
   * Estimate cost for a pipeline run
   */
  static estimatePipelineCost(options: {
    enableSegmentation?: boolean;
    enableABComparison?: boolean;
    enableVideo?: boolean;
    videoDuration?: 5 | 10;
  }): number {
    let cost = 0;

    if (options.enableSegmentation) {
      cost += MODEL_COSTS['sam3-image'];
    }

    if (options.enableABComparison) {
      cost += MODEL_COSTS['fashn-v1.5'];
      cost += MODEL_COSTS['fashn-v1.6'];
    } else {
      cost += MODEL_COSTS['fashn-v1.5'];
    }

    if (options.enableVideo) {
      cost += MODEL_COSTS['kling-o3-pro'];
    }

    return cost;
  }

  /**
   * Format estimated cost for display
   */
  static formatEstimatedCost(options: Parameters<typeof CostTracker.estimatePipelineCost>[0]): string {
    return `$${CostTracker.estimatePipelineCost(options).toFixed(2)}`;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Export entries as JSON
   */
  toJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      summary: this.getSummary(),
      entries: this.entries,
    }, null, 2);
  }
}

// Singleton for current session
let currentTracker: CostTracker | null = null;

export function getCostTracker(sessionId?: string): CostTracker {
  if (!currentTracker || (sessionId && currentTracker['sessionId'] !== sessionId)) {
    currentTracker = new CostTracker(sessionId || `session-${Date.now()}`);
  }
  return currentTracker;
}

export function resetCostTracker(): void {
  currentTracker = null;
}
