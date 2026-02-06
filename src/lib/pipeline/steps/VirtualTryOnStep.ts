/**
 * Virtual Try-On Step
 * Uses FASHN v1.5 (primary) and FASHN v1.6 (secondary) for A/B comparison
 *
 * Features:
 * - Circuit breaker protection
 * - Automatic retry with exponential backoff
 * - Graceful degradation (fallback to secondary model)
 */

import { fal } from "@/lib/fal";
import {
  StepResult,
  VTONOutput,
  PipelineInputs,
  GarmentCategory,
} from "@/types/pipeline";
import { modelRegistry } from "@/lib/models/ModelRegistry";
import { PipelineConfig } from "../PipelineOrchestrator";
import { circuitBreakers, withRetry } from "@/lib/resilience";
import { env } from "@/lib/config/environment";

export interface VTONStepInput {
  stepId: string;
  inputs: PipelineInputs;
  previousResults: Record<string, StepResult | undefined>;
  config: PipelineConfig;
}

// Run a single VTON model with resilience (circuit breaker + retry)
async function runVTONModel(
  modelId: string,
  humanImageUrl: string,
  garmentImageUrl: string,
  category: string,
): Promise<{
  success: boolean;
  imageUrl?: string;
  error?: string;
  processingTimeMs: number;
}> {
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
    const input = modelRegistry.buildVTONInput(
      modelId,
      humanImageUrl,
      garmentImageUrl,
      category as GarmentCategory,
    );

    if (env.enableDebugLogs) {
      console.log(`[VTON] Calling ${modelId} with input:`, input);
    }

    // Execute with circuit breaker and retry for resilience
    const result = await circuitBreakers.vton.execute(() =>
      withRetry(
        () =>
          fal.subscribe(modelConfig.modelPath, {
            input,
            logs: env.enableDebugLogs,
          }),
        {
          maxRetries: env.maxRetries,
          onRetry: (attempt, error) => {
            console.warn(
              `[VTON] ${modelId} retry attempt ${attempt}:`,
              (error as Error).message,
            );
          },
        },
      ),
    );

    const processingTimeMs = Date.now() - startTime;
    const outputData = (result as Record<string, unknown>).data || result;
    const out = outputData as Record<string, unknown>;

    if (env.enableDebugLogs) {
      console.log(`[VTON] ${modelId} output keys:`, Object.keys(out));
    }

    // Extract image URL based on model output format
    // FASHN v1.6 returns: { images: [{ url: "..." }] }
    let imageUrl: string | undefined;
    const imagesField = out.images as
      | Array<Record<string, unknown> | string>
      | undefined;
    const imageField = out.image as
      | Record<string, unknown>
      | string
      | undefined;
    const outputField = out.output as Record<string, unknown> | undefined;

    // Priority 1: images array (FASHN v1.6 format)
    if (Array.isArray(imagesField) && imagesField.length > 0) {
      const first = imagesField[0];
      imageUrl = typeof first === "string" ? first : (first.url as string);
      console.log(`[VTON] ${modelId} using images[0].url`);
    }
    // Priority 2: image object
    else if (typeof imageField === "object" && imageField?.url) {
      imageUrl = imageField.url as string;
      console.log(`[VTON] ${modelId} using image.url`);
    }
    // Priority 3: image string
    else if (typeof imageField === "string") {
      imageUrl = imageField;
      console.log(`[VTON] ${modelId} using image string`);
    }
    // Priority 4: output field
    else if (outputField?.url) {
      imageUrl = outputField.url as string;
      console.log(`[VTON] ${modelId} using output.url`);
    }
    // Priority 5: direct url
    else if (typeof out.url === "string") {
      imageUrl = out.url;
      console.log(`[VTON] ${modelId} using direct url`);
    }

    if (!imageUrl) {
      console.error(`[VTON] ${modelId} no image URL found. Output:`, out);
      throw new Error(`No image URL in VTON response. Available keys: ${Object.keys(out).join(', ')}`);
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
      error: error instanceof Error ? error.message : "Unknown VTON error",
      processingTimeMs: Date.now() - startTime,
    };
  }
}

