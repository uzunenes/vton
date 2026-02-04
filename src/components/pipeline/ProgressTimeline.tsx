/**
 * Progress Timeline Component
 * Visual representation of pipeline steps and their status
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { PipelineStepState, StepStatus } from '@/types/pipeline';
import { PIPELINE_STEPS } from '@/lib/pipeline/PipelineOrchestrator';

interface ProgressTimelineProps {
  steps: PipelineStepState[];
  currentStepIndex: number;
  compact?: boolean;
}

const statusConfig: Record<StepStatus, { color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: {
    color: 'text-gray-500',
    bgColor: 'bg-gray-800',
    icon: <Clock className="w-4 h-4" />,
  },
  running: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
  },
  awaiting_approval: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    icon: <ChevronRight className="w-4 h-4" />,
  },
  approved: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    icon: <Check className="w-4 h-4" />,
  },
  rejected: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  completed: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    icon: <Check className="w-4 h-4" />,
  },
  failed: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  skipped: {
    color: 'text-gray-600',
    bgColor: 'bg-gray-900',
    icon: <span className="w-4 h-4">-</span>,
  },
};

function getStepName(stepId: string): string {
  const step = PIPELINE_STEPS.find(s => s.id === stepId);
  return step?.name || stepId;
}

function getStepDescription(stepId: string): string {
  const step = PIPELINE_STEPS.find(s => s.id === stepId);
  return step?.description || '';
}

export function ProgressTimeline({ steps, currentStepIndex, compact = false }: ProgressTimelineProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {steps.map((step, index) => {
          const config = statusConfig[step.status];
          const isCurrent = index === currentStepIndex;

          return (
            <React.Fragment key={step.stepId}>
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: isCurrent ? 1.1 : 1 }}
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                  config.bgColor,
                  config.color,
                  isCurrent && 'ring-2 ring-white/20'
                )}
              >
                {config.icon}
              </motion.div>
              {index < steps.length - 1 && (
                <div
                  className={clsx(
                    'h-0.5 w-8 transition-all',
                    step.status === 'completed' ? 'bg-green-500/40' : 'bg-gray-700'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const config = statusConfig[step.status];
        const isCurrent = index === currentStepIndex;
        const stepName = getStepName(step.stepId);
        const stepDesc = getStepDescription(step.stepId);

        return (
          <motion.div
            key={step.stepId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={clsx(
              'flex items-start gap-4 p-4 rounded-2xl transition-all',
              isCurrent && 'bg-white/5 border border-white/10',
              !isCurrent && 'opacity-60'
            )}
          >
            {/* Step indicator */}
            <div className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              config.bgColor,
              config.color
            )}>
              {config.icon}
            </div>

            {/* Step info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className={clsx(
                  'font-semibold text-sm',
                  isCurrent ? 'text-white' : 'text-gray-400'
                )}>
                  {stepName}
                </h4>
                {step.status === 'running' && (
                  <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wider">
                    Processing
                  </span>
                )}
                {step.status === 'awaiting_approval' && (
                  <span className="text-[10px] font-medium text-yellow-400 uppercase tracking-wider">
                    Awaiting Approval
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{stepDesc}</p>

              {/* Processing time */}
              {step.result?.processingTimeMs && (
                <p className="text-[10px] text-gray-600 mt-1">
                  Completed in {(step.result.processingTimeMs / 1000).toFixed(1)}s
                </p>
              )}
            </div>

            {/* Connection line */}
            {index < steps.length - 1 && (
              <div className="absolute left-[26px] top-14 w-0.5 h-8 bg-gray-800" />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// Mini progress bar for header
export function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-blue-500 to-green-500"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}
