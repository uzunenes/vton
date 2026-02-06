/**
 * User-Friendly Error Messages
 * Maps technical errors to human-readable messages with recovery actions
 *
 * Design Principles (Apple HIG):
 * - Clear, concise language
 * - Actionable recovery steps
 * - No technical jargon
 * - Positive, helpful tone
 */

export interface UserFriendlyError {
  /** Short, descriptive title */
  title: string;

  /** Detailed explanation for the user */
  message: string;

  /** Optional action URL or identifier */
  action?: string;

  /** Label for the action button */
  actionLabel?: string;

  /** Secondary action label (e.g., "Cancel") */
  secondaryActionLabel?: string;

  /** Whether the error can be recovered from */
  recoverable: boolean;

  /** Error severity for styling */
  severity: 'info' | 'warning' | 'error';

  /** Icon name to display */
  icon?: 'network' | 'timeout' | 'auth' | 'processing' | 'camera' | 'upload' | 'generic';
}

/**
 * Error code to user-friendly message mapping
 */
export const ERROR_MESSAGES: Record<string, UserFriendlyError> = {
  // Network & Connection Errors
  NETWORK_ERROR: {
    title: 'Connection Lost',
    message: 'We couldn\'t connect to our servers. Please check your internet connection and try again.',
    actionLabel: 'Try Again',
    recoverable: true,
    severity: 'warning',
    icon: 'network',
  },

  TIMEOUT_ERROR: {
    title: 'Request Timed Out',
    message: 'The server is taking longer than expected. This can happen during high demand. Please try again.',
    actionLabel: 'Try Again',
    recoverable: true,
    severity: 'warning',
    icon: 'timeout',
  },

  ABORT_ERROR: {
    title: 'Request Cancelled',
    message: 'The operation was cancelled. You can start again whenever you\'re ready.',
    actionLabel: 'Start Over',
    recoverable: true,
    severity: 'info',
    icon: 'generic',
  },

  // Authentication Errors
  API_KEY_MISSING: {
    title: 'Configuration Error',
    message: 'The application is not properly configured. Please contact support if this persists.',
    actionLabel: 'Contact Support',
    action: 'mailto:support@example.com',
    recoverable: false,
    severity: 'error',
    icon: 'auth',
  },

  AUTH_FAILED: {
    title: 'Authentication Failed',
    message: 'We couldn\'t verify your credentials. Please try signing in again.',
    actionLabel: 'Sign In',
    recoverable: true,
    severity: 'error',
    icon: 'auth',
  },

  // Circuit Breaker Errors
  CIRCUIT_OPEN: {
    title: 'Service Temporarily Unavailable',
    message: 'Our AI service is experiencing high demand. Please wait a moment and try again.',
    actionLabel: 'Try Again',
    secondaryActionLabel: 'Learn More',
    recoverable: true,
    severity: 'warning',
    icon: 'processing',
  },

  // Pipeline Step Errors
  SEGMENTATION_FAILED: {
    title: 'Image Processing Failed',
    message: 'We couldn\'t process your garment image. Try using a photo with a clear background and good lighting.',
    actionLabel: 'Upload New Image',
    recoverable: true,
    severity: 'error',
    icon: 'processing',
  },

  VTON_FAILED: {
    title: 'Try-On Generation Failed',
    message: 'We couldn\'t generate your virtual try-on. This can happen with certain garment types or poses. Please try again.',
    actionLabel: 'Try Again',
    secondaryActionLabel: 'Try Different Image',
    recoverable: true,
    severity: 'error',
    icon: 'processing',
  },

  VIDEO_FAILED: {
    title: 'Video Generation Failed',
    message: 'We couldn\'t create your runway video. Don\'t worry - your try-on image is still available.',
    actionLabel: 'Skip Video',
    secondaryActionLabel: 'Try Again',
    recoverable: true,
    severity: 'warning',
    icon: 'processing',
  },

  // Camera Errors
  CAMERA_PERMISSION_DENIED: {
    title: 'Camera Access Required',
    message: 'To capture your pose, we need access to your camera. Please enable camera access in your browser settings.',
    actionLabel: 'Open Settings',
    secondaryActionLabel: 'Upload Photo Instead',
    recoverable: true,
    severity: 'warning',
    icon: 'camera',
  },

  CAMERA_NOT_FOUND: {
    title: 'No Camera Detected',
    message: 'We couldn\'t find a camera on your device. You can upload a photo instead.',
    actionLabel: 'Upload Photo',
    recoverable: true,
    severity: 'info',
    icon: 'camera',
  },

  CAMERA_IN_USE: {
    title: 'Camera Busy',
    message: 'Your camera is being used by another application. Please close other apps using the camera and try again.',
    actionLabel: 'Try Again',
    recoverable: true,
    severity: 'warning',
    icon: 'camera',
  },

  // Upload Errors
  UPLOAD_FAILED: {
    title: 'Upload Failed',
    message: 'We couldn\'t upload your image. Please check your connection and try again.',
    actionLabel: 'Try Again',
    recoverable: true,
    severity: 'error',
    icon: 'upload',
  },

  FILE_TOO_LARGE: {
    title: 'File Too Large',
    message: 'This image is too large. Please use an image smaller than 10MB.',
    actionLabel: 'Choose Different Image',
    recoverable: true,
    severity: 'warning',
    icon: 'upload',
  },

  INVALID_FILE_TYPE: {
    title: 'Unsupported File Type',
    message: 'Please upload a JPG, PNG, or WebP image.',
    actionLabel: 'Choose Different Image',
    recoverable: true,
    severity: 'warning',
    icon: 'upload',
  },

  // Pose Detection Errors
  POSE_NOT_DETECTED: {
    title: 'Pose Not Detected',
    message: 'We couldn\'t detect your pose. Please make sure your full body is visible and well-lit.',
    actionLabel: 'Try Again',
    recoverable: true,
    severity: 'info',
    icon: 'camera',
  },

  POSE_ALIGNMENT_FAILED: {
    title: 'Alignment Issue',
    message: 'Please stand in a neutral pose facing the camera. Keep your arms slightly away from your body.',
    actionLabel: 'Try Again',
    recoverable: true,
    severity: 'info',
    icon: 'camera',
  },

  // Rate Limiting
  RATE_LIMITED: {
    title: 'Too Many Requests',
    message: 'You\'re generating content too quickly. Please wait a moment before trying again.',
    actionLabel: 'Wait and Retry',
    recoverable: true,
    severity: 'warning',
    icon: 'timeout',
  },

  // Generic Errors
  UNKNOWN_ERROR: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again. If this persists, contact support.',
    actionLabel: 'Try Again',
    secondaryActionLabel: 'Contact Support',
    recoverable: true,
    severity: 'error',
    icon: 'generic',
  },
};

