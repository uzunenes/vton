/**
 * Pipeline Orchestrator
 * Central controller for the VTON pipeline execution
 * Manages step execution, approval gates, and state transitions
 */

import {
  PipelineState,
  PipelineStatus,
  PipelineStepState,
  PipelineInputs,
  PipelineEvent,
  PipelineEventHandler,
  PipelineEventType,
  ApprovalDecision,
  StepStatus,
  StepResult,
  GarmentCategory,
} from "@/types/pipeline";
import {
  Session,
  SessionId,
  generateSessionId,
  formatDateForDirectory,
} from "@/types/session";
import {
  getEnvironmentConfig,
  getPipelineConfig as getEnvPipelineConfig,
} from "@/lib/config/environment";

// Step definitions
export interface StepDefinition {
  id: string;
  name: string;
  description: string;
  requiresApproval: boolean;
  canRetry: boolean;
  maxRetries: number;
  estimatedTimeSeconds: number;
  autoApprove?: boolean;
}

// Pipeline configuration
export interface PipelineConfig {
  enableSegmentation: boolean;
  enableABComparison: boolean;
  enableVideo: boolean;
  videoDuration: number;
  outputDirectory: string;
  useMock: boolean;
}

// Default pipeline configuration - now sourced from environment
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = getEnvPipelineConfig();

// Step definitions for the VTON pipeline
export const PIPELINE_STEPS: StepDefinition[] = [
  {
    id: "segmentation",
    name: "Garment Segmentation",
    description: "Remove background from garment image using SAM3",
    requiresApproval: true,
    canRetry: true,
    maxRetries: 2,
    estimatedTimeSeconds: 5,
    autoApprove: false,
  },
  {
    id: "virtual-tryon",
    name: "Virtual Try-On",
    description: "Generate try-on image using AI models",
    requiresApproval: true,
    canRetry: true,
    maxRetries: 2,
    estimatedTimeSeconds: 20,
    autoApprove: false,
  },
  {
    id: "video-generation",
    name: "Video Generation",
    description: "Generate runway video from try-on result",
    requiresApproval: true,
    canRetry: true,
    maxRetries: 1,
    estimatedTimeSeconds: 120,
    autoApprove: false,
  },
];

