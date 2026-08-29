"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { API } from "@/backend/api/api.endpoints";
import type {
  IApiStudentLearningResumeAttempt,
  IApiStudentLearningSnapshot,
  IApiStudentLearningStatus,
  IApiStudentTutorTurnRequest,
} from "@/backend/api/api.interface";
import { getStudentFirebaseAuth } from "@/shared/firebase/client";

import { THINKING_MS } from "../agent/mock-tutor";
import { defaultAvatarPresetId } from "../avatars/avatar-presets";
import {
  readStoredAvatarPresetId,
  storeAvatarPresetId,
  subscribeStoredAvatarPresetId,
} from "../avatars/avatar-storage";
import type { Question } from "../content/mission";
import {
  buildGameMission,
  normalizeMissionAnswer,
  slotForStageID,
  sourceQuestionID,
  sourceStageID,
  type GameMission,
} from "../content/game-mission";
import {
  readStudentMissionSession,
  type StudentMissionSession,
} from "../student-session/student-mission-session";
import { studentSessionReadyEvent } from "../student-session/use-student-presence";
import type {
  FeedbackValue,
  WorldDirective,
  WorldReport,
} from "../types/game";
import { POD_ORDER } from "../types/game";
import {
  createInitialSession,
  sessionReducer,
  shuffledMoves,
  type Session,
} from "./session-reducer";
import {
  clearMemory,
  createInitialMemory,
  loadStudentRecovery,
  normalizeStudentMemory,
  saveMemory,
  type StudentMemory,
  type StudentSessionCheckpoint,
} from "./student-memory";

const idleReport: WorldReport = {
  nearSeat: false,
  walking: false,
  ready: false,
};
const snapshotDebounceMilliseconds = 450;
const activeHeartbeatMilliseconds = 30_000;

type TutorEvidence = Omit<IApiStudentTutorTurnRequest, "mission_id">;

/**
 * Connects the game reducer to published mission content, recoverable local
 * checkpoints, Firestore snapshots and the live Gemini tutor.
 */
