"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import CameraView from "@/components/CameraView";
import { fal } from "@/lib/fal";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Camera, Upload, Play, Download, ChevronRight, Check, X, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { usePipeline } from "@/hooks/usePipeline";
import { PipelineWizard, PipelineStatus } from "@/components/pipeline";
import { GarmentCategory, VTONOutput, VideoOutput, ApprovalDecision } from "@/types/pipeline";

fal.config({
  proxyUrl: "/api/fal/proxy",
});

type VtonCategory = "tops" | "bottoms" | "one-piece" | "accessory";

// Pipeline configuration
const PIPELINE_CONFIG = {
  enableSegmentation: true,
  enableABComparison: true,
  enableFaceRestoration: false, // Keep disabled for now
  enableVideo: true,
  videoDuration: 5,
  outputDirectory: 'outputs',
};

export default function VtonPage() {
  // Core state
  const [garmentImage, setGarmentImage] = useState<Blob | null>(null);
  const [garmentImageUrl, setGarmentImageUrl] = useState<string | null>(null);
  const [userImageUrl, setUserImageUrl] = useState<string | null>(null);
  const [isStudioActive, setIsStudioActive] = useState(false);
  const [vtonCategory, setVtonCategory] = useState<VtonCategory>("tops");
  const [garmentLandmarks, setGarmentLandmarks] = useState<any>(null);
  
  // User metadata for dynamic prompts
  const [userAge, setUserAge] = useState<number>(30);
  const [userGender, setUserGender] = useState<'male' | 'female' | 'other'>('male');
  const [userCountry, setUserCountry] = useState<string>('Turkey');
  
  // Interactive segmentation hints (SAM3 points)
  const [segmentationPrompts, setSegmentationPrompts] = useState<{ x: number; y: number; label: number }[]>([]);
  
  const garmentCanvasRef = useRef<HTMLCanvasElement>(null);

  // Pipeline state
  const [showPipelineView, setShowPipelineView] = useState(false);
  const [selectedVTONVariant, setSelectedVTONVariant] = useState<string | undefined>();

  // Use the pipeline hook
  const pipeline = usePipeline({
    config: PIPELINE_CONFIG,
    onStepComplete: (stepId, result) => {
      console.log(`[Pipeline] Step ${stepId} completed:`, result);
    },
    onPipelineComplete: (state) => {
      console.log('[Pipeline] Complete:', state);
    },
    onError: (error, stepId) => {
      console.error(`[Pipeline] Error in ${stepId}:`, error);
    },
  });

  // Result display state
  const resultImage = pipeline.vtonResults?.resultImageUrl ||
    (pipeline.vtonResults?.variants?.fashn?.imageUrl) ||
    (pipeline.vtonResults?.variants?.leffa?.imageUrl) ||
    null;
  const resultVideo = pipeline.videoResult?.videoUrl || null;

  // Handle garment upload
  const handleGarmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setGarmentImage(file);

      // Upload to fal storage immediately
      try {
        const url = await pipeline.uploadImage(file);
        setGarmentImageUrl(url);
        console.log('[Garment] Uploaded:', url);
      } catch (error) {
        console.error('[Garment] Upload failed:', error);
      }
    }
  };

  // Handle camera capture
  const handleCapture = async (blob: Blob, autoStart: boolean = false) => {
    try {
      // Upload user image to fal storage
      const url = await pipeline.uploadImage(blob);
      setUserImageUrl(url);
      console.log('[User] Captured and uploaded:', url);

      // Auto-start pipeline if ready
      if (autoStart && garmentImageUrl) {
        startPipeline(url);
      }
    } catch (error) {
      console.error('[User] Upload failed:', error);
    }
  };

  // Start the pipeline
  const startPipeline = useCallback(async (userImgUrl?: string) => {
    const finalUserUrl = userImgUrl || userImageUrl;
    if (!finalUserUrl || !garmentImageUrl) {
      console.error('[Pipeline] Missing images');
      return;
    }

    setShowPipelineView(true);

    await pipeline.start({
      garmentImageUrl,
      garmentCategory: vtonCategory as GarmentCategory,
      userImageUrl: finalUserUrl,
      userPoseLandmarks: garmentLandmarks,
      userAge,
      userGender,
      userCountry,
      segmentationPrompts,
    });
  }, [pipeline, garmentImageUrl, userImageUrl, vtonCategory, garmentLandmarks, userAge, userGender, userCountry, segmentationPrompts]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!garmentCanvasRef.current) return;
    const rect = garmentCanvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1024;
    const y = ((e.clientY - rect.top) / rect.height) * 1024;
    const newPrompt = { x: Math.round(x), y: Math.round(y), label: 1 };
    setSegmentationPrompts(prev => [...prev, newPrompt]);
  };

  // Handle approval decision
  const handleApproval = useCallback(async (decision: ApprovalDecision) => {
    if (decision.selectedVariant) {
      setSelectedVTONVariant(decision.selectedVariant);
    }
    await pipeline.approve(decision);
  }, [pipeline]);

  // Handle video generation (manual trigger)
  const handleGenerateVideo = useCallback(async () => {
    if (!resultImage) return;

    // If pipeline is complete, we need to generate video separately
    // For now, this is handled within the pipeline
    console.log('[Video] Manual generation requested');
  }, [resultImage]);

  // Draw garment skeleton effect
  useEffect(() => {
    if (!garmentLandmarks || !garmentCanvasRef.current || !garmentImage) return;

    const canvas = garmentCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = URL.createObjectURL(garmentImage);
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 4;
      ctx.fillStyle = "#ffffff";

      const connections = [
        [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
        [11, 23], [12, 24], [23, 24],
        [23, 25], [25, 27], [24, 26], [26, 28]
      ];

      connections.forEach(([i, j]) => {
        const p1 = garmentLandmarks[i];
        const p2 = garmentLandmarks[j];
        if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
          ctx.beginPath();
          ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
          ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
          ctx.stroke();
        }
      });

      garmentLandmarks.forEach((lm: any) => {
        if (lm.visibility > 0.5) {
          ctx.beginPath();
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 6, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      // Draw segmentation prompts
      segmentationPrompts.forEach(p => {
        ctx.fillStyle = "#22c55e"; // Green color for prompts
        ctx.beginPath();
        ctx.arc((p.x / 1024) * canvas.width, (p.y / 1024) * canvas.height, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      URL.revokeObjectURL(img.src);
    };
  }, [garmentLandmarks, garmentImage, segmentationPrompts]);

  // Get selected VTON image URL
  const getDisplayImageUrl = () => {
    if (!pipeline.vtonResults) return resultImage;

    if (selectedVTONVariant && pipeline.vtonResults.variants) {
      if (selectedVTONVariant === 'fashn' && pipeline.vtonResults.variants.fashn) {
        return pipeline.vtonResults.variants.fashn.imageUrl;
      }
      if (selectedVTONVariant === 'leffa' && pipeline.vtonResults.variants.leffa) {
        return pipeline.vtonResults.variants.leffa.imageUrl;
      }
    }
    return pipeline.vtonResults.resultImageUrl;
  };

  const displayImageUrl = getDisplayImageUrl();

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center">
      {/* Pipeline View Overlay */}
      <AnimatePresence>
        {showPipelineView && pipeline.state && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-700"
            >
              <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Virtual Try-On Pipeline
                </h2>
                <button
                  onClick={() => setShowPipelineView(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <PipelineWizard
                  state={pipeline.state}
                  currentResult={pipeline.currentResult}
                  onApprove={handleApproval}
                  onRetry={() => pipeline.retry()}
                  progress={pipeline.progress}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8" />
            Virtual Try-On Studio
          </h1>
          <p className="text-gray-400">
            SAM3 • FASHN v1.6 • Kling 3.0 Pro
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Garment Upload */}
          <div className="space-y-4">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Garment
              </h2>

              <div className="space-y-4">
                {/* Garment Category */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Garment Type</label>
                  <select
                    value={vtonCategory}
                    onChange={(e) => setVtonCategory(e.target.value as VtonCategory)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  >
                    <option value="tops">Tops / T-Shirts</option>
                    <option value="bottoms">Bottoms</option>
                    <option value="one-piece">One-Piece</option>
                    <option value="accessory">Accessory</option>
                  </select>
                </div>

                {/* Preview and Selection (Handled below) */}

                {/* Preview */}
                {garmentImage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative bg-slate-900 rounded overflow-hidden cursor-crosshair border border-slate-700"
                  >
                    <canvas 
                      ref={garmentCanvasRef} 
                      className="w-full h-auto" 
                      onClick={handleCanvasClick}
                    />
                    <div className="absolute bottom-2 left-2 bg-black/60 text-[10px] px-2 py-1 rounded text-white pointer-events-none">
                      {segmentationPrompts.length > 0 ? `${segmentationPrompts.length} points selected` : 'Click to select tshirt'}
                    </div>
                  </motion.div>
                )}

                {/* Metadata Fields */}
                <div className="pt-4 space-y-3 border-t border-slate-800">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">User Info (for AI Prompt)</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Age</label>
                      <input 
                        type="number" 
                        value={userAge} 
                        onChange={(e) => setUserAge(parseInt(e.target.value))}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-1">Gender</label>
                      <select 
                        value={userGender} 
                        onChange={(e) => setUserGender(e.target.value as any)}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Country / Scene</label>
                    <input 
                      type="text" 
                      value={userCountry} 
                      onChange={(e) => setUserCountry(e.target.value)}
                      placeholder="e.g. Turkey, playing ball"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Upload Input */}
                <div className="pt-2">
                  <input
                    type="file"
                    id="garment-upload"
                    accept="image/*"
                    onChange={handleGarmentUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="garment-upload"
                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-center cursor-pointer transition text-sm font-medium"
                  >
                    Upload Model (Manken)
                  </label>
                  {segmentationPrompts.length > 0 && (
                    <button 
                      onClick={() => setSegmentationPrompts([])}
                      className="w-full mt-2 text-[10px] text-red-400 hover:text-red-300 transition"
                    >
                      Reset Selection
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Center Panel - Camera Capture */}
          <div className="space-y-4">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-700 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Your Photo</h2>
              </div>

              <div className="aspect-video bg-slate-900">
                {isStudioActive ? (
                  <CameraView
                    onCapture={handleCapture}
                    isProcessing={pipeline.state?.status === 'running'}
                    garmentBlob={garmentImage}
                    onGarmentPoseDetected={setGarmentLandmarks}
                    onClose={() => setIsStudioActive(false)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center flex-col gap-4">
                    {userImageUrl ? (
                      <motion.img
                        src={userImageUrl}
                        alt="Captured"
                        className="w-full h-full object-cover"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      />
                    ) : (
                      <>
                        <Camera className="w-12 h-12 text-gray-500" />
                        <p className="text-gray-400">No photo captured</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-700">
                <button
                  onClick={() => setIsStudioActive(!isStudioActive)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded px-4 py-2 transition"
                >
                  {isStudioActive ? 'Close Camera' : 'Open Camera'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-4">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-700 flex items-center gap-2">
                <Download className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Result</h2>
              </div>

              <div className="aspect-video bg-slate-900">
                {displayImageUrl ? (
                  <motion.img
                    src={displayImageUrl}
                    alt="Result"
                    className="w-full h-full object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center flex-col gap-4">
                    <Sparkles className="w-12 h-12 text-gray-500" />
                    <p className="text-gray-400">Result will appear here</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-700 space-y-2">
                <button
                  onClick={() => startPipeline()}
                  disabled={!userImageUrl || !garmentImageUrl}
                  className={clsx(
                    "w-full px-4 py-2 rounded transition font-medium flex items-center justify-center gap-2",
                    userImageUrl && garmentImageUrl
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-gray-600 text-gray-400 cursor-not-allowed"
                  )}
                >
                  <Play className="w-4 h-4" />
                  Start Try-On
                </button>
                {resultVideo && (
                  <button
                    onClick={handleGenerateVideo}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 transition"
                  >
                    Generate Video
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status Section */}
        {pipeline.state && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6"
          >
            <h3 className="text-lg font-semibold mb-4">Pipeline Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Status</p>
                <p className="font-mono text-white">{pipeline.state.status}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Progress</p>
                <p className="font-mono text-white">{Math.round(pipeline.progress)}%</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Current Step</p>
                <p className="font-mono text-white">{pipeline.state.currentStepIndex + 1}/{pipeline.state.steps.length}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Elapsed Time</p>
                <p className="font-mono text-white">
                  {pipeline.state.completedAt
                    ? Math.round((pipeline.state.completedAt.getTime() - pipeline.state.startedAt.getTime()) / 1000) + 's'
                    : '-'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
