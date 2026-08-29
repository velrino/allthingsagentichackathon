import { POD_PLANS, type NoteKind } from "../content/algebra-mission";
import { POD_ORDER, type ExplanationStyle, type PodId, type PodStatus } from "../types/game";

/** One thing the tutor wrote down about how this student thinks. */
export type StudentNote = {
  readonly id: string;
  readonly misconceptionId: string | null;
  readonly text: string;
  readonly kind: NoteKind;
  readonly skill: PodId;
  /** Question ids that produced this note. */
  readonly evidence: readonly string[];
  readonly count: number;
  readonly createdAt: number;
};

export type PodProgress = {
  readonly status: PodStatus;
  /** Question ids still to answer; the first one is the current question. */
  readonly queue: readonly string[];
  /** Spare questions for retries and reviews. */
  readonly pool: readonly string[];
  readonly correct: number;
  readonly required: number;
};

export type DecisionAction = "next" | "complete" | "redirect" | "mission-complete" | "erase-note";

export type DecisionEntry = {
  readonly id: string;
  readonly at: number;
  readonly action: DecisionAction;
  readonly message: string;
  readonly why: string;
};

export type StudentPreferences = {
  readonly explanationStyle: ExplanationStyle;
  readonly difficultyBias: -1 | 0 | 1;
};

export type LearningEventType =
  | "question"
  | "answer"
  | "reasoning"
  | "feedback"
  | "adaptation"
  | "mastery";

export type LearningEventOutcome =
  | "neutral"
  | "correct"
  | "incorrect"
  | "support"
  | "complete";

/** Observable evidence used to build the teacher-facing learning flow. */
export type LearningEvent = {
  readonly id: string;
  readonly sequence: number;
  readonly type: LearningEventType;
  readonly stageId: PodId;
  readonly questionId: string;
  readonly title: string;
  readonly detail: string;
  readonly outcome: LearningEventOutcome;
  readonly occurredAt: number;
};

/** Everything the tutor remembers about one student. Firestore document shape, mirrored in localStorage for the mock. */
export type StudentMemory = {
  readonly version: 1;
  readonly notes: readonly StudentNote[];
  readonly preferences: StudentPreferences;
  readonly progress: Record<PodId, PodProgress>;
  readonly decisions: readonly DecisionEntry[];
  readonly events: readonly LearningEvent[];
  /** The tutor redirects at most once per mission, so the demo never ping-pongs. */
  readonly redirected: boolean;
  /** Pod to go back to once a review is done. */
  readonly returnTo: PodId | null;
  readonly lastPod: PodId | null;
};

const STORAGE_KEY = "classgame.student.v1";

export function createInitialMemory(): StudentMemory {
  const progress = {} as Record<PodId, PodProgress>;

  for (const podId of POD_ORDER) {
    const plan = POD_PLANS[podId];

    progress[podId] = {
      status: podId === POD_ORDER[0] ? "ready" : "locked",
      queue: [...plan.primary],
      pool: [...plan.reinforcement],
      correct: 0,
      required: plan.required,
    };
  }

  return {
    version: 1,
    notes: [],
    preferences: { explanationStyle: "steps", difficultyBias: 0 },
    progress,
    decisions: [],
    events: [],
    redirected: false,
    returnTo: null,
    lastPod: null,
  };
}

export function loadMemory(): StudentMemory | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StudentMemory>;

    return parsed.version === 1 ? normalizeStudentMemory(parsed) : null;
  } catch {
    return null;
  }
}

export function normalizeStudentMemory(
  value: Partial<StudentMemory>,
): StudentMemory {
  const initial = createInitialMemory();
  const progress = { ...initial.progress };

  for (const podId of POD_ORDER) {
    const storedProgress = value.progress?.[podId];
    if (storedProgress) {
      progress[podId] = {
        status: storedProgress.status,
        queue: [...storedProgress.queue],
        pool: [...storedProgress.pool],
        correct: storedProgress.correct,
        required: storedProgress.required,
      };
    }
  }

  return {
    version: 1,
    notes: Array.isArray(value.notes) ? value.notes : [],
    preferences: value.preferences ?? initial.preferences,
    progress,
    decisions: Array.isArray(value.decisions) ? value.decisions : [],
    events: Array.isArray(value.events) ? value.events : [],
    redirected: value.redirected ?? false,
    returnTo: value.returnTo ?? null,
    lastPod: value.lastPod ?? null,
  };
}

export function saveMemory(memory: StudentMemory) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Storage is a convenience here; the session keeps working without it.
  }
}

export function clearMemory() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** The pod the tutor should be standing at for this memory. */
export function pickTutorPod(memory: StudentMemory): PodId {
  const review = POD_ORDER.find((podId) => memory.progress[podId].status === "review");

  if (review) {
    return review;
  }

  return POD_ORDER.find((podId) => memory.progress[podId].status === "ready") ?? POD_ORDER[POD_ORDER.length - 1];
}

export function isMissionComplete(memory: StudentMemory) {
  return POD_ORDER.every((podId) => memory.progress[podId].status === "complete");
}
