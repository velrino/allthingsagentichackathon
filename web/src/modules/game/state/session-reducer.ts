import {
  applyFeedback,
  decideAfterFeedback,
  decideAfterPodComplete,
  eraseNoteDecision,
  noteFromReasoning,
  roamingLine,
  type Decision,
} from "../agent/mock-tutor";
import { getMisconception, getQuestion, type EquationStep, type Misconception, type Question, type StepMove } from "../content/algebra-mission";
import { POD_ORDER, type FeedbackValue, type PodId } from "../types/game";
import {
  createInitialMemory,
  pickTutorPod,
  type PodProgress,
  type StudentMemory,
  type StudentNote,
} from "./student-memory";

export type LessonPhase = "question" | "correct" | "why" | "explain" | "feedback" | "thinking" | "decision";

export type Lesson = {
  readonly pod: PodId;
  readonly question: Question;
  readonly phase: LessonPhase;
  /** For step questions: which step we're on and the lines written so far. */
  readonly stepIndex: number;
  readonly lines: readonly string[];
  /** The move the student just got wrong, if any. */
  readonly wrong: { readonly chosen: string; readonly misconception: Misconception | null } | null;
  readonly explainIndex: number;
  readonly decision: Decision | null;
  /** Reset to false the moment a wrong move happens; a question only counts when clean. */
  readonly clean: boolean;
};

export type Session = {
  readonly hydrated: boolean;
  readonly memory: StudentMemory;
  readonly lesson: Lesson | null;
  readonly seatedAt: PodId | null;
  readonly tutorPod: PodId;
  readonly tutorLine: string;
  readonly walkRequest: { readonly token: number } | null;
  /** Bumps whenever a note is written so the notebook badge can pop. */
  readonly noteFlash: number;
  readonly notebookOpen: boolean;
};

export type SessionAction =
  | { type: "hydrate"; memory: StudentMemory | null; now: number }
  | { type: "sit" }
  | { type: "stand" }
  | { type: "walk" }
  | { type: "choose"; index: number }
  | { type: "step"; index: number }
  | { type: "why"; reasoning: { misconceptionId: string } | { text: string }; now: number }
  | { type: "explain-next" }
  | { type: "feedback"; value: FeedbackValue; now: number }
  | { type: "reveal-decision" }
  | { type: "continue"; now: number }
  | { type: "dispute-note"; noteId: string; now: number }
  | { type: "toggle-notebook"; open?: boolean }
  | { type: "reset"; now: number };

