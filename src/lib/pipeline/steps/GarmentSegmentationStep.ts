/**
 * Garment Segmentation Step
 * Uses SAM3 to segment the garment from background
 *
 * Features:
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

    // For SAM3, use box_prompts to capture the entire garment
    // Box format: [x_min, y_min, x_max, y_max] array (not object!)
    const segmentInput = {
      image_url: garmentImageUrl,
      box_prompts: [
        [50, 50, 974, 974], // Large box covering most of the image
      ],
      apply_mask: true,
    };

    console.log("[Segmentation] SAM3 input:", JSON.stringify(segmentInput, null, 2));

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
        modelUsed: "mock-sam3",
        inputUrls: [garmentImageUrl],
        outputUrls: [garmentImageUrl],
        metadata: { isMock: true },
        timestamp: new Date(),
      };
    }

    if (env.enableDebugLogs) {
      console.log("[Segmentation] Calling SAM3 with input:", segmentInput);
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

    // Write result to file for debugging
    try {
      const fs = require('fs');
      const debugData = {
        timestamp: new Date().toISOString(),
        result: result,
        resultData: result.data,
        resultOutput: result.output,
        resultKeys: Object.keys(result),
        resultDataKeys: result.data ? Object.keys(result.data) : null,
      };
      fs.writeFileSync('/workspaces/vton/sam3_debug.json', JSON.stringify(debugData, null, 2));
      console.log("[Segmentation] Debug data written to sam3_debug.json");
    } catch (e) {
      console.error("[Segmentation] Failed to write debug file:", e);
    }

    // CRITICAL: Log the ENTIRE result object structure
    console.log("[Segmentation] ========================================");
    console.log("[Segmentation] RAW RESULT:");
    console.log("[Segmentation] typeof result:", typeof result);
    console.log("[Segmentation] result constructor:", result?.constructor?.name);
    
    // Try to stringify the entire result
    try {
      console.log("[Segmentation] result JSON:", JSON.stringify(result, null, 2));
    } catch (e) {
      console.log("[Segmentation] result not JSON-stringifiable:", e);
    }
    
    // Check specific paths
    console.log("[Segmentation] result.data:", result.data);
    console.log("[Segmentation] result.output:", result.output);
    console.log("[Segmentation] result itself keys:", Object.keys(result));
    
    if (result.data) {
      console.log("[Segmentation] result.data keys:", Object.keys(result.data));
      console.log("[Segmentation] result.data.image:", result.data.image);
      console.log("[Segmentation] result.data.masks:", result.data.masks);
    }
    
    console.log("[Segmentation] ========================================");
    
    // Try to extract outputData from different paths
    let outputData = result.data || result;
    
    console.log("[Segmentation] Available keys:", Object.keys(outputData));
    
    // Force-extract each property manually 
    const imageField = outputData['image'];
    const masksField = outputData['masks'];
    const metadataField = outputData['metadata'];
    const scoresField = outputData['scores'];
    const boxesField = outputData['boxes'];
    
    console.log("[Segmentation] Extracted image:", imageField);
    console.log("[Segmentation] Extracted masks:", masksField);
    console.log("[Segmentation] Extracted metadata:", metadataField);
    
    // Check types
    console.log("[Segmentation] typeof image:", typeof imageField);
    console.log("[Segmentation] typeof masks:", typeof masksField);
    
    // For masks array
    if (masksField) {
      console.log("[Segmentation] Is masks array?:", Array.isArray(masksField));
      if (Array.isArray(masksField)) {
        console.log("[Segmentation] Masks length:", masksField.length);
        if (masksField.length > 0) {
          console.log("[Segmentation] First mask:", masksField[0]);
        }
      }
    }
    
    // For image field
    if (imageField) {
      console.log("[Segmentation] Is image string?:", typeof imageField === 'string');
      console.log("[Segmentation] Is image object?:", typeof imageField === 'object');
      if (typeof imageField === 'object' && imageField !== null) {
        console.log("[Segmentation] Image has url?:", 'url' in imageField);
        console.log("[Segmentation] Image.url:", imageField.url);
      }
    }
    
    console.log("[Segmentation] ===== EXTRACTION END =====");

    // SAM3 API returns: image (optional primary mask) and masks (required array)
    // According to docs: image is "Primary segmented mask preview", masks is "Segmented mask images"
    let segmentedImageUrl: string;
    let maskUrl: string;

    // Priority 1: Use 'image' field if it has url
    if (imageField && typeof imageField === 'object' && imageField.url) {
      segmentedImageUrl = imageField.url;
      maskUrl = imageField.url;
      console.log("[Segmentation] ✓ Using image.url");
    }
    // Priority 2: Check if image is a string directly
    else if (imageField && typeof imageField === 'string') {
      segmentedImageUrl = imageField;
      maskUrl = imageField;
      console.log("[Segmentation] ✓ Using image string");
    }
    // Priority 3: Use first mask from masks array
    else if (masksField && Array.isArray(masksField) && masksField.length > 0) {
      const firstMask = masksField[0];
      if (typeof firstMask === 'object' && firstMask.url) {
        maskUrl = firstMask.url;
        segmentedImageUrl = maskUrl;
        console.log("[Segmentation] ✓ Using masks[0].url");
      } else if (typeof firstMask === 'string') {
        maskUrl = firstMask;
        segmentedImageUrl = maskUrl;
        console.log("[Segmentation] ✓ Using masks[0] string");
      } else {
        throw new Error(`masks[0] format unexpected: ${typeof firstMask}`);
      }
    }
    else {
      // Create detailed error with all extraction info
      const debugInfo = {
        availableKeys: Object.keys(outputData),
        imageFieldType: typeof imageField,
        imageFieldValue: imageField,
        masksFieldType: typeof masksField,
        masksFieldValue: masksField,
        masksIsArray: Array.isArray(masksField),
        masksLength: Array.isArray(masksField) ? masksField.length : 'N/A',
        firstMaskIfExists: Array.isArray(masksField) && masksField.length > 0 ? masksField[0] : 'N/A',
      };
      
      console.error("[Segmentation] No mask found in output. Debug info:", JSON.stringify(debugInfo, null, 2));
      console.error("[Segmentation] Full output:", outputData);
      
      throw new Error(
        `No mask returned from SAM3.\n` +
        `Available keys: ${Object.keys(outputData).join(', ')}\n` +
        `image type: ${typeof imageField}, value: ${JSON.stringify(imageField)}\n` +
        `masks type: ${typeof masksField}, is array: ${Array.isArray(masksField)}, ` +
        `length: ${Array.isArray(masksField) ? masksField.length : 'N/A'}\n` +
        `First mask: ${Array.isArray(masksField) && masksField.length > 0 ? JSON.stringify(masksField[0]) : 'N/A'}`
      );
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
        box_prompts: segmentInput.box_prompts,
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
  const modelConfig = modelRegistry.getSegmentationModel("sam3-image");

  if (!modelConfig) {
    return {
      success: false,
      error: "SAM3 model not found",
      processingTimeMs: Date.now() - startTime,
      modelUsed: "sam3-image",
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
