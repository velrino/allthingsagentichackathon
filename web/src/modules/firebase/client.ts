import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const requiredEnv = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} satisfies FirebaseOptions;

const optionalEnv = {
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
} satisfies Pick<FirebaseOptions, "measurementId">;

let firestore: Firestore | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;

export function isFirebaseConfigured() {
  return Object.values(requiredEnv).every((value) => typeof value === "string" && value.length > 0);
}

function getFirebaseConfig(): FirebaseOptions {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* environment variables.");
  }

  return {
    ...requiredEnv,
    ...(optionalEnv.measurementId ? optionalEnv : {}),
  };
}

export function getFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
}

export function getFirebaseDb(): Firestore {
  firestore ??= getFirestore(getFirebaseApp());
  return firestore;
}

export function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined" || !isFirebaseConfigured()) {
    return Promise.resolve(null);
  }

  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(getFirebaseApp()) : null))
    .catch(() => null);

  return analyticsPromise;
}
