"use client";

import { useEffect } from "react";

import { API } from "@/backend/api/api.endpoints";
import type { IApiStudentPresence } from "@/backend/api/api.interface";
import { getFirebaseAuth } from "@/shared/firebase/client";

const heartbeatIntervalMilliseconds = 15_000;
export const studentSessionReadyEvent = "classgame:student-session-ready";

export function useStudentPresence(presence: IApiStudentPresence) {
  const { activity_id, stage_id, stage_name, status, subject } = presence;

  useEffect(() => {
    let cancelled = false;

    async function reportPresence() {
      const user = getFirebaseAuth().currentUser;
      if (cancelled || document.visibilityState !== "visible" || !user?.isAnonymous) {
        return;
      }

      try {
        const idToken = await user.getIdToken();
        if (!cancelled) {
          await API.users.studentPresence(idToken, {
            activity_id,
            stage_id,
            stage_name,
            status,
            subject,
          });
        }
      } catch {
        // Presence is best effort; the game remains playable if the API is offline.
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
  }, [activity_id, stage_id, stage_name, status, subject]);
}