export class PipelineOrchestrator {
  private state: PipelineState;
  private config: PipelineConfig;
  private eventHandlers: Map<PipelineEventType, PipelineEventHandler[]>;
  private stepExecutors: Map<string, (input: unknown) => Promise<StepResult>>;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.eventHandlers = new Map();
    this.stepExecutors = new Map();
    this.state = this.createInitialState();
  }

  private createInitialState(): PipelineState {
    const activeSteps = this.getActiveSteps();

    return {
      sessionId: generateSessionId(),
      currentStepIndex: -1,
      steps: activeSteps.map((step) => ({
        stepId: step.id,
        status: "pending" as StepStatus,
        attempts: 0,
      })),
      startedAt: new Date(),
      status: "idle",
      inputs: {
        garmentCategory: "tops",
      },
    };
  }

  // Get steps that are active based on config
  private getActiveSteps(): StepDefinition[] {
    return PIPELINE_STEPS.filter((step) => {
      if (step.id === "segmentation" && !this.config.enableSegmentation)
        return false;
      if (step.id === "video-generation" && !this.config.enableVideo)
        return false;
      return true;
    });
  }

  // Register a step executor
  registerStepExecutor(
    stepId: string,
    executor: (input: unknown) => Promise<StepResult>,
  ): void {
    this.stepExecutors.set(stepId, executor);
  }

  // Subscribe to pipeline events
  on(eventType: PipelineEventType, handler: PipelineEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  // Emit an event
  private emit(type: PipelineEventType, stepId?: string, data?: unknown): void {
    const event: PipelineEvent = {
      type,
      stepId,
      data,
      timestamp: new Date(),
    };

    const handlers = this.eventHandlers.get(type) || [];
    handlers.forEach((handler) => handler(event));
  }

  // Get current state
  getState(): PipelineState {
    return { ...this.state };
  }

  // Get session ID
  getSessionId(): SessionId {
    return this.state.sessionId;
  }

  // Get current step
  getCurrentStep(): PipelineStepState | null {
    if (
      this.state.currentStepIndex < 0 ||
      this.state.currentStepIndex >= this.state.steps.length
    ) {
      return null;
    }
    return this.state.steps[this.state.currentStepIndex];
  }

  // Get step definition
  getStepDefinition(stepId: string): StepDefinition | undefined {
    return PIPELINE_STEPS.find((s) => s.id === stepId);
  }

  // Update inputs
  setInputs(inputs: Partial<PipelineInputs>): void {
    this.state.inputs = { ...this.state.inputs, ...inputs };
  }

  // Start the pipeline
  async start(inputs: PipelineInputs): Promise<void> {
    if (this.state.status === "running") {
      throw new Error("Pipeline is already running");
    }

    this.state = this.createInitialState();
    this.state.inputs = inputs;
    this.state.status = "running";
    this.state.startedAt = new Date();

    await this.executeNextStep();
  }

  // Execute the next step in the pipeline
  private async executeNextStep(): Promise<void> {
    this.state.currentStepIndex++;

    if (this.state.currentStepIndex >= this.state.steps.length) {
      // Pipeline completed
      this.state.status = "completed";
      this.state.completedAt = new Date();
      this.emit("pipeline_completed");
      return;
    }

    const stepState = this.state.steps[this.state.currentStepIndex];
    const stepDef = this.getStepDefinition(stepState.stepId);

    if (!stepDef) {
      throw new Error(`Unknown step: ${stepState.stepId}`);
    }

    // Update step state
    stepState.status = "running";
    stepState.startedAt = new Date();
    stepState.attempts++;

    this.emit("step_started", stepState.stepId);

    try {
      // Get executor for this step
      const executor = this.stepExecutors.get(stepState.stepId);
      if (!executor) {
        throw new Error(`No executor registered for step: ${stepState.stepId}`);
      }

      // Execute the step
      const result = await executor(this.buildStepInput(stepState.stepId));
      stepState.result = result;

      if (result.success) {
        stepState.completedAt = new Date();
        this.emit("step_completed", stepState.stepId, result);

        // Check if approval is required
        if (stepDef.requiresApproval && !stepDef.autoApprove) {
          stepState.status = "awaiting_approval";
          this.state.status = "awaiting_approval";
          this.emit("awaiting_approval", stepState.stepId, result);
        } else {
          // Auto-approve and continue
          stepState.status = "completed";
          stepState.approvedAt = new Date();
          await this.executeNextStep();
        }
      } else {
        throw new Error(result.error || "Step execution failed");
      }
    } catch (error) {
      stepState.status = "failed";
      stepState.completedAt = new Date();
      stepState.result = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: 0,
        modelUsed: "",
        inputUrls: [],
        outputUrls: [],
        metadata: {},
        timestamp: new Date(),
      };

      this.emit("step_failed", stepState.stepId, error);

      // Check if retry is possible
      if (stepDef.canRetry && stepState.attempts < stepDef.maxRetries) {
        // Retry the step
        this.state.currentStepIndex--;
        await this.executeNextStep();
      } else {
        // Pipeline failed
        this.state.status = "failed";
        this.emit("pipeline_failed", stepState.stepId, error);
      }
    }
  }

  // Build input for a step based on previous results
  private buildStepInput(stepId: string): unknown {
    const inputs = this.state.inputs;
    const previousResults = this.state.steps
      .filter((s) => s.status === "completed" && s.result)
      .reduce(
        (acc, s) => {
          acc[s.stepId] = s.result;
          return acc;
        },
        {} as Record<string, StepResult | undefined>,
      );

    return {
      stepId,
      inputs,
      previousResults,
      config: this.config,
    };
  }

  // Approve current step
  async approveStep(decision: ApprovalDecision): Promise<void> {
    const currentStep = this.getCurrentStep();
    if (!currentStep || currentStep.status !== "awaiting_approval") {
      throw new Error("No step awaiting approval");
    }

    if (decision.approved) {
      currentStep.status = "completed";
      currentStep.approvedAt = new Date();
      currentStep.feedback = decision.feedback;
      currentStep.selectedVariant = decision.selectedVariant;

      this.state.status = "running";
      this.emit("step_approved", currentStep.stepId, decision);

      await this.executeNextStep();
    } else if (decision.regenerate) {
      // Retry with potentially different model
      currentStep.status = "pending";
      currentStep.rejectedAt = new Date();
      currentStep.feedback = decision.feedback;

      this.state.currentStepIndex--;
      this.state.status = "running";
      this.emit("step_rejected", currentStep.stepId, decision);

      await this.executeNextStep();
    } else {
      // Rejected - go back
      currentStep.status = "rejected";
      currentStep.rejectedAt = new Date();
      currentStep.feedback = decision.feedback;

      this.emit("step_rejected", currentStep.stepId, decision);
    }
  }

  // Retry current step with optional model change
  async retryStep(newModelId?: string): Promise<void> {
    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      throw new Error("No current step to retry");
    }

    const stepDef = this.getStepDefinition(currentStep.stepId);
    if (!stepDef || !stepDef.canRetry) {
      throw new Error("Step cannot be retried");
    }

    if (currentStep.attempts >= stepDef.maxRetries) {
      throw new Error("Max retries exceeded");
    }

    currentStep.status = "pending";
    this.state.currentStepIndex--;
    this.state.status = "running";

    // Store new model preference if provided
    if (newModelId) {
      this.state.inputs = {
        ...this.state.inputs,
        // Store model preference in a way the executor can access
      };
    }

    await this.executeNextStep();
  }

  // Cancel the pipeline
  cancel(): void {
    if (
      this.state.status === "running" ||
      this.state.status === "awaiting_approval"
    ) {
      this.state.status = "cancelled";
      this.state.completedAt = new Date();

      const currentStep = this.getCurrentStep();
      if (currentStep && currentStep.status === "running") {
        currentStep.status = "failed";
      }

      this.emit("pipeline_cancelled");
    }
  }

  // Reset the pipeline
  reset(): void {
    this.state = this.createInitialState();
  }

  // Get progress percentage
  getProgress(): number {
    const completedSteps = this.state.steps.filter(
      (s) => s.status === "completed",
    ).length;
    return Math.round((completedSteps / this.state.steps.length) * 100);
  }

  // Get estimated remaining time
  getEstimatedRemainingTime(): number {
    const activeSteps = this.getActiveSteps();
    let remaining = 0;

    for (let i = this.state.currentStepIndex + 1; i < activeSteps.length; i++) {
      remaining += activeSteps[i].estimatedTimeSeconds;
    }

    // Add remaining time for current step if running
    const currentStep = this.getCurrentStep();
    if (currentStep && currentStep.status === "running") {
      const stepDef = this.getStepDefinition(currentStep.stepId);
      if (stepDef) {
        const elapsed = currentStep.startedAt
          ? (Date.now() - currentStep.startedAt.getTime()) / 1000
          : 0;
        remaining += Math.max(0, stepDef.estimatedTimeSeconds - elapsed);
      }
    }

    return remaining;
  }

  // Check if pipeline can proceed
  canProceed(): boolean {
    return (
      this.state.status === "idle" || this.state.status === "awaiting_approval"
    );
  }

  // Check if pipeline is waiting for user input
  isAwaitingApproval(): boolean {
    return this.state.status === "awaiting_approval";
  }

  // Check if pipeline is complete
  isComplete(): boolean {
    return this.state.status === "completed";
  }

  // Check if pipeline failed
  isFailed(): boolean {
    return this.state.status === "failed";
  }
}

// Factory function to create a new pipeline
export function createPipeline(
  config?: Partial<PipelineConfig>,
): PipelineOrchestrator {
  return new PipelineOrchestrator(config);
}
