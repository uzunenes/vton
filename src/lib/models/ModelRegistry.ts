/**
 * Model Registry
 * Central registry for all AI models with lookup and adapter functionality
 */

import {
  VTON_MODELS,
  VIDEO_MODELS,
  SEGMENTATION_MODELS,
  DEFAULT_MODELS,
  VTONModelConfig,
  VideoModelConfig,
  SegmentationModelConfig,
  AnyModelConfig,
  mapCategory,
  GarmentType,
} from '../../types/models';
import { GarmentCategory } from '../../types/pipeline';

export class ModelRegistry {
  private static instance: ModelRegistry;

  private constructor() {}

  static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  // Get all VTON models
  getAllVTONModels(): VTONModelConfig[] {
    return Object.values(VTON_MODELS);
  }

  // Get all video models
  getAllVideoModels(): VideoModelConfig[] {
    return Object.values(VIDEO_MODELS);
  }

  // Get all segmentation models
  getAllSegmentationModels(): SegmentationModelConfig[] {
    return Object.values(SEGMENTATION_MODELS);
  }

  // Get specific model by ID
  getVTONModel(id: string): VTONModelConfig | null {
    return VTON_MODELS[id] || null;
  }

  getVideoModel(id: string): VideoModelConfig | null {
    return VIDEO_MODELS[id] || null;
  }

  getSegmentationModel(id: string): SegmentationModelConfig | null {
    return SEGMENTATION_MODELS[id] || null;
  }

  // Get model by path (fal endpoint)
  getModelByPath(path: string): AnyModelConfig | null {
    // Check VTON models
    for (const model of Object.values(VTON_MODELS)) {
      if (model.modelPath === path) return model;
    }
    // Check video models
    for (const model of Object.values(VIDEO_MODELS)) {
      if (model.modelPath === path) return model;
    }
    // Check segmentation models
    for (const model of Object.values(SEGMENTATION_MODELS)) {
      if (model.modelPath === path) return model;
    }
    return null;
  }

  // Get default models
  getDefaultVTONModels(): { primary: VTONModelConfig; secondary: VTONModelConfig } {
    return {
      primary: VTON_MODELS[DEFAULT_MODELS.vton.primary],
      secondary: VTON_MODELS[DEFAULT_MODELS.vton.secondary],
    };
  }

  getDefaultVideoModel(): VideoModelConfig {
    return VIDEO_MODELS[DEFAULT_MODELS.video];
  }

  getDefaultSegmentationModel(): SegmentationModelConfig {
    return SEGMENTATION_MODELS[DEFAULT_MODELS.segmentation];
  }

  // Build input parameters for a VTON model
  buildVTONInput(
    modelId: string,
    humanImageUrl: string,
    garmentImageUrl: string,
    category: GarmentCategory,
    additionalParams?: Record<string, unknown>
  ): Record<string, unknown> {
    const model = this.getVTONModel(modelId);
    if (!model) {
      throw new Error(`Unknown VTON model: ${modelId}`);
    }

    const mappedCategory = mapCategory(modelId, category);
    const mapping = model.parameterMapping;

    const input: Record<string, unknown> = {
      [mapping.humanImage]: humanImageUrl,
      [mapping.garmentImage]: garmentImageUrl,
      [mapping.category]: mappedCategory,
    };

    // Add model-specific defaults
    if (modelId === 'fashn-v1.6') {
      input.adjust_body = true;
      input.restore_clothes = false;
    } else if (modelId === 'leffa') {
      input.num_inference_steps = 50;
    }

    // Merge additional params
    if (additionalParams) {
      Object.assign(input, additionalParams);
    }

    return input;
  }

