"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";

import { defaultAvatarPresetId } from "../avatars/avatar-presets";
import { readStoredAvatarPresetId, storeAvatarPresetId, subscribeStoredAvatarPresetId } from "../avatars/avatar-storage";
import { THINKING_MS } from "../agent/mock-tutor";
import type { FeedbackValue, WorldDirective, WorldReport } from "../types/game";
import { POD_ORDER } from "../types/game";
import { createInitialSession, sessionReducer } from "./session-reducer";
import { clearMemory, loadMemory, saveMemory } from "./student-memory";

const idleReport: WorldReport = { nearSeat: false, walking: false, ready: false };

/**
 * Glues the pure session reducer to the browser: localStorage, the tutor's
 * "thinking" pause, and the directive ref the 3D loop reads every frame.
 */
export function useGameSession() {
  const [session, dispatch] = useReducer(sessionReducer, undefined, createInitialSession);
  const [report, setReport] = useState<WorldReport>(idleReport);
  const directiveRef = useRef<WorldDirective>({
    podStatus: { fractions: "ready", "simple-equations": "locked", "two-step-equations": "locked" },
    tutorPod: POD_ORDER[0],
    tutorThinking: false,
    seated: false,
    walkRequest: null,
    avatarPresetId: defaultAvatarPresetId,
  });

  const avatarPresetId = useSyncExternalStore(subscribeStoredAvatarPresetId, readStoredAvatarPresetId, () => defaultAvatarPresetId);

  // Hydrate from the previous visit, client-side only.
  useEffect(() => {
    dispatch({ type: "hydrate", memory: loadMemory(), now: Date.now() });
  }, []);

  // Persist the tutor's memory whenever it changes.
  useEffect(() => {
    if (session.hydrated) {
      saveMemory(session.memory);
    }
  }, [session.hydrated, session.memory]);

  // The hologram pauses before revealing a decision.
  useEffect(() => {
    if (session.lesson?.phase !== "thinking") {
      return;
    }

    const timer = window.setTimeout(() => dispatch({ type: "reveal-decision" }), THINKING_MS);
    return () => window.clearTimeout(timer);
  }, [session.lesson?.phase, session.lesson?.decision]);

  // Keep the directive ref in sync after each commit; the render loop reads it next frame.
  const directive: WorldDirective = useMemo(
    () => ({
      podStatus: {
        fractions: session.memory.progress.fractions.status,
        "simple-equations": session.memory.progress["simple-equations"].status,
        "two-step-equations": session.memory.progress["two-step-equations"].status,
      },
      tutorPod: session.tutorPod,
      tutorThinking: session.lesson?.phase === "thinking",
      seated: session.seatedAt !== null,
      walkRequest: session.walkRequest,
      avatarPresetId,
    }),
    [avatarPresetId, session.lesson?.phase, session.memory.progress, session.seatedAt, session.tutorPod, session.walkRequest],
  );

  useEffect(() => {
    directiveRef.current = directive;
  }, [directive]);

  const handlers = useMemo(
    () => ({
      sit: () => dispatch({ type: "sit" }),
      stand: () => dispatch({ type: "stand" }),
      choose: (index: number) => dispatch({ type: "choose", index }),
      step: (index: number) => dispatch({ type: "step", index }),
      why: (reasoning: { misconceptionId: string } | { text: string }) => dispatch({ type: "why", reasoning, now: Date.now() }),
      explainNext: () => dispatch({ type: "explain-next" }),
      feedback: (value: FeedbackValue) => dispatch({ type: "feedback", value, now: Date.now() }),
      continue: () => dispatch({ type: "continue", now: Date.now() }),
      disputeNote: (noteId: string) => dispatch({ type: "dispute-note", noteId, now: Date.now() }),
      selectAvatar: (presetId: string) => storeAvatarPresetId(presetId),
      openNotebook: () => dispatch({ type: "toggle-notebook", open: true }),
      closeNotebook: () => dispatch({ type: "toggle-notebook", open: false }),
      reset: () => {
        clearMemory();
        dispatch({ type: "reset", now: Date.now() });
      },
    }),
    [],
  );

  const onReport = useCallback((next: WorldReport) => setReport(next), []);

  return { session, report, directiveRef, avatarPresetId, handlers: { ...handlers, onReport } };
}
