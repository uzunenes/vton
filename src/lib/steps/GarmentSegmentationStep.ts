/**
 * Garment Segmentation Step
 * Uses SAM2 to segment the garment from background
 *
 * Features:
 * - Circuit breaker protection
 * - Automatic retry with exponential backoff
 */

import { fal } from "../fal";
import {
  StepResult,
  SegmentationOutput,
  PipelineInputs,
} from "../../types/pipeline";
import { modelRegistry } from "../models/ModelRegistry";
import { PipelineConfig } from "../PipelineOrchestrator";
import { circuitBreakers, withRetry } from "../resilience";
import { env } from "../../utils/environment";

export interface SegmentationStepInput {
  stepId: string;
  inputs: PipelineInputs;
  previousResults: Record<string, StepResult | undefined>;
  config: PipelineConfig;
}

export async function executeGarmentSegmentation(
  input: SegmentationStepInput,
): Promise<StepResult<SegmentationOutput>> {
  const startTime = Date.now();
  const modelConfig = modelRegistry.getDefaultSegmentationModel();

  try {
    // Get garment image URL
    const garmentImageUrl = input.inputs.garmentImageUrl;
    if (!garmentImageUrl) {
      throw new Error("No garment image URL provided");
    }

    // Build input based on model type
    const isSAM3 = modelConfig.modelPath.includes("sam-3");
    const segmentInput = isSAM3
      ? {
          // SAM3 format: uses point_prompts (not prompts) and text prompt
          image_url: garmentImageUrl,
          prompt: "clothing garment",
          point_prompts: [
            { x: 512, y: 512, label: 1 }, // Center point, foreground
          ],
          apply_mask: true,
          output_format: "png",
        }
      : {
          // SAM2 format: uses prompts array
          image_url: garmentImageUrl,
          prompts: [{ x: 512, y: 512, label: 1 }],
          apply_mask: true,
        };

    // Check for mock mode
    if (input.config.useMock) {
      console.log(
        "[Segmentation] MOCK MODE: Returning mock segmentation result",
      );
      // In mock mode, we just return the original image as segmented
      const output: SegmentationOutput = {
        segmentedImageUrl: garmentImageUrl,
        maskUrl: garmentImageUrl,
        originalImageUrl: garmentImageUrl,
      };

      return {
        success: true,
        data: output,
        processingTimeMs: 100, // Fast mock time
        modelUsed: "mock-sam2",
        inputUrls: [garmentImageUrl],
        outputUrls: [garmentImageUrl],
        metadata: { isMock: true },
        timestamp: new Date(),
      };
    }

    if (env.enableDebugLogs) {
      console.log("[Segmentation] Calling SAM2 with input:", segmentInput);
    }

    // Execute with circuit breaker and retry for resilience
    const result = (await circuitBreakers.segmentation.execute(() =>
      withRetry(
        () =>
          fal.subscribe(modelConfig.modelPath, {
            input: segmentInput,
            logs: env.enableDebugLogs,
          }),
        {
          maxRetries: env.maxRetries,
          onRetry: (attempt, error) => {
            console.warn(
              `[Segmentation] Retry attempt ${attempt}:`,
              (error as Error).message,
            );
          },
        },
      ),
    )) as any;

    const processingTimeMs = Date.now() - startTime;

    // Extract results
    const outputData = result.data || result;

    // Always log output structure for debugging
    console.log("[Segmentation] Model:", modelConfig.modelPath);
    console.log("[Segmentation] Output keys:", Object.keys(outputData));
    if (outputData.image)
      console.log(
        "[Segmentation] image.url:",
        outputData.image.url?.substring(0, 80),
      );
    if (outputData.masks)
      console.log("[Segmentation] masks count:", outputData.masks.length);
    if (outputData.combined_mask)
      console.log(
        "[Segmentation] combined_mask.url:",
        outputData.combined_mask.url?.substring(0, 80),
      );

    // SAM3 returns: { image, masks[], metadata[], scores[], boxes[] }
    // SAM2 returns: { image, combined_mask, masks[] }
    let segmentedImageUrl: string;
    let maskUrl: string;

    if (outputData.image?.url) {
      segmentedImageUrl = outputData.image.url;
      maskUrl = outputData.image.url;
      console.log("[Segmentation] ✅ Using image.url (mask applied)");
    } else if (outputData.masks && outputData.masks.length > 0) {
      const firstMask = outputData.masks[0];
      maskUrl = firstMask.url || firstMask;
      segmentedImageUrl = maskUrl;
      console.log("[Segmentation] ✅ Using masks[0]");
    } else if (outputData.combined_mask?.url) {
      maskUrl = outputData.combined_mask.url;
      segmentedImageUrl = maskUrl;
      console.log("[Segmentation] ✅ Using combined_mask");
    } else {
      console.error(
        "[Segmentation] ❌ Full response:",
        JSON.stringify(outputData).substring(0, 500),
      );
      throw new Error("No mask returned from segmentation model");
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
    console.error("[Segmentation] Error:", error);

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown segmentation error",
      processingTimeMs,
      modelUsed: modelConfig.id,
      inputUrls: [input.inputs.garmentImageUrl || ""],
      outputUrls: [],
      metadata: {},
      timestamp: new Date(),
    };
  }
}

// Alternative: Use auto-segment for full automatic segmentation
export async function executeAutoSegmentation(
  garmentImageUrl: string,
): Promise<StepResult<SegmentationOutput>> {
  const startTime = Date.now();
  const modelConfig = modelRegistry.getSegmentationModel("sam2-auto");

  if (!modelConfig) {
    return {
      success: false,
      error: "SAM2 auto-segment model not found",
      processingTimeMs: Date.now() - startTime,
      modelUsed: "sam2-auto",
      inputUrls: [garmentImageUrl],
      outputUrls: [],
      metadata: {},
      timestamp: new Date(),
    };
  }

  try {
    const result = (await fal.subscribe(modelConfig.modelPath, {
      input: {
        image_url: garmentImageUrl,
      },
      logs: true,
    })) as any;

    const processingTimeMs = Date.now() - startTime;
    const outputData = result.data || result;

    // Auto-segment returns combined mask
    const maskUrl = outputData.combined_mask?.url;
    if (!maskUrl) {
      throw new Error("No combined mask returned");
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
      error:
        error instanceof Error ? error.message : "Auto-segmentation failed",
      processingTimeMs: Date.now() - startTime,
      modelUsed: modelConfig.id,
      inputUrls: [garmentImageUrl],
      outputUrls: [],
      metadata: {},
      timestamp: new Date(),
    };
  }
}
