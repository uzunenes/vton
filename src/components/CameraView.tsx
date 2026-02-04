"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePoseTracker } from "@/hooks/usePoseTracker";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

interface CameraViewProps {
    onCapture: (blob: Blob) => void;
    isProcessing: boolean;
    garmentBlob?: Blob | null;
    onGarmentPoseDetected?: (landmarks: any) => void;
}

export default function CameraView({ onCapture, isProcessing, garmentBlob, onGarmentPoseDetected }: CameraViewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [referenceLandmarks, setReferenceLandmarks] = useState<any>(null);

    const { poseStatus, debugInfo, detectStaticImage } = usePoseTracker(videoRef, canvasRef, {
        referenceLandmarks,
        matchThreshold: 0.50,
    });

    useEffect(() => {
        if (!garmentBlob || !detectStaticImage) {
            setReferenceLandmarks(null);
            if (onGarmentPoseDetected) onGarmentPoseDetected(null);
            return;
        }

        const analyzeImage = async () => {
            const url = URL.createObjectURL(garmentBlob);
            const img = new Image();
            img.src = url;
            img.onload = async () => {
                const landmarks = await detectStaticImage(img);
                if (landmarks) {
                    setReferenceLandmarks(landmarks);
                    if (onGarmentPoseDetected) onGarmentPoseDetected(landmarks);
                }
                URL.revokeObjectURL(url);
            };
        };

        analyzeImage();
    }, [garmentBlob, detectStaticImage, onGarmentPoseDetected]);

    useEffect(() => {
        if (referenceLandmarks && poseStatus === "READY" && !isProcessing) {
            const timeout = setTimeout(() => {
                captureSnapshot();
            }, 800);
            return () => clearTimeout(timeout);
        }
    }, [poseStatus, referenceLandmarks, isProcessing]);

    const captureSnapshot = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const ctx = tempCanvas.getContext("2d");
        if (ctx) {
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, -video.videoWidth, video.videoHeight);
            tempCanvas.toBlob((blob) => {
                if (blob) onCapture(blob);
            }, "image/jpeg", 0.95);
        }
    };

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 1280, height: 720 },
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Camera error:", err);
            }
        };
        startCamera();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div className="relative w-full h-full bg-black">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
            />

            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none opacity-40 mix-blend-screen"
            />

            {/* Premium HUD Overlay */}
            <div className="absolute inset-0 flex flex-col justify-between p-8 pointer-events-none">
                <div className="flex justify-between items-start">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="apple-glass px-5 py-2.5 rounded-2xl flex items-center gap-3 border border-white/10"
                    >
                        <div className={clsx(
                            "w-2 h-2 rounded-full",
                            poseStatus === "READY" ? "bg-green-500 shadow-[0_0_10px_#22c55e]" : "bg-white/40"
                        )} />
                        <span className="text-[12px] font-bold tracking-widest uppercase text-white/90">
                            {poseStatus === "READY" ? "Position Locked" : "Aligning Subject"}
                        </span>
                    </motion.div>

                    <div className="text-[10px] font-bold tracking-[0.2em] text-white/30 uppercase text-right">
                        Mapping Precision <br />
                        <span className="text-white/60">{(debugInfo?.matchScore * 100).toFixed(0)}%</span>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-8 pointer-events-auto">
                    <p className="text-xs font-semibold tracking-wide text-white/50 apple-glass px-4 py-1.5 rounded-full border border-white/5">
                        {referenceLandmarks
                            ? (poseStatus === "READY" ? "Analysis in progress..." : "Adjust to match the guide")
                            : "Position yourself in the center"
                        }
                    </p>

                    <button
                        onClick={captureSnapshot}
                        className={clsx(
                            "relative w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-500",
                            poseStatus === "READY" ? "border-green-500 scale-110" : "border-white/20",
                            isProcessing ? "opacity-20 pointer-events-none" : "hover:scale-105 active:scale-95"
                        )}
                    >
                        <div className={clsx(
                            "w-14 h-14 rounded-full transition-all duration-500",
                            poseStatus === "READY" ? "bg-white" : "bg-white/10"
                        )} />

                        {poseStatus === "READY" && (
                            <motion.div
                                className="absolute inset-[-8px] border-2 border-green-500 rounded-full"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1.2, opacity: 0 }}
                                transition={{ duration: 1, repeat: Infinity }}
                            />
                        )}
                    </button>

                    <span className="text-[10px] font-bold tracking-[0.3em] text-white/20 uppercase">
                        Capture Sensor
                    </span>
                </div>
            </div>
        </div>
    );
}
