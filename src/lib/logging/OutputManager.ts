/**
 * Output Manager
 * Handles saving and retrieving pipeline outputs (images, videos, metadata)
 */

import {
  SessionId,
  SessionOutput,
  OutputType,
  OutputMetadata,
  SessionDirectory,
  getSessionDirectory,
  formatDateForDirectory,
  formatTimestampForFilename,
  generateOutputId,
} from '@/types/session';

export interface SaveOutputParams {
  stepId: string;
  url: string;
  type: OutputType;
  modelUsed: string;
  variant?: string;
  metadata?: Partial<OutputMetadata>;
}

export interface OutputManagerConfig {
  baseDirectory: string;
  apiEndpoint: string;
}

const DEFAULT_CONFIG: OutputManagerConfig = {
  baseDirectory: 'outputs',
  apiEndpoint: '/api/session',
};

export class OutputManager {
  private sessionId: SessionId;
  private config: OutputManagerConfig;
  private outputs: SessionOutput[];
  private directory: SessionDirectory;

  constructor(sessionId: SessionId, config: Partial<OutputManagerConfig> = {}) {
    this.sessionId = sessionId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.outputs = [];
    this.directory = getSessionDirectory(
      this.config.baseDirectory,
      formatDateForDirectory(),
      sessionId
    );
  }

  // Get session directory paths
  getDirectory(): SessionDirectory {
    return this.directory;
  }

  // Save an input file (garment or user image)
  async saveInput(
    type: 'garment-original' | 'garment-segmented' | 'garment-mask' | 'user-capture',
    blob: Blob,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const extension = this.getExtensionFromMimeType(blob.type);
    const filename = `${type}.${extension}`;

    try {
      const response = await fetch(`${this.config.apiEndpoint}/${this.sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          contentType: blob.type,
          data: await this.blobToBase64(blob),
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save input: ${response.statusText}`);
      }

      const result = await response.json();
      return result.localPath;
    } catch (error) {
      console.error('Failed to save input:', error);
      throw error;
    }
  }

  // Save an output from a pipeline step
  async saveOutput(params: SaveOutputParams): Promise<SessionOutput> {
    const { stepId, url, type, modelUsed, variant, metadata } = params;

    const outputId = generateOutputId(stepId, variant);
    const timestamp = formatTimestampForFilename();
    const extension = this.getExtensionFromType(type);
    const variantSuffix = variant ? `-${variant}` : '';
    const filename = `${stepId}${variantSuffix}_${timestamp}.${extension}`;

    try {
      // Call API to download and save the file
      const response = await fetch(`${this.config.apiEndpoint}/${this.sessionId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Action': 'output',
        },
        body: JSON.stringify({
          action: 'output',
          url,
          type,
          filename,
          stepId,
          modelUsed,
          variant,
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save output: ${response.statusText}`);
      }

      const result = await response.json();

      const output: SessionOutput = {
        id: outputId,
        stepId,
        type,
        url,
        localPath: result.localPath,
        modelUsed,
        variant,
        createdAt: new Date(),
        approved: false,
        selected: false,
        metadata: {
          processingTimeMs: metadata?.processingTimeMs || 0,
          modelParams: metadata?.modelParams || {},
          fileSize: result.fileSize,
          resolution: result.resolution,
          duration: result.duration,
          contentType: result.contentType,
        },
      };

      this.outputs.push(output);
      return output;
    } catch (error) {
      console.error('Failed to save output:', error);
      throw error;
    }
  }

  // Save step metadata
  async saveMetadata(stepId: string, metadata: Record<string, unknown>): Promise<void> {
    try {
      await fetch(`${this.config.apiEndpoint}/${this.sessionId}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          metadata,
        }),
      });
    } catch (error) {
      console.error('Failed to save metadata:', error);
      throw error;
    }
  }

  // Mark an output as approved
  markApproved(outputId: string): void {
    const output = this.outputs.find(o => o.id === outputId);
    if (output) {
      output.approved = true;
    }
  }

  // Mark an output as selected (for A/B comparison)
  markSelected(outputId: string): void {
    const output = this.outputs.find(o => o.id === outputId);
    if (output) {
      output.selected = true;
      // Deselect other outputs from the same step
      this.outputs
        .filter(o => o.stepId === output.stepId && o.id !== outputId)
        .forEach(o => { o.selected = false; });
    }
  }

  // Get all outputs
  getOutputs(): SessionOutput[] {
    return [...this.outputs];
  }

  // Get outputs for a specific step
  getStepOutputs(stepId: string): SessionOutput[] {
    return this.outputs.filter(o => o.stepId === stepId);
  }

  // Get output by ID
  getOutput(outputId: string): SessionOutput | undefined {
    return this.outputs.find(o => o.id === outputId);
  }

  // Get selected output for a step (for A/B comparison)
  getSelectedOutput(stepId: string): SessionOutput | undefined {
    return this.outputs.find(o => o.stepId === stepId && o.selected);
  }

  // Get the latest output for a step
  getLatestOutput(stepId: string): SessionOutput | undefined {
    const stepOutputs = this.getStepOutputs(stepId);
    if (stepOutputs.length === 0) return undefined;
    return stepOutputs.reduce((latest, current) =>
      current.createdAt > latest.createdAt ? current : latest
    );
  }

  // Get outputs by type
  getOutputsByType(type: OutputType): SessionOutput[] {
    return this.outputs.filter(o => o.type === type);
  }

  // Calculate total file size
  getTotalFileSize(): number {
    return this.outputs.reduce((total, output) =>
      total + (output.metadata.fileSize || 0), 0
    );
  }

  // Export outputs summary
  exportSummary(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      directory: this.directory,
      outputCount: this.outputs.length,
      totalFileSize: this.getTotalFileSize(),
      outputs: this.outputs.map(o => ({
        id: o.id,
        stepId: o.stepId,
        type: o.type,
        localPath: o.localPath,
        modelUsed: o.modelUsed,
        approved: o.approved,
        selected: o.selected,
        createdAt: o.createdAt,
      })),
    };
  }

  // Helper: Get file extension from MIME type
  private getExtensionFromMimeType(mimeType: string): string {
    const mapping: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
    };
    return mapping[mimeType] || 'bin';
  }

  // Helper: Get file extension from output type
  private getExtensionFromType(type: OutputType): string {
    switch (type) {
      case 'image':
      case 'mask':
      case 'segmented_garment':
        return 'png';
      case 'video':
        return 'mp4';
      default:
        return 'bin';
    }
  }

  // Helper: Convert blob to base64
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// Factory function
export function createOutputManager(
  sessionId: SessionId,
  config?: Partial<OutputManagerConfig>
): OutputManager {
  return new OutputManager(sessionId, config);
}
