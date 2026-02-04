/**
 * Garment Segmentation Step
 * Uses SAM2 to segment the garment from background
 */

import { fal } from '@/lib/fal';
import { StepResult, SegmentationOutput, PipelineInputs } from '@/types/pipeline';
import { modelRegistry } from '@/lib/models/ModelRegistry';
import { PipelineConfig } from '../PipelineOrchestrator';

export interface SegmentationStepInput {
  stepId: string;
  inputs: PipelineInputs;
  previousResults: Record<string, StepResult | undefined>;
  config: PipelineConfig;
}

export async function executeGarmentSegmentation(
  input: SegmentationStepInput
): Promise<StepResult<SegmentationOutput>> {
  const startTime = Date.now();
  const modelConfig = modelRegistry.getDefaultSegmentationModel();

  try {
    // Get garment image URL
    const garmentImageUrl = input.inputs.garmentImageUrl;
    if (!garmentImageUrl) {
      throw new Error('No garment image URL provided');
    }

    // For SAM2, we use prompts format with {x, y, label}
    // Using center point for controlled segmentation (assuming typical garment image ~1024px)
    const segmentInput = {
      image_url: garmentImageUrl,
      prompts: [
        { x: 512, y: 512, label: 1 } // Center point, foreground
      ],
      apply_mask: true,
    };

    console.log('[Segmentation] Calling SAM2 with input:', segmentInput);

    const result = await fal.subscribe(modelConfig.modelPath, {
      input: segmentInput,
      logs: true,
    }) as any;

    const processingTimeMs = Date.now() - startTime;

    // Extract results
    const outputData = result.data || result;

    // SAM2 returns image with mask applied
    let segmentedImageUrl: string;
    let maskUrl: string;

    if (outputData.image?.url) {
      segmentedImageUrl = outputData.image.url;
      maskUrl = outputData.image.url;
    } else if (outputData.combined_mask?.url) {
      maskUrl = outputData.combined_mask.url;
      segmentedImageUrl = maskUrl;
    } else if (outputData.masks && outputData.masks.length > 0) {
      // Use the first/best mask
      maskUrl = outputData.masks[0].url || outputData.masks[0];
      segmentedImageUrl = maskUrl;
    } else {
      throw new Error('No mask returned from SAM2');
    }

    const output: SegmentationOutput = {
      segmentedImageUrl,
      maskUrl,
      originalImageUrl: garmentImageUrl,
    };

    return {
      success: true,
      data: output,
      processingTimeMs,
      modelUsed: modelConfig.id,
      inputUrls: [garmentImageUrl],
      outputUrls: [segmentedImageUrl, maskUrl],
      metadata: {
        modelPath: modelConfig.modelPath,
        prompts: segmentInput.prompts,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    console.error('[Segmentation] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown segmentation error',
      processingTimeMs,
      modelUsed: modelConfig.id,
      inputUrls: [input.inputs.garmentImageUrl || ''],
      outputUrls: [],
      metadata: {},
      timestamp: new Date(),
    };
  }
}

// Alternative: Use auto-segment for full automatic segmentation
export async function executeAutoSegmentation(
  garmentImageUrl: string
): Promise<StepResult<SegmentationOutput>> {
  const startTime = Date.now();
  const modelConfig = modelRegistry.getSegmentationModel('sam2-auto');

  if (!modelConfig) {
    return {
      success: false,
      error: 'SAM2 auto-segment model not found',
      processingTimeMs: Date.now() - startTime,
      modelUsed: 'sam2-auto',
      inputUrls: [garmentImageUrl],
      outputUrls: [],
      metadata: {},
      timestamp: new Date(),
    };
  }

  try {
    const result = await fal.subscribe(modelConfig.modelPath, {
      input: {
        image_url: garmentImageUrl,
      },
      logs: true,
    }) as any;

    const processingTimeMs = Date.now() - startTime;
    const outputData = result.data || result;

    // Auto-segment returns combined mask
    const maskUrl = outputData.combined_mask?.url;
    if (!maskUrl) {
      throw new Error('No combined mask returned');
    }

    const output: SegmentationOutput = {
      segmentedImageUrl: maskUrl,
      maskUrl,
      originalImageUrl: garmentImageUrl,
    };

    return {
      success: true,
      data: output,
      processingTimeMs,
      modelUsed: modelConfig.id,
      inputUrls: [garmentImageUrl],
      outputUrls: [maskUrl],
      metadata: {
        modelPath: modelConfig.modelPath,
        autoSegment: true,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Auto-segmentation failed',
      processingTimeMs: Date.now() - startTime,
      modelUsed: modelConfig.id,
      inputUrls: [garmentImageUrl],
      outputUrls: [],
      metadata: {},
      timestamp: new Date(),
    };
  }
}
