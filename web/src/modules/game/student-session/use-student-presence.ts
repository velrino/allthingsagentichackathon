"use client";

import { useEffect } from "react";

import { API } from "@/backend/api/api.endpoints";
import type { IApiStudentPresence } from "@/backend/api/api.interface";
import { getStudentFirebaseAuth } from "@/shared/firebase/client";

import { readStudentMissionSession } from "./student-mission-session";

const heartbeatIntervalMilliseconds = 15_000;
export const studentSessionReadyEvent = "classgame:student-session-ready";

export function useStudentPresence(
  presence: Omit<IApiStudentPresence, "mission_id" | "subject">,
  options?: { readonly enabled?: boolean },
) {
  const { stage_id, stage_name, status } = presence;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function reportPresence() {
      const user = getStudentFirebaseAuth().currentUser;
      const missionSession = readStudentMissionSession();
      if (
        cancelled ||
        document.visibilityState !== "visible" ||
        !user?.isAnonymous ||
        !missionSession
      ) {
        return;
      }

      try {
        const idToken = await user.getIdToken();
        if (!cancelled) {
          await API.users.studentPresence(idToken, {
            mission_id: missionSession.missionId,
            stage_id,
            stage_name,
            status,
            subject: missionSession.subject,
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
  }, [enabled, stage_id, stage_name, status]);
}
