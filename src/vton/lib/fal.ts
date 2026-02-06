import { fal } from "@fal-ai/client";

// Initialize the fal.ai client
fal.config({
    credentials: import.meta.env.VITE_FAL_KEY,
});

// Queue ID for IDM-VTON
export const VTON_MODEL_ID = "fal-ai/idm-vton";
export { fal };
