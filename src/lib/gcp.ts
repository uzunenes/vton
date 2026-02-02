import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (Singleton pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const storage = getStorage(app);
const auth = getAuth(app);

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";

export const uploadImage = async (file: Blob, path: string): Promise<string> => {
    console.log(`[Upload] Starting upload for ${path}`);

    // Ensure we are authenticated
    if (!auth.currentUser) {
        console.log("[Upload] No user, signing in anonymously...");
        try {
            await signInAnonymously(auth);
            console.log("[Upload] Signed in anonymously:", auth.currentUser?.uid);
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
    } catch (uploadError: any) {
        console.error("[Upload] Upload bytes failed:", uploadError);
        if (uploadError.message && uploadError.message.includes("unauthorized")) {
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
