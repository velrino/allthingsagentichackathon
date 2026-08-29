"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";

import { API } from "@/backend/api/api.endpoints";
import type {
  IApiStudentLearningAttempt,
  IApiStudentLearningSnapshot,
  IApiStudentLearningStatus,
} from "@/backend/api/api.interface";
import { getStudentFirebaseAuth } from "@/shared/firebase/client";

import { defaultAvatarPresetId } from "../avatars/avatar-presets";
import { readStoredAvatarPresetId, storeAvatarPresetId, subscribeStoredAvatarPresetId } from "../avatars/avatar-storage";
import { THINKING_MS } from "../agent/mock-tutor";
import type { FeedbackValue, WorldDirective, WorldReport } from "../types/game";
import { POD_ORDER } from "../types/game";
import {
  readStudentMissionSession,
  type StudentMissionSession,
} from "../student-session/student-mission-session";
import { studentSessionReadyEvent } from "../student-session/use-student-presence";
import { createInitialSession, sessionReducer } from "./session-reducer";
import {
  clearMemory,
  createInitialMemory,
  loadMemory,
  normalizeStudentMemory,
  saveMemory,
  type DecisionAction,
  type LearningEventOutcome,
  type LearningEventType,
  type StudentMemory,
} from "./student-memory";

const idleReport: WorldReport = { nearSeat: false, walking: false, ready: false };

/**
 * Glues the pure session reducer to the browser: localStorage, the tutor's
 * "thinking" pause, and the directive ref the 3D loop reads every frame.
 */
