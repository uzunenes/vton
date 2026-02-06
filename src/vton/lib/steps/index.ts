/**
 * Pipeline Steps Index
 * Export all step executors
 */

export {
  executeGarmentSegmentation,
  executeAutoSegmentation,
  type SegmentationStepInput,
} from './GarmentSegmentationStep';

export {
  executeVirtualTryOn,
  getSelectedVTONUrl,
  type VTONStepInput,
} from './VirtualTryOnStep';

export {
  executeVideoGeneration,
  executeVideoWithCustomPrompt,
  type VideoStepInput,
} from './VideoGenerationStep';

// Step executor type
import { StepResult } from '@/vton/../types/pipeline';
import { executeGarmentSegmentation as segmentationStep } from './GarmentSegmentationStep';
import { executeVirtualTryOn as vtonStep } from './VirtualTryOnStep';
import { executeVideoGeneration as videoStep } from './VideoGenerationStep';

export type StepExecutor<TInput = unknown, TOutput = unknown> = (
  input: TInput
) => Promise<StepResult<TOutput>>;

// Create step executors map for pipeline orchestrator
export function createStepExecutors() {
  return {
    'segmentation': segmentationStep,
    'virtual-tryon': vtonStep,
    'video-generation': videoStep,
  };
}