export async function executeVirtualTryOn(
  input: VTONStepInput,
): Promise<StepResult<VTONOutput>> {
  const startTime = Date.now();
  const { primary, secondary } = modelRegistry.getDefaultVTONModels();

  try {
    // Get human image URL
    const humanImageUrl = input.inputs.userImageUrl;
    if (!humanImageUrl) {
      throw new Error("No user image URL provided");
    }

    // Get garment image URL (use segmented if available)
    const garmentImageUrl = input.inputs.garmentImageUrl;

    // Check if segmentation step was run and use its output
    const segmentationResult = input.previousResults["segmentation"];
    // If segmentation was run, its output could be used for compositing
    // For now we use the original garment image directly

    if (!garmentImageUrl) {
      throw new Error("No garment image URL provided");
    }

    const category = input.inputs.garmentCategory;

    // Check for mock mode
    if (input.config.useMock) {
      console.log("[VTON] MOCK MODE: Returning mock try-on result");
      const output: VTONOutput = {
        resultImageUrl: humanImageUrl, // In mock mode, just return the human image
        modelUsed: "mock-vton",
      };

      return {
        success: true,
        data: output,
        processingTimeMs: 500,
        modelUsed: "mock-vton",
        inputUrls: [humanImageUrl, garmentImageUrl],
        outputUrls: [humanImageUrl],
        metadata: { isMock: true, category },
        timestamp: new Date(),
      };
    }

    // Check if A/B comparison is enabled
    const enableAB = input.config.enableABComparison;

    if (enableAB) {
      // Run both models in parallel
      console.log("[VTON] Running A/B comparison with FASHN v1.5 and v1.6");

      const [fashnv15Result, fashnv16Result] = await Promise.all([
        runVTONModel(primary.id, humanImageUrl, garmentImageUrl, category),
        runVTONModel(secondary.id, humanImageUrl, garmentImageUrl, category),
      ]);

      const processingTimeMs = Date.now() - startTime;

      // Check if at least one succeeded
      if (!fashnv15Result.success && !fashnv16Result.success) {
        throw new Error(
          `Both models failed: FASHN v1.5: ${fashnv15Result.error}, FASHN v1.6: ${fashnv16Result.error}`,
        );
      }

      // Build output with variants
      const output: VTONOutput = {
        resultImageUrl: fashnv15Result.imageUrl || fashnv16Result.imageUrl || "",
        modelUsed: fashnv15Result.success ? primary.id : secondary.id,
        variants: {},
      };

      if (fashnv15Result.success && fashnv15Result.imageUrl) {
        output.variants!.fashnv15 = {
          imageUrl: fashnv15Result.imageUrl,
          processingTime: fashnv15Result.processingTimeMs,
        };
      }

      if (fashnv16Result.success && fashnv16Result.imageUrl) {
        output.variants!.fashnv16 = {
          imageUrl: fashnv16Result.imageUrl,
          processingTime: fashnv16Result.processingTimeMs,
        };
      }

      const outputUrls = [fashnv15Result.imageUrl, fashnv16Result.imageUrl].filter(
        Boolean,
      ) as string[];

      return {
        success: true,
        data: output,
        processingTimeMs,
        modelUsed: "ab-comparison",
        inputUrls: [humanImageUrl, garmentImageUrl],
        outputUrls,
        metadata: {
          fashnv15Success: fashnv15Result.success,
          fashnv15Time: fashnv15Result.processingTimeMs,
          fashnv15Error: fashnv15Result.error,
          fashnv16Success: fashnv16Result.success,
          fashnv16Time: fashnv16Result.processingTimeMs,
          fashnv16Error: fashnv16Result.error,
          category,
        },
        timestamp: new Date(),
      };
    } else {
      // Run only primary model
      console.log("[VTON] Running single model:", primary.id);

      const result = await runVTONModel(
        primary.id,
        humanImageUrl,
        garmentImageUrl,
        category,
      );

      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || "VTON failed");
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
    console.error("[VTON] Error:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown VTON error",
      processingTimeMs,
      modelUsed: primary.id,
      inputUrls: [
        input.inputs.userImageUrl || "",
        input.inputs.garmentImageUrl || "",
      ],
      outputUrls: [],
      metadata: {},
      timestamp: new Date(),
    };
  }
}

// Helper to get the selected variant URL
export function getSelectedVTONUrl(
  result: StepResult<VTONOutput>,
  selectedVariant?: string,
): string | undefined {
  if (!result.success || !result.data) return undefined;

  const output = result.data;

  if (selectedVariant && output.variants) {
    if (selectedVariant === "fashnv15" && output.variants.fashnv15) {
      return output.variants.fashnv15.imageUrl;
    }
    if (selectedVariant === "fashnv16" && output.variants.fashnv16) {
      return output.variants.fashnv16.imageUrl;
    }
  }

  return output.resultImageUrl;
}
