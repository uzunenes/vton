/**
 * Firebase/GCP Integration
 *
 * NOTE: This module is deprecated and will be removed.
 * All storage operations now use fal.ai storage via FalClient.
 *
 * @deprecated Use @/lib/api/FalClient instead
 */

// This file is kept as a placeholder for potential future Firebase integration
// If you need Firebase, uncomment the code below and install firebase package

export const uploadImage = async (
  _file: Blob,
  _path: string,
): Promise<string> => {
  throw new Error(
    "Firebase storage is deprecated. Use fal.storage.upload() via FalClient instead.",
  );
};

// Placeholder exports for backwards compatibility
export const app = null;
export const storage = null;
export const auth = null;
