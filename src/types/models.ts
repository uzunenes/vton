/**
 * Model Configuration Types
 * Defines types and registry for all AI models used in the VTON pipeline
 */

// Base model configuration
export interface ModelConfig {
  id: string;
  provider: 'fal-ai';
  modelPath: string;
  displayName: string;
  description: string;
  costPerRun: number;
  averageTimeSeconds: number;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

// VTON model specific configuration
export interface VTONModelConfig extends ModelConfig {
  category: 'vton';
  supportedGarmentTypes: GarmentType[];
  maxResolution: Resolution;
  supportsInpaintingMask: boolean;
  parameterMapping: VTONParameterMapping;
}

export type GarmentType = 'upper_body' | 'lower_body' | 'full_body';

export interface Resolution {
  width: number;
  height: number;
}

// Parameter name mapping between our system and model API
export interface VTONParameterMapping {
  humanImage: string;
  garmentImage: string;
  category: string;
}

// Video model specific configuration
export interface VideoModelConfig extends ModelConfig {
  category: 'video';
  supportedDurations: number[];
  supportedResolutions: string[];
  supportsImageToVideo: boolean;
  supportsTextToVideo: boolean;
  parameterMapping: VideoParameterMapping;
}

export interface VideoParameterMapping {
  imageUrl: string;
  prompt: string;
  duration: string;
}

// Segmentation model specific configuration
export interface SegmentationModelConfig extends ModelConfig {
  category: 'segmentation';
  supportsAutoSegment: boolean;
  supportsPointPrompt: boolean;
  supportsBoxPrompt: boolean;
}

// All model types union
export type AnyModelConfig = VTONModelConfig | VideoModelConfig | SegmentationModelConfig;

// Category mapping for VTON models
export const CATEGORY_MAPPING: Record<string, Record<string, string>> = {
  'fashn-v1.6': {
    'tops': 'tops',
    'bottoms': 'bottoms',
    'one-piece': 'one-pieces',
    'accessory': 'auto',
  },
  'leffa': {
    'tops': 'upper_body',
    'bottoms': 'lower_body',
    'one-piece': 'dresses',
    'accessory': 'upper_body',
  },
  'idm-vton': {
    'tops': 'tops',
    'bottoms': 'bottoms',
    'one-piece': 'one-piece',
    'accessory': 'tops',
  },
};

// VTON Models Registry
export const VTON_MODELS: Record<string, VTONModelConfig> = {
  'fashn-v1.6': {
    id: 'fashn-v1.6',
    provider: 'fal-ai',
    modelPath: 'fal-ai/fashn/tryon/v1.6',
    displayName: 'FASHN v1.6',
    description: 'High precision virtual try-on, excellent for text and patterns on garments',
    costPerRun: 0.05,
    averageTimeSeconds: 15,
    category: 'vton',
    supportedGarmentTypes: ['upper_body', 'lower_body', 'full_body'],
    maxResolution: { width: 864, height: 1296 },
    supportsInpaintingMask: true,
    inputSchema: {
      model_image: 'string',
      garment_image: 'string',
      category: 'string',
      adjust_body: 'boolean',
      restore_clothes: 'boolean',
    },
    outputSchema: {
      image: { url: 'string', width: 'number', height: 'number' },
    },
    parameterMapping: {
      humanImage: 'model_image',
      garmentImage: 'garment_image',
      category: 'category',
    },
  },
  'leffa': {
    id: 'leffa',
    provider: 'fal-ai',
    modelPath: 'fal-ai/leffa/virtual-tryon',
    displayName: 'Leffa VTON',
    description: 'Commercial quality virtual try-on with inference step control',
    costPerRun: 0.04,
    averageTimeSeconds: 12,
    category: 'vton',
    supportedGarmentTypes: ['upper_body', 'lower_body', 'full_body'],
    maxResolution: { width: 1024, height: 1024 },
    supportsInpaintingMask: false,
    inputSchema: {
      human_image_url: 'string',
      garment_image_url: 'string',
      garment_type: 'string',
      num_inference_steps: 'number',
    },
    outputSchema: {
      image: { url: 'string', width: 'number', height: 'number' },
    },
    parameterMapping: {
      humanImage: 'human_image_url',
      garmentImage: 'garment_image_url',
      category: 'garment_type',
    },
  },
  'idm-vton': {
    id: 'idm-vton',
    provider: 'fal-ai',
    modelPath: 'fal-ai/idm-vton',
    displayName: 'IDM-VTON (Legacy)',
    description: 'Legacy virtual try-on model, replaced by FASHN and Leffa',
    costPerRun: 0.03,
    averageTimeSeconds: 20,
    category: 'vton',
    supportedGarmentTypes: ['upper_body', 'lower_body', 'full_body'],
    maxResolution: { width: 768, height: 1024 },
    supportsInpaintingMask: true,
    inputSchema: {
      human_image_url: 'string',
      garment_image_url: 'string',
      category: 'string',
      description: 'string',
    },
    outputSchema: {
      image: { url: 'string' },
      mask: { url: 'string' },
    },
    parameterMapping: {
      humanImage: 'human_image_url',
      garmentImage: 'garment_image_url',
      category: 'category',
    },
  },
};

// Video Models Registry
export const VIDEO_MODELS: Record<string, VideoModelConfig> = {
  'kling-2.0-master': {
    id: 'kling-2.0-master',
    provider: 'fal-ai',
    modelPath: 'fal-ai/kling-video/v2/master/image-to-video',
    displayName: 'Kling 2.0 Master',
    description: 'Premium quality fashion runway video generation',
    costPerRun: 1.0,
    averageTimeSeconds: 120,
    category: 'video',
    supportedDurations: [5, 10],
    supportedResolutions: ['720p', '1080p'],
    supportsImageToVideo: true,
    supportsTextToVideo: false,
    inputSchema: {
      image_url: 'string',
      prompt: 'string',
      duration: 'number',
      cfg_scale: 'number',
      negative_prompt: 'string',
    },
    outputSchema: {
      video: { url: 'string', duration: 'number' },
    },
    parameterMapping: {
      imageUrl: 'image_url',
      prompt: 'prompt',
      duration: 'duration',
    },
  },
  'minimax-video': {
    id: 'minimax-video',
    provider: 'fal-ai',
    modelPath: 'fal-ai/minimax/video-01-live/image-to-video',
    displayName: 'MiniMax Hailuo',
    description: 'Fast video generation with good motion',
    costPerRun: 0.5,
    averageTimeSeconds: 90,
    category: 'video',
    supportedDurations: [5],
    supportedResolutions: ['720p'],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    inputSchema: {
      image_url: 'string',
      prompt: 'string',
    },
    outputSchema: {
      video: { url: 'string' },
    },
    parameterMapping: {
      imageUrl: 'image_url',
      prompt: 'prompt',
      duration: 'duration',
    },
  },
  'grok-video': {
    id: 'grok-video',
    provider: 'fal-ai',
    modelPath: 'xai/grok-imagine-video/text-to-video',
    displayName: 'Grok Video (Legacy)',
    description: 'Legacy video generation model',
    costPerRun: 0.3,
    averageTimeSeconds: 60,
    category: 'video',
    supportedDurations: [6],
    supportedResolutions: ['720p'],
    supportsImageToVideo: true,
    supportsTextToVideo: true,
    inputSchema: {
      image_url: 'string',
      prompt: 'string',
      duration: 'number',
      aspect_ratio: 'string',
      resolution: 'string',
    },
    outputSchema: {
      video: { url: 'string' },
    },
    parameterMapping: {
      imageUrl: 'image_url',
      prompt: 'prompt',
      duration: 'duration',
    },
  },
};

// Segmentation Models Registry
export const SEGMENTATION_MODELS: Record<string, SegmentationModelConfig> = {
  'sam2-image': {
    id: 'sam2-image',
    provider: 'fal-ai',
    modelPath: 'fal-ai/sam2/image',
    displayName: 'SAM2 Image',
    description: 'Segment Anything Model 2 for precise image segmentation',
    costPerRun: 0.02,
    averageTimeSeconds: 5,
    category: 'segmentation',
    supportsAutoSegment: false,
    supportsPointPrompt: true,
    supportsBoxPrompt: true,
    inputSchema: {
      image_url: 'string',
      point_coords: 'array',
      point_labels: 'array',
      box: 'array',
    },
    outputSchema: {
      masks: 'array',
      scores: 'array',
    },
  },
  'sam2-auto': {
    id: 'sam2-auto',
    provider: 'fal-ai',
    modelPath: 'fal-ai/sam2/auto-segment',
    displayName: 'SAM2 Auto Segment',
    description: 'Automatic segmentation without prompts',
    costPerRun: 0.03,
    averageTimeSeconds: 8,
    category: 'segmentation',
    supportsAutoSegment: true,
    supportsPointPrompt: false,
    supportsBoxPrompt: false,
    inputSchema: {
      image_url: 'string',
    },
    outputSchema: {
      masks: 'array',
      combined_mask: { url: 'string' },
    },
  },
};

// Default model selections
export const DEFAULT_MODELS = {
  vton: {
    primary: 'fashn-v1.6',
    secondary: 'leffa',
  },
  video: 'kling-2.0-master',
  segmentation: 'sam2-image',
};

// Helper function to get model by ID
export function getVTONModel(id: string): VTONModelConfig | undefined {
  return VTON_MODELS[id];
}

export function getVideoModel(id: string): VideoModelConfig | undefined {
  return VIDEO_MODELS[id];
}

export function getSegmentationModel(id: string): SegmentationModelConfig | undefined {
  return SEGMENTATION_MODELS[id];
}

// Map internal category to model-specific category
export function mapCategory(modelId: string, internalCategory: string): string {
  const mapping = CATEGORY_MAPPING[modelId];
  if (mapping && mapping[internalCategory]) {
    return mapping[internalCategory];
  }
  // Default mapping
  switch (internalCategory) {
    case 'tops': return 'upper_body';
    case 'bottoms': return 'lower_body';
    case 'one-piece': return 'full_body';
    default: return internalCategory;
  }
}
