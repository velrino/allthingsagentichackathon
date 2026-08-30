"use client";

import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { API } from "@/backend/api/api.endpoints";
import { PageLoadingFallback } from "@/components/page-loading-fallback";
import { miaAnalytics } from "@/lib/mia-analytics";
import {
  getStudentFirebaseAuth,
  isFirebaseConfigured,
} from "@/shared/firebase/client";

import {
  describeStudentEntryError,
  studentSessionErrorScope,
  studentEntryCopy,
} from "./student-entry-messages";
import {
  StudentSessionModal,
  type StudentSessionFormValue,
} from "./student-session-modal";
import {
  clearStudentSession,
  readStudentClassSession,
  saveStudentClassSession,
  studentClassSessionStorageKey,
} from "./student-mission-session";
import {
  studentSessionReadyEvent,
  studentClassUnavailableEvent,
} from "./use-student-presence";

type StudentSessionGateProps = {
  readonly children: ReactNode;
  readonly initialClassCode?: string;
};

type GateStatus = "checking" | "needs_student_session" | "ready";

export function StudentSessionGate({
  children,
  initialClassCode = "",
}: StudentSessionGateProps) {
  const firebaseConfigured = isFirebaseConfigured();
  const registeringRef = useRef(false);
  const [status, setStatus] = useState<GateStatus>(() =>
    firebaseConfigured ? "checking" : "needs_student_session",
  );
  const [error, setError] = useState<string | null>(() =>
    firebaseConfigured
      ? null
      : "Firebase is not configured for this environment.",
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) {
      return;
    }

    const auth = getStudentFirebaseAuth();
    let cancelled = false;
    const showClassUnavailable = () => {
      setError(studentEntryCopy.errors.classUnavailable);
    };
    window.addEventListener(
      studentClassUnavailableEvent,
      showClassUnavailable,
    );

    async function restoreStoredSession(user: User | null) {
      if (registeringRef.current) {
        return;
      }

      const classSession = readStudentClassSession();
      if (user?.isAnonymous && classSession) {
        setStatus("checking");
        try {
          await API.users.validateStudentSession({
            class_code: classSession.classCode,
          });
        } catch (caughtError) {
          if (cancelled) {
            return;
          }
          if (studentSessionErrorScope(caughtError) === "class") {
            clearStudentSession();
            setStatus("needs_student_session");
            setError(studentEntryCopy.errors.classUnavailable);
            await signOut(auth).catch(() => undefined);
            return;
          }
          // Keep a previously opened mission playable during a network outage.
        }

        if (cancelled) {
          return;
        }
        setStatus("ready");
        setError(null);
        window.dispatchEvent(new Event(studentSessionReadyEvent));
        return;
      }

      clearStudentSession();
      setStatus("needs_student_session");
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void restoreStoredSession(user);
    });
    const restoreSessionFromAnotherTab = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== studentClassSessionStorageKey
      ) {
        return;
      }
      void restoreStoredSession(auth.currentUser);
    };
    window.addEventListener("storage", restoreSessionFromAnotherTab);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("storage", restoreSessionFromAnotherTab);
      window.removeEventListener(
        studentClassUnavailableEvent,
        showClassUnavailable,
      );
    };
  }, [firebaseConfigured]);

  async function handleSubmit(value: StudentSessionFormValue) {
    setError(null);
    setLoading(true);
    registeringRef.current = true;
    let newAnonymousUser: User | null = null;
    let joinStage: Parameters<typeof miaAnalytics.gameJoinFailed>[1]["stage"] =
      "class_validation";

    try {
      await API.users.validateStudentSession({
        class_code: value.classCode,
      });

      joinStage = "authentication";
      const auth = getStudentFirebaseAuth();
      const { isNew, user } = await anonymousUser(auth.currentUser);
      if (isNew) {
        newAnonymousUser = user;
      }
      const idToken = await user.getIdToken(true);

      joinStage = "session_creation";
      const response = await API.users.studentSession(idToken, {
        student_name: value.studentName,
        class_code: value.classCode,
      });

      if (!response.class) {
        joinStage = "response_validation";
        throw new Error("The class is unavailable.");
      }

      saveStudentClassSession(response.class, value.studentName);
      miaAnalytics.gameJoined({ class_id: response.class.id });

      setStatus("ready");
      window.dispatchEvent(new Event(studentSessionReadyEvent));
    } catch (caughtError) {
      miaAnalytics.gameJoinFailed(caughtError, { stage: joinStage });
      if (newAnonymousUser) {
        await newAnonymousUser.delete().catch(() => undefined);
      }

      setStatus("needs_student_session");
      setError(describeStudentEntryError(caughtError));
    } finally {
      registeringRef.current = false;
      setLoading(false);
    }
  }

  const ready = status === "ready";

  return (
    <>
      {/*
        The classroom renders behind the modal so the student sees the game
        while entering the code. `inert` blocks focus, taps and the joystick
        until the session exists; the game's keyboard controls already ignore
        keys typed inside inputs.
      */}
      <div
        aria-hidden={!ready}
        inert={!ready}
        className={ready ? undefined : "pointer-events-none select-none"}
      >
        {children}
      </div>
      {status === "checking" ? (
        <PageLoadingFallback
          className="dashboard-theme"
          message="Checking session..."
        />
      ) : status === "needs_student_session" ? (
        <StudentSessionModal
          error={error}
          initialClassCode={initialClassCode}
          loading={loading}
          onSubmit={handleSubmit}
        />
      ) : null}
    </>
  );
}

async function anonymousUser(currentUser: User | null) {
  if (currentUser?.isAnonymous) {
    return { isNew: false, user: currentUser };
  }

  const auth = getStudentFirebaseAuth();
  if (currentUser) {
    await signOut(auth);
  }

  const credential = await signInAnonymously(auth);
  return { isNew: true, user: credential.user };
}
