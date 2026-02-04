/**
 * Session and Logging Types
 * Types for session management, logging, and output persistence
 */

import { PipelineState, GarmentCategory, PoseLandmark } from './pipeline';

// Unique session identifier
export type SessionId = string;

// Complete session object
export interface Session {
  id: SessionId;
  createdAt: Date;
  updatedAt: Date;
  status: SessionStatus;
  inputs: SessionInputs;
  outputs: SessionOutput[];
  logs: SessionLogEntry[];
  pipelineState: PipelineState;
  metadata: SessionMetadata;
}

export type SessionStatus = 'active' | 'completed' | 'abandoned' | 'failed';

// Session inputs - what the user provided
export interface SessionInputs {
  garmentImageUrl?: string;
  garmentImageLocalPath?: string;
  garmentCategory: GarmentCategory;
  userImageUrl?: string;
  userImageLocalPath?: string;
  userPoseLandmarks?: PoseLandmark[];
  garmentPoseLandmarks?: PoseLandmark[];
}

// Individual output from a pipeline step
export interface SessionOutput {
  id: string;
  stepId: string;
  type: OutputType;
  url: string;
  localPath?: string;
  modelUsed: string;
  variant?: string; // 'fashn' | 'leffa' for A/B comparison
  createdAt: Date;
  approved: boolean;
  selected: boolean; // Was this the selected variant?
  metadata: OutputMetadata;
}

export type OutputType = 'image' | 'video' | 'mask' | 'segmented_garment';

// Metadata for an output
export interface OutputMetadata {
  resolution?: Resolution;
  duration?: number; // For videos
  fileSize?: number;
  processingTimeMs: number;
  modelParams: Record<string, unknown>;
  qualityScore?: number;
  contentType?: string;
}

export interface Resolution {
  width: number;
  height: number;
}

// Log entry for session tracking
export interface SessionLogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  stepId?: string;
  message: string;
  data?: Record<string, unknown>;
  source: string; // 'client' | 'server' | 'model'
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Session metadata
export interface SessionMetadata {
  userAgent?: string;
  deviceType?: string;
  totalProcessingTimeMs: number;
  totalCost: number;
  modelsUsed: string[];
  completedSteps: number;
  totalSteps: number;
}

// Session creation request
export interface CreateSessionRequest {
  garmentCategory: GarmentCategory;
}

// Session creation response
export interface CreateSessionResponse {
  sessionId: SessionId;
  createdAt: Date;
  outputDirectory: string;
}

// Save output request
export interface SaveOutputRequest {
  sessionId: SessionId;
  stepId: string;
  url: string;
  type: OutputType;
  modelUsed: string;
  variant?: string;
  metadata?: Partial<OutputMetadata>;
}

// Save output response
export interface SaveOutputResponse {
  outputId: string;
  localPath: string;
  savedAt: Date;
}

// Log request
export interface LogRequest {
  sessionId: SessionId;
  level: LogLevel;
  stepId?: string;
  message: string;
  data?: Record<string, unknown>;
}

// Session summary for gallery display
export interface SessionSummary {
  id: SessionId;
  createdAt: Date;
  status: SessionStatus;
  garmentCategory: GarmentCategory;
  thumbnailUrl?: string;
  outputCount: number;
  hasVideo: boolean;
  totalProcessingTimeMs: number;
}

// Session list response
export interface SessionListResponse {
  sessions: SessionSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// Session directory structure
export interface SessionDirectory {
  root: string;
  inputs: string;
  outputs: string;
  metadata: string;
  sessionJson: string;
  logsJsonl: string;
}

// Helper to generate session directory paths
export function getSessionDirectory(baseDir: string, date: string, sessionId: SessionId): SessionDirectory {
  const root = `${baseDir}/${date}/${sessionId}`;
  return {
    root,
    inputs: `${root}/inputs`,
    outputs: `${root}/outputs`,
    metadata: `${root}/metadata`,
    sessionJson: `${root}/session.json`,
    logsJsonl: `${root}/logs.jsonl`,
  };
}

// Generate unique IDs
export function generateSessionId(): SessionId {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function generateOutputId(stepId: string, variant?: string): string {
  const variantSuffix = variant ? `-${variant}` : '';
  return `output-${stepId}${variantSuffix}-${Date.now()}`;
}

export function generateLogId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

// Date formatting for directory names
export function formatDateForDirectory(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Timestamp formatting for file names
export function formatTimestampForFilename(date: Date = new Date()): string {
  const time = date.toTimeString().split(' ')[0].replace(/:/g, '-');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${time}-${ms}`;
}
