/**
 * Session Logger
 * Structured logging system for VTON pipeline sessions
 * Supports both in-memory logging and file persistence
 */

import {
  SessionId,
  SessionLogEntry,
  LogLevel,
  generateLogId,
} from '@/vton/types/session';

export interface LogOptions {
  stepId?: string;
  data?: Record<string, unknown>;
  source?: string;
}

export class SessionLogger {
  private sessionId: SessionId;
  private logs: SessionLogEntry[];
  private apiEndpoint: string;
  private flushInterval: NodeJS.Timeout | null = null;
  private pendingLogs: SessionLogEntry[] = [];
  private batchSize: number = 10;
  private flushIntervalMs: number = 5000;

  constructor(sessionId: SessionId, apiEndpoint: string = '/api/session') {
    this.sessionId = sessionId;
    this.logs = [];
    this.apiEndpoint = apiEndpoint;

    // Start periodic flush
    this.startPeriodicFlush();
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  private stopPeriodicFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  // Create a log entry
  private createEntry(level: LogLevel, message: string, options: LogOptions = {}): SessionLogEntry {
    const entry: SessionLogEntry = {
      id: generateLogId(),
      timestamp: new Date(),
      level,
      message,
      stepId: options.stepId,
      data: options.data,
      source: options.source || 'client',
    };

    this.logs.push(entry);
    this.pendingLogs.push(entry);

    // Auto-flush if batch size reached
    if (this.pendingLogs.length >= this.batchSize) {
      this.flush();
    }

    return entry;
  }

  // Log methods for different levels
  debug(message: string, options?: LogOptions): SessionLogEntry {
    return this.createEntry('debug', message, options);
  }

  info(message: string, options?: LogOptions): SessionLogEntry {
    return this.createEntry('info', message, options);
  }

  warn(message: string, options?: LogOptions): SessionLogEntry {
    return this.createEntry('warn', message, options);
  }

  error(message: string, options?: LogOptions): SessionLogEntry {
    return this.createEntry('error', message, options);
  }

  // Log step start
  stepStarted(stepId: string, stepName: string): SessionLogEntry {
    return this.info(`Step started: ${stepName}`, {
      stepId,
      data: { stepName, action: 'step_started' },
    });
  }

  // Log step completion
  stepCompleted(stepId: string, stepName: string, processingTimeMs: number): SessionLogEntry {
    return this.info(`Step completed: ${stepName} (${processingTimeMs}ms)`, {
      stepId,
      data: { stepName, processingTimeMs, action: 'step_completed' },
    });
  }

  // Log step failure
  stepFailed(stepId: string, stepName: string, error: string): SessionLogEntry {
    return this.error(`Step failed: ${stepName} - ${error}`, {
      stepId,
      data: { stepName, error, action: 'step_failed' },
    });
  }

  // Log model call
  modelCalled(stepId: string, modelId: string, modelPath: string): SessionLogEntry {
    return this.info(`Model called: ${modelId}`, {
      stepId,
      data: { modelId, modelPath, action: 'model_called' },
    });
  }

  // Log model response
  modelResponse(stepId: string, modelId: string, success: boolean, processingTimeMs: number): SessionLogEntry {
    const level = success ? 'info' : 'error';
    const message = success
      ? `Model response: ${modelId} succeeded (${processingTimeMs}ms)`
      : `Model response: ${modelId} failed`;
    return this.createEntry(level, message, {
      stepId,
      data: { modelId, success, processingTimeMs, action: 'model_response' },
    });
  }

  // Log approval event
  approvalEvent(stepId: string, approved: boolean, selectedVariant?: string): SessionLogEntry {
    const message = approved
      ? `Step approved${selectedVariant ? ` (variant: ${selectedVariant})` : ''}`
      : 'Step rejected';
    return this.info(message, {
      stepId,
      data: { approved, selectedVariant, action: 'approval_event' },
    });
  }

  // Log file save
  fileSaved(stepId: string, filename: string, fileSize: number): SessionLogEntry {
    return this.info(`File saved: ${filename} (${this.formatBytes(fileSize)})`, {
      stepId,
      data: { filename, fileSize, action: 'file_saved' },
    });
  }

  // Log pipeline start
  pipelineStarted(garmentCategory: string): SessionLogEntry {
    return this.info(`Pipeline started for category: ${garmentCategory}`, {
      data: { garmentCategory, action: 'pipeline_started' },
    });
  }

  // Log pipeline completion
  pipelineCompleted(totalTimeMs: number): SessionLogEntry {
    return this.info(`Pipeline completed in ${this.formatDuration(totalTimeMs)}`, {
      data: { totalTimeMs, action: 'pipeline_completed' },
    });
  }

  // Log pipeline failure
  pipelineFailed(error: string): SessionLogEntry {
    return this.error(`Pipeline failed: ${error}`, {
      data: { error, action: 'pipeline_failed' },
    });
  }

  // Flush pending logs to server
  async flush(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logsToSend = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      await fetch(`${this.apiEndpoint}/${this.sessionId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Action': 'logs',
        },
        body: JSON.stringify({ action: 'logs', logs: logsToSend }),
      });
    } catch (error) {
      // Re-add logs if send failed
      this.pendingLogs = [...logsToSend, ...this.pendingLogs];
      console.error('Failed to flush logs:', error);
    }
  }

  // Get all logs
  getLogs(): SessionLogEntry[] {
    return [...this.logs];
  }

  // Get logs for a specific step
  getStepLogs(stepId: string): SessionLogEntry[] {
    return this.logs.filter(log => log.stepId === stepId);
  }

  // Get logs by level
  getLogsByLevel(level: LogLevel): SessionLogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  // Get recent logs
  getRecentLogs(count: number = 10): SessionLogEntry[] {
    return this.logs.slice(-count);
  }

  // Export logs as JSONL string
  exportAsJsonl(): string {
    return this.logs.map(log => JSON.stringify(log)).join('\n');
  }

  // Clear logs
  clear(): void {
    this.logs = [];
    this.pendingLogs = [];
  }

  // Destroy logger
  destroy(): void {
    this.stopPeriodicFlush();
    this.flush(); // Final flush
  }

  // Helper: Format bytes
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Helper: Format duration
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

// Factory function
export function createSessionLogger(sessionId: SessionId): SessionLogger {
  return new SessionLogger(sessionId);
}

// Console logger for development
export class ConsoleLogger {
  private prefix: string;

  constructor(prefix: string = '[VTON]') {
    this.prefix = prefix;
  }

  debug(message: string, data?: unknown): void {
    console.debug(`${this.prefix} [DEBUG] ${message}`, data || '');
  }

  info(message: string, data?: unknown): void {
    console.info(`${this.prefix} [INFO] ${message}`, data || '');
  }

  warn(message: string, data?: unknown): void {
    console.warn(`${this.prefix} [WARN] ${message}`, data || '');
  }

  error(message: string, data?: unknown): void {
    console.error(`${this.prefix} [ERROR] ${message}`, data || '');
  }
}

export const consoleLogger = new ConsoleLogger();
