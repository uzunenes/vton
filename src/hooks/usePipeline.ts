/**
 * usePipeline Hook
 * React hook for managing pipeline state and execution
 *
 * Fixed: deep-clone state on every publish to prevent shallow-copy mutation bugs.
 * Fixed: running state tracked via ref so approve() always sees latest.
 * Fixed: `state` removed from start() deps to prevent mid-run invalidation.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  PipelineState,
  PipelineStatus,
  PipelineInputs,
  ApprovalDecision,
  StepResult,
  StepStatus,
  PipelineStepState,
  VTONOutput,
  VideoOutput,
} from "@/types/pipeline";
import {
  PipelineOrchestrator,
  PipelineConfig,
  createPipeline,
  PIPELINE_STEPS,
  StepDefinition,
} from "@/lib/pipeline/PipelineOrchestrator";
import {
  createSessionLogger,
  SessionLogger,
} from "@/lib/logging/SessionLogger";
import {
  createOutputManager,
  OutputManager,
} from "@/lib/logging/OutputManager";
import { fal } from "@/lib/fal";

// ─────────────────────────────────────────────
//  Deep-clone helpers – the single source of
//  truth for producing an immutable snapshot
// ─────────────────────────────────────────────

function cloneStep(s: PipelineStepState): PipelineStepState {
  return {
    ...s,
    result: s.result ? { ...s.result } : undefined,
    startedAt: s.startedAt ? new Date(s.startedAt.getTime()) : undefined,
    completedAt: s.completedAt ? new Date(s.completedAt.getTime()) : undefined,
    approvedAt: s.approvedAt ? new Date(s.approvedAt.getTime()) : undefined,
    rejectedAt: s.rejectedAt ? new Date(s.rejectedAt.getTime()) : undefined,
  };
}

function cloneState(s: PipelineState): PipelineState {
  return {
    ...s,
    steps: s.steps.map(cloneStep),
    startedAt: new Date(s.startedAt.getTime()),
    completedAt: s.completedAt ? new Date(s.completedAt.getTime()) : undefined,
    inputs: { ...s.inputs },
  };
}

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
//  Helper: get active steps from config
// ─────────────────────────────────────────────

function getActiveSteps(pipelineConfig: PipelineConfig): StepDefinition[] {
  return PIPELINE_STEPS.filter((step) => {
    if (step.id === "segmentation" && !pipelineConfig.enableSegmentation)
      return false;
    if (step.id === "face-restoration") return false;
    if (step.id === "video-generation" && !pipelineConfig.enableVideo)
      return false;
    return true;
  });
}

// ─────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────

export function usePipeline(
  options: UsePipelineOptions = {},
): UsePipelineReturn {
  const { config, onStepComplete, onPipelineComplete, onError } = options;

  // ── React state (immutable snapshots) ──
  const [state, setState] = useState<PipelineState | null>(null);
  const [currentResult, setCurrentResult] = useState<StepResult | null>(null);
  const [vtonResults, setVtonResults] = useState<VTONOutput | null>(null);
  const [videoResult, setVideoResult] = useState<VideoOutput | null>(null);

  // ── Mutable refs that survive across renders ──
  const orchestratorRef = useRef<PipelineOrchestrator | null>(null);
  const loggerRef = useRef<SessionLogger | null>(null);
  const outputManagerRef = useRef<OutputManager | null>(null);

  // The *mutable* running state.  We mutate this freely inside start/approve,
  // then call publishState() to push an immutable deep-clone into React state.
  const runStateRef = useRef<PipelineState | null>(null);

  // Previous results accumulated across steps (survives approve boundaries)
  const previousResultsRef = useRef<Record<string, StepResult | undefined>>({});

  // Pipeline config resolved once at start, stored in ref for approve()
  const pipelineConfigRef = useRef<PipelineConfig | null>(null);

  // Active steps for current run
  const activeStepsRef = useRef<StepDefinition[]>([]);

  // ── Derived convenience booleans ──
  const isRunning = state?.status === "running";
  const isAwaitingApproval = state?.status === "awaiting_approval";
  const isComplete = state?.status === "completed";
  const isFailed = state?.status === "failed";

  const currentStepId =
    state &&
    state.currentStepIndex >= 0 &&
    state.currentStepIndex < state.steps.length
      ? (state.steps[state.currentStepIndex]?.stepId ?? null)
      : null;

  const progress = state
    ? Math.round(
        (state.steps.filter((s) => s.status === "completed").length /
          state.steps.length) *
          100,
      )
    : 0;

  // ── Publish: push immutable snapshot of runStateRef into React ──
  const publishState = useCallback(() => {
    const rs = runStateRef.current;
    if (rs) {
      setState(cloneState(rs));
    }
  }, []);

  // ── Upload helper ──
  const uploadImage = useCallback(
    async (blob: Blob): Promise<string> => {
      if (config?.useMock) {
        console.log("[Mock] Skipping real upload, returning local URL");
        return URL.createObjectURL(blob);
      }
      const url = await fal.storage.upload(blob);
      return url;
    },
    [config?.useMock],
  );

  // ── Execute a single step ──
  const executeStep = useCallback(
    async (
      stepId: string,
      inputs: PipelineInputs,
      previousResults: Record<string, StepResult | undefined>,
      pipelineConfig: PipelineConfig,
    ): Promise<StepResult> => {
      const logger = loggerRef.current;
      const outputManager = outputManagerRef.current;

      const stepDef = PIPELINE_STEPS.find((s) => s.id === stepId);
      if (!stepDef) {
        throw new Error(`Unknown step: ${stepId}`);
      }

      logger?.stepStarted(stepId, stepDef.name);
      const startTime = Date.now();

      try {
        let result: StepResult;

        switch (stepId) {
          case "segmentation": {
            const { executeGarmentSegmentation } =
              await import("@/lib/pipeline/steps/GarmentSegmentationStep");
            result = await executeGarmentSegmentation({
              stepId,
              inputs,
              previousResults,
              config: pipelineConfig,
            });
            break;
          }

          case "pose-detection": {
            result = {
              success:
                !!inputs.userPoseLandmarks &&
                inputs.userPoseLandmarks.length > 0,
              data: {
                landmarks: inputs.userPoseLandmarks || [],
                isValid: true,
                matchScore: 1,
                capturedImageUrl: inputs.userImageUrl || "",
              },
              processingTimeMs: Date.now() - startTime,
              modelUsed: "mediapipe",
              inputUrls: [inputs.userImageUrl || ""],
              outputUrls: [inputs.userImageUrl || ""],
              metadata: {},
              timestamp: new Date(),
            };
            break;
          }

          case "virtual-tryon": {
            const { executeVirtualTryOn } =
              await import("@/lib/pipeline/steps/VirtualTryOnStep");
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

          case "face-restoration": {
            const vtonResult = previousResults["virtual-tryon"];
            result = {
              success: true,
              data: vtonResult?.data,
              processingTimeMs: Date.now() - startTime,
              modelUsed: "passthrough",
              inputUrls: vtonResult?.outputUrls || [],
              outputUrls: vtonResult?.outputUrls || [],
              metadata: { skipped: true },
              timestamp: new Date(),
            };
            break;
          }

          case "video-generation": {
            const { executeVideoGeneration } =
              await import("@/lib/pipeline/steps/VideoGenerationStep");
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

        // Persist outputs to disk
        if (result.success && result.outputUrls?.length > 0 && outputManager) {
          for (const url of result.outputUrls) {
            try {
              const type =
                stepId === "video-generation"
                  ? ("video" as const)
                  : ("image" as const);
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
            } catch (saveErr) {
              console.warn("[Pipeline] Failed to save output:", saveErr);
            }
          }
        }

        onStepComplete?.(stepId, result);
        return result;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        logger?.stepFailed(stepId, stepDef.name, errorMsg);
        onError?.(error instanceof Error ? error : new Error(errorMsg), stepId);
        throw error;
      }
    },
    [onStepComplete, onError],
  );

  // ─────────────────────────────────────────
  //  runSteps: shared step-execution loop
  //  used by both start() and approve()
  // ─────────────────────────────────────────

  const runSteps = useCallback(
    async (fromIndex: number, inputs: PipelineInputs): Promise<void> => {
      const rs = runStateRef.current;
      const activeSteps = activeStepsRef.current;
      const pipelineConfig = pipelineConfigRef.current;
      const previousResults = previousResultsRef.current;

      if (!rs || !pipelineConfig) return;

      for (let i = fromIndex; i < activeSteps.length; i++) {
        const step = activeSteps[i];

        // Update running state
        rs.currentStepIndex = i;
        rs.status = "running";
        rs.steps[i].status = "running" as StepStatus;
        rs.steps[i].startedAt = new Date();
        rs.steps[i].attempts = (rs.steps[i].attempts || 0) + 1;
        publishState();
        setCurrentResult(null);

        try {
          const result = await executeStep(
            step.id,
            inputs,
            previousResults,
            pipelineConfig,
          );
          previousResults[step.id] = result;

          rs.steps[i].result = result;
          rs.steps[i].completedAt = new Date();

          if (!result.success) {
            rs.steps[i].status = "failed" as StepStatus;
            rs.status = "failed";
            publishState();
            return;
          }

          // Approval gate
          if (step.requiresApproval && !step.autoApprove) {
            rs.steps[i].status = "awaiting_approval" as StepStatus;
            rs.status = "awaiting_approval";
            publishState();
            setCurrentResult(result);
            // Execution pauses here. approve() will call runSteps(i+1, …)
            return;
          }

          // Auto-approved
          rs.steps[i].status = "completed" as StepStatus;
          rs.steps[i].approvedAt = new Date();
          publishState();
        } catch (_err) {
          rs.steps[i].status = "failed" as StepStatus;
          rs.status = "failed";
          publishState();
          return;
        }
      }

      // All steps completed successfully
      rs.status = "completed";
      rs.completedAt = new Date();
      publishState();

      const logger = loggerRef.current;
      if (logger && rs.completedAt) {
        const totalTime = rs.completedAt.getTime() - rs.startedAt.getTime();
        logger.pipelineCompleted(totalTime);
      }
      onPipelineComplete?.(cloneState(rs));
    },
    [executeStep, publishState, onPipelineComplete],
  );

  // ─────────────────────────────────────────
  //  start()
  // ─────────────────────────────────────────

  const start = useCallback(
    async (inputs: PipelineInputs) => {
      // Guard against double-start
      const current = runStateRef.current;
      if (
        current &&
        (current.status === "running" || current.status === "awaiting_approval")
      ) {
        console.warn("[Pipeline] Already running, ignoring start()");
        return;
      }

      // Reset result state
      setVtonResults(null);
      setVideoResult(null);
      setCurrentResult(null);

      // Create orchestrator, logger, output manager
      const orchestrator = createPipeline(config);
      orchestratorRef.current = orchestrator;

      const sessionId = orchestrator.getSessionId();
      const logger = createSessionLogger(sessionId);
      const outputManager = createOutputManager(sessionId);
      loggerRef.current = logger;
      outputManagerRef.current = outputManager;

      logger.pipelineStarted(inputs.garmentCategory);

      // Resolve pipeline config
      const pipelineConfig = {
        ...(orchestrator as unknown as { config: PipelineConfig }).config,
      } as PipelineConfig;
      pipelineConfigRef.current = pipelineConfig;

      // Build active steps
      const activeSteps = getActiveSteps(pipelineConfig);
      activeStepsRef.current = activeSteps;

      // Reset previous results
      previousResultsRef.current = {};

      // Build initial mutable state
      const runState: PipelineState = {
        sessionId,
        currentStepIndex: 0,
        steps: activeSteps.map((step) => ({
          stepId: step.id,
          status: "pending" as StepStatus,
          attempts: 0,
        })),
        startedAt: new Date(),
        status: "running",
        inputs,
      };
      runStateRef.current = runState;
      publishState();

      // Begin execution
      await runSteps(0, inputs);
    },
    [config, publishState, runSteps],
  );

  // ─────────────────────────────────────────
  //  approve()
  // ─────────────────────────────────────────

  const approve = useCallback(
    async (decision: ApprovalDecision) => {
      const rs = runStateRef.current;
      if (!rs || rs.status !== "awaiting_approval") {
        throw new Error("No step awaiting approval");
      }

      const logger = loggerRef.current;
      const idx = rs.currentStepIndex;
      const currentStep = rs.steps[idx];

      logger?.approvalEvent(
        currentStep.stepId,
        decision.approved,
        decision.selectedVariant,
      );

      if (decision.approved) {
        // Mark step completed
        rs.steps[idx].status = "completed" as StepStatus;
        rs.steps[idx].approvedAt = new Date();
        rs.steps[idx].selectedVariant = decision.selectedVariant;
        publishState();

        // Continue from next step
        await runSteps(idx + 1, rs.inputs);
      } else if (decision.regenerate) {
        // Retry the same step
        rs.steps[idx].status = "pending" as StepStatus;
        rs.steps[idx].rejectedAt = new Date();
        rs.steps[idx].feedback = decision.feedback;
        publishState();

        await runSteps(idx, rs.inputs);
      } else {
        // Rejected – stop pipeline
        rs.steps[idx].status = "rejected" as StepStatus;
        rs.steps[idx].rejectedAt = new Date();
        rs.steps[idx].feedback = decision.feedback;
        rs.status = "failed";
        publishState();
      }
    },
    [publishState, runSteps],
  );

  // ─────────────────────────────────────────
  //  retry()
  // ─────────────────────────────────────────

  const retry = useCallback(
    async (_modelId?: string) => {
      const rs = runStateRef.current;
      if (!rs) return;

      const idx = rs.currentStepIndex;
      const step = rs.steps[idx];
      if (!step) return;

      // Reset step state
      step.status = "pending" as StepStatus;
      step.result = undefined;
      step.completedAt = undefined;
      publishState();

      await runSteps(idx, rs.inputs);
    },
    [publishState, runSteps],
  );

  // ─────────────────────────────────────────
  //  cancel()
  // ─────────────────────────────────────────

  const cancel = useCallback(() => {
    const rs = runStateRef.current;
    if (rs && (rs.status === "running" || rs.status === "awaiting_approval")) {
      rs.status = "cancelled" as PipelineStatus;
      rs.completedAt = new Date();
      publishState();
    }
    loggerRef.current?.destroy();
  }, [publishState]);

  // ─────────────────────────────────────────
  //  reset()
  // ─────────────────────────────────────────

  const reset = useCallback(() => {
    runStateRef.current = null;
    previousResultsRef.current = {};
    pipelineConfigRef.current = null;
    activeStepsRef.current = [];
    orchestratorRef.current = null;

    loggerRef.current?.destroy();
    loggerRef.current = null;
    outputManagerRef.current = null;

    setState(null);
    setCurrentResult(null);
    setVtonResults(null);
    setVideoResult(null);
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
