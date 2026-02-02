"use client";

import { useState, useRef, useEffect } from "react";
import CameraView from "@/components/CameraView";
import { fal } from "@/lib/fal";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Camera, Upload, Play, Download, Zap, ChevronRight, X } from "lucide-react";
import clsx from "clsx";

fal.config({
  proxyUrl: "/api/fal/proxy",
});

type VtonCategory = "tops" | "bottoms" | "one-piece" | "accessory";

export default function Home() {
  const [userImage, setUserImage] = useState<Blob | null>(null);
  const [garmentImage, setGarmentImage] = useState<Blob | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>("/showcase.mp4");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [debugLogs, setDebugLogs] = useState<{ time: string, msg: string }[]>([]);
  const [isStudioActive, setIsStudioActive] = useState(false);
  const [status, setStatus] = useState("");
  const [vtonCategory, setVtonCategory] = useState<VtonCategory>("tops");
  const [garmentLandmarks, setGarmentLandmarks] = useState<any>(null);
  const garmentCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleCapture = (blob: Blob, autoStart: boolean = false) => {
    setUserImage(blob);
    setResultVideo(null);
    if (autoStart && garmentImage) {
      processVTON(blob, garmentImage);
    }
  };

  const handleGarmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setGarmentImage(e.target.files[0]);
    }
  };

  const addDebugLog = (msg: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString() + "." + now.getMilliseconds().toString().padStart(3, '0');
    setDebugLogs(prev => [...prev, { time, msg }]);
    logStep(msg).catch(console.error);
  };

  const logStep = async (message: string, data?: any) => {
    try {
      await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, data })
      });
    } catch (e) {
      console.error("Failed to send log", e);
    }
  };

  const saveToDisk = async (url: string, type: "image" | "video") => {
    try {
      await fetch("/api/save-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type }),
      });
    } catch (e) {
      console.error("Auto-save failed", e);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      interval = setInterval(() => {
        setProcessingTime(prev => prev + 1);
      }, 1000);
    } else {
      setProcessingTime(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  // Draw garment skeleton effect (Apple Pro style)
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

  const generateGrokVideo = async (overrideImage?: string, accessoryUrl?: string) => {
    const imgToUse = overrideImage || resultImage;
    if (!imgToUse) return;

    setStatus("Rendering Cinema...");
    setIsProcessing(true);

    let grokPrompt = `An ultra-realistic 4k fashion runway video of THE EXACT SAME PERSON shown in the provided image. Face and body must be preserved 100% accurately. Professional high-end runway. No generic models. No gender changes. Cinematic lighting, fluid motion.`;

    if (accessoryUrl) {
      grokPrompt += ` The person is wearing the accessory from: ${accessoryUrl}. Integrate realistically.`;
    } else {
      grokPrompt += ` The person is wearing exactly the outfit shown.`;
    }

    try {
      const result = await fal.subscribe("xai/grok-imagine-video/text-to-video", {
        input: {
          image_url: imgToUse,
          prompt: grokPrompt,
          duration: 6,
          aspect_ratio: "9:16",
          resolution: "720p"
        },
        logs: true,
      });

      const resData = result as any;
      const videoUrl = resData.data?.video?.url || resData.video?.url;

      if (videoUrl) {
        setResultVideo(videoUrl);
        saveToDisk(videoUrl, "video");
      }
    } catch (error: any) {
      console.error("Grok Video failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const processVTON = async (forceUserImage?: Blob, forceGarmentImage?: Blob) => {
    const uImg = forceUserImage || userImage;
    const gImg = forceGarmentImage || garmentImage;

    if (!uImg || !gImg) return;

    setIsProcessing(true);
    setDebugLogs([]);
    setStatus("Synchronizing...");

    try {
      const [userImageUrl, garmentImageUrl] = await Promise.all([
        fal.storage.upload(uImg),
        fal.storage.upload(gImg)
      ]);

      if (vtonCategory === "accessory") {
        setResultImage(userImageUrl);
        await generateGrokVideo(userImageUrl, garmentImageUrl);
      } else {
        const result: any = await fal.subscribe("fal-ai/idm-vton", {
          input: {
            human_image_url: userImageUrl,
            garment_image_url: garmentImageUrl,
            category: vtonCategory === "tops" ? "tops" : vtonCategory === "bottoms" ? "bottoms" : "one-piece",
            description: "A high-end fashion garment, realistic fabric texture, perfect fit"
          },
          logs: true,
        });

        const output = result.data || result;
        if (output && output.image && output.image.url) {
          setResultImage(output.image.url);
          saveToDisk(output.image.url, "image");
          await generateGrokVideo(output.image.url);
        } else {
          throw new Error("No image URL returned");
        }
      }
    } catch (error: any) {
      setStatus("Error: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center">
      {/* Enhanced Preview with mask */}
      <AnimatePresence>
        {resultImage && !resultVideo && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-12 flex flex-col items-center"
          >
            <div className="relative w-32 h-44 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              <img src={resultImage} alt="VTON Result" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-white/40" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 apple-glass flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-md text-center">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                <motion.div
                  className="absolute inset-0 border-4 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight mb-2 italic">Refining details.</h2>
              <p className="text-gray-400 font-medium text-sm tracking-wide uppercase">{status}</p>

              <div className="mt-12 text-left bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-[9px] text-gray-500 max-h-32 overflow-hidden">
                {debugLogs.slice(-4).map((log, i) => (
                  <div key={i} className="mb-1 opacity-50">[{log.time}] {log.msg}</div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Navigation */}
      <nav className="w-full max-w-6xl px-6 py-8 flex justify-between items-center z-10">
        <div className="text-2xl font-bold tracking-tighter cursor-pointer" onClick={() => window.location.reload()}>VTON</div>
        <div className="flex gap-8 text-[13px] font-medium text-gray-400">
          <span className="text-white">Studio</span>
          <span className="cursor-not-allowed opacity-30">Collection</span>
          <span className="cursor-not-allowed opacity-30">Archive</span>
        </div>
        <div className="hidden md:block">
          <div className="px-4 py-1.5 apple-surface text-[11px] font-bold tracking-widest uppercase text-white/40">
            Professional Workflow
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
            >
              Enter Studio <ChevronRight className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 px-6 py-3 apple-surface text-sm font-semibold text-gray-500">
              <Sparkles className="w-4 h-4 text-white/20" />
              Advanced Neural Synthesis
            </div>
          </div>

        </div>

        {/* Right Output Preview */}
        <div className="lg:col-span-5 relative">
          <div className="sticky top-12">
            <div className="relative aspect-[3/4] bg-[#0c0c0c] rounded-[48px] overflow-hidden border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.8)] group">
              {resultVideo ? (
                <video src={resultVideo} autoPlay loop muted playsInline className="w-full h-full object-cover" />
              ) : resultImage ? (
                <div className="relative w-full h-full">
                  <img src={resultImage} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-10 px-10">
                    <button
                      onClick={() => generateGrokVideo()}
                      className="w-full py-5 bg-white text-black font-bold rounded-2xl shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      Generate Motion
                    </button>
                  </div>
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
            <input type="file" onChange={handleGarmentUpload} className="absolute inset-0 opacity-0 z-20 cursor-pointer" />

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
          <div className="flex justify-between items-end px-2 h-[68px]"> {/* Fixed height matching Module 01 */}
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
                isProcessing={isProcessing}
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
                  disabled={!garmentImage}
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
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <span className="uppercase tracking-widest text-[10px] font-bold text-white/30">Studio Uplink Active</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <span className="uppercase tracking-widest text-[10px] font-bold text-white/30">Neural Core Ready</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
