import { PoseLandmarkerResult } from "@mediapipe/tasks-vision";

/**
 * Blends the original face onto the generated image using canvas operations.
 * 
 * Logic:
 * 1. Create a mask/clip path around the face/neck/hands using landmarks.
 * 2. Draw the original image (which contains the real face/skin).
 * 3. Use globalCompositeOperation = 'destination-over' to draw the generated image behind it.
 *    (Or 'source-in' / 'destination-out' depending on the exact masking strategy options)
 * 
 * Based on user prompt: "GlobalCompositeOperation = 'destination-over' ... AI kumaşının altına/üstüne yedirmek"
 */
export const blendImages = (
    originalImage: HTMLImageElement,
    generatedImage: HTMLImageElement,
    landmarks: PoseLandmarkerResult,
    canvas: HTMLCanvasElement
) => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !landmarks.landmarks[0]) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // 1. Define the Face/Skin Mask Region
    // We need to create a path for the face. 
    // MediaPipe Pose landmarks for face are 0-10.
    // We can create a soft clipping region around these points.
    const pose = landmarks.landmarks[0];
    const facePoints = pose.slice(0, 11); // Nose, eyes, ears, mouth

    // Calculate bounding box of face
    let minX = width, minY = height, maxX = 0, maxY = 0;
    facePoints.forEach(p => {
        const x = p.x * width;
        const y = p.y * height;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    });

    // Expand bounding box for "Feathering" and coverage
    const padding = (maxX - minX) * 0.5; // 50% padding
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const radiusX = (maxX - minX) / 2 + padding;
    const radiusY = (maxY - minY) / 2 + padding * 1.2; // Little more vertical for neck

    // Draw the "Real" Face from Original Image
    // We use a radial gradient for alpha transparency (feathering) logic 
    // OR we simply clip and draw.

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, 2 * Math.PI);
    // Feathering: We can't easily feather a clip, but we can feather the drawing using shadow or gradient mask.
    // approach: Draw original image into an offscreen canvas, apply radial gradient alpha mask, then draw to main.
    ctx.clip();

    // Draw original image (The Face)
    ctx.drawImage(originalImage, 0, 0, width, height);
    ctx.restore();

    // 2. Draw the Generated Image (Clothes) BEHIND the preserved face
    // This is where "destination-over" comes in.
    // Existing pixels (the face we just drawn) will remain. 
    // New pixels (the generated image) will be drawn *under* the transparent pixels.

    ctx.globalCompositeOperation = "destination-over";
    ctx.drawImage(generatedImage, 0, 0, width, height);

    // Reset
    ctx.globalCompositeOperation = "source-over";
};

export const createLaserEffect = (ctx: CanvasRenderingContext2D, width: number, height: number, scanLineY: number) => {
    // "Statik bir spinner değil, kullanıcının vücut hatlarını tarayan bir lazer efekti"
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff00';

    ctx.beginPath();
    ctx.moveTo(0, scanLineY);
    ctx.lineTo(width, scanLineY);
    ctx.stroke();
}
