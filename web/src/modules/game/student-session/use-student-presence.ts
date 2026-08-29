"use client";

import { useEffect, useRef } from "react";

import { API } from "@/backend/api/api.endpoints";
import type { IApiStudentPresence } from "@/backend/api/api.interface";
import { getStudentFirebaseAuth } from "@/shared/firebase/client";

import { studentSessionErrorScope } from "./student-entry-messages";
import {
  readStudentClassSession,
  readStudentMissionSession,
} from "./student-mission-session";

const heartbeatIntervalMilliseconds = 15_000;
export const studentSessionReadyEvent = "classgame:student-session-ready";
export const studentClassUnavailableEvent =
  "classgame:student-class-unavailable";

export function useStudentPresence(
  presence: Omit<
    IApiStudentPresence,
    "mission_id" | "class_code" | "subject"
  >,
  options?: {
    readonly enabled?: boolean;
    readonly onClassUnavailable?: () => void;
    readonly onMissionUnavailable?: () => void;
  },
) {
  const { stage_id, stage_name, status } = presence;
  const enabled = options?.enabled ?? true;
  const onClassUnavailableRef = useRef(options?.onClassUnavailable);
  const onMissionUnavailableRef = useRef(options?.onMissionUnavailable);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    onClassUnavailableRef.current = options?.onClassUnavailable;
    onMissionUnavailableRef.current = options?.onMissionUnavailable;
  }, [options?.onClassUnavailable, options?.onMissionUnavailable]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let sessionUnavailable = false;

    async function reportPresence() {
      const user = getStudentFirebaseAuth().currentUser;
      const classSession = readStudentClassSession();
      const missionSession = readStudentMissionSession();
      if (
        cancelled ||
        sessionUnavailable ||
        requestInFlightRef.current ||
        document.visibilityState !== "visible" ||
        !user?.isAnonymous ||
        !classSession ||
        !missionSession
      ) {
        return;
      }

      requestInFlightRef.current = true;
      try {
        const idToken = await user.getIdToken();
        if (!cancelled) {
          await API.users.studentPresence(idToken, {
            mission_id: missionSession.missionId,
            class_code: classSession.classCode,
            stage_id,
            stage_name,
            status,
            subject: missionSession.subject,
          });
        }
      } catch (error) {
        const scope = studentSessionErrorScope(error);
        if (!cancelled && scope) {
          const currentClassSession = readStudentClassSession();
          const currentMissionSession = readStudentMissionSession();
          if (
            scope === "class" &&
            currentClassSession?.classCode !== classSession.classCode
          ) {
            return;
          }
          if (
            scope === "mission" &&
            currentMissionSession?.missionId !== missionSession.missionId
          ) {
            return;
          }
          sessionUnavailable = true;
          if (scope === "class") {
            window.dispatchEvent(new Event(studentClassUnavailableEvent));
            onClassUnavailableRef.current?.();
          } else {
            onMissionUnavailableRef.current?.();
          }
        }
        // Other presence failures are best effort, so an offline game remains playable.
      } finally {
        requestInFlightRef.current = false;
      }
    }

    void reportPresence();
    const interval = window.setInterval(reportPresence, heartbeatIntervalMilliseconds);
    const reportWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void reportPresence();
      }
    };
    document.addEventListener("visibilitychange", reportWhenVisible);
    window.addEventListener(studentSessionReadyEvent, reportPresence);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", reportWhenVisible);
      window.removeEventListener(studentSessionReadyEvent, reportPresence);
    };
  }, [enabled, stage_id, stage_name, status]);
}