export function useGameSession() {
  const [session, dispatch] = useReducer(
    sessionReducer,
    undefined,
    createInitialSession,
  );
  const [report, setReport] = useState<WorldReport>(idleReport);
  const [learningSyncReady, setLearningSyncReady] = useState(false);
  const sessionRef = useRef(session);
  const revisionRef = useRef(0);
  const tokenRef = useRef("");
  const attemptReadyRef = useRef(false);
  const hydrationRef = useRef(0);
  const skipLocalSaveRef = useRef(false);
  const tutorRequestRef = useRef(0);
  const lastPauseAtRef = useRef(0);
  const directiveRef = useRef<WorldDirective>({
    podStatus: {
      fractions: "ready",
      "simple-equations": "locked",
      "two-step-equations": "locked",
    },
    tutorPod: POD_ORDER[0],
    tutorThinking: false,
    seated: false,
    walkRequest: null,
    avatarPresetId: defaultAvatarPresetId,
  });

  const avatarPresetId = useSyncExternalStore(
    subscribeStoredAvatarPresetId,
    readStoredAvatarPresetId,
    () => defaultAvatarPresetId,
  );

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // The session gate dispatches this event only after anonymous auth and the
  // published mission payload are ready. The newer of Firestore and the local
  // checkpoint wins, so an offline click made just before refresh is not lost.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const missionSession = readStudentMissionSession();
      if (!missionSession) {
        return;
      }

      const generation = ++hydrationRef.current;
      const mission = buildGameMission(missionSession.mission);
      const local = loadStudentRecovery(
        mission,
        studentRecoveryID(missionSession),
      );
      revisionRef.current = local?.revision ?? 0;
      skipLocalSaveRef.current = true;
      dispatch({
        type: "hydrate",
        mission,
        memory: local?.memory ?? null,
        checkpoint: local?.checkpoint,
        now: Date.now(),
      });
      setLearningSyncReady(false);

      const user = getStudentFirebaseAuth().currentUser;
      if (!user?.isAnonymous) {
        return;
      }

      try {
        const idToken = await user.getIdToken();
        tokenRef.current = idToken;
        const response = await API.users.studentLearning(
          idToken,
          missionSession.missionId,
        );
        if (cancelled || generation !== hydrationRef.current) {
          return;
        }

        attemptReadyRef.current = response.attempt !== null;
        const latestLocal =
          loadStudentRecovery(mission, studentRecoveryID(missionSession)) ??
          local;
        const remoteRevision = response.attempt?.snapshot.revision ?? 0;
        const localWins =
          latestLocal !== null &&
          latestLocal.revision > remoteRevision &&
          response.attempt?.status !== "completed";
        const memory = localWins
          ? latestLocal.memory
          : response.attempt
            ? memoryFromLearningAttempt(response.attempt, mission)
            : latestLocal?.memory ?? createInitialMemory(mission);
        const checkpoint = localWins
          ? latestLocal.checkpoint
          : response.attempt
            ? checkpointFromLearningAttempt(response.attempt, mission)
            : latestLocal?.checkpoint ?? null;

        revisionRef.current = Math.max(
          latestLocal?.revision ?? 0,
          remoteRevision,
        );
        skipLocalSaveRef.current = true;
        dispatch({
          type: "hydrate",
          mission,
          memory,
          checkpoint,
          now: Date.now(),
        });
      } catch {
        // The local recovery remains playable while the API is unavailable.
      } finally {
        if (!cancelled && generation === hydrationRef.current) {
          setLearningSyncReady(true);
        }
      }
    }

    const hydrateWhenReady = () => void hydrate();
    window.addEventListener(studentSessionReadyEvent, hydrateWhenReady);
    if (readStudentMissionSession()) {
      void hydrate();
    }

    return () => {
      cancelled = true;
      window.removeEventListener(studentSessionReadyEvent, hydrateWhenReady);
    };
  }, []);

  const syncSnapshot = useCallback(
    async (
      statusOverride?: IApiStudentLearningStatus,
      keepalive = false,
    ) => {
      const activeSession = sessionRef.current;
      const missionSession = readStudentMissionSession();
      const user = getStudentFirebaseAuth().currentUser;
      if (
        !activeSession.hydrated ||
        !missionSession ||
        !user?.isAnonymous ||
        missionSession.missionId !== activeSession.mission.id
      ) {
        return false;
      }

      let idToken = tokenRef.current;
      if (!keepalive) {
        try {
          idToken = await user.getIdToken();
          tokenRef.current = idToken;
        } catch {
          return false;
        }
      }
      if (!idToken) {
        return false;
      }

      const revision = nextRevision(revisionRef);
      const checkpoint = checkpointFromSession(activeSession);
      saveMemory(
        activeSession.memory,
        studentRecoveryID(missionSession),
        checkpoint,
        revision,
      );

      try {
        const response = await API.users.saveStudentLearning(
          idToken,
          {
            mission_id: missionSession.missionId,
            status:
              statusOverride ??
              learningStatus(
                activeSession.memory,
                activeSession.lesson?.phase,
              ),
            snapshot: toLearningSnapshot(
              activeSession,
              checkpoint,
              revision,
              keepalive,
            ),
          },
          { keepalive },
        );
        attemptReadyRef.current = response.attempt !== null;
        revisionRef.current = Math.max(
          revisionRef.current,
          response.attempt?.snapshot.revision ?? 0,
        );
        return true;
      } catch {
        // Local recovery is authoritative until a later heartbeat succeeds.
        return false;
      }
    },
    [],
  );

  // Save the exact board phase synchronously on every reducer commit. Notes,
  // model observations and event history are deliberately stripped locally.
  useEffect(() => {
    if (!session.hydrated) {
      return;
    }
    if (skipLocalSaveRef.current) {
      skipLocalSaveRef.current = false;
      return;
    }
    const missionSession = readStudentMissionSession();
    if (!missionSession || missionSession.missionId !== session.mission.id) {
      return;
    }

    const revision = nextRevision(revisionRef);
    saveMemory(
      session.memory,
      studentRecoveryID(missionSession),
      checkpointFromSession(session),
      revision,
    );
  }, [session]);

  // Debounced writes capture each meaningful step. A heartbeat also proves the
  // tab is still active while a student spends time reading an explanation.
  useEffect(() => {
    if (!session.hydrated || !learningSyncReady) {
      return;
    }

    const timer = window.setTimeout(
      () => void syncSnapshot(),
      snapshotDebounceMilliseconds,
    );
    return () => window.clearTimeout(timer);
  }, [learningSyncReady, session, syncSnapshot]);

  useEffect(() => {
    if (!learningSyncReady) {
      return;
    }

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncSnapshot();
      }
    }, activeHeartbeatMilliseconds);

    return () => window.clearInterval(heartbeat);
  }, [learningSyncReady, syncSnapshot]);

  // A final keepalive checkpoint marks the attempt paused immediately. The
  // queued watchdog turns it into abandoned only if no newer heartbeat arrives.
  useEffect(() => {
    const pause = () => {
      const now = Date.now();
      if (now - lastPauseAtRef.current < 500) {
        return;
      }
      lastPauseAtRef.current = now;
      void syncSnapshot("paused", true);
    };
    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") {
        pause();
      } else {
        void syncSnapshot();
      }
    };

    window.addEventListener("pagehide", pause);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      window.removeEventListener("pagehide", pause);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [syncSnapshot]);

  const requestTutorTurn = useCallback(
    async (renderedQuestionID: string, evidence: TutorEvidence) => {
      const requestVersion = ++tutorRequestRef.current;
      const missionSession = readStudentMissionSession();
      const user = getStudentFirebaseAuth().currentUser;
      if (!missionSession || !user?.isAnonymous) {
        return;
      }

      if (!attemptReadyRef.current && !(await syncSnapshot())) {
        return;
      }

      try {
        const idToken = await user.getIdToken();
        tokenRef.current = idToken;
        const response = await API.users.studentTutorTurn(idToken, {
          mission_id: missionSession.missionId,
          ...evidence,
        });
        if (requestVersion !== tutorRequestRef.current) {
          return;
        }
        dispatch({
          type: "apply-tutor-turn",
          questionId: renderedQuestionID,
          message: response.turn.message,
          whyPrompt: response.turn.why_prompt,
          explanationSteps: response.turn.explanation_steps,
          explanationStyle: response.turn.explanation_style,
          difficultyBias: response.turn.difficulty_bias,
        });
      } catch {
        // The deterministic tutor copy remains available if Gemini is offline.
      }
    },
    [syncSnapshot],
  );

  // The hologram pauses before revealing a decision.
  useEffect(() => {
    if (session.lesson?.phase !== "thinking") {
      return;
    }

    const timer = window.setTimeout(
      () => dispatch({ type: "reveal-decision" }),
      THINKING_MS,
    );
    return () => window.clearTimeout(timer);
  }, [session.lesson?.decision, session.lesson?.phase]);

  const directive: WorldDirective = useMemo(
    () => ({
      podStatus: {
        fractions: session.memory.progress.fractions.status,
        "simple-equations":
          session.memory.progress["simple-equations"].status,
        "two-step-equations":
          session.memory.progress["two-step-equations"].status,
      },
      tutorPod: session.tutorPod,
      tutorThinking: session.lesson?.phase === "thinking",
      seated: session.seatedAt !== null,
      walkRequest: session.walkRequest,
      avatarPresetId,
    }),
    [
      avatarPresetId,
      session.lesson?.phase,
      session.memory.progress,
      session.seatedAt,
      session.tutorPod,
      session.walkRequest,
    ],
  );

  useEffect(() => {
    directiveRef.current = directive;
  }, [directive]);

  const handlers = useMemo(
    () => ({
      sit: () => dispatch({ type: "sit" }),
      stand: () => dispatch({ type: "stand" }),
      choose: (index: number) => {
        const lesson = session.lesson;
        if (lesson?.question.kind !== "choice") {
          return;
        }
        const option = lesson.question.options[index];
        if (!option) {
          return;
        }
        const now = Date.now();
        const outcome = option.correct ? "correct" : "incorrect";
        const eventID = learningEventID(
          now,
          session.memory.eventSequence + 1,
        );
        dispatch({ type: "choose", index, now });
        void requestTutorTurn(lesson.question.id, {
          event_id: eventID,
          type: "answer",
          stage_id: sourceStageID(
            session.mission,
            lesson.pod,
            lesson.question.id,
          ),
          question_id: sourceQuestionID(session.mission, lesson.question.id),
          prompt: questionPrompt(lesson.question),
          student_response: option.text,
          expected_answer: expectedAnswer(lesson.question),
          outcome,
          explicit_reasoning: "",
          feedback: "",
        });
      },
      writeAnswer: (text: string) => {
        const lesson = session.lesson;
        const answer = text.trim();
        if (lesson?.question.kind !== "choice" || answer.length === 0) {
          return;
        }
        const now = Date.now();
        const expected = expectedAnswer(lesson.question);
        const outcome =
          expected !== "" &&
          normalizeMissionAnswer(answer) === normalizeMissionAnswer(expected)
            ? "correct"
            : "incorrect";
        const eventID = learningEventID(
          now,
          session.memory.eventSequence + 1,
        );
        dispatch({ type: "write-answer", text: answer, now });
        void requestTutorTurn(lesson.question.id, {
          event_id: eventID,
          type: "answer",
          stage_id: sourceStageID(
            session.mission,
            lesson.pod,
            lesson.question.id,
          ),
          question_id: sourceQuestionID(session.mission, lesson.question.id),
          prompt: questionPrompt(lesson.question),
          student_response: answer,
          expected_answer: expected,
          outcome,
          explicit_reasoning: "",
          feedback: "",
        });
      },
      step: (index: number) => {
        const lesson = session.lesson;
        if (lesson?.question.kind !== "steps") {
          return;
        }
        const expectedStep = lesson.question.steps[lesson.stepIndex];
        const move = shuffledMoves(
          lesson.question.id,
          lesson.stepIndex,
          expectedStep,
        )[index];
        if (!move || !expectedStep) {
          return;
        }
        const now = Date.now();
        const outcome = move === expectedStep.correct ? "correct" : "incorrect";
        const eventID = learningEventID(
          now,
          session.memory.eventSequence + 1,
        );
        dispatch({ type: "step", index, now });
        void requestTutorTurn(lesson.question.id, {
          event_id: eventID,
          type: "answer",
          stage_id: sourceStageID(
            session.mission,
            lesson.pod,
            lesson.question.id,
          ),
          question_id: sourceQuestionID(session.mission, lesson.question.id),
          prompt: questionPrompt(lesson.question),
          student_response: `${move.op} → ${move.result}`,
          expected_answer: `${expectedStep.correct.op} → ${expectedStep.correct.result}`,
          outcome,
          explicit_reasoning: "",
          feedback: "",
        });
      },
      why: (reasoning: { misconceptionId: string } | { text: string }) => {
        const lesson = session.lesson;
        if (!lesson || lesson.phase !== "why") {
          return;
        }
        const now = Date.now();
        const reasoningText =
          "text" in reasoning
            ? reasoning.text
            : session.mission.misconceptions.find(
                (item) => item.id === reasoning.misconceptionId,
              )?.reasoning ?? reasoning.misconceptionId;
        const eventID = learningEventID(
          now,
          session.memory.eventSequence + 1,
        );
        dispatch({ type: "why", reasoning, now });
        void requestTutorTurn(lesson.question.id, {
          event_id: eventID,
          type: "reasoning",
          stage_id: sourceStageID(
            session.mission,
            lesson.pod,
            lesson.question.id,
          ),
          question_id: sourceQuestionID(session.mission, lesson.question.id),
          prompt:
            lesson.whyPrompt ||
            `Why did you choose ${lesson.wrong?.chosen ?? "that answer"}?`,
          student_response: reasoningText,
          expected_answer: expectedAnswer(lesson.question),
          outcome: "support",
          explicit_reasoning: reasoningText,
          feedback: "",
        });
      },
      explainNext: () => dispatch({ type: "explain-next" }),
      feedback: (value: FeedbackValue) => {
        const lesson = session.lesson;
        if (!lesson || lesson.phase !== "feedback") {
          return;
        }
        const now = Date.now();
        const eventID = learningEventID(
          now,
          session.memory.eventSequence + 1,
        );
        dispatch({ type: "feedback", value, now });
        void requestTutorTurn(lesson.question.id, {
          event_id: eventID,
          type: "feedback",
          stage_id: sourceStageID(
            session.mission,
            lesson.pod,
            lesson.question.id,
          ),
          question_id: sourceQuestionID(session.mission, lesson.question.id),
          prompt: "How was that explanation?",
          student_response: value,
          expected_answer: "",
          outcome: value === "helpful" ? "correct" : "support",
          explicit_reasoning: "",
          feedback: value,
        });
      },
      continue: () => dispatch({ type: "continue", now: Date.now() }),
      selectAvatar: (presetId: string) => storeAvatarPresetId(presetId),
      reset: () => {
        const missionSession = readStudentMissionSession();
        const recoveryID = missionSession
          ? studentRecoveryID(missionSession)
          : session.mission.id;
        clearMemory(recoveryID);
        revisionRef.current = 0;
        dispatch({ type: "reset", now: Date.now() });
      },
    }),
    [requestTutorTurn, session],
  );

  const onReport = useCallback((next: WorldReport) => setReport(next), []);

  return {
    session,
    report,
    directiveRef,
    avatarPresetId,
    handlers: { ...handlers, onReport },
  };
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
  if (phase || memory.eventSequence > 0) {
    return "learning";
  }

  return "exploring";
}