  // Build input parameters for a video model
  buildVideoInput(
    modelId: string,
    imageUrl: string,
    prompt: string,
    duration: number = 5,
    additionalParams?: Record<string, unknown>
  ): Record<string, unknown> {
    const model = this.getVideoModel(modelId);
    if (!model) {
      throw new Error(`Unknown video model: ${modelId}`);
    }

    const mapping = model.parameterMapping;

    const input: Record<string, unknown> = {
      [mapping.imageUrl]: imageUrl,
      [mapping.prompt]: prompt,
    };

    // Add duration if supported
    if (model.supportedDurations.includes(duration)) {
      // Kling O3 Pro expects duration as string
      if (modelId.startsWith('kling-o3')) {
        input[mapping.duration] = String(duration);
      } else {
        input[mapping.duration] = duration;
      }
    } else {
      // Use closest supported duration
      const closest = model.supportedDurations.reduce((prev, curr) =>
        Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
      );
      if (modelId.startsWith('kling-o3')) {
        input[mapping.duration] = String(closest);
      } else {
        input[mapping.duration] = closest;
      }
    }

    // Add model-specific defaults
    if (modelId === 'kling-2.0-master') {
      input.cfg_scale = 0.7;
      input.negative_prompt = 'blur, distort, low quality, deformed';
    } else if (modelId === 'kling-o3-pro') {
      // Kling O3 Pro uses simpler parameters
      // No cfg_scale or negative_prompt needed
    }

    // Merge additional params
    if (additionalParams) {
      Object.assign(input, additionalParams);
    }

    return input;
  }

  // Build input parameters for a segmentation model
  buildSegmentationInput(
    modelId: string,
    imageUrl: string,
    pointCoords?: [number, number][],
    pointLabels?: number[],
    box?: [number, number, number, number]
  ): Record<string, unknown> {
    const model = this.getSegmentationModel(modelId);
    if (!model) {
      throw new Error(`Unknown segmentation model: ${modelId}`);
    }

    const input: Record<string, unknown> = {
      image_url: imageUrl,
    };

    if (model.supportsPointPrompt && pointCoords && pointLabels) {
      input.point_coords = pointCoords;
      input.point_labels = pointLabels;
    }

    if (model.supportsBoxPrompt && box) {
      input.box = box;
    }

    return input;
  }

  // Get estimated cost for a pipeline run
  estimatePipelineCost(options: {
    enableSegmentation: boolean;
    enableABComparison: boolean;
    enableVideo: boolean;
  }): number {
    let cost = 0;

    // Segmentation
    if (options.enableSegmentation) {
      cost += this.getDefaultSegmentationModel().costPerRun;
    }

    // VTON
    const vtonModels = this.getDefaultVTONModels();
    cost += vtonModels.primary.costPerRun;
    if (options.enableABComparison) {
      cost += vtonModels.secondary.costPerRun;
    }

    // Video
    if (options.enableVideo) {
      cost += this.getDefaultVideoModel().costPerRun;
    }

    return cost;
  }

  // Get estimated time for a pipeline run
  estimatePipelineTime(options: {
    enableSegmentation: boolean;
    enableABComparison: boolean;
    enableVideo: boolean;
  }): number {
    let time = 0;

    // Segmentation
    if (options.enableSegmentation) {
      time += this.getDefaultSegmentationModel().averageTimeSeconds;
    }

    // VTON (parallel if A/B)
    const vtonModels = this.getDefaultVTONModels();
    if (options.enableABComparison) {
      // Run in parallel, take the max
      time += Math.max(
        vtonModels.primary.averageTimeSeconds,
        vtonModels.secondary.averageTimeSeconds
      );
    } else {
      time += vtonModels.primary.averageTimeSeconds;
    }

    // Video
    if (options.enableVideo) {
      time += this.getDefaultVideoModel().averageTimeSeconds;
    }

    return time;
  }

  // Fashion runway video prompt template
  getFashionVideoPrompt(additionalContext?: string): string {
    const basePrompt = `High-end fashion runway video. Professional model walking confidently on a luxury runway.
Cinematic lighting with dramatic shadows and highlights.
Smooth camera tracking shot following the model.
4K quality, premium fashion show atmosphere.
Natural fluid motion, elegant poses.`;

    if (additionalContext) {
      return `${basePrompt}\n${additionalContext}`;
    }
    return basePrompt;
  }
}

// Export singleton instance
export const modelRegistry = ModelRegistry.getInstance();
