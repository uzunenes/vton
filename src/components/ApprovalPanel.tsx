/**
 * Approval Panel Component
 * UI for reviewing and approving pipeline step outputs
 * Supports A/B comparison for VTON results
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, RefreshCw, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { StepResult, VTONOutput, VideoOutput, ApprovalDecision } from '../types/pipeline';

interface ApprovalPanelProps {
  stepId: string;
  stepName: string;
  result: StepResult;
  onApprove: (decision: ApprovalDecision) => void;
  onRegenerate?: () => void;
  onBack?: () => void;
  isLoading?: boolean;
}

export function ApprovalPanel({
  stepId,
  stepName,
  result,
  onApprove,
  onRegenerate,
  onBack,
  isLoading = false,
}: ApprovalPanelProps) {
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>();
  const [feedback, setFeedback] = useState('');

  const isVTONStep = stepId === 'virtual-tryon';
  const isVideoStep = stepId === 'video-generation';
  const isSegmentationStep = stepId === 'segmentation';
  const isPoseStep = stepId === 'pose-detection';
  const isFaceRestorationStep = stepId === 'face-restoration';
  
  const vtonData = isVTONStep ? (result.data as VTONOutput) : null;
  const videoData = isVideoStep ? (result.data as VideoOutput) : null;
  const hasVariants = vtonData?.variants && Object.keys(vtonData.variants).length > 1;

  // Get preview image URL based on step type
  const getPreviewImageUrl = (): string => {
    if (result.outputUrls && result.outputUrls.length > 0) {
      return result.outputUrls[0];
    }
    if (result.data && typeof result.data === 'object') {
      const data = result.data as Record<string, unknown>;
      if (data.maskedImageUrl) return data.maskedImageUrl as string;
      if (data.capturedImageUrl) return data.capturedImageUrl as string;
      if (data.imageUrl) return data.imageUrl as string;
    }
    return '';
  };

  // Get step-specific description
  const getStepDescription = (): string => {
    if (hasVariants) {
      return 'Compare results and select your preferred output';
    }
    switch (stepId) {
      case 'segmentation':
        return 'Review the garment segmentation result. The background should be removed cleanly.';
      case 'pose-detection':
        return 'Review the captured pose. Make sure you are positioned correctly.';
      case 'virtual-tryon':
        return 'Review the virtual try-on result.';
      case 'face-restoration':
        return 'Review the face restoration result.';
      case 'video-generation':
        return 'Review the generated video.';
      default:
        return 'Review the result and approve to continue';
    }
  };

  const handleApprove = () => {
    onApprove({
      approved: true,
      selectedVariant: hasVariants ? selectedVariant : undefined,
      feedback: feedback || undefined,
    });
  };

  const handleReject = () => {
    onApprove({
      approved: false,
      feedback: feedback || undefined,
    });
  };

  const handleRegenerate = () => {
    onApprove({
      approved: false,
      regenerate: true,
      feedback: feedback || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">{stepName}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {getStepDescription()}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {(result.processingTimeMs / 1000).toFixed(1)}s
        </div>
      </div>

      {/* Content */}
      {hasVariants ? (
        <ABComparisonView
          variants={vtonData!.variants!}
          selectedVariant={selectedVariant}
          onSelect={setSelectedVariant}
        />
      ) : isVideoStep && videoData ? (
        <VideoPreview videoUrl={videoData.videoUrl} />
      ) : (
        <SingleImageView imageUrl={getPreviewImageUrl()} stepId={stepId} />
      )}

      {/* Model info */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Model: {result.modelUsed}
        </span>
        {typeof result.metadata?.category === 'string' && (
          <span>Category: {result.metadata.category}</span>
        )}
      </div>

      {/* Feedback input */}
      <div className="mt-6">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Optional feedback..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-white/20"
          rows={2}
        />
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            disabled={isLoading}
            className="px-4 py-3 flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={handleRegenerate}
          disabled={isLoading}
          className="px-6 py-3 flex items-center gap-2 text-sm font-medium text-gray-400 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Regenerate
        </button>

        <button
          onClick={handleApprove}
          disabled={isLoading || (hasVariants && !selectedVariant)}
          className={clsx(
            'px-8 py-3 flex items-center gap-2 text-sm font-bold rounded-xl transition-all disabled:opacity-50',
            'bg-white text-black hover:bg-gray-200'
          )}
        >
          <Check className="w-4 h-4" />
          {hasVariants ? 'Use Selected' : 'Approve & Continue'}
        </button>
      </div>
    </motion.div>
  );
}

// A/B Comparison View
interface ABComparisonViewProps {
  variants: NonNullable<VTONOutput['variants']>;
  selectedVariant?: string;
  onSelect: (variant: string) => void;
}

function ABComparisonView({ variants, selectedVariant, onSelect }: ABComparisonViewProps) {
  const variantKeys = Object.keys(variants) as ('fashn' | 'leffa')[];

  return (
    <div className="grid grid-cols-2 gap-4">
      {variantKeys.map((key) => {
        const variant = variants[key];
        if (!variant) return null;

        const isSelected = selectedVariant === key;
        const displayName = key === 'fashn' ? 'FASHN v1.6' : 'Leffa';

        return (
          <motion.button
            key={key}
            onClick={() => onSelect(key)}
            className={clsx(
              'relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all',
              isSelected
                ? 'border-white ring-4 ring-white/20'
                : 'border-white/10 hover:border-white/30'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <img
              src={variant.imageUrl}
              alt={`${displayName} result`}
              className="w-full h-full object-cover"
            />

            {/* Overlay */}
            <div className={clsx(
              'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity',
              isSelected ? 'opacity-100' : 'opacity-0 hover:opacity-100'
            )} />

            {/* Label */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{displayName}</span>
                <span className="text-xs text-gray-400">
                  {(variant.processingTime / 1000).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Selected indicator */}
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center"
              >
                <Check className="w-5 h-5 text-black" />
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// Single image view
function SingleImageView({ imageUrl, stepId }: { imageUrl: string; stepId: string }) {
  // Adjust aspect ratio based on step type
  const aspectClass = stepId === 'pose-detection' ? 'aspect-[3/4]' : 'aspect-square';
  const maxWidthClass = stepId === 'pose-detection' ? 'max-w-md' : 'max-w-sm';
  
  if (!imageUrl) {
    return (
      <div className={`relative ${aspectClass} ${maxWidthClass} mx-auto rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center`}>
        <p className="text-gray-500 text-sm">No preview available</p>
      </div>
    );
  }
  
  return (
    <div className={`relative ${aspectClass} ${maxWidthClass} mx-auto rounded-2xl overflow-hidden border border-white/10`}>
      <img src={imageUrl} alt="Result" className="w-full h-full object-cover" />
    </div>
  );
}

// Video preview
function VideoPreview({ videoUrl }: { videoUrl: string }) {
  return (
    <div className="relative aspect-[9/16] max-w-sm mx-auto rounded-2xl overflow-hidden border border-white/10">
      <video
        src={videoUrl}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
}

// Clock icon component
function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
