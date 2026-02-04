/**
 * usePipeline Hook
 * React hook for managing pipeline state and execution
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  PipelineState,
  PipelineStatus,
  PipelineInputs,
  ApprovalDecision,
  StepResult,
  GarmentCategory,
  VTONOutput,
  VideoOutput,
  SegmentationOutput,
} from '@/types/pipeline';
import {
  PipelineOrchestrator,
  PipelineConfig,
  createPipeline,
  PIPELINE_STEPS,
} from '@/lib/pipeline/PipelineOrchestrator';
import { createSessionLogger, SessionLogger } from '@/lib/logging/SessionLogger';
import { createOutputManager, OutputManager } from '@/lib/logging/OutputManager';
import { fal } from '@/lib/fal';
import { modelRegistry } from '@/lib/models/ModelRegistry';
import { mapCategory } from '@/types/models';

export interface UsePipelineOptions {
  config?: Partial<PipelineConfig>;
  onStepComplete?: (stepId: string, result: StepResult) => void;
  onPipelineComplete?: (state: PipelineState) => void;
  onError?: (error: Error, stepId?: string) => void;
}

export interface UsePipelineReturn {
  // State
  state: PipelineState | null;
  isRunning: boolean;
  isAwaitingApproval: boolean;
  isComplete: boolean;
  isFailed: boolean;
  currentStepId: string | null;
  progress: number;

  // Current step results
  currentResult: StepResult | null;
  vtonResults: VTONOutput | null;
  videoResult: VideoOutput | null;

  // Actions
  start: (inputs: PipelineInputs) => Promise<void>;
  approve: (decision: ApprovalDecision) => Promise<void>;
  retry: (modelId?: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;

  // Utilities
  uploadImage: (blob: Blob) => Promise<string>;
  logger: SessionLogger | null;
  outputManager: OutputManager | null;
}

export function usePipeline(options: UsePipelineOptions = {}): UsePipelineReturn {
  const { config, onStepComplete, onPipelineComplete, onError } = options;

  // State
  const [state, setState] = useState<PipelineState | null>(null);
  const [currentResult, setCurrentResult] = useState<StepResult | null>(null);
  const [vtonResults, setVtonResults] = useState<VTONOutput | null>(null);
  const [videoResult, setVideoResult] = useState<VideoOutput | null>(null);

  // Refs for orchestrator and utilities
  const orchestratorRef = useRef<PipelineOrchestrator | null>(null);
  const loggerRef = useRef<SessionLogger | null>(null);
  const outputManagerRef = useRef<OutputManager | null>(null);

  // Derived state
  const isRunning = state?.status === 'running';
  const isAwaitingApproval = state?.status === 'awaiting_approval';
  const isComplete = state?.status === 'completed';
  const isFailed = state?.status === 'failed';
  const currentStepId = state?.currentStepIndex !== undefined && state.currentStepIndex >= 0
    ? state.steps[state.currentStepIndex]?.stepId || null
    : null;
  const progress = state ? Math.round((state.steps.filter(s => s.status === 'completed').length / state.steps.length) * 100) : 0;

  // Upload image to fal storage
  const uploadImage = useCallback(async (blob: Blob): Promise<string> => {
    const url = await fal.storage.upload(blob);
    return url;
  }, []);

  // Execute a single step
  const executeStep = useCallback(async (
    stepId: string,
    inputs: PipelineInputs,
    previousResults: Record<string, StepResult | undefined>,
    pipelineConfig: PipelineConfig
  ): Promise<StepResult> => {
    const logger = loggerRef.current;
    const outputManager = outputManagerRef.current;

    const stepDef = PIPELINE_STEPS.find(s => s.id === stepId);
    if (!stepDef) {
      throw new Error(`Unknown step: ${stepId}`);
    }

    logger?.stepStarted(stepId, stepDef.name);
    const startTime = Date.now();

    try {
      let result: StepResult;

      switch (stepId) {
        case 'segmentation': {
          // Import and execute segmentation
          const { executeGarmentSegmentation } = await import('@/lib/pipeline/steps/GarmentSegmentationStep');
          result = await executeGarmentSegmentation({
            stepId,
            inputs,
            previousResults,
            config: pipelineConfig,
          });
          break;
        }

        case 'pose-detection': {
          // Pose detection is handled by MediaPipe in CameraView
          // This step just validates that we have pose data
          result = {
            success: !!inputs.userPoseLandmarks && inputs.userPoseLandmarks.length > 0,
            data: {
              landmarks: inputs.userPoseLandmarks || [],
              isValid: true,
              matchScore: 1,
              capturedImageUrl: inputs.userImageUrl || '',
            },
            processingTimeMs: Date.now() - startTime,
            modelUsed: 'mediapipe',
            inputUrls: [inputs.userImageUrl || ''],
            outputUrls: [inputs.userImageUrl || ''],
            metadata: {},
            timestamp: new Date(),
          };
          break;
        }

        case 'virtual-tryon': {
          const { executeVirtualTryOn } = await import('@/lib/pipeline/steps/VirtualTryOnStep');
          result = await executeVirtualTryOn({
            stepId,
            inputs,
            previousResults,
            config: pipelineConfig,
          });

          if (result.success && result.data) {
            setVtonResults(result.data as VTONOutput);
          }
          break;
        }

        case 'face-restoration': {
          // Face restoration is optional - pass through the VTON result
          const vtonResult = previousResults['virtual-tryon'];
          result = {
            success: true,
            data: vtonResult?.data,
            processingTimeMs: Date.now() - startTime,
            modelUsed: 'passthrough',
            inputUrls: vtonResult?.outputUrls || [],
            outputUrls: vtonResult?.outputUrls || [],
            metadata: { skipped: !pipelineConfig.enableFaceRestoration },
            timestamp: new Date(),
          };
          break;
        }

        case 'video-generation': {
          const { executeVideoGeneration } = await import('@/lib/pipeline/steps/VideoGenerationStep');
          result = await executeVideoGeneration({
            stepId,
            inputs,
            previousResults,
            config: pipelineConfig,
          });

          if (result.success && result.data) {
            setVideoResult(result.data as VideoOutput);
          }
          break;
        }

        default:
          throw new Error(`No executor for step: ${stepId}`);
      }

      logger?.stepCompleted(stepId, stepDef.name, result.processingTimeMs);

      // Save outputs
      if (result.success && result.outputUrls?.length > 0 && outputManager) {
        for (const url of result.outputUrls) {
          const type = stepId === 'video-generation' ? 'video' : 'image';
          await outputManager.saveOutput({
            stepId,
            url,
            type,
            modelUsed: result.modelUsed,
            metadata: {
              processingTimeMs: result.processingTimeMs,
              modelParams: result.metadata,
            },
          });
        }
      }

      onStepComplete?.(stepId, result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger?.stepFailed(stepId, stepDef.name, errorMsg);
      onError?.(error instanceof Error ? error : new Error(errorMsg), stepId);
      throw error;
    }
  }, [onStepComplete, onError]);

  // Start the pipeline
  const start = useCallback(async (inputs: PipelineInputs) => {
    // Prevent starting if already running
    if (state && (state.status === 'running' || state.status === 'awaiting_approval')) {
      console.warn('[Pipeline] Pipeline already running');
      return;
    }

    // Create new orchestrator and utilities
    const orchestrator = createPipeline(config);
    orchestratorRef.current = orchestrator;

    const sessionId = orchestrator.getSessionId();
    const logger = createSessionLogger(sessionId);
    const outputManager = createOutputManager(sessionId);

    loggerRef.current = logger;
    outputManagerRef.current = outputManager;

    logger.pipelineStarted(inputs.garmentCategory);

    // Set up event handlers
    orchestrator.on('step_started', (event) => {
      setState(orchestrator.getState());
      setCurrentResult(null);
    });

    orchestrator.on('step_completed', (event) => {
      setState(orchestrator.getState());
      if (event.data) {
        setCurrentResult(event.data as StepResult);
      }
    });

    orchestrator.on('awaiting_approval', (event) => {
      setState(orchestrator.getState());
      if (event.data) {
        setCurrentResult(event.data as StepResult);
      }
    });

    orchestrator.on('pipeline_completed', () => {
      const finalState = orchestrator.getState();
      setState(finalState);
      const totalTime = finalState.completedAt
        ? finalState.completedAt.getTime() - finalState.startedAt.getTime()
        : 0;
      logger.pipelineCompleted(totalTime);
      onPipelineComplete?.(finalState);
    });

    orchestrator.on('pipeline_failed', (event) => {
      setState(orchestrator.getState());
      const errorMsg = event.data instanceof Error ? event.data.message : 'Pipeline failed';
      logger.pipelineFailed(errorMsg);
    });

    // Register step executors
    const pipelineConfig = { ...orchestrator['config'] } as PipelineConfig;
    const previousResults: Record<string, StepResult | undefined> = {};

    // Custom start that executes steps one by one
    orchestrator.setInputs(inputs);

    const activeSteps = PIPELINE_STEPS.filter(step => {
      if (step.id === 'segmentation' && !pipelineConfig.enableSegmentation) return false;
      if (step.id === 'face-restoration' && !pipelineConfig.enableFaceRestoration) return false;
      if (step.id === 'video-generation' && !pipelineConfig.enableVideo) return false;
      return true;
    });

    // Initialize state
    const initialState: PipelineState = {
      sessionId,
      currentStepIndex: 0,
      steps: activeSteps.map(step => ({
        stepId: step.id,
        status: 'pending',
        attempts: 0,
      })),
      startedAt: new Date(),
      status: 'running',
      inputs,
    };
    setState(initialState);

    // Execute steps
    for (let i = 0; i < activeSteps.length; i++) {
      const step = activeSteps[i];
      const currentState = { ...initialState, currentStepIndex: i };
      currentState.steps[i].status = 'running';
      currentState.steps[i].startedAt = new Date();
      setState({ ...currentState });

      try {
        const result = await executeStep(step.id, inputs, previousResults, pipelineConfig);
        previousResults[step.id] = result;

        currentState.steps[i].result = result;
        currentState.steps[i].completedAt = new Date();

        if (!result.success) {
          currentState.steps[i].status = 'failed';
          currentState.status = 'failed';
          setState({ ...currentState });
          return;
        }

        // Check if approval is required
        if (step.requiresApproval && !step.autoApprove) {
          currentState.steps[i].status = 'awaiting_approval';
          currentState.status = 'awaiting_approval';
          setState({ ...currentState });
          setCurrentResult(result);

          // Wait for approval (will be handled by approve function)
          return;
        }

        currentState.steps[i].status = 'completed';
        currentState.steps[i].approvedAt = new Date();
        setState({ ...currentState });
      } catch (error) {
        currentState.steps[i].status = 'failed';
        currentState.status = 'failed';
        setState({ ...currentState });
        return;
      }
    }

    // All steps completed
    initialState.status = 'completed';
    initialState.completedAt = new Date();
    setState({ ...initialState });
  }, [config, executeStep, onPipelineComplete, state]);

  // Approve current step
  const approve = useCallback(async (decision: ApprovalDecision) => {
    if (!state || state.status !== 'awaiting_approval') {
      throw new Error('No step awaiting approval');
    }

    const logger = loggerRef.current;
    const currentStepIndex = state.currentStepIndex;
    const currentStep = state.steps[currentStepIndex];

    logger?.approvalEvent(currentStep.stepId, decision.approved, decision.selectedVariant);

    if (decision.approved) {
      // Mark current step as completed
      const newState = { ...state };
      newState.steps[currentStepIndex].status = 'completed';
      newState.steps[currentStepIndex].approvedAt = new Date();
      newState.steps[currentStepIndex].selectedVariant = decision.selectedVariant;

      // Continue with remaining steps
      const activeSteps = PIPELINE_STEPS.filter(step => {
        const pipelineConfig = orchestratorRef.current?.['config'] as PipelineConfig;
        if (step.id === 'segmentation' && !pipelineConfig?.enableSegmentation) return false;
        if (step.id === 'face-restoration' && !pipelineConfig?.enableFaceRestoration) return false;
        if (step.id === 'video-generation' && !pipelineConfig?.enableVideo) return false;
        return true;
      });

      const previousResults: Record<string, StepResult | undefined> = {};
      for (let i = 0; i <= currentStepIndex; i++) {
        previousResults[newState.steps[i].stepId] = newState.steps[i].result;
      }

      // Continue from next step
      newState.status = 'running';
      setState(newState);

      for (let i = currentStepIndex + 1; i < activeSteps.length; i++) {
        const step = activeSteps[i];
        const stepState = newState.steps[i];

        stepState.status = 'running';
        stepState.startedAt = new Date();
        newState.currentStepIndex = i;
        setState({ ...newState });

        try {
          const pipelineConfig = orchestratorRef.current?.['config'] as PipelineConfig;
          const result = await executeStep(
            step.id,
            state.inputs,
            previousResults,
            pipelineConfig
          );
          previousResults[step.id] = result;
          stepState.result = result;
          stepState.completedAt = new Date();

          if (!result.success) {
            stepState.status = 'failed';
            newState.status = 'failed';
            setState({ ...newState });
            return;
          }

          if (step.requiresApproval && !step.autoApprove) {
            stepState.status = 'awaiting_approval';
            newState.status = 'awaiting_approval';
            setState({ ...newState });
            setCurrentResult(result);
            return;
          }

          stepState.status = 'completed';
          stepState.approvedAt = new Date();
          setState({ ...newState });
        } catch (error) {
          stepState.status = 'failed';
          newState.status = 'failed';
          setState({ ...newState });
          return;
        }
      }

      // All done
      newState.status = 'completed';
      newState.completedAt = new Date();
      setState({ ...newState });
    } else if (decision.regenerate) {
      // Retry the step
      // TODO: Implement regeneration logic
    }
  }, [state, executeStep]);

  // Retry current step
  const retry = useCallback(async (modelId?: string) => {
    // TODO: Implement retry logic
  }, []);

  // Cancel pipeline
  const cancel = useCallback(() => {
    if (state) {
      setState({ ...state, status: 'cancelled' as PipelineStatus });
    }
    loggerRef.current?.destroy();
  }, [state]);

  // Reset pipeline
  const reset = useCallback(() => {
    setState(null);
    setCurrentResult(null);
    setVtonResults(null);
    setVideoResult(null);
    orchestratorRef.current = null;
    loggerRef.current?.destroy();
    loggerRef.current = null;
    outputManagerRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      loggerRef.current?.destroy();
    };
  }, []);

  return {
    state,
    isRunning,
    isAwaitingApproval,
    isComplete,
    isFailed,
    currentStepId,
    progress,
    currentResult,
    vtonResults,
    videoResult,
    start,
    approve,
    retry,
    cancel,
    reset,
    uploadImage,
    logger: loggerRef.current,
    outputManager: outputManagerRef.current,
  };
}