function checkpointFromSession(session: Session): StudentSessionCheckpoint {
  const lesson = session.lesson;
  return {
    stageId: lesson?.pod ?? session.tutorPod,
    questionId: lesson?.question.id ?? "",
    phase: lesson?.phase ?? "",
    stepIndex: lesson?.stepIndex ?? 0,
    explainIndex: lesson?.explainIndex ?? 0,
    lines: lesson ? [...lesson.lines] : [],
    wrongChoice: lesson?.wrong?.chosen ?? "",
    wrongMisconceptionId: lesson?.wrong?.misconception?.id ?? "",
    decisionAction: lesson?.decision?.action ?? "",
    decisionTarget: lesson?.decision?.target ?? "",
    decisionMessage: lesson?.decision?.message ?? "",
    decisionWhy: lesson?.decision?.why ?? "",
    tutorMessage: lesson?.tutorMessage ?? "",
    whyPrompt: lesson?.whyPrompt ?? "",
    clean: lesson?.clean ?? true,
    seated: session.seatedAt !== null && lesson !== null,
  };
}

function toLearningSnapshot(
  session: Session,
  checkpoint: StudentSessionCheckpoint,
  revision: number,
  compact = false,
): IApiStudentLearningSnapshot {
  const { memory, mission } = session;
  const notes = compact ? memory.notes.slice(0, 8) : memory.notes;
  const decisions = compact ? memory.decisions.slice(0, 8) : memory.decisions;
  const events = compact ? memory.events.slice(-16) : memory.events;
  return {
    revision,
    progress: POD_ORDER.map((podId) => ({
      stage_id: sourceStageID(mission, podId),
      status: memory.progress[podId].status,
      queue: [...memory.progress[podId].queue],
      pool: [...memory.progress[podId].pool],
      correct: memory.progress[podId].correct,
      required: memory.progress[podId].required,
    })),
    notes: notes.map((note) => ({
      id: note.id,
      misconception_id: note.misconceptionId ?? "",
      text: note.text,
      kind: note.kind,
      skill: sourceStageID(mission, note.skill),
      evidence: [...note.evidence],
      count: note.count,
      created_at: note.createdAt,
    })),
    preferences: {
      explanation_style: memory.preferences.explanationStyle,
      difficulty_bias: memory.preferences.difficultyBias,
    },
    decisions: decisions.map((decision) => ({
      id: decision.id,
      at: decision.at,
      action: decision.action,
      message: decision.message,
      why: decision.why,
    })),
    events: events.map((event) => ({
      id: event.id,
      sequence: event.sequence,
      type: event.type,
      stage_id: sourceStageID(mission, event.stageId, event.questionId),
      question_id: sourceQuestionID(mission, event.questionId),
      title: event.title,
      detail: event.detail,
      outcome: event.outcome,
      occurred_at: event.occurredAt,
    })),
    redirected: memory.redirected,
    return_to: memory.returnTo
      ? sourceStageID(mission, memory.returnTo)
      : "",
    last_pod: memory.lastPod ? sourceStageID(mission, memory.lastPod) : "",
    checkpoint: {
      stage_id: sourceStageID(
        mission,
        checkpoint.stageId,
        checkpoint.questionId,
      ),
      question_id: checkpoint.questionId,
      phase: checkpoint.phase,
      step_index: checkpoint.stepIndex,
      explain_index: checkpoint.explainIndex,
      lines: [...checkpoint.lines],
      wrong_choice: checkpoint.wrongChoice,
      wrong_misconception_id: checkpoint.wrongMisconceptionId,
      decision_action: checkpoint.decisionAction,
      decision_target: checkpoint.decisionTarget
        ? sourceStageID(mission, checkpoint.decisionTarget)
        : "",
      decision_message: checkpoint.decisionMessage,
      decision_why: checkpoint.decisionWhy,
      tutor_message: checkpoint.tutorMessage,
      why_prompt: checkpoint.whyPrompt,
      clean: checkpoint.clean,
      seated: checkpoint.seated,
    },
  };
}

