"use client";

import { FirebaseError } from "firebase/app";
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";

import { getFirebaseAuth, isFirebaseConfigured } from "@/shared/firebase/client";

type TeacherAuthStatus = "checking" | "signed_out" | "signed_in";

type TeacherAuthState = {
  readonly status: TeacherAuthStatus;
  readonly user: User | null;
  readonly error: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  "auth/network-request-failed": "Couldn't reach Google. Check your connection and try again.",
  "auth/unauthorized-domain": "This domain isn't authorised for Google sign-in.",
  "auth/invalid-credential": "Google didn't accept that sign-in. Please try again.",
  "auth/account-exists-with-different-credential": "This email is already linked to another sign-in method.",
  "auth/user-disabled": "This account has been disabled.",
};

function describeSignInError(error: unknown) {
  if (error instanceof FirebaseError) {
    return ERROR_MESSAGES[error.code] ?? "Google sign-in failed. Please try again.";
  }

  return "Google sign-in failed. Please try again.";
}

export function useTeacherAuth() {
  const firebaseConfigured = isFirebaseConfigured();
  const [state, setState] = useState<TeacherAuthState>(() => ({
    status: firebaseConfigured ? "checking" : "signed_out",
    user: null,
    error: firebaseConfigured ? null : "Firebase is not configured.",
  }));

  useEffect(() => {
    if (!firebaseConfigured) {
      return;
    }

    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (user) => {
      setState({
        status: user && !user.isAnonymous ? "signed_in" : "signed_out",
        user: user && !user.isAnonymous ? user : null,
        error: null,
      });
    });
  }, [firebaseConfigured]);

  /** Exchange the ID token from Google's button for a Firebase session. Returns null (with `error` set) on failure. */
  const signInWithGoogleIdToken = useCallback(async (idToken: string) => {
    setState((current) => ({ ...current, error: null }));

    try {
      const auth = getFirebaseAuth();
      if (auth.currentUser?.isAnonymous) {
        await signOut(auth);
      }

      const credential = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      setState({
        status: "signed_in",
        user: credential.user,
        error: null,
      });

      return credential.user;
    } catch (error) {
      setState({
        status: "signed_out",
        user: null,
        error: describeSignInError(error),
      });
      return null;
    }
  }, []);

  /** Surface a problem that happened before Firebase was involved (Google's script failed to load). */
  const reportSignInError = useCallback((message: string) => {
    setState((current) => ({ ...current, error: message }));
  }, []);

  const signOutTeacher = useCallback(async () => {
    await signOut(getFirebaseAuth());
    setState({
      status: "signed_out",
      user: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    firebaseConfigured,
    signInWithGoogleIdToken,
    reportSignInError,
    signOutTeacher,
  };
}
