// Firebase configuration and authentication setup
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { getStorage } from "firebase/storage";
dotenv.config();
const app = express();
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider("apple.com");

// Configure Google provider
googleProvider.addScope("email");
googleProvider.addScope("profile");

// Configure Apple provider
appleProvider.addScope("email");
appleProvider.addScope("name");

// Google Sign In with popup (better UX than redirect)
export const signInWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    // If popup is blocked, fall back to redirect
    if (error.code === "auth/popup-blocked") {
      console.log("Popup blocked, falling back to redirect");
      return await signInWithGoogleRedirect();
    }
    throw error;
  }
};

// Google Sign In with redirect (fallback if popup is blocked)
export const signInWithGoogleRedirect = () => {
  return signInWithRedirect(auth, googleProvider);
};

// Handle redirect result (call this on app initialization)
export const handleAuthRedirect = () => {
  return getRedirectResult(auth);
};

// Sign out
export const firebaseSignOut = () => {
  return signOut(auth);
};

// Apple Sign In with popup (better UX than redirect)
export const signInWithApple = async () => {
  try {
    return await signInWithPopup(auth, appleProvider);
  } catch (error: any) {
    // If popup is blocked, fall back to redirect
    if (error.code === "auth/popup-blocked") {
      console.log("Popup blocked, falling back to redirect");
      return await signInWithAppleRedirect();
    }
    throw error;
  }
};

// Apple Sign In with redirect (fallback if popup is blocked)
export const signInWithAppleRedirect = () => {
  return signInWithRedirect(auth, appleProvider);
};

// Auth state observer
export const onAuthStateChange = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, callback);
};
