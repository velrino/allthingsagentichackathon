"use client";

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";

import { getFirebaseAuth, isFirebaseConfigured } from "@/shared/firebase/client";

type TeacherAuthStatus = "checking" | "signed_out" | "signed_in";

type TeacherAuthState = {
  readonly status: TeacherAuthStatus;
  readonly user: User | null;
  readonly error: string | null;
};

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

  const signInWithGoogle = useCallback(async () => {
    setState((current) => ({ ...current, error: null }));

    try {
      const auth = getFirebaseAuth();
      if (auth.currentUser?.isAnonymous) {
        await signOut(auth);
      }

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });

      const credential = await signInWithPopup(auth, provider);
      setState({
        status: "signed_in",
        user: credential.user,
        error: null,
      });

      return credential.user;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign in failed.";
      setState({
        status: "signed_out",
        user: null,
        error: message,
      });
      throw error;
    }
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
    signInWithGoogle,
    signOutTeacher,
  };
}
