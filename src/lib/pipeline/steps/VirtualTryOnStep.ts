/**
 * Virtual Try-On Step
 * Uses FASHN v1.6 and Leffa models for A/B comparison
 */

import { fal } from '@/lib/fal';
import { StepResult, VTONOutput, PipelineInputs, SegmentationOutput } from '@/types/pipeline';
import { modelRegistry } from '@/lib/models/ModelRegistry';
import { mapCategory } from '@/types/models';
import { PipelineConfig } from '../PipelineOrchestrator';

export interface VTONStepInput {
  stepId: string;
  inputs: PipelineInputs;
  previousResults: Record<string, StepResult | undefined>;
  config: PipelineConfig;
}

// Run a single VTON model
async function runVTONModel(
  modelId: string,
  humanImageUrl: string,
  garmentImageUrl: string,
  category: string
): Promise<{ success: boolean; imageUrl?: string; error?: string; processingTimeMs: number }> {
  const startTime = Date.now();
  const modelConfig = modelRegistry.getVTONModel(modelId);

  if (!modelConfig) {
    return {
      success: false,
      error: `Model not found: ${modelId}`,
      processingTimeMs: Date.now() - startTime,
    };
  }

  try {
    const mappedCategory = mapCategory(modelId, category);
    const input = modelRegistry.buildVTONInput(
      modelId,
      humanImageUrl,
      garmentImageUrl,
      category as any
    );

    console.log(`[VTON] Calling ${modelId} with input:`, input);

    const result = await fal.subscribe(modelConfig.modelPath, {
      input,
      logs: true,
    }) as any;

    const processingTimeMs = Date.now() - startTime;
    const outputData = result.data || result;

    // Extract image URL based on model output format
    let imageUrl: string | undefined;
    if (outputData.image?.url) {
      imageUrl = outputData.image.url;
    } else if (outputData.output?.url) {
      imageUrl = outputData.output.url;
    } else if (outputData.url) {
      imageUrl = outputData.url;
    } else if (typeof outputData.image === 'string') {
      imageUrl = outputData.image;
    } else if (Array.isArray(outputData.images) && outputData.images.length > 0) {
      imageUrl = outputData.images[0].url || outputData.images[0];
    }

    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    return {
      success: true,
      imageUrl,
      processingTimeMs,
    };
  } catch (error) {
    console.error(`[VTON] ${modelId} error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

export async function executeVirtualTryOn(
  input: VTONStepInput
): Promise<StepResult<VTONOutput>> {
  const startTime = Date.now();
  const { primary, secondary } = modelRegistry.getDefaultVTONModels();

  try {
    // Get human image URL
    const humanImageUrl = input.inputs.userImageUrl;
    if (!humanImageUrl) {
      throw new Error('No user image URL provided');
    }

    // Get garment image URL (use segmented if available)
    let garmentImageUrl = input.inputs.garmentImageUrl;

    // Check if segmentation step was run and use its output
    const segmentationResult = input.previousResults['segmentation'];
    if (segmentationResult?.success && segmentationResult.data) {
      const segData = segmentationResult.data as SegmentationOutput;
      // Use original garment for now - segmented mask would need compositing
      // garmentImageUrl = segData.segmentedImageUrl;
    }

    if (!garmentImageUrl) {
      throw new Error('No garment image URL provided');
    }

    const category = input.inputs.garmentCategory;

    // Check if A/B comparison is enabled
    const enableAB = input.config.enableABComparison;

    if (enableAB) {
      // Run both models in parallel
      console.log('[VTON] Running A/B comparison with FASHN and Leffa');

      const [fashnResult, leffaResult] = await Promise.all([
        runVTONModel(primary.id, humanImageUrl, garmentImageUrl, category),
        runVTONModel(secondary.id, humanImageUrl, garmentImageUrl, category),
      ]);

      const processingTimeMs = Date.now() - startTime;

      // Check if at least one succeeded
      if (!fashnResult.success && !leffaResult.success) {
        throw new Error(`Both models failed: FASHN: ${fashnResult.error}, Leffa: ${leffaResult.error}`);
      }

      // Build output with variants
      const output: VTONOutput = {
        resultImageUrl: fashnResult.imageUrl || leffaResult.imageUrl || '',
        modelUsed: fashnResult.success ? primary.id : secondary.id,
        variants: {},
      };

      if (fashnResult.success && fashnResult.imageUrl) {
        output.variants!.fashn = {
          imageUrl: fashnResult.imageUrl,
          processingTime: fashnResult.processingTimeMs,
        };
      }

      if (leffaResult.success && leffaResult.imageUrl) {
        output.variants!.leffa = {
          imageUrl: leffaResult.imageUrl,
          processingTime: leffaResult.processingTimeMs,
        };
      }

      const outputUrls = [
        fashnResult.imageUrl,
        leffaResult.imageUrl,
      ].filter(Boolean) as string[];

      return {
        success: true,
        data: output,
        processingTimeMs,
        modelUsed: 'ab-comparison',
        inputUrls: [humanImageUrl, garmentImageUrl],
        outputUrls,
        metadata: {
          fashnSuccess: fashnResult.success,
          fashnTime: fashnResult.processingTimeMs,
          fashnError: fashnResult.error,
          leffaSuccess: leffaResult.success,
          leffaTime: leffaResult.processingTimeMs,
          leffaError: leffaResult.error,
          category,
        },
        timestamp: new Date(),
      };
    } else {
      // Run only primary model
      console.log('[VTON] Running single model:', primary.id);

      const result = await runVTONModel(primary.id, humanImageUrl, garmentImageUrl, category);

      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || 'VTON failed');
      }

      const output: VTONOutput = {
        resultImageUrl: result.imageUrl,
        modelUsed: primary.id,
      };

      return {
        success: true,
        data: output,
        processingTimeMs: result.processingTimeMs,
        modelUsed: primary.id,
        inputUrls: [humanImageUrl, garmentImageUrl],
        outputUrls: [result.imageUrl],
        metadata: {
          category,
          modelPath: primary.modelPath,
        },
        timestamp: new Date(),
      };
    }
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    console.error('[VTON] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown VTON error',
      processingTimeMs,
      modelUsed: primary.id,
      inputUrls: [input.inputs.userImageUrl || '', input.inputs.garmentImageUrl || ''],
      outputUrls: [],
      metadata: {},
      timestamp: new Date(),
    };
  }
}

// Helper to get the selected variant URL
export function getSelectedVTONUrl(result: StepResult<VTONOutput>, selectedVariant?: string): string | undefined {
  if (!result.success || !result.data) return undefined;

  const output = result.data;

  if (selectedVariant && output.variants) {
    if (selectedVariant === 'fashn' && output.variants.fashn) {
      return output.variants.fashn.imageUrl;
    }
    if (selectedVariant === 'leffa' && output.variants.leffa) {
      return output.variants.leffa.imageUrl;
    }
  }

  return output.resultImageUrl;
}
