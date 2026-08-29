"use client";

import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { API } from "@/backend/api/api.endpoints";
import {
  getFirebaseAuth,
  isFirebaseConfigured,
} from "@/shared/firebase/client";

import { describeStudentEntryError } from "./student-entry-messages";
import {
  StudentSessionModal,
  type StudentSessionFormValue,
} from "./student-session-modal";
import {
  clearStudentMissionSession,
  saveStudentMissionSession,
} from "./student-mission-session";
import { studentSessionReadyEvent } from "./use-student-presence";

type StudentSessionGateProps = {
  readonly children: ReactNode;
};

type GateStatus = "checking" | "needs_student_session" | "ready";

export function StudentSessionGate({ children }: StudentSessionGateProps) {
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

    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, () => {
      if (registeringRef.current) {
        return;
      }

      clearStudentMissionSession();
      setStatus("needs_student_session");
    });
  }, [firebaseConfigured]);

  async function handleSubmit(value: StudentSessionFormValue) {
    setError(null);
    setLoading(true);
    registeringRef.current = true;
    let newAnonymousUser: User | null = null;

    try {
      await API.users.validateStudentSession({
        mission_code: value.missionCode,
      });

      const auth = getFirebaseAuth();
      const { isNew, user } = await anonymousUser(auth.currentUser);
      if (isNew) {
        newAnonymousUser = user;
      }
      const idToken = await user.getIdToken(true);

      const response = await API.users.studentSession(idToken, {
        student_name: value.studentName,
        mission_code: value.missionCode,
      });

      saveStudentMissionSession({
        missionCode: response.user.student.mission_code,
        missionId: response.user.activity.current_game.mission_id,
        publishedRevision:
          response.user.activity.current_game.published_revision,
        subject: response.user.activity.current_game.subject,
      });

      setStatus("ready");
      window.dispatchEvent(new Event(studentSessionReadyEvent));
    } catch (caughtError) {
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
      {!ready ? (
        <StudentSessionModal
          error={error}
          loading={loading || status === "checking"}
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

  const credential = await signInAnonymously(getFirebaseAuth());
  return { isNew: true, user: credential.user };
}
