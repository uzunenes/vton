/**
 * Garment Segmentation Step
 * Uses SAM2 or SAM3 to segment the garment from background
 *
 * Features:
 * - Robust URL extraction for multiple Fal.ai model formats
 * - Circuit breaker protection
 * - Automatic retry with exponential backoff
 */

import { fal } from "@/lib/fal";
import {
  StepResult,
  SegmentationOutput,
  PipelineInputs,
} from "@/types/pipeline";
import { modelRegistry } from "@/lib/models/ModelRegistry";
import { PipelineConfig } from "../PipelineOrchestrator";
import { circuitBreakers, withRetry } from "@/lib/resilience";
import { env } from "@/lib/config/environment";

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
    let segmentInput: any;
    
    // Use interactive prompts if provided, otherwise fallback to center point
    const prompts = input.inputs.segmentationPrompts && input.inputs.segmentationPrompts.length > 0
      ? input.inputs.segmentationPrompts
      : [{ x: 512, y: 512, label: 1 }];

    if (modelConfig.id === "sam3-image") {
      // SAM-3: Automatic segmentation or interactive
      segmentInput = {
        image_url: garmentImageUrl,
        prompts: prompts,
      };
      console.log("[Segmentation] Using SAM-3 with prompts:", prompts.length);
    } else if (modelConfig.id === "sam2-auto") {
      // SAM2 Auto-Segment: No prompts needed, automatic segmentation
      segmentInput = {
        image_url: garmentImageUrl,
      };
      console.log("[Segmentation] Using SAM2 auto-segment (no prompts)");
    } else if (modelConfig.id === "sam2-image") {
      // SAM2 Image: Uses point/box prompts
      segmentInput = {
        image_url: garmentImageUrl,
        point_coords: [[512, 512]], // Center point
        point_labels: [1], // Foreground
      };
      console.log("[Segmentation] Using SAM2 image with point prompts");
    } else {
      // Default fallback
      segmentInput = {
        image_url: garmentImageUrl,
      };
      console.log("[Segmentation] Using default input format");
    }

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
      console.log("[Segmentation] Calling model with input:", segmentInput);
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

    // Always log basic info, detailed info only if debug enabled
    console.log("[Segmentation] Model used:", modelConfig.modelPath);
    console.log("[Segmentation] Raw output keys:", Object.keys(outputData));
    
    if (env.enableDebugLogs) {
      console.log("[Segmentation] Full output data:", JSON.stringify(outputData, null, 2));
      console.log("[Segmentation] outputData.combined_mask:", outputData.combined_mask);
      console.log("[Segmentation] outputData.image:", outputData.image);
      console.log("[Segmentation] outputData.masks:", outputData.masks);
      console.log("[Segmentation] typeof outputData.image:", typeof outputData.image);
      if (outputData.image) {
        console.log("[Segmentation] outputData.image.url:", outputData.image.url);
      }
    }

    // Extract URLs with robust fallback logic
    let segmentedImageUrl: string | undefined;
    let maskUrl: string | undefined;

    // Priority 1: Use combined_mask (common for auto-segmentation)
    if (outputData.combined_mask) {
      if (typeof outputData.combined_mask === 'object' && outputData.combined_mask !== null && outputData.combined_mask.url) {
        maskUrl = outputData.combined_mask.url;
        segmentedImageUrl = maskUrl;
        console.log("[Segmentation] ✓ Using combined_mask.url");
      } else if (typeof outputData.combined_mask === 'string' && outputData.combined_mask.startsWith('http')) {
        maskUrl = outputData.combined_mask;
        segmentedImageUrl = maskUrl;
        console.log("[Segmentation] ✓ Using combined_mask string");
      }
    }

    // Priority 2: Use image field (SAM-3 primary output)
    if (!segmentedImageUrl && outputData.image) {
      if (typeof outputData.image === 'object' && outputData.image !== null && outputData.image.url) {
        segmentedImageUrl = outputData.image.url;
        if (!maskUrl) maskUrl = outputData.image.url;
        console.log("[Segmentation] ✓ Using image.url");
      } else if (typeof outputData.image === 'string' && outputData.image.startsWith('http')) {
        segmentedImageUrl = outputData.image;
        if (!maskUrl) maskUrl = outputData.image;
        console.log("[Segmentation] ✓ Using image string");
      }
    }

    // Priority 3: Use first mask from masks array
    if (!maskUrl && outputData.masks && Array.isArray(outputData.masks) && outputData.masks.length > 0) {
      const firstMask = outputData.masks[0];
      if (typeof firstMask === 'object' && firstMask !== null && (firstMask as any).url) {
        maskUrl = (firstMask as any).url;
        if (!segmentedImageUrl) segmentedImageUrl = (firstMask as any).url;
        console.log("[Segmentation] ✓ Using masks[0].url");
      } else if (typeof firstMask === 'string' && firstMask.startsWith('http')) {
        maskUrl = firstMask;
        if (!segmentedImageUrl) segmentedImageUrl = firstMask;
        console.log("[Segmentation] ✓ Using masks[0] string");
      }
    }

    // Priority 4: Check if outputData itself is a URL string
    if (!segmentedImageUrl && typeof outputData === 'string' && outputData.startsWith('http')) {
      maskUrl = outputData;
      segmentedImageUrl = outputData;
      console.log("[Segmentation] ✓ Using outputData as raw URL string");
    }

    // Priority 5: Check for generic url property
    if (!segmentedImageUrl && outputData.url && typeof outputData.url === 'string') {
      maskUrl = outputData.url;
      segmentedImageUrl = outputData.url;
      console.log("[Segmentation] ✓ Using outputData.url");
    }

    // Final validation
    if (!segmentedImageUrl || !maskUrl) {
      const availableKeys = Object.keys(outputData).join(', ');
      const errorDetails = {
        model: modelConfig.modelPath,
        availableKeys: availableKeys,
        imageType: typeof outputData.image,
        masksType: typeof outputData.masks,
        masksLength: Array.isArray(outputData.masks) ? outputData.masks.length : 0,
      };
      console.error("[Segmentation] ✗ Failed to extract URL. Details:", errorDetails);
      throw new Error(
        `No valid image URL found in segmentation output. ` +
        `Model: ${modelConfig.modelPath}. ` +
        `Available keys: [${availableKeys}]. ` +
        `Check console logs for detailed debugging info.`
      );
    }

    console.log("[Segmentation] ✓ Final URLs - segmented:", segmentedImageUrl, "mask:", maskUrl);

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
        availableKeys: Object.keys(outputData),
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

    const maskUrl = outputData.combined_mask?.url || outputData.image?.url || (Array.isArray(outputData.masks) && outputData.masks[0]?.url);
    if (!maskUrl) {
      throw new Error("No mask found in auto-segmentation output");
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