function memoryFromLearningAttempt(
  attempt: IApiStudentLearningResumeAttempt,
  mission: GameMission,
): StudentMemory {
  const initial = createInitialMemory(mission);
  const progress = { ...initial.progress };
  for (const stage of attempt.snapshot.progress) {
    const pod = slotForStageID(mission, stage.stage_id);
    if (!pod) {
      continue;
    }
    progress[pod] = {
      status: isPodStatus(stage.status) ? stage.status : progress[pod].status,
      queue: stage.queue.filter((id) =>
        mission.questions.some((question) => question.id === id),
      ),
      pool: stage.pool.filter((id) =>
        mission.questions.some((question) => question.id === id),
      ),
      correct: stage.correct,
      required: stage.required,
    };
  }

  return normalizeStudentMemory(
    {
      version: 2,
      progress,
      preferences: {
        explanationStyle:
          attempt.snapshot.preferences.explanation_style === "visual"
            ? "visual"
            : "steps",
        difficultyBias: normalizeDifficultyBias(
          attempt.snapshot.preferences.difficulty_bias,
        ),
      },
      eventSequence: attempt.last_event_sequence,
      redirected: attempt.snapshot.redirected,
      returnTo: slotForStageID(mission, attempt.snapshot.return_to),
      lastPod: slotForStageID(mission, attempt.snapshot.last_pod),
    },
    mission,
  );
}

