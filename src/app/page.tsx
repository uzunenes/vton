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

export default function Home() {
  // Core state
  const [garmentImage, setGarmentImage] = useState<Blob | null>(null);
  const [garmentImageUrl, setGarmentImageUrl] = useState<string | null>(null);
  const [userImageUrl, setUserImageUrl] = useState<string | null>(null);
  const [isStudioActive, setIsStudioActive] = useState(false);
  const [vtonCategory, setVtonCategory] = useState<VtonCategory>("tops");
  const [garmentLandmarks, setGarmentLandmarks] = useState<any>(null);
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
    });
  }, [pipeline, garmentImageUrl, userImageUrl, vtonCategory, garmentLandmarks]);

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
      URL.revokeObjectURL(img.src);
    };
  }, [garmentLandmarks, garmentImage]);

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
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-auto"
          >
            <button
              onClick={() => setShowPipelineView(false)}
              className="absolute top-6 right-6 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <PipelineWizard
              state={pipeline.state}
              currentResult={pipeline.currentResult}
              onApprove={handleApproval}
              onRetry={() => pipeline.retry()}
              onCancel={() => {
                pipeline.cancel();
                setShowPipelineView(false);
              }}
              progress={pipeline.progress}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing Status Bar (when pipeline is running but overlay is closed) */}
      <AnimatePresence>
        {pipeline.state && pipeline.isRunning && !showPipelineView && (
          <motion.div
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="fixed top-0 left-0 right-0 z-40 p-4"
          >
            <div className="max-w-md mx-auto">
              <button onClick={() => setShowPipelineView(true)} className="w-full">
                <PipelineStatus state={pipeline.state} progress={pipeline.progress} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Preview with mask */}
      <AnimatePresence>
        {displayImageUrl && !resultVideo && !showPipelineView && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-12 flex flex-col items-center"
          >
            <div className="relative w-32 h-44 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              <img src={displayImageUrl} alt="VTON Result" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-white/40" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Navigation */}
      <nav className="w-full max-w-6xl px-6 py-8 flex justify-between items-center z-10">
        <div className="text-2xl font-bold tracking-tighter cursor-pointer" onClick={() => {
          pipeline.reset();
          setShowPipelineView(false);
          setGarmentImage(null);
          setGarmentImageUrl(null);
          setUserImageUrl(null);
          setIsStudioActive(false);
        }}>VTON</div>
        <div className="flex gap-8 text-[13px] font-medium text-gray-400">
          <span className="text-white">Studio</span>
          <span className="cursor-not-allowed opacity-30">Collection</span>
          <span className="cursor-not-allowed opacity-30">Archive</span>
        </div>
        <div className="hidden md:block">
          <div className="px-4 py-1.5 apple-surface text-[11px] font-bold tracking-widest uppercase text-white/40">
            {PIPELINE_CONFIG.enableABComparison ? 'A/B Comparison Mode' : 'Professional Workflow'}
          </div>
        </div>
      </nav>

      {/* Hero / Hero Preview Section */}
      <div className="w-full max-w-6xl px-6 pt-12 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        <div className="lg:col-span-7 space-y-12">
          <div className="space-y-6">
            <h1 className="text-7xl md:text-8xl font-bold tracking-tight leading-[0.9] text-white">
              Motion <br />
              <span className="text-gray-600">is the standard.</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-md font-medium leading-relaxed">
              Experience clothing in its natural element. Cinematic runway simulation powered by high-fidelity neural synthesis.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setIsStudioActive(true)}
              className="apple-button flex items-center gap-2"
              disabled={!garmentImage}
            >
              Enter Studio <ChevronRight className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 px-6 py-3 apple-surface text-sm font-semibold text-gray-500">
              <Sparkles className="w-4 h-4 text-white/20" />
              FASHN + Leffa A/B
            </div>
          </div>

          {/* Model Info */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <p className="text-gray-500 mb-1">VTON Models</p>
              <p className="text-white font-medium">FASHN v1.6 + Leffa</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <p className="text-gray-500 mb-1">Video Model</p>
              <p className="text-white font-medium">Kling 2.0 Master</p>
            </div>
          </div>
        </div>

        {/* Right Output Preview */}
        <div className="lg:col-span-5 relative">
          <div className="sticky top-12">
            <div className="relative aspect-[3/4] bg-[#0c0c0c] rounded-[48px] overflow-hidden border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.8)] group">
              {resultVideo ? (
                <video src={resultVideo} autoPlay loop muted playsInline className="w-full h-full object-cover" />
              ) : displayImageUrl ? (
                <div className="relative w-full h-full">
                  <img src={displayImageUrl} alt="Preview" className="w-full h-full object-cover" />

                  {/* A/B Comparison Selector */}
                  {pipeline.vtonResults?.variants && Object.keys(pipeline.vtonResults.variants).length > 1 && (
                    <div className="absolute top-4 left-4 right-4 flex gap-2">
                      {pipeline.vtonResults.variants.fashn && (
                        <button
                          onClick={() => setSelectedVTONVariant('fashn')}
                          className={clsx(
                            'flex-1 py-2 text-xs font-bold rounded-lg transition-all',
                            selectedVTONVariant === 'fashn' || (!selectedVTONVariant && pipeline.vtonResults.modelUsed === 'fashn-v1.6')
                              ? 'bg-white text-black'
                              : 'bg-black/50 text-white/70 hover:bg-black/70'
                          )}
                        >
                          FASHN
                        </button>
                      )}
                      {pipeline.vtonResults.variants.leffa && (
                        <button
                          onClick={() => setSelectedVTONVariant('leffa')}
                          className={clsx(
                            'flex-1 py-2 text-xs font-bold rounded-lg transition-all',
                            selectedVTONVariant === 'leffa'
                              ? 'bg-white text-black'
                              : 'bg-black/50 text-white/70 hover:bg-black/70'
                          )}
                        >
                          Leffa
                        </button>
                      )}
                    </div>
                  )}

                  {/* Generate Video Button */}
                  {!pipeline.isRunning && !resultVideo && (
                    <div className="absolute inset-x-0 bottom-10 px-10">
                      <button
                        onClick={() => setShowPipelineView(true)}
                        className="w-full py-5 bg-white text-black font-bold rounded-2xl shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        View Pipeline
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                  <div className="w-16 h-16 rounded-full border border-white/5 flex items-center justify-center mb-6">
                    <Sparkles className="w-8 h-8 text-white/5" />
                  </div>
                  <p className="text-white/20 font-bold text-[10px] tracking-[0.4em] uppercase">Output Channel Ready</p>
                </div>
              )}

              {/* Download Badge */}
              {resultVideo && (
                <a href={resultVideo} download className="absolute top-6 right-6 w-12 h-12 apple-glass text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                  <Download className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Area */}
      <div className="w-full max-w-6xl px-6 pb-40 grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Step 1: Garment Selection */}
        <div className="space-y-8 flex flex-col">
          <div className="flex justify-between items-end px-2 h-[68px]">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">Module 01</span>
              <h2 className="text-3xl font-bold tracking-tight">Garment Data</h2>
            </div>
            <div className="flex gap-1.5 pb-1">
              {["tops", "bottoms", "one-piece", "accessory"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setVtonCategory(cat as VtonCategory)}
                  className={clsx(
                    "px-4 py-1.5 text-[10px] font-bold rounded-full border transition-all uppercase tracking-tighter",
                    vtonCategory === cat ? "bg-white text-black border-white" : "text-gray-500 border-white/5 hover:border-white/20"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="relative aspect-[3/4] apple-surface flex flex-col items-center justify-center overflow-hidden cursor-pointer group hover:border-white/20 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <input type="file" accept="image/*" onChange={handleGarmentUpload} className="absolute inset-0 opacity-0 z-20 cursor-pointer" />

            {/* Pro Focus Brackets */}
            <div className="absolute inset-6 border border-white/10 pointer-events-none z-10 transition-opacity group-hover:opacity-40" />
            <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-white/40 pointer-events-none z-10" />
            <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-white/40 pointer-events-none z-10" />
            <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-white/40 pointer-events-none z-10" />
            <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-white/40 pointer-events-none z-10" />

            {garmentImage ? (
              <motion.div
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full h-full"
              >
                <img src={URL.createObjectURL(garmentImage)} alt="Garment" className="w-full h-full object-cover grayscale-[0.3] brightness-90 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                <canvas ref={garmentCanvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40 mix-blend-screen scale-[0.9]" />

                {/* Upload status indicator */}
                {garmentImageUrl && (
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] font-bold text-green-400">Uploaded</span>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="text-center z-10 space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-6 border border-white/5 backdrop-blur-xl">
                  <Upload className="w-6 h-6 text-white/20 group-hover:text-white/60 transition-colors" />
                </div>
                <p className="text-sm font-bold tracking-tight text-white/30">Import high-fidelity asset</p>
                <p className="text-[10px] text-white/10 uppercase tracking-[0.2em]">Lossless formats preferred</p>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Pose Alignment */}
        <div className="space-y-8 flex flex-col">
          <div className="flex justify-between items-end px-2 h-[68px]">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em]">Module 02</span>
              <h2 className="text-3xl font-bold tracking-tight">Pose Alignment</h2>
            </div>
          </div>

          <div className="relative aspect-[3/4] apple-surface overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
            {/* Alignment Brackets Overlay */}
            <div className="absolute inset-0 border border-white/5 pointer-events-none z-10" />
            <div className="absolute top-8 left-8 w-12 h-12 border-t border-l border-white/20 pointer-events-none z-10" />
            <div className="absolute top-8 right-8 w-12 h-12 border-t border-r border-white/20 pointer-events-none z-10" />
            <div className="absolute bottom-8 left-8 w-12 h-12 border-b border-l border-white/20 pointer-events-none z-10" />
            <div className="absolute bottom-8 right-8 w-12 h-12 border-b border-r border-white/20 pointer-events-none z-10" />

            {isStudioActive ? (
              <CameraView
                onCapture={(blob) => handleCapture(blob, true)}
                isProcessing={pipeline.isRunning}
                garmentBlob={garmentImage}
                onGarmentPoseDetected={setGarmentLandmarks}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-white/[0.02] flex items-center justify-center mb-8 border border-white/5">
                  <Camera className="w-8 h-8 text-white/10" />
                </div>
                <p className="text-gray-500 text-base font-medium mb-10 leading-relaxed max-w-[240px]">
                  Sensors calibrate based on garment geometry.
                </p>
                <button
                  onClick={() => setIsStudioActive(true)}
                  disabled={!garmentImage || !garmentImageUrl}
                  className="px-10 py-4 bg-white text-black rounded-full font-bold text-sm disabled:opacity-30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Initialize Sensor
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="w-full max-w-6xl px-6 py-20 border-t border-white/5 flex flex-col md:flex-row justify-between items-start gap-12 text-[13px] text-gray-600 font-medium">
        <div className="flex gap-10">
          <span className="text-white/80 font-bold tracking-tighter text-base">VTON</span>
          <div className="flex gap-8 items-center">
            <span className="cursor-pointer hover:text-white transition-colors">Safety</span>
            <span className="cursor-pointer hover:text-white transition-colors">Precision</span>
            <span className="cursor-pointer hover:text-white transition-colors">Legal</span>
          </div>
        </div>
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
            <div className={clsx(
              "w-1.5 h-1.5 rounded-full",
              pipeline.isRunning ? "bg-blue-500 animate-pulse" : "bg-white/20"
            )} />
            <span className="uppercase tracking-widest text-[10px] font-bold text-white/30">
              {pipeline.isRunning ? "Processing" : "Studio Uplink Active"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={clsx(
              "w-1.5 h-1.5 rounded-full",
              garmentImageUrl ? "bg-green-500" : "bg-white/20"
            )} />
            <span className="uppercase tracking-widest text-[10px] font-bold text-white/30">
              {garmentImageUrl ? "Garment Ready" : "Neural Core Ready"}
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
