"use client";

import { useState, useRef, useEffect } from "react";
import CameraView from "@/components/CameraView";
// import { uploadImage } from "@/lib/gcp"; // Firebase removed
import { fal } from "@/lib/fal";
// import { blendImages } from "@/utils/canvas";
import { motion, AnimatePresence } from "framer-motion";
import MatrixRain from "@/components/MatrixRain";
import { Sparkles, Camera, Upload, Play, Download, Zap } from "lucide-react";
import clsx from "clsx";

// Ensure fal is configured
fal.config({
  proxyUrl: "/api/fal/proxy",
});

type VtonCategory = "tops" | "bottoms" | "one-piece" | "accessory";

export default function Home() {
  const [userImage, setUserImage] = useState<Blob | null>(null);
  const [garmentImage, setGarmentImage] = useState<Blob | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [debugLogs, setDebugLogs] = useState<{ time: string, msg: string }[]>([]);
  const [isStudioActive, setIsStudioActive] = useState(false);
  const [status, setStatus] = useState("");
  const [vtonCategory, setVtonCategory] = useState<VtonCategory>("tops");
  const [garmentLandmarks, setGarmentLandmarks] = useState<any>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const garmentCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleCapture = (blob: Blob, autoStart: boolean = false) => {
    setUserImage(blob);
    setResultVideo(null); // Reset video
    setStatus("Photo Captured!");

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
    // Restore server-side logging
    logStep(msg).catch(console.error);
  };

  const saveToDisk = async (url: string, type: "image" | "video") => {
    try {
      await fetch("/api/save-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type }),
      });
      addDebugLog(`DISK_SAVE: ${type} written to outputs/`);
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

      // Draw skeleton logic
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 5;
      ctx.fillStyle = "#00FF00";

      const connections = [
        [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Upper body
        [11, 23], [12, 24], [23, 24], // Torso
        [23, 25], [25, 27], [24, 26], [26, 28] // Legs
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
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 8, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
      URL.revokeObjectURL(img.src);
    };
  }, [garmentLandmarks, garmentImage]);

  // Helper for logging to backend file
  const logStep = async (message: string, data?: any) => {
    console.log(`[Client Log] ${message}`, data || "");
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

  // Separate function for video generation
  const generateVideo = async () => {
    if (!resultImage) return;

    setStatus("Awakening the photo (Living Lookbook)...");
    setIsProcessing(true);
    await logStep("Starting SVD Video Generation manually", { source_image: resultImage });

    try {
      // Using MiniMax for high-quality video generation as per documentation
      const videoResult: any = await fal.subscribe("fal-ai/minimax-video/image-to-video", {
        input: {
          image_url: resultImage,
          prompt: "A fashion model posing for a photoshoot, breathing naturally, confident look, high quality, photorealistic, cinematic lighting, slow motion, detailed texture"
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_QUEUE") {
            setStatus(`Video Queue (MiniMax): Position ${update.queue_position}`);
            logStep("Video Queue Update", update);
          } else {
            logStep("Video Status Update", update);
          }
        }
      });

      await logStep("MiniMax Video Result received", videoResult);

      const videoOutput = videoResult.data || videoResult;

      // Robust check for various Fal API response formats (MiniMax vs SVD vs General)
      const videoUrl = videoOutput.video?.url || videoOutput.video || videoOutput.url;

      if (videoUrl && typeof videoUrl === 'string') {
        setResultVideo(videoUrl);
        setStatus("Living Lookbook Ready");
        await logStep("Process Completed Successfully - Video Ready", { videoUrl });
      } else {
        setStatus("Video generation completed but no URL found.");
        await logStep("Warning: No video URL found in result object", videoResult);
      }
    } catch (videoError: any) {
      console.error("Video generation failed:", videoError);
      setStatus("Video animation failed, but photo is ready.");
      await logStep("Video generation failed", { error: videoError.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateGrokVideo = async (overrideImage?: string, accessoryUrl?: string) => {
    const imgToUse = overrideImage || resultImage;
    if (!imgToUse) return;

    setStatus("Grok is imagining your video...");
    setIsProcessing(true);

    // EXTREME IDENTITY PRESERVATION PROMPT
    let grokPrompt = `An ultra-realistic 4k fashion runway video of THE EXACT SAME PERSON shown in the provided image. 
    The person's face, body, and appearance must be preserved 100% accurately. 
    The person is walking on a professional high-end runway. 
    DO NOT generate a generic model. DO NOT change the gender or facial features. 
    Cinematic lighting, high-end fashion film aesthetics, fluid motion, 8k textures.`;

    if (accessoryUrl) {
      grokPrompt += ` The person is now wearing the specific accessoryseen in this reference: ${accessoryUrl}. Integrate it realistically on their head/body.`;
    } else {
      grokPrompt += ` The person is wearing exactly the outfit shown in the image.`;
    }

    addDebugLog(`GROK_INIT: Triggering runway simulation`);
    addDebugLog(`PROMPT_SYNC: ${grokPrompt.substring(0, 60)}...`);

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
        addDebugLog("GROK_SUCCESS: Fashion film ready");
        setStatus("Instant Runway Ready");
        setIsStudioActive(false);
        saveToDisk(videoUrl, "video");
      }
    } catch (error: any) {
      addDebugLog(`GROK_ERROR: ${error.message}`);
      console.error("Grok Video failed:", error);
    } finally {
      setIsProcessing(false);
      addDebugLog("PROCESS_END: Sequence complete");
    }
  };

  const processVTON = async (forceUserImage?: Blob, forceGarmentImage?: Blob) => {
    const uImg = forceUserImage || userImage;
    const gImg = forceGarmentImage || garmentImage;

    if (!uImg || !gImg) return;

    setIsProcessing(true);
    setDebugLogs([]);
    addDebugLog("SYSTEM_INIT: VTON sequence started");
    setStatus("Initiating upload...");

    try {
      // 1. Upload images to Fal.ai Storage
      addDebugLog("UPLOADS: Syncing User & Garment to Cloud");
      const [userImageUrl, garmentImageUrl] = await Promise.all([
        fal.storage.upload(uImg),
        fal.storage.upload(gImg)
      ]);
      addDebugLog("UPLOADS: Sync successful");

      // 2. Call Fal.ai (IDM-VTON) or Direct Grok
      if (vtonCategory === "accessory") {
        addDebugLog("ACCESSORY_MODE: Bypassing clothing model, using direct synthesis");
        // For accessories, we pass the original capture and let Grok handle the blending
        setResultImage(userImageUrl); // Preview the original but with hat instruction in Grok
        await generateGrokVideo(userImageUrl, garmentImageUrl);
      } else {
        const vtonInput = {
          human_image_url: userImageUrl,
          garment_image_url: garmentImageUrl,
          category: vtonCategory === "tops" ? "tops" : vtonCategory === "bottoms" ? "bottoms" : "one-piece",
          description: `${vtonCategory === "tops" ? "A premium top" : vtonCategory === "bottoms" ? "Stylish trousers/bottoms" : "A high-end one-piece outfit"}, realistic fabric texture, perfect fit, highly detailed fashion garment`
        };

        addDebugLog(`VTON_SUBMIT: Calling idm-vton [${vtonInput.category}]`);
        const result: any = await fal.subscribe("fal-ai/idm-vton", {
          input: vtonInput,
          logs: true,
        });

        const output = result.data || result;

        if (output && output.image && output.image.url) {
          addDebugLog("VTON_SUCCESS: Transformation image ready");
          setResultImage(output.image.url);
          saveToDisk(output.image.url, "image");
          await generateGrokVideo(output.image.url);
        } else {
          throw new Error("No image URL returned from IDM-VTON");
        }
      }
    } catch (error: any) {
      addDebugLog(`ERROR: ${error.message}`);
      setStatus("Error: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-8 flex flex-col items-center relative overflow-hidden">
      {/* Global Processing State: Matrix Rain */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-hidden flex flex-col items-center justify-center p-6"
          >
            <MatrixRain />
            <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px]" />

            <div className="relative z-10 w-full max-w-2xl">
              <div className="flex justify-between items-end mb-4 font-mono">
                <div className="text-matrix-color text-sm animate-pulse flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  CORE_UPLINK_STATUS: ACTIVE
                </div>
                <div className="text-6xl font-black text-white tracking-tighter">
                  {processingTime}<span className="text-matrix-color text-2xl">s</span>
                </div>
              </div>

              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mb-12">
                <motion.div
                  className="h-full bg-matrix-color"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 45, ease: "linear" }}
                />
              </div>

              {/* Real-time Debug HUD */}
              <div className="glass-dark border border-white/10 rounded-2xl p-6 font-mono text-[10px] space-y-2 max-h-[200px] overflow-hidden shadow-2xl relative">
                <div className="absolute top-2 right-4 text-[8px] text-matrix-color/50">DEBUG_CONSOLE_V2</div>
                {debugLogs.map((log, idx) => (
                  <motion.div
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    key={idx}
                    className="flex gap-4"
                  >
                    <span className="text-matrix-color/40">[{log.time}]</span>
                    <span className={idx === debugLogs.length - 1 ? "text-matrix-color" : "text-gray-400"}>
                      {log.msg}
                    </span>
                  </motion.div>
                ))}
                <div className="animate-pulse text-matrix-color pt-2">{">"} WAITING_FOR_UPLINK_RESPONSE_</div>
              </div>

              {/* Preview while video is generating */}
              <AnimatePresence>
                {resultImage && !resultVideo && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mt-8 flex flex-col items-center"
                  >
                    <div className="text-[9px] text-gray-500 uppercase tracking-[0.4em] mb-4">Initial Synthesis Complete</div>
                    <div className="w-32 h-44 rounded-xl border border-matrix-color/30 overflow-hidden shadow-[0_0_30px_rgba(0,255,170,0.2)] relative group">
                      <img src={resultImage} alt="VTON Result" className="w-full h-full object-cover grayscale brightness-125" />
                      <div className="absolute inset-0 bg-matrix-color/10 mix-blend-overlay" />
                      <div className="absolute bottom-0 left-0 right-0 bg-matrix-color/20 py-1 text-[8px] text-center text-white font-mono">FRAME_BUFFER_01</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="mt-8 text-center text-gray-500 font-mono text-[9px] uppercase tracking-[0.5em]">
                {status}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center mb-12 z-10 gap-4">
        <div className="flex flex-col">
          <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent italic px-1">
            VTON
          </h1>
        </div>
        <div className="flex items-center gap-6 text-[10px] font-mono text-gray-500">
          <span className="bg-white/5 py-1 px-3 rounded-full border border-white/10 uppercase tracking-widest">
            Ready
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-7xl z-10">
        {/* Left Column: Input (Lg 7/12) */}
        <div className="lg:col-span-7 space-y-8">
          <section className="glass-dark rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/50" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-400" />
                1. POSE ALIGNMENT
              </h2>
              <div className="flex gap-2">
                {["tops", "bottoms", "one-piece", "accessory"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setVtonCategory(cat as VtonCategory)}
                    className={clsx(
                      "px-3 py-1 text-[10px] font-bold rounded-full border transition-all uppercase tracking-wider",
                      vtonCategory === cat
                        ? "bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                        : "bg-white/5 border-white/10 text-gray-500 hover:text-white"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-white/5 bg-black/40 min-h-[400px] flex items-center justify-center">
              {isStudioActive ? (
                <CameraView
                  onCapture={(blob) => handleCapture(blob, true)}
                  isProcessing={isProcessing}
                  garmentBlob={garmentImage}
                  onGarmentPoseDetected={setGarmentLandmarks}
                />
              ) : (
                <div className="text-center p-8">
                  <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-6 border border-purple-500/20">
                    <Camera className="w-10 h-10 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">READY TO START?</h3>
                  <p className="text-gray-500 text-sm max-w-[280px] mx-auto mb-8 font-mono uppercase tracking-widest text-[10px]">
                    {garmentImage ? "STUDIO CALIBRATED. ACTIVATE SENSOR." : "UPLOAD A GARMENT FIRST TO ACTIVATE STUDIO."}
                  </p>
                  <button
                    onClick={() => setIsStudioActive(true)}
                    disabled={!garmentImage}
                    className="px-8 py-3 bg-white text-black font-black uppercase tracking-tighter rounded-full hover:scale-105 transition-transform disabled:opacity-20"
                  >
                    ACTIVATE STUDIO
                  </button>
                </div>
              )}

              <AnimatePresence>
                {userImage && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-4 right-4 w-28 h-40 border-2 border-white/20 rounded-xl overflow-hidden bg-black shadow-2xl glass"
                  >
                    <img src={URL.createObjectURL(userImage)} alt="Captured" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 text-[10px] text-center font-mono">LIVE_CLIP</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p className="mt-4 text-[9px] font-mono text-gray-600 flex items-center gap-2 uppercase tracking-widest">
              <Sparkles className="w-3 h-3 text-white/20" />
              Pose alignment sensor active
            </p>
          </section>

          <section className="glass-dark rounded-3xl p-6 relative group border-l-4 border-l-pink-500/50">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5 text-pink-400" />
              2. GARMENT SELECTION
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-dashed border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center bg-white/2 hover:bg-white/5 transition-all cursor-pointer relative min-h-[200px]">
                <input type="file" onChange={handleGarmentUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                {garmentImage ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img src={URL.createObjectURL(garmentImage)} alt="Garment" className="max-h-[180px] object-contain rounded-lg" />
                    <canvas
                      ref={garmentCanvasRef}
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-60"
                    />
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                    <span className="text-sm text-gray-400 font-medium">Drop mannequin photo</span>
                    <p className="text-[10px] text-gray-600 mt-1 uppercase font-mono">JPG, PNG up to 10MB</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-end space-y-4">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-[12px] font-mono text-gray-400 mb-2">INTELLIGENT PARSING</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-gray-600">POSE_MATCH:</span>
                      <span className={garmentLandmarks ? "text-green-500" : "text-red-500"}>
                        {garmentLandmarks ? "DETECTED" : "PENDING"}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: garmentLandmarks ? "100%" : "0%" }}
                        className="h-full bg-purple-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => processVTON()}
                  disabled={!userImage || !garmentImage || isProcessing}
                  className="group relative w-full py-4 bg-white text-black font-black uppercase tracking-tighter rounded-2xl flex items-center justify-center gap-3 hover:bg-white transition-all overflow-hidden disabled:opacity-30"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-600 opacity-0 group-hover:opacity-10 transition-opacity" />
                  <Zap className="w-5 h-5 fill-black" />
                  {isProcessing ? "INITIALIZING..." : "GENERATE OUTFIT"}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Result (Lg 5/12) */}
        <div className="lg:col-span-5">
          <div className="sticky top-8 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                3. AI OUTPUT
              </h2>
              <span className="text-[10px] font-mono text-gray-500 px-2 py-1 bg-white/5 rounded border border-white/10 italic">
                RUNWAY_SIMULATION
              </span>
            </div>

            <div className="w-full aspect-[3/4] glass-dark rounded-[2.5rem] border border-white/10 flex items-center justify-center relative overflow-hidden group shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
              {resultVideo ? (
                <div className="relative w-full h-full">
                  <video
                    src={resultVideo}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                  <div className="absolute bottom-8 left-0 right-0 px-8 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest">Grok Imagine</span>
                      <span className="text-lg font-bold">LIVING_LOOK_READY</span>
                    </div>
                    <a
                      href={resultVideo}
                      download="lookbook-grok.mp4"
                      target="_blank"
                      className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              ) : resultImage ? (
                <div className="relative w-full h-full">
                  <img src={resultImage} alt="Result" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <canvas ref={resultCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none mix-blend-overlay" />

                  {/* Animate Button Overlay */}
                  {!isProcessing && (
                    <div className="absolute bottom-8 left-0 right-0 px-8 flex flex-col gap-3">
                      <button
                        onClick={() => generateGrokVideo()}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black py-4 px-8 rounded-2xl shadow-2xl flex items-center justify-center gap-3 transform hover:-translate-y-1 transition-all border border-white/20"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        ACTIVATE GROK RUNWAY
                      </button>
                      <p className="text-[9px] text-center font-mono text-gray-400 uppercase tracking-widest">
                        Instant video generation for premium brands
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center text-center p-12">
                  <div className="w-20 h-20 rounded-full border border-white/5 flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin" />
                    <Sparkles className="w-8 h-8 text-gray-700" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-400">READY FOR SIMULATION</h3>
                  <p className="text-xs text-gray-600 mt-2 max-w-[200px] font-mono leading-relaxed">
                    Upload a garment and match the pose to see the AI runway magic.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-purple-300 uppercase italic">Zara Next-Gen Integration</p>
                <p className="text-[10px] text-purple-200/50 mt-1 leading-normal">
                  Targeting instant try-on for luxury retail. Direct API bridge to Grok Imagine Video for high-fidelity fabric motion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