function checkpointFromLearningAttempt(
  attempt: IApiStudentLearningResumeAttempt,
  mission: GameMission,
): StudentSessionCheckpoint | null {
  const checkpoint = attempt.snapshot.checkpoint;
  const stage = slotForStageID(mission, checkpoint.stage_id);
  if (!stage || !checkpoint.seated || !checkpoint.question_id) {
    return null;
  }

  return {
    stageId: stage,
    questionId: checkpoint.question_id,
    phase: checkpoint.phase,
    stepIndex: checkpoint.step_index,
    explainIndex: checkpoint.explain_index,
    lines: checkpoint.lines,
    wrongChoice: checkpoint.wrong_choice,
    wrongMisconceptionId: checkpoint.wrong_misconception_id,
    decisionAction: isDecisionAction(checkpoint.decision_action)
      ? checkpoint.decision_action
      : "",
    decisionTarget:
      slotForStageID(mission, checkpoint.decision_target) ?? "",
    decisionMessage: checkpoint.decision_message,
    decisionWhy: checkpoint.decision_why,
    tutorMessage: checkpoint.tutor_message,
    whyPrompt: checkpoint.why_prompt,
    clean: checkpoint.clean,
    seated: checkpoint.seated,
  };
}

function questionPrompt(question: Question) {
  return question.kind === "choice" ? question.prompt : question.equation;
}

function expectedAnswer(question: Question) {
  if (question.kind === "choice") {
    return question.options.find((option) => option.correct)?.text ?? "";
  }

  return question.steps.at(-1)?.correct.result ?? "";
}

function learningEventID(now: number, sequence: number) {
  return `event-${now}-${sequence}`;
}

function nextRevision(reference: { current: number }) {
  const revision = Math.max(Date.now(), reference.current + 1);
  reference.current = revision;
  return revision;
}

function isPodStatus(
  value: string,
): value is StudentMemory["progress"][(typeof POD_ORDER)[number]]["status"] {
  return ["locked", "ready", "review", "complete"].includes(value);
}

function isDecisionAction(
  value: string,
): value is Exclude<StudentSessionCheckpoint["decisionAction"], ""> {
  return [
    "next",
    "complete",
    "redirect",
    "mission-complete",
    "erase-note",
  ].includes(value);
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

function studentRecoveryID(session: StudentMissionSession) {
  const anonymousUID = getStudentFirebaseAuth().currentUser?.uid ?? "student";
  return session.attemptId || `${anonymousUID}:${session.missionId}`;
}
