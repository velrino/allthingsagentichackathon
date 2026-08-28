"use client";

import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { API } from "@/backend/api/api.endpoints";
import { getFirebaseAuth, isFirebaseConfigured } from "@/shared/firebase/client";

import { StudentSessionModal, type StudentSessionFormValue } from "./student-session-modal";

type StudentSessionGateProps = {
  readonly children: ReactNode;
};

type GateStatus = "checking" | "needs_student_session" | "ready";

export function StudentSessionGate({ children }: StudentSessionGateProps) {
  const firebaseConfigured = isFirebaseConfigured();
  const registeringRef = useRef(false);
  const [status, setStatus] = useState<GateStatus>(() => (firebaseConfigured ? "checking" : "needs_student_session"));
  const [error, setError] = useState<string | null>(() => (firebaseConfigured ? null : "Firebase is not configured for this environment."));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) {
      return;
    }

    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (user) => {
      if (registeringRef.current) {
        return;
      }

      setStatus(user?.isAnonymous ? "ready" : "needs_student_session");
    });
  }, [firebaseConfigured]);

  async function handleSubmit(value: StudentSessionFormValue) {
    setError(null);
    setLoading(true);
    registeringRef.current = true;

    try {
      const auth = getFirebaseAuth();
      const user = await anonymousUser(auth.currentUser);
      const idToken = await user.getIdToken(true);

      await API.users.studentSession(idToken, {
        student_name: value.studentName,
        turma_id: value.turmaId,
      });

      setStatus("ready");
    } catch (caughtError) {
      setStatus("needs_student_session");
      setError(caughtError instanceof Error ? caughtError.message : "Could not start the student session.");
    } finally {
      registeringRef.current = false;
      setLoading(false);
    }
  }

  return (
    <>
      {status === "ready" ? children : null}
      {status !== "ready" ? <StudentSessionModal error={error} loading={loading || status === "checking"} onSubmit={handleSubmit} /> : null}
    </>
  );
}

async function anonymousUser(currentUser: User | null) {
  if (currentUser?.isAnonymous) {
    return currentUser;
  }

  const credential = await signInAnonymously(getFirebaseAuth());
  return credential.user;
}