export function useGameSession() {
  const [session, dispatch] = useReducer(sessionReducer, undefined, createInitialSession);
  const [report, setReport] = useState<WorldReport>(idleReport);
  const [learningSyncReady, setLearningSyncReady] = useState(false);
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

  // Retrieve this anonymous student's current attempt and persistent memory
  // after the mission code has been accepted. This keeps a resumed session
  // stateful across browsers instead of relying only on localStorage.
  useEffect(() => {
    let cancelled = false;

    async function hydrateRemoteAttempt() {
      const user = getStudentFirebaseAuth().currentUser;
      const missionSession = readStudentMissionSession();
      if (!user?.isAnonymous || !missionSession) {
        return;
      }

      setLearningSyncReady(false);
      try {
        const idToken = await user.getIdToken();
        const response = await API.users.studentLearning(
          idToken,
          missionSession.missionId,
        );
        if (!cancelled) {
          dispatch({
            type: "hydrate",
            memory: response.attempt
              ? memoryFromLearningAttempt(response.attempt)
              : memoryFromPersistentProfile(missionSession.learningMemory),
            now: Date.now(),
          });
        }
      } catch {
        // The local memory remains usable when the API is temporarily offline.
      } finally {
        if (!cancelled) {
          setLearningSyncReady(true);
        }
      }
    }

    const hydrateWhenReady = () => void hydrateRemoteAttempt();
    window.addEventListener(studentSessionReadyEvent, hydrateWhenReady);
    if (readStudentMissionSession()) {
      void hydrateRemoteAttempt();
    }

    return () => {
      cancelled = true;
      window.removeEventListener(studentSessionReadyEvent, hydrateWhenReady);
    };
  }, []);

  // Persist the tutor's memory whenever it changes.
  useEffect(() => {
    if (session.hydrated) {
      saveMemory(session.memory);
    }
  }, [session.hydrated, session.memory]);

  // Debounce snapshots while the student plays. Completion triggers the
  // backend's Gemini learning-trace workflow; intermediate snapshots provide
  // live evidence and recovery after refresh.
  useEffect(() => {
    if (!session.hydrated || !learningSyncReady) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const user = getStudentFirebaseAuth().currentUser;
      const missionSession = readStudentMissionSession();
      if (!user?.isAnonymous || !missionSession) {
        return;
      }

      try {
        const idToken = await user.getIdToken();
        await API.users.saveStudentLearning(idToken, {
          mission_id: missionSession.missionId,
          status: learningStatus(session.memory, session.lesson?.phase),
          snapshot: toLearningSnapshot(session.memory),
        });
      } catch {
        // Sync is best effort. localStorage still protects the active session.
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [learningSyncReady, session.hydrated, session.lesson?.phase, session.memory]);

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
      choose: (index: number) => dispatch({ type: "choose", index, now: Date.now() }),
      step: (index: number) => dispatch({ type: "step", index, now: Date.now() }),
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

function learningStatus(
  memory: StudentMemory,
  phase: string | undefined,
): IApiStudentLearningStatus {
  if (POD_ORDER.every((podId) => memory.progress[podId].status === "complete")) {
    return "completed";
  }
  if (phase === "thinking") {
    return "thinking";
  }
  if (POD_ORDER.some((podId) => memory.progress[podId].status === "review")) {
    return "reviewing";
  }
  if (memory.events.length > 0) {
    return "learning";
  }

  return "exploring";
}

function memoryFromPersistentProfile(
  profile: StudentMissionSession["learningMemory"] | undefined,
): StudentMemory {
  const initial = createInitialMemory();
  const explanationStyle =
    profile?.preferredExplanation === "visual" ? "visual" : "steps";

  return {
    ...initial,
    preferences: {
      explanationStyle,
      difficultyBias: profile?.improvementAreas.length ? -1 : 0,
    },
  };
}

function toLearningSnapshot(memory: StudentMemory): IApiStudentLearningSnapshot {
  return {
    progress: POD_ORDER.map((podId) => ({
      stage_id: podId,
      status: memory.progress[podId].status,
      queue: [...memory.progress[podId].queue],
      pool: [...memory.progress[podId].pool],
      correct: memory.progress[podId].correct,
      required: memory.progress[podId].required,
    })),
    notes: memory.notes.map((note) => ({
      id: note.id,
      misconception_id: note.misconceptionId ?? "",
      text: note.text,
      kind: note.kind,
      skill: note.skill,
      evidence: [...note.evidence],
      count: note.count,
      created_at: note.createdAt,
    })),
    preferences: {
      explanation_style: memory.preferences.explanationStyle,
      difficulty_bias: memory.preferences.difficultyBias,
    },
    decisions: memory.decisions.map((decision) => ({
      id: decision.id,
      at: decision.at,
      action: decision.action,
      message: decision.message,
      why: decision.why,
    })),
    events: memory.events.map((event) => ({
      id: event.id,
      sequence: event.sequence,
      type: event.type,
      stage_id: event.stageId,
      question_id: event.questionId,
      title: event.title,
      detail: event.detail,
      outcome: event.outcome,
      occurred_at: event.occurredAt,
    })),
    redirected: memory.redirected,
    return_to: memory.returnTo ?? "",
    last_pod: memory.lastPod ?? "",
  };
}

function memoryFromLearningAttempt(
  attempt: IApiStudentLearningAttempt,
): StudentMemory {
  const initial = createInitialMemory();
  const progress = { ...initial.progress };
  for (const stage of attempt.snapshot.progress) {
    if (!isPodId(stage.stage_id)) {
      continue;
    }
    progress[stage.stage_id] = {
      status: isPodStatus(stage.status) ? stage.status : progress[stage.stage_id].status,
      queue: stage.queue,
      pool: stage.pool,
      correct: stage.correct,
      required: stage.required,
    };
  }

  return normalizeStudentMemory({
    version: 1,
    progress,
    notes: attempt.snapshot.notes
      .filter((note) => isPodId(note.skill))
      .map((note) => ({
        id: note.id,
        misconceptionId: note.misconception_id || null,
        text: note.text,
        kind: note.kind === "habit" ? "habit" : "misconception",
        skill: note.skill as (typeof POD_ORDER)[number],
        evidence: note.evidence,
        count: note.count,
        createdAt: note.created_at,
      })),
    preferences: {
      explanationStyle:
        attempt.snapshot.preferences.explanation_style === "visual"
          ? "visual"
          : "steps",
      difficultyBias: normalizeDifficultyBias(
        attempt.snapshot.preferences.difficulty_bias,
      ),
    },
    decisions: attempt.snapshot.decisions.map((decision) => ({
      id: decision.id,
      at: decision.at,
      action: decision.action as DecisionAction,
      message: decision.message,
      why: decision.why,
    })),
    events: attempt.snapshot.events
      .filter((event) => isPodId(event.stage_id))
      .map((event) => ({
        id: event.id,
        sequence: event.sequence,
        type: event.type as LearningEventType,
        stageId: event.stage_id as (typeof POD_ORDER)[number],
        questionId: event.question_id,
        title: event.title,
        detail: event.detail,
        outcome: event.outcome as LearningEventOutcome,
        occurredAt: event.occurred_at,
      })),
    redirected: attempt.snapshot.redirected,
    returnTo: isPodId(attempt.snapshot.return_to)
      ? attempt.snapshot.return_to
      : null,
    lastPod: isPodId(attempt.snapshot.last_pod)
      ? attempt.snapshot.last_pod
      : null,
  });
}

function isPodId(value: string): value is (typeof POD_ORDER)[number] {
  return POD_ORDER.some((podId) => podId === value);
}

function isPodStatus(
  value: string,
): value is StudentMemory["progress"][(typeof POD_ORDER)[number]]["status"] {
  return ["locked", "ready", "review", "complete"].includes(value);
}

function normalizeDifficultyBias(value: number): -1 | 0 | 1 {
  if (value < 0) {
    return -1;
  }
  if (value > 0) {
    return 1;
  }

  return 0;
}
