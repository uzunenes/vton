/**
 * Video Generation Step
 * Uses Kling 2.0 Master for fashion runway video generation
 *
 * Features:
 * - Circuit breaker protection
 * - Automatic retry with exponential backoff
 * - Longer timeout for video generation (120s)
 */

import { fal } from "../fal";
import {
  StepResult,
  VideoOutput,
  PipelineInputs,
  VTONOutput,
} from "../../types/pipeline";
import { modelRegistry } from "../models/ModelRegistry";
import { PipelineConfig } from "../PipelineOrchestrator";
import { getSelectedVTONUrl } from "./VirtualTryOnStep";
import { circuitBreakers, withRetry } from "../resilience";
import { env } from "../../utils/environment";

export interface VideoStepInput {
  stepId: string;
  inputs: PipelineInputs;
  previousResults: Record<string, StepResult | undefined>;
  config: PipelineConfig;
  selectedVTONVariant?: string;
}

export async function executeVideoGeneration(
  input: VideoStepInput,
): Promise<StepResult<VideoOutput>> {
  const startTime = Date.now();
  const modelConfig = modelRegistry.getDefaultVideoModel();

  try {
    // Get the VTON result image
    const vtonResult = input.previousResults["virtual-tryon"] as
      | StepResult<VTONOutput>
      | undefined;

    let sourceImageUrl: string | undefined;

    if (vtonResult?.success && vtonResult.data) {
      // Use selected variant or default
      sourceImageUrl = getSelectedVTONUrl(
        vtonResult,
        input.selectedVTONVariant,
      );
    }

    // Fallback to face-restoration output if available
    const faceRestorationResult = input.previousResults["face-restoration"];
    if (
      faceRestorationResult?.success &&
      faceRestorationResult.outputUrls?.length > 0
    ) {
      sourceImageUrl = faceRestorationResult.outputUrls[0];
    }

    if (!sourceImageUrl) {
      throw new Error("No source image available for video generation");
    }

    // Build the prompt
    const prompt = modelRegistry.getFashionVideoPrompt(
      `The model is wearing a ${input.inputs.garmentCategory} garment. Showcase the clothing with elegant movement.`,
    );

    // Build video input
    const videoInput = modelRegistry.buildVideoInput(
      modelConfig.id,
      sourceImageUrl,
      prompt,
      input.config.videoDuration,
    );

    // Check for mock mode
    if (input.config.useMock) {
      console.log("[Video] MOCK MODE: Returning mock video result");
      const output: VideoOutput = {
        videoUrl:
          "https://storage.googleapis.com/falserverless/model_tests/kling/test_video.mp4", // A public test video
        duration: input.config.videoDuration,
        resolution: "720p",
        thumbnailUrl: sourceImageUrl,
      };

      return {
        success: true,
        data: output,
        processingTimeMs: 1000,
        modelUsed: "mock-kling",
        inputUrls: [sourceImageUrl],
        outputUrls: [output.videoUrl],
        metadata: { isMock: true },
        timestamp: new Date(),
      };
    }

    if (env.enableDebugLogs) {
      console.log("[Video] Calling Kling 2.0 with input:", {
        model: modelConfig.modelPath,
        duration: input.config.videoDuration,
        prompt: prompt.substring(0, 100) + "...",
      });
    }

    // Execute with circuit breaker and retry for resilience
    // Video generation has fewer retries due to high cost ($1/run)
    const result = (await circuitBreakers.video.execute(() =>
      withRetry(
        () =>
          fal.subscribe(modelConfig.modelPath, {
            input: videoInput,
            logs: env.enableDebugLogs,
          }),
        {
          maxRetries: 1, // Only 1 retry for video due to cost
          baseDelayMs: 2000, // Longer base delay
          onRetry: (attempt, error) => {
            console.warn(
              `[Video] Retry attempt ${attempt}:`,
              (error as Error).message,
            );
          },
        },
      ),
    )) as any;

    const processingTimeMs = Date.now() - startTime;
    const outputData = result.data || result;

    // Extract video URL
    let videoUrl: string | undefined;
    if (outputData.video?.url) {
      videoUrl = outputData.video.url;
    } else if (outputData.output?.url) {
      videoUrl = outputData.output.url;
    } else if (outputData.url) {
      videoUrl = outputData.url;
    } else if (typeof outputData.video === "string") {
      videoUrl = outputData.video;
    } else if (
      Array.isArray(outputData.videos) &&
      outputData.videos.length > 0
    ) {
      videoUrl = outputData.videos[0].url || outputData.videos[0];
    }

    if (!videoUrl) {
      throw new Error("No video URL in response");
    }

    const output: VideoOutput = {
      videoUrl,
      duration: input.config.videoDuration,
      resolution: "720p",
      thumbnailUrl: sourceImageUrl, // Use source image as thumbnail
    };

    return {
      success: true,
      data: output,
      processingTimeMs,
      modelUsed: modelConfig.id,
      inputUrls: [sourceImageUrl],
      outputUrls: [videoUrl],
      metadata: {
        modelPath: modelConfig.modelPath,
        duration: input.config.videoDuration,
        prompt,
        cfgScale: videoInput.cfg_scale,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    console.error("[Video] Error:", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown video generation error",
      processingTimeMs,
      modelUsed: modelConfig.id,
      inputUrls: [],
      outputUrls: [],
      metadata: {},
      timestamp: new Date(),
    };
  }
}

// Generate video with custom prompt
export async function executeVideoWithCustomPrompt(
  sourceImageUrl: string,
  customPrompt: string,
  duration: number = 5,
): Promise<StepResult<VideoOutput>> {
  const startTime = Date.now();
  const modelConfig = modelRegistry.getDefaultVideoModel();

  try {
    const videoInput = modelRegistry.buildVideoInput(
      modelConfig.id,
      sourceImageUrl,
      customPrompt,
      duration,
    );

    const result = (await fal.subscribe(modelConfig.modelPath, {
      input: videoInput,
      logs: true,
    })) as any;

    const processingTimeMs = Date.now() - startTime;
    const outputData = result.data || result;

    const videoUrl = outputData.video?.url || outputData.output?.url;
    if (!videoUrl) {
      throw new Error("No video URL in response");
    }

    return {
      success: true,
      data: {
        videoUrl,
        duration,
        resolution: "720p",
        thumbnailUrl: sourceImageUrl,
      },
      processingTimeMs,
      modelUsed: modelConfig.id,
      inputUrls: [sourceImageUrl],
      outputUrls: [videoUrl],
      metadata: {
        customPrompt: true,
        prompt: customPrompt,
        duration,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Video generation failed",
      processingTimeMs: Date.now() - startTime,
      modelUsed: modelConfig.id,
      inputUrls: [sourceImageUrl],
      outputUrls: [],
      metadata: {},
      timestamp: new Date(),
    };
  }
}