export function createInitialSession(): Session {
  return {
    hydrated: false,
    memory: createInitialMemory(),
    lesson: null,
    seatedAt: null,
    tutorPod: POD_ORDER[0],
    tutorLine: "",
    walkRequest: null,
    noteFlash: 0,
    notebookOpen: false,
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function sortByBias(ids: readonly string[], bias: -1 | 0 | 1) {
  if (bias === 0) {
    return [...ids];
  }

  return [...ids].sort((a, b) => (getQuestion(a).difficulty - getQuestion(b).difficulty) * bias);
}

/** Make sure there's a question at the front of the queue, pulling from the pool when needed. */
function ensureQueue(progress: PodProgress, bias: -1 | 0 | 1): PodProgress {
  if (progress.queue.length > 0 || progress.pool.length === 0) {
    return progress;
  }

  const [next, ...rest] = sortByBias(progress.pool, bias);
  return { ...progress, queue: [next], pool: rest };
}

function startLesson(memory: StudentMemory, pod: PodId): { lesson: Lesson | null; memory: StudentMemory } {
  const progress = ensureQueue(memory.progress[pod], memory.preferences.difficultyBias);
  const questionId = progress.queue[0];

  if (!questionId) {
    return { lesson: null, memory };
  }

  const question = getQuestion(questionId);

  return {
    memory: { ...memory, progress: { ...memory.progress, [pod]: progress }, lastPod: pod },
    lesson: {
      pod,
      question,
      phase: "question",
      stepIndex: 0,
      lines: question.kind === "steps" ? [question.equation] : [],
      wrong: null,
      explainIndex: 0,
      decision: null,
      clean: true,
    },
  };
}

/** A wrong answer sends the question to the back of the line; a fresh one comes forward if it's the only one. */
function requeueCurrent(progress: PodProgress, bias: -1 | 0 | 1): PodProgress {
  const [current, ...rest] = progress.queue;

  if (!current) {
    return progress;
  }

  if (rest.length === 0 && progress.pool.length > 0) {
    const [fresh, ...pool] = sortByBias(progress.pool, bias);
    return { ...progress, queue: [fresh, current], pool };
  }

  return { ...progress, queue: [...rest, current] };
}

function mergeNote(notes: readonly StudentNote[], draft: Omit<StudentNote, "count">): StudentNote[] {
  const existing = draft.misconceptionId ? notes.find((note) => note.misconceptionId === draft.misconceptionId) : null;

  if (!existing) {
    return [{ ...draft, count: 1 }, ...notes];
  }

  return notes.map((note) =>
    note.id === existing.id
      ? { ...note, count: note.count + 1, evidence: [...new Set([...note.evidence, ...draft.evidence])] }
      : note,
  );
}

function logDecision(memory: StudentMemory, decision: Decision, now: number): StudentMemory {
  return {
    ...memory,
    decisions: [
      { id: `decision-${now}`, at: now, action: decision.action, message: decision.message, why: decision.why },
      ...memory.decisions,
    ].slice(0, 40),
  };
}

function leaveSeat(session: Session, memory: StudentMemory, tutorPod: PodId, tutorLine: string): Session {
  return { ...session, memory, lesson: null, seatedAt: null, tutorPod, tutorLine };
}

/** Stay at the desk and open the next stage right away; stand up only if it has nothing to ask. */
function continueSeated(session: Session, memory: StudentMemory, tutorPod: PodId): Session {
  const started = startLesson(memory, tutorPod);
  const tutorLine = roamingLine(started.memory, tutorPod, false);

  if (!started.lesson) {
    return leaveSeat(session, started.memory, tutorPod, tutorLine);
  }

  return { ...session, memory: started.memory, lesson: started.lesson, seatedAt: tutorPod, tutorPod, tutorLine };
}

// ── reducer ─────────────────────────────────────────────────────────────────

export function sessionReducer(session: Session, action: SessionAction): Session {
  switch (action.type) {
    case "hydrate": {
      const memory = action.memory ?? createInitialMemory();
      const tutorPod = pickTutorPod(memory);

      return {
        ...session,
        hydrated: true,
        memory,
        tutorPod,
        tutorLine: roamingLine(memory, tutorPod, action.memory !== null),
        walkRequest: null,
      };
    }

    case "walk":
      return { ...session, walkRequest: { token: (session.walkRequest?.token ?? 0) + 1 } };

    // One desk for the whole mission: sitting down resumes whatever stage the tutor is on.
    case "sit": {
      const pod = session.tutorPod;
      const status = session.memory.progress[pod].status;

      if (status === "locked" || status === "complete") {
        return session;
      }

      const started = startLesson(session.memory, pod);

      if (!started.lesson) {
        return session;
      }

      return { ...session, memory: started.memory, lesson: started.lesson, seatedAt: pod, notebookOpen: false };
    }

    case "stand":
      return { ...session, lesson: null, seatedAt: null };

    case "choose": {
      const { lesson } = session;

      if (!lesson || lesson.phase !== "question" || lesson.question.kind !== "choice") {
        return session;
      }

      const option = lesson.question.options[action.index];

      if (!option) {
        return session;
      }

      if (option.correct) {
        return { ...session, lesson: { ...lesson, phase: "correct" } };
      }

      return {
        ...session,
        lesson: {
          ...lesson,
          phase: "why",
          clean: false,
          wrong: { chosen: option.text, misconception: getMisconception(option.misconception) },
        },
      };
    }

    case "step": {
      const { lesson } = session;

      if (!lesson || lesson.phase !== "question" || lesson.question.kind !== "steps") {
        return session;
      }

      const step = lesson.question.steps[lesson.stepIndex];
      const moves = shuffledMoves(lesson.question.id, lesson.stepIndex, step);
      const move = moves[action.index];

      if (!step || !move) {
        return session;
      }

      if (move === step.correct) {
        const lines = [...lesson.lines, move.result];
        const isLast = lesson.stepIndex + 1 >= lesson.question.steps.length;

        return {
          ...session,
          lesson: { ...lesson, lines, stepIndex: lesson.stepIndex + 1, phase: isLast ? "correct" : "question" },
        };
      }

      return {
        ...session,
        lesson: {
          ...lesson,
          lines: [...lesson.lines, move.result],
          phase: "why",
          clean: false,
          wrong: { chosen: move.op, misconception: getMisconception(move.misconception) },
        },
      };
    }

    case "why": {
      const { lesson } = session;

      if (!lesson || lesson.phase !== "why") {
        return session;
      }

      const draft = noteFromReasoning(lesson.question, action.reasoning, action.now);
      const notes = mergeNote(session.memory.notes, draft);
      const misconception =
        "misconceptionId" in action.reasoning ? getMisconception(action.reasoning.misconceptionId) : lesson.wrong?.misconception ?? null;

      return {
        ...session,
        memory: { ...session.memory, notes },
        noteFlash: session.noteFlash + 1,
        lesson: {
          ...lesson,
          phase: "explain",
          explainIndex: 0,
          wrong: lesson.wrong ? { ...lesson.wrong, misconception } : lesson.wrong,
        },
      };
    }

    case "explain-next": {
      const { lesson } = session;

      if (!lesson || lesson.phase !== "explain") {
        return session;
      }

      const next = lesson.explainIndex + 1;

      if (next >= lesson.question.explanation.steps.length) {
        return { ...session, lesson: { ...lesson, phase: "feedback" } };
      }

      return { ...session, lesson: { ...lesson, explainIndex: next } };
    }

    case "feedback": {
      const { lesson } = session;

      if (!lesson || lesson.phase !== "feedback") {
        return session;
      }

      const previousStyle = session.memory.preferences.explanationStyle;
      const preferences = applyFeedback(session.memory.preferences, action.value);
      const memory: StudentMemory = { ...session.memory, preferences };
      const decision = decideAfterFeedback({
        memory,
        pod: lesson.pod,
        feedback: action.value,
        misconception: lesson.wrong?.misconception ?? null,
        previousStyle,
      });

      return {
        ...session,
        memory: logDecision(memory, decision, action.now),
        lesson: { ...lesson, phase: "thinking", decision },
      };
    }

    case "reveal-decision": {
      const { lesson } = session;

      if (!lesson || lesson.phase !== "thinking" || !lesson.decision) {
        return session;
      }

      return { ...session, lesson: { ...lesson, phase: "decision" } };
    }

    case "continue": {
      const { lesson, memory } = session;

      if (!lesson) {
        return session;
      }

      const bias = memory.preferences.difficultyBias;

      // A clean answer: count it, and either move on or let the tutor close the pod.
      if (lesson.phase === "correct") {
        const progress = memory.progress[lesson.pod];
        const [, ...rest] = progress.queue;
        const correct = lesson.clean ? progress.correct + 1 : progress.correct;
        let updated: PodProgress = { ...progress, queue: rest, correct };

        if (correct >= progress.required) {
          const nextMemory: StudentMemory = { ...memory, progress: { ...memory.progress, [lesson.pod]: updated } };
          const decision = decideAfterPodComplete(nextMemory, lesson.pod);

          return {
            ...session,
            memory: logDecision(nextMemory, decision, action.now),
            lesson: { ...lesson, phase: "thinking", decision },
          };
        }

        updated = ensureQueue(updated, bias);
        const nextMemory: StudentMemory = { ...memory, progress: { ...memory.progress, [lesson.pod]: updated } };
        const started = startLesson(nextMemory, lesson.pod);

        return started.lesson ? { ...session, memory: started.memory, lesson: started.lesson } : leaveSeat(session, nextMemory, session.tutorPod, session.tutorLine);
      }

      if (lesson.phase !== "decision" || !lesson.decision) {
        return session;
      }

      const { decision } = lesson;

      switch (decision.action) {
        case "next": {
          const progress = requeueCurrent(memory.progress[lesson.pod], bias);
          const nextMemory: StudentMemory = { ...memory, progress: { ...memory.progress, [lesson.pod]: progress } };
          const started = startLesson(nextMemory, lesson.pod);

          return started.lesson ? { ...session, memory: started.memory, lesson: started.lesson } : leaveSeat(session, nextMemory, session.tutorPod, session.tutorLine);
        }

        case "redirect": {
          const target = decision.target ?? POD_ORDER[0];
          const review = memory.progress[target];
          const [first, second, ...pool] = sortByBias(review.pool, bias);
          const reviewQueue = [first, second].filter((id): id is string => Boolean(id));
          const nextMemory: StudentMemory = {
            ...memory,
            redirected: true,
            returnTo: lesson.pod,
            // The failed question stays at the front: when the student comes back, they retry exactly what stopped them.
            progress: {
              ...memory.progress,
              [target]: { ...review, status: "review", queue: reviewQueue, pool, required: review.correct + reviewQueue.length },
            },
          };

          return continueSeated(session, nextMemory, target);
        }

        case "complete":
        case "mission-complete": {
          const target = decision.target;
          const progress = { ...memory.progress, [lesson.pod]: { ...memory.progress[lesson.pod], status: "complete" as const } };

          if (target && progress[target].status === "locked") {
            progress[target] = { ...progress[target], status: "ready" };
          }

          const nextMemory: StudentMemory = { ...memory, progress, returnTo: null };

          if (!target) {
            return leaveSeat(session, nextMemory, lesson.pod, roamingLine(nextMemory, lesson.pod, false));
          }

          return continueSeated(session, nextMemory, target);
        }

        case "erase-note":
          return session;
      }

      return session;
    }

    case "dispute-note": {
      const note = session.memory.notes.find((item) => item.id === action.noteId);

      if (!note) {
        return session;
      }

      const memory = logDecision(
        { ...session.memory, notes: session.memory.notes.filter((item) => item.id !== note.id) },
        eraseNoteDecision(note),
        action.now,
      );

      return { ...session, memory };
    }

    case "toggle-notebook":
      return { ...session, notebookOpen: action.open ?? !session.notebookOpen };

    case "reset": {
      const memory = createInitialMemory();
      const tutorPod = POD_ORDER[0];

      return {
        ...createInitialSession(),
        hydrated: true,
        memory,
        tutorPod,
        tutorLine: roamingLine(memory, tutorPod, false),
        walkRequest: null,
      };
    }
  }
}

// ── derived views used by the board ─────────────────────────────────────────

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

/** Stable shuffle so the correct move isn't always in the same slot. */
export function shuffledMoves(questionId: string, stepIndex: number, step: EquationStep | undefined): StepMove[] {
  if (!step) {
    return [];
  }

  const moves = [step.correct, ...step.distractors];

  return moves
    .map((move, index) => ({ move, key: hashString(`${questionId}:${stepIndex}:${index}`) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.move);
}
