/**
 * Pipeline Type Definitions
 * Core types for the VTON pipeline orchestration system
 */

// Step status tracking
export type StepStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed'
  | 'skipped';

// Result of a single pipeline step execution
export interface StepResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  processingTimeMs: number;
  modelUsed: string;
  inputUrls: string[];
  outputUrls: string[];
  metadata: Record<string, unknown>;
  timestamp: Date;
}

// Configuration for step execution
export interface StepConfig {
  modelId: string;
  modelParams: Record<string, unknown>;
  timeout: number;
  retryOnFailure: boolean;
}

// Abstract pipeline step interface
export interface PipelineStep<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  requiresApproval: boolean;
  execute: (input: TInput, config: StepConfig) => Promise<StepResult<TOutput>>;
  validate?: (result: StepResult<TOutput>) => boolean;
  canRetry: boolean;
  maxRetries: number;
  estimatedTimeSeconds: number;
}

// State of an individual step in the pipeline
export interface PipelineStepState {
  stepId: string;
  status: StepStatus;
  result?: StepResult;
  approvedAt?: Date;
  rejectedAt?: Date;
  feedback?: string;
  attempts: number;
  startedAt?: Date;
  completedAt?: Date;
  selectedVariant?: string; // For A/B comparison
}

// Overall pipeline state
export interface PipelineState {
  sessionId: string;
  currentStepIndex: number;
  steps: PipelineStepState[];
  startedAt: Date;
  completedAt?: Date;
  status: PipelineStatus;
  inputs: PipelineInputs;
}

export type PipelineStatus =
  | 'idle'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Pipeline inputs
export interface PipelineInputs {
  garmentImageBlob?: Blob;
  garmentImageUrl?: string;
  garmentCategory: GarmentCategory;
  userImageBlob?: Blob;
  userImageUrl?: string;
  userPoseLandmarks?: PoseLandmark[];
}

export type GarmentCategory = 'tops' | 'bottoms' | 'one-piece' | 'accessory';

// Pose landmark from MediaPipe
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

// User's decision on approval
export interface ApprovalDecision {
  approved: boolean;
  feedback?: string;
  selectedVariant?: string; // For A/B comparison - 'fashn' | 'leffa'
  regenerate?: boolean;
  regenerateWithModel?: string;
}

// Pipeline events for UI updates
export type PipelineEventType =
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'awaiting_approval'
  | 'step_approved'
  | 'step_rejected'
  | 'pipeline_completed'
  | 'pipeline_failed'
  | 'pipeline_cancelled';

export interface PipelineEvent {
  type: PipelineEventType;
  stepId?: string;
  data?: unknown;
  timestamp: Date;
}

export type PipelineEventHandler = (event: PipelineEvent) => void;

// Step-specific output types
export interface SegmentationOutput {
  segmentedImageUrl: string;
  maskUrl: string;
  originalImageUrl: string;
}

export interface PoseDetectionOutput {
  landmarks: PoseLandmark[];
  matchScore: number;
  isValid: boolean;
  capturedImageUrl: string;
}

export interface VTONOutput {
  resultImageUrl: string;
  maskUrl?: string;
  modelUsed: string;
  // For A/B comparison
  variants?: {
    fashn?: {
      imageUrl: string;
      processingTime: number;
    };
    leffa?: {
      imageUrl: string;
      processingTime: number;
    };
  };
}

export interface VideoOutput {
  videoUrl: string;
  duration: number;
  resolution: string;
  thumbnailUrl?: string;
}

// Combined output type union
export type StepOutputType =
  | SegmentationOutput
  | PoseDetectionOutput
  | VTONOutput
  | VideoOutput;
