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
        matchThreshold: 0.68, // More achievable threshold for real-world usage
    });

    // Analyze uploaded mannequin image to get target pose
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
                    console.log("Reference pose analyzed successfully");
                }
                URL.revokeObjectURL(url);
            };
        };

        analyzeImage();
    }, [garmentBlob, detectStaticImage, onGarmentPoseDetected]);

    // Auto-capture when pose matches target mannequin pose
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

    // Setup Camera
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

        // Clean up stream on unmount
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div className="relative w-full max-w-4xl aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl bg-black border border-gray-800">
            {/* Video Feed */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
            />

            {/* Augmented Reality Canvas (Pose Skeleton) */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none opacity-50"
            />

            {/* UI Overlays */}
            <div className="absolute inset-0 flex flex-col items-center justify-between p-6">

                {/* Top Status */}
                <div className="w-full flex justify-between items-start pointer-events-none">
                    <div className="flex flex-col gap-2">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={clsx(
                                "px-4 py-2 rounded-lg backdrop-blur-md border font-mono text-xs whitespace-nowrap",
                                poseStatus === "READY" ? "bg-green-500/20 border-green-500/50 text-green-100" :
                                    poseStatus === "MATCHING" ? "bg-blue-500/20 border-blue-500/50 text-blue-100" :
                                        poseStatus === "UNSTABLE" ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-100" :
                                            "bg-red-500/20 border-red-500/50 text-red-100"
                            )}
                        >
                            {poseStatus === "READY" && "● POSE MATCH PERFECT"}
                            {poseStatus === "MATCHING" && "● POSE MATCHING..."}
                            {poseStatus === "UNSTABLE" && "● STABILIZING..."}
                            {poseStatus === "ALIGNING" && (referenceLandmarks ? "● ALIGN TO SILHOUETTE" : "● ALIGNING POSE...")}
                        </motion.div>

                        {referenceLandmarks && (
                            <div className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-gray-400 font-mono">
                                GHOST SILHOUETTE ACTIVE
                            </div>
                        )}
                    </div>

                    <div className="font-mono text-[10px] text-gray-500 bg-black/40 p-2 rounded border border-white/5">
                        MATCH: {(debugInfo?.matchScore * 100).toFixed(1)}%<br />
                        STABILITY: {(100 - (debugInfo?.sigma * 1000)).toFixed(1)}%
                    </div>
                </div>

                {/* Center Guide */}
                <div className="pointer-events-none border-2 border-dashed border-white/5 w-64 h-96 rounded-full opacity-10" />

                {/* Bottom Actions */}
                <div className="w-full flex flex-col items-center gap-4">
                    <p className="text-sm font-medium text-white/70 bg-black/40 px-4 py-1 rounded-full backdrop-blur-sm">
                        {referenceLandmarks
                            ? (poseStatus === "READY" ? "Perfect match! Snapshot triggered..." : "Mimic the mannequin's pose to capture")
                            : (poseStatus === "READY" ? "Ready to capture!" : "Adjust your position for best results")
                        }
                    </p>

                    <button
                        onClick={captureSnapshot}
                        className={clsx(
                            "group relative flex items-center justify-center transition-all duration-300",
                            isProcessing ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:scale-110 active:scale-95"
                        )}
                    >
                        {/* Outer Ring */}
                        <div className={clsx(
                            "absolute inset-[-8px] border-2 rounded-full transition-colors duration-500",
                            poseStatus === "READY" ? "border-green-500 animate-pulse" : "border-white/20"
                        )} />

                        {/* Main Button */}
                        <div className={clsx(
                            "w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all duration-300",
                            poseStatus === "READY" ? "bg-white border-green-500" : "bg-white/10 border-white/40"
                        )}>
                            <div className={clsx(
                                "w-12 h-12 rounded-full transition-all duration-300",
                                poseStatus === "READY" ? "bg-green-500" : "bg-white/20"
                            )} />
                        </div>
                    </button>

                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                        Capture Reference Photo
                    </span>
                </div>
            </div>

            {/* Laser Effect Scanner */}
            <AnimatePresence>
                {poseStatus === "ALIGNING" && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/20 to-transparent w-full h-8 z-10"
                        animate={{ top: ["0%", "100%"] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