/**
 * Get user-friendly error message for an error code
 */
export function getErrorMessage(errorCode: string): UserFriendlyError {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Map an Error object to an error code
 */
export function mapErrorToCode(error: Error | unknown): string {
  if (!(error instanceof Error)) {
    return 'UNKNOWN_ERROR';
  }

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Timeout errors
  if (name === 'timeouterror' || message.includes('timeout') || message.includes('timed out')) {
    return 'TIMEOUT_ERROR';
  }

  // Abort errors
  if (name === 'aborterror' || message.includes('abort')) {
    return 'ABORT_ERROR';
  }

  // Circuit breaker
  if (name === 'circuitopenerror' || message.includes('circuit')) {
    return 'CIRCUIT_OPEN';
  }

  // Network errors
  if (
    name === 'networkerror' ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('socket')
  ) {
    return 'NETWORK_ERROR';
  }

  // Auth errors
  if (message.includes('fal_key') || message.includes('authentication') || message.includes('api key')) {
    return 'API_KEY_MISSING';
  }

  // Rate limiting
  if (message.includes('429') || message.includes('rate limit') || message.includes('too many')) {
    return 'RATE_LIMITED';
  }

  // Pipeline step errors
  if (message.includes('segment')) {
    return 'SEGMENTATION_FAILED';
  }
  if (message.includes('vton') || message.includes('try-on') || message.includes('tryon')) {
    return 'VTON_FAILED';
  }
  if (message.includes('video')) {
    return 'VIDEO_FAILED';
  }

  // Camera errors
  if (message.includes('camera')) {
    if (message.includes('permission') || message.includes('denied')) {
      return 'CAMERA_PERMISSION_DENIED';
    }
    if (message.includes('not found') || message.includes('no camera')) {
      return 'CAMERA_NOT_FOUND';
    }
    if (message.includes('in use') || message.includes('busy')) {
      return 'CAMERA_IN_USE';
    }
  }

  // Upload errors
  if (message.includes('upload')) {
    return 'UPLOAD_FAILED';
  }
  if (message.includes('file size') || message.includes('too large')) {
    return 'FILE_TOO_LARGE';
  }
  if (message.includes('file type') || message.includes('format')) {
    return 'INVALID_FILE_TYPE';
  }

  // Pose errors
  if (message.includes('pose')) {
    if (message.includes('not detected') || message.includes('no pose')) {
      return 'POSE_NOT_DETECTED';
    }
    return 'POSE_ALIGNMENT_FAILED';
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Get user-friendly error for an Error object
 */
export function getUserFriendlyError(error: Error | unknown): UserFriendlyError {
  const code = mapErrorToCode(error);
  return getErrorMessage(code);
}

/**
 * Format error for logging (includes technical details)
 */
export function formatErrorForLogging(error: Error | unknown): {
  code: string;
  message: string;
  stack?: string;
  originalMessage?: string;
} {
  const code = mapErrorToCode(error);
  const userError = getErrorMessage(code);

  return {
    code,
    message: userError.title,
    stack: error instanceof Error ? error.stack : undefined,
    originalMessage: error instanceof Error ? error.message : String(error),
  };
}
