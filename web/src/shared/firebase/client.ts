import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const DEFAULT_FIREBASE_APP_NAME = "[DEFAULT]";
const STUDENT_FIREBASE_APP_NAME = "classgame-student";

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
let auth: Auth | null = null;
let studentAuth: Auth | null = null;
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
  const existingApp = getApps().find(
    (app) => app.name === DEFAULT_FIREBASE_APP_NAME,
  );

  return existingApp ?? initializeApp(getFirebaseConfig());
}

export function getStudentFirebaseApp(): FirebaseApp {
  const existingApp = getApps().find(
    (app) => app.name === STUDENT_FIREBASE_APP_NAME,
  );

  return existingApp ?? initializeApp(getFirebaseConfig(), STUDENT_FIREBASE_APP_NAME);
}

export function getFirebaseDb(): Firestore {
  firestore ??= getFirestore(getFirebaseApp());
  return firestore;
}

export function getFirebaseAuth(): Auth {
  auth ??= getAuth(getFirebaseApp());
  return auth;
}

export function getStudentFirebaseAuth(): Auth {
  studentAuth ??= getAuth(getStudentFirebaseApp());
  return studentAuth;
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
