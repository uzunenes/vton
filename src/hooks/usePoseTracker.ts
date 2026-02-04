import { useEffect, useRef, useState, useCallback } from "react";
import {
    PoseLandmarker,
    FilesetResolver,
    DrawingUtils,
    PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

export interface PoseTrackerOptions {
    alignmentThreshold?: number; // Default 0.15
    stabilityThreshold?: number; // Default 0.02
    stabilityWindow?: number; // Default 10 frames
    matchThreshold?: number; // Default 0.75 (Cosine Similarity or similar)
    referenceLandmarks?: any; // The target landmarks to match
}

export type PoseStatus = "ALIGNING" | "STABLE" | "UNSTABLE" | "READY" | "MATCHING";

export interface PoseTrackerOutput {
    poseStatus: PoseStatus;
    poseLandmarker: PoseLandmarker | null;
    lastResults: PoseLandmarkerResult | null;
    matchScore: number;
    detectStaticImage: (image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) => Promise<any>;
    debugInfo: {
        alignmentScore: number;
        sigma: number;
        isVisible: boolean;
        matchScore: number;
        status: string;
    };
}

export const usePoseTracker = (
    videoRef: React.RefObject<HTMLVideoElement | null>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    options: PoseTrackerOptions = {}
): PoseTrackerOutput => {
    const [poseStatus, setPoseStatus] = useState<PoseStatus>("ALIGNING");
    const [matchScore, setMatchScore] = useState(0);
    const [debugInfo, setDebugInfo] = useState({
        alignmentScore: 0,
        sigma: 0,
        isVisible: false,
        matchScore: 0,
        status: "INIT"
    });
    const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
    const [staticPoseLandmarker, setStaticPoseLandmarker] = useState<PoseLandmarker | null>(null);
    const [lastResults, setLastResults] = useState<PoseLandmarkerResult | null>(null);

    const {
        alignmentThreshold = 0.15,
        stabilityThreshold = 0.04, // Relaxed from 0.02
        stabilityWindow = 10,
        matchThreshold = 0.50,
        referenceLandmarks = null
    } = options;

    const poseHistory = useRef<{ x: number; y: number }[][]>([]);

    useEffect(() => {
        let isMounted = true;
        const createPoseLandmarkers = async () => {
            setDebugInfo(prev => ({ ...prev, status: "LOADING_MP" }));
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                );

                // 1. Live Video Landmarker
                const landmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                        delegate: "GPU",
                    },
                    runningMode: "VIDEO",
                    numPoses: 1,
                });

                // 2. Static Image Landmarker (For garment analysis)
                const staticLandmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                        delegate: "GPU",
                    },
                    runningMode: "IMAGE",
                    numPoses: 1,
                });

                if (isMounted) {
                    setPoseLandmarker(landmarker);
                    setStaticPoseLandmarker(staticLandmarker);
                    setDebugInfo(prev => ({ ...prev, status: "MP_READY" }));
                }
            } catch (error) {
                console.error(error);
                if (isMounted) setDebugInfo(prev => ({ ...prev, status: "MP_ERROR" }));
            }
        };
        createPoseLandmarkers();
        return () => { isMounted = false; };
    }, []);

    const detectStaticImage = useCallback(async (image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) => {
        if (!staticPoseLandmarker) {
            console.warn("Static pose landmarker not ready yet");
            return null;
        }
        const result = staticPoseLandmarker.detect(image);
        return result.landmarks[0] || null;
    }, [staticPoseLandmarker]);

    const calculateSimilarity = (current: any, reference: any) => {
        if (!current || !reference) return 0;

        // Key joints for mapping
        const keyPoints = [11, 12, 13, 14, 15, 16, 23, 24];

        // 1. Calculate characteristic scales (Shoulder width)
        const getDist = (a: any, b: any) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
        const curScale = getDist(current[11], current[12]) || 0.1;
        const refScale = getDist(reference[11], reference[12]) || 0.1;

        // 2. Normalizing: Center of Shoulders
        const curCenter = {
            x: (current[11].x + current[12].x) / 2,
            y: (current[11].y + current[12].y) / 2
        };
        const refCenter = {
            x: (reference[11].x + reference[12].x) / 2,
            y: (reference[11].y + reference[12].y) / 2
        };

        let totalDist = 0;
        let count = 0;

        keyPoints.forEach(idx => {
            const c = current[idx];
            const r = reference[idx];

            // IMPORTANT: If video is mirrored (-scale-x-100), we might need to flip current.x logic
            // But since both current and reference are in 0-1 range from same model, 
            // the relative distances to their own centers should match.
            if (c.visibility > 0.3 && r.visibility > 0.3) {
                const cnx = (c.x - curCenter.x) / curScale;
                const cny = (c.y - curCenter.y) / curScale;

                const rnx = (r.x - refCenter.x) / refScale;
                const rny = (r.y - refCenter.y) / refScale;

                totalDist += Math.sqrt(Math.pow(cnx - rnx, 2) + Math.pow(cny - rny, 2));
                count++;
            }
        });

        if (count === 0) return 0;
        const avgDist = totalDist / count;

        // Match score logic: 0.1 avg dist is very good, 0.3 is poor.
        const score = Math.max(0, 1 - (avgDist * 1.5));
        return score;
    };

    const processFrame = useCallback(() => {
        if (!poseLandmarker || !videoRef.current || !canvasRef.current) return;
        if (videoRef.current.readyState < 2) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        const startTimeMs = performance.now();
        const result = poseLandmarker.detectForVideo(video, startTimeMs);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (result.landmarks.length > 0) {
            const drawingUtils = new DrawingUtils(ctx);
            const landmarks = result.landmarks[0];

            // 1. Stability Check
            const currentCenter = { x: (landmarks[11].x + landmarks[12].x) / 2, y: (landmarks[11].y + landmarks[12].y) / 2 };
            poseHistory.current.push([currentCenter]);
            if (poseHistory.current.length > stabilityWindow) poseHistory.current.shift();

            let sigma = 1;
            if (poseHistory.current.length === stabilityWindow) {
                const meanX = poseHistory.current.reduce((sum, p) => sum + p[0].x, 0) / stabilityWindow;
                const meanY = poseHistory.current.reduce((sum, p) => sum + p[0].y, 0) / stabilityWindow;
                const varX = poseHistory.current.reduce((sum, p) => sum + Math.pow(p[0].x - meanX, 2), 0) / stabilityWindow;
                const varY = poseHistory.current.reduce((sum, p) => sum + Math.pow(p[0].y - meanY, 2), 0) / stabilityWindow;
                sigma = Math.sqrt(varX + varY);
            }

            // 2. Similarity Score
            let currentMatchScore = 0;
            if (referenceLandmarks) {
                currentMatchScore = calculateSimilarity(landmarks, referenceLandmarks);
                setMatchScore(currentMatchScore);
            }

            // Draw current pose
            drawingUtils.drawLandmarks(landmarks, { color: currentMatchScore > matchThreshold ? "#00FF00" : "#FFFFFF55", radius: 2 });
            drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: currentMatchScore > matchThreshold ? "#00FF00" : "#FFFFFF55" });

            // Draw ghost pose if reference exists (scaled/centered for guidance)
            if (referenceLandmarks) {
                const refPoints = referenceLandmarks.map((p: any) => ({
                    ...p,
                    x: p.x, // Assuming both are normalized 0-1
                    y: p.y
                }));
                drawingUtils.drawConnectors(refPoints, PoseLandmarker.POSE_CONNECTIONS, {
                    color: currentMatchScore > matchThreshold ? "#00FF0033" : "#FFFFFF22",
                    lineWidth: 4
                });
            }

            // logic: READY if stable AND (if ref exists, matchScore > threshold; else alignment < thresh)
            const isStable = sigma < stabilityThreshold;
            const leftShoulder = landmarks[11];
            const rightShoulder = landmarks[12];
            const alignmentScore = Math.abs(leftShoulder.y - rightShoulder.y);
            const isVisible = (leftShoulder.visibility ?? 1) > 0.5 && (rightShoulder.visibility ?? 1) > 0.5;

            if (!isVisible) {
                setPoseStatus("ALIGNING");
            } else if (referenceLandmarks) {
                if (currentMatchScore > matchThreshold && isStable) {
                    setPoseStatus("READY");
                } else if (currentMatchScore > 0.4) {
                    setPoseStatus("MATCHING");
                } else {
                    setPoseStatus("ALIGNING");
                }
            } else {
                if (alignmentScore < alignmentThreshold && isStable) {
                    setPoseStatus("READY");
                } else {
                    setPoseStatus("ALIGNING");
                }
            }

            setLastResults(result);
            setDebugInfo({
                alignmentScore,
                sigma,
                isVisible,
                matchScore: currentMatchScore,
                status: "TRACKING"
            });
        }
    }, [poseLandmarker, alignmentThreshold, stabilityThreshold, stabilityWindow, matchThreshold, referenceLandmarks, videoRef, canvasRef]);

    useEffect(() => {
        let animationFrameId: number;
        const loop = () => {
            processFrame();
            animationFrameId = requestAnimationFrame(loop);
        }
        loop();
        return () => cancelAnimationFrame(animationFrameId);
    }, [processFrame]);

    return { poseStatus, poseLandmarker, lastResults, matchScore, detectStaticImage, debugInfo };
};
