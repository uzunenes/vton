/**
 * Firebase Storage Helper
 * Handles file uploads to Firebase Storage for user images, session data, and outputs
 */

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import firebase_app from "./firebaseClient";

const storage = getStorage(firebase_app);

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

/**
 * Upload a file to Firebase Storage
 */
export async function uploadFile(
  path: string,
  file: Blob | File | Buffer | Uint8Array,
  options?: UploadOptions,
): Promise<string> {
  try {
    const storageRef = ref(storage, path);

    const metadata: any = {
      contentType: options?.contentType || "application/octet-stream",
      cacheControl: options?.cacheControl || "public, max-age=31536000",
      customMetadata: options?.metadata || {},
    };

    await uploadBytes(storageRef, file, metadata);
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error: any) {
    console.error("Error uploading file to Firebase Storage:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Upload user image (model or garment)
 */
export async function uploadUserImage(
  userId: string,
  imageType: "model" | "garment",
  file: Blob | File,
  sessionId?: string,
): Promise<string> {
  const timestamp = Date.now();
  const extension = file.type.split("/")[1] || "jpg";
  const filename = `${imageType}_${timestamp}.${extension}`;

  const path = sessionId
    ? `users/${userId}/sessions/${sessionId}/inputs/${filename}`
    : `users/${userId}/uploads/${filename}`;

  return uploadFile(path, file, {
    contentType: file.type,
    metadata: {
      userId,
      imageType,
      sessionId: sessionId || "",
      uploadedAt: new Date().toISOString(),
    },
  });
}

/**
 * Upload session output (generated image or video)
 */
export async function uploadSessionOutput(
  userId: string,
  sessionId: string,
  stepId: string,
  file: Blob | ArrayBuffer,
  options: {
    type: "image" | "video";
    modelUsed: string;
    variant?: string;
    metadata?: Record<string, any>;
  },
): Promise<string> {
  const timestamp = Date.now();
  const extension = options.type === "video" ? "mp4" : "jpg";
  const filename = `${stepId}_${options.variant || "default"}_${timestamp}.${extension}`;

  const path = `users/${userId}/sessions/${sessionId}/outputs/${filename}`;

  const fileBlob = file instanceof Blob ? file : new Blob([file]);

  return uploadFile(path, fileBlob, {
    contentType: options.type === "video" ? "video/mp4" : "image/jpeg",
    metadata: {
      userId,
      sessionId,
      stepId,
      type: options.type,
      modelUsed: options.modelUsed,
      variant: options.variant || "",
      ...options.metadata,
      createdAt: new Date().toISOString(),
    },
  });
}

/**
 * Download file from URL and upload to Firebase Storage
 */
export async function uploadFromURL(
  path: string,
  url: string,
  options?: UploadOptions,
): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const blob = await response.blob();
    return uploadFile(path, blob, {
      ...options,
      contentType:
        options?.contentType ||
        response.headers.get("content-type") ||
        undefined,
    });
  } catch (error: any) {
    console.error("Error uploading from URL:", error);
    throw new Error(`Failed to upload from URL: ${error.message}`);
  }
}

/**
 * Save session metadata as JSON
 */
export async function uploadSessionMetadata(
  userId: string,
  sessionId: string,
  metadata: Record<string, any>,
): Promise<string> {
  const path = `users/${userId}/sessions/${sessionId}/metadata.json`;
  const blob = new Blob([JSON.stringify(metadata, null, 2)], {
    type: "application/json",
  });

  return uploadFile(path, blob, {
    contentType: "application/json",
  });
}

/**
 * Save session logs
 */
export async function uploadSessionLogs(
  userId: string,
  sessionId: string,
  logs: any[],
): Promise<string> {
  const path = `users/${userId}/sessions/${sessionId}/logs.jsonl`;
  const logLines = logs.map((log) => JSON.stringify(log)).join("\n");
  const blob = new Blob([logLines], { type: "application/x-ndjson" });

  return uploadFile(path, blob, {
    contentType: "application/x-ndjson",
  });
}

/**
 * Delete a file from Firebase Storage
 */
export async function deleteFile(path: string): Promise<void> {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error: any) {
    console.error("Error deleting file from Firebase Storage:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Delete all files in a directory
 */
export async function deleteDirectory(path: string): Promise<void> {
  try {
    const storageRef = ref(storage, path);
    const listResult = await listAll(storageRef);

    // Delete all files
    const deletePromises = listResult.items.map((item) => deleteObject(item));

    // Recursively delete subdirectories
    const subdirPromises = listResult.prefixes.map((prefix) =>
      deleteDirectory(prefix.fullPath),
    );

    await Promise.all([...deletePromises, ...subdirPromises]);
  } catch (error: any) {
    console.error("Error deleting directory from Firebase Storage:", error);
    throw new Error(`Failed to delete directory: ${error.message}`);
  }
}

/**
 * Delete all session files
 */
export async function deleteSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  const path = `users/${userId}/sessions/${sessionId}`;
  return deleteDirectory(path);
}

/**
 * Get download URL for a file
 */
export async function getFileURL(path: string): Promise<string> {
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error: any) {
    console.error("Error getting file URL from Firebase Storage:", error);
    throw new Error(`Failed to get file URL: ${error.message}`);
  }
}

/**
 * List all files in a directory
 */
export async function listFiles(path: string): Promise<string[]> {
  try {
    const storageRef = ref(storage, path);
    const listResult = await listAll(storageRef);

    return listResult.items.map((item) => item.fullPath);
  } catch (error: any) {
    console.error("Error listing files from Firebase Storage:", error);
    throw new Error(`Failed to list files: ${error.message}`);
  }
}

/**
 * Get all session outputs
 */
export async function getSessionOutputs(
  userId: string,
  sessionId: string,
): Promise<string[]> {
  const path = `users/${userId}/sessions/${sessionId}/outputs`;
  return listFiles(path);
}

/**
 * Helper to convert base64 to Blob
 */
export function base64ToBlob(
  base64: string,
  contentType: string = "image/jpeg",
): Blob {
  const byteCharacters = atob(base64.split(",")[1] || base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: contentType });
}

export { storage };
