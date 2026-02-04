/**
 * Pipeline Wizard Component
 * Main container for the VTON pipeline UI
 * Handles step progression and approval flows
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { PipelineState, ApprovalDecision, StepResult } from '@/types/pipeline';
import { ProgressTimeline, ProgressBar } from './ProgressTimeline';
import { ApprovalPanel } from './ApprovalPanel';
import { PIPELINE_STEPS } from '@/lib/pipeline/PipelineOrchestrator';

interface PipelineWizardProps {
  state: PipelineState;
  currentResult: StepResult | null;
  onApprove: (decision: ApprovalDecision) => void;
  onRetry?: () => void;
  onCancel?: () => void;
  progress: number;
}

export function PipelineWizard({
  state,
  currentResult,
  onApprove,
  onRetry,
  onCancel,
  progress,
}: PipelineWizardProps) {
  const currentStep = state.currentStepIndex >= 0
    ? state.steps[state.currentStepIndex]
    : null;
  const currentStepDef = currentStep
    ? PIPELINE_STEPS.find(s => s.id === currentStep.stepId)
    : null;

  const isRunning = state.status === 'running';
  const isAwaitingApproval = state.status === 'awaiting_approval';
  const isComplete = state.status === 'completed';
  const isFailed = state.status === 'failed';

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">
            {isComplete ? 'Pipeline Complete' : isAwaitingApproval ? 'Review Required' : 'Processing'}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Step {state.currentStepIndex + 1} of {state.steps.length}
            </span>
            <span className="text-sm font-medium text-white">{progress}%</span>
          </div>
        </div>
        <ProgressBar progress={progress} />
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left sidebar - Timeline */}
        <div className="col-span-4">
          <div className="sticky top-8">
            <ProgressTimeline
              steps={state.steps}
              currentStepIndex={state.currentStepIndex}
            />

            {/* Cancel button */}
            {(isRunning || isAwaitingApproval) && onCancel && (
              <button
                onClick={onCancel}
                className="mt-6 w-full px-4 py-3 text-sm font-medium text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 transition-all"
              >
                Cancel Pipeline
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="col-span-8">
          <AnimatePresence mode="wait">
            {/* Running state */}
            {isRunning && currentStep && (
              <motion.div
                key="running"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="relative w-24 h-24 mb-8">
                  <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                  <motion.div
                    className="absolute inset-0 border-4 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-white/20" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {currentStepDef?.name || 'Processing'}
                </h3>
                <p className="text-sm text-gray-400 text-center max-w-md">
                  {currentStepDef?.description || 'Please wait while we process your request...'}
                </p>
                {currentStepDef?.estimatedTimeSeconds && (
                  <p className="text-xs text-gray-500 mt-4">
                    Estimated time: ~{currentStepDef.estimatedTimeSeconds}s
                  </p>
                )}
              </motion.div>
            )}

            {/* Awaiting approval state */}
            {isAwaitingApproval && currentStep && currentResult && (
              <ApprovalPanel
                key="approval"
                stepId={currentStep.stepId}
                stepName={currentStepDef?.name || currentStep.stepId}
                result={currentResult}
                onApprove={onApprove}
                onRegenerate={onRetry}
              />
            )}

            {/* Complete state */}
            {isComplete && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6"
                >
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">All Done!</h3>
                <p className="text-sm text-gray-400 text-center max-w-md">
                  Your virtual try-on has been completed successfully.
                  Check the output preview to see your results.
                </p>
                {state.completedAt && state.startedAt && (
                  <p className="text-xs text-gray-500 mt-4">
                    Total time: {((state.completedAt.getTime() - state.startedAt.getTime()) / 1000).toFixed(1)}s
                  </p>
                )}
              </motion.div>
            )}

            {/* Failed state */}
            {isFailed && (
              <motion.div
                key="failed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Pipeline Failed</h3>
                <p className="text-sm text-gray-400 text-center max-w-md mb-6">
                  {currentStep?.result?.error || 'An unexpected error occurred.'}
                </p>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Try Again
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Compact version for inline display
export function PipelineStatus({
  state,
  progress,
}: {
  state: PipelineState;
  progress: number;
}) {
  const isRunning = state.status === 'running';
  const isAwaitingApproval = state.status === 'awaiting_approval';
  const isComplete = state.status === 'completed';
  const isFailed = state.status === 'failed';

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white/5 rounded-xl border border-white/10">
      {/* Status icon */}
      {isRunning && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
      {isAwaitingApproval && <AlertCircle className="w-5 h-5 text-yellow-400" />}
      {isComplete && <CheckCircle2 className="w-5 h-5 text-green-500" />}
      {isFailed && <AlertCircle className="w-5 h-5 text-red-500" />}

      {/* Status text */}
      <div className="flex-1">
        <p className="text-sm font-medium text-white">
          {isRunning && 'Processing...'}
          {isAwaitingApproval && 'Review Required'}
          {isComplete && 'Complete'}
          {isFailed && 'Failed'}
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 w-8">{progress}%</span>
      </div>
    </div>
  );
}
