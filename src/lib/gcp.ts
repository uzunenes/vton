/**
 * Firebase/GCP Integration
 * NOTE: Currently unused - fal.ai storage is used instead
 * Kept for potential future use
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from "firebase/storage";
import { getAuth, signInAnonymously, Auth } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (Singleton pattern)
let app: FirebaseApp;
let storage: FirebaseStorage;
let auth: Auth;

try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    storage = getStorage(app);
    auth = getAuth(app);
} catch (e) {
    console.warn('[Firebase] Initialization failed:', e);
}

export const uploadImage = async (file: Blob, path: string): Promise<string> => {
    if (!auth || !storage) {
        throw new Error('Firebase not initialized');
    }

    console.log(`[Upload] Starting upload for ${path}`);

    // Ensure we are authenticated
    if (!auth.currentUser) {
        console.log("[Upload] No user, signing in anonymously...");
        try {
            const userCred = await signInAnonymously(auth);
            console.log("[Upload] Signed in anonymously:", userCred.user?.uid);
        } catch (authError) {
            console.error("[Upload] Auth failed:", authError);
            throw new Error("Authentication failed. Please check Firebase Console > Auth > Sign-in method > Anonymous is ENABLED.");
        }
    } else {
        console.log("[Upload] Already signed in:", auth.currentUser.uid);
    }

    const storageRef = ref(storage, path);

    console.log(`[Upload] Uploading bytes to ${path}...`);
    try {
        const result = await uploadBytes(storageRef, file);
        console.log("[Upload] Upload success:", result);
    } catch (uploadError: unknown) {
        console.error("[Upload] Upload bytes failed:", uploadError);
        if (uploadError instanceof Error && uploadError.message.includes("unauthorized")) {
            throw new Error("Storage Unauthorized. Check Firebase Console > Storage > Rules. Should allow write if request.auth != null.");
        }
        throw uploadError;
    }

    console.log(`[Upload] Getting download URL...`);
    const url = await getDownloadURL(storageRef);
    console.log(`[Upload] URL retrieved: ${url}`);

    return url;
};

export { app, storage, auth };
