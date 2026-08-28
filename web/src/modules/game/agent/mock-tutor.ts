/**
 * The mock tutor. Every function here is pure and is the exact boundary the
 * real Gemini 3.5+-backed agent will replace: same inputs, same outputs, just async.
 */
import {
  GUESSED_ID,
  MISCONCEPTIONS,
  POD_PLANS,
  TUTOR_NAME,
  getMisconception,
  type Misconception,
  type Question,
} from "../content/algebra-mission";
import type { DecisionAction, StudentMemory, StudentNote, StudentPreferences } from "../state/student-memory";
import { POD_LABELS, POD_ORDER, type FeedbackValue, type PodId } from "../types/game";

export type Decision = {
  readonly action: DecisionAction;
  readonly target: PodId | null;
  readonly message: string;
  readonly why: string;
};

export type WhyOption = {
  readonly id: string;
  readonly label: string;
};

/** How long the hologram "thinks" before revealing a decision. Hides real latency later. */
export const THINKING_MS = 750;

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

/** Deterministic shuffle so the matching reason isn't always first. */
function orderBySeed<T>(items: readonly T[], seed: string) {
  return items
    .map((item, index) => ({ item, key: hashString(`${seed}:${index}`) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}

/** The clarifying question: a few plausible reasons in the student's voice, plus guessing. */
export function buildWhyOptions(question: Question, chosenMisconception: Misconception | null): WhyOption[] {
  const skills = new Set<PodId>([question.skill]);

  if (question.skill !== "fractions" && question.kind === "steps") {
    skills.add("simple-equations");
  }

  const candidates = MISCONCEPTIONS.filter(
    (item) => item.id !== GUESSED_ID && (skills.has(item.skill) || item.id === chosenMisconception?.id),
  );
  const picked = new Map<string, Misconception>();

  if (chosenMisconception) {
    picked.set(chosenMisconception.id, chosenMisconception);
  }

  for (const candidate of orderBySeed(candidates, question.id)) {
    if (picked.size >= 3) {
      break;
    }

    picked.set(candidate.id, candidate);
  }

  const options = orderBySeed(
    [...picked.values()].map((item) => ({ id: item.id, label: item.reasoning })),
    `${question.id}-why`,
  );

  options.push({ id: GUESSED_ID, label: "Honestly, I guessed" });

  return options;
}

export function noteFromReasoning(
  question: Question,
  reasoning: { misconceptionId: string } | { text: string },
  now: number,
): Omit<StudentNote, "count"> {
  if ("text" in reasoning) {
    return {
      id: `note-${question.id}-${now}`,
      misconceptionId: null,
      text: `In their own words: “${reasoning.text.trim()}”`,
      kind: "misconception",
      skill: question.skill,
      evidence: [question.id],
      createdAt: now,
    };
  }

  const misconception = getMisconception(reasoning.misconceptionId);

  if (!misconception) {
    throw new Error(`Unknown misconception: ${reasoning.misconceptionId}`);
  }

  return {
    id: `note-${misconception.id}`,
    misconceptionId: misconception.id,
    text: misconception.note,
    kind: misconception.kind,
    // "guessed" is a habit about this pod, not about fractions specifically.
    skill: misconception.id === GUESSED_ID ? question.skill : misconception.skill,
    evidence: [question.id],
    createdAt: now,
  };
}

export function applyFeedback(preferences: StudentPreferences, feedback: FeedbackValue): StudentPreferences {
  switch (feedback) {
    case "confusing":
      return { ...preferences, explanationStyle: "visual" };
    case "too-hard":
      return { ...preferences, difficultyBias: -1 };
    case "too-easy":
      return { ...preferences, difficultyBias: 1 };
    case "helpful":
      return preferences;
  }
}

type FeedbackContext = {
  readonly memory: StudentMemory;
  readonly pod: PodId;
  readonly feedback: FeedbackValue;
  readonly misconception: Misconception | null;
  readonly previousStyle: StudentPreferences["explanationStyle"];
};

/** After the student rates an explanation: change route, change style, or carry on. */
export function decideAfterFeedback(context: FeedbackContext): Decision {
  const { memory, pod, feedback, misconception, previousStyle } = context;

  const canRedirect =
    misconception !== null &&
    misconception.id !== GUESSED_ID &&
    misconception.skill !== pod &&
    !memory.redirected &&
    memory.progress[misconception.skill].status === "complete";

  if (canRedirect && misconception) {
    const target = misconception.skill;

    return {
      action: "redirect",
      target,
      message: `That slip wasn't ${POD_LABELS[pod].toLowerCase()} — it was ${POD_LABELS[target].toLowerCase()}. Let's fix that first.`,
      why: `Spotted: “${misconception.note}”. Reopening ${POD_LABELS[target]} for a short review before we come back.`,
    };
  }

  switch (feedback) {
    case "confusing":
      return {
        action: "next",
        target: null,
        message:
          previousStyle === "visual"
            ? "Okay — I'll slow down and draw the next one too."
            : "Got it. From now on I draw it instead of explaining it.",
        why: "You marked the explanation as confusing → switching to visual explanations.",
      };
    case "too-hard":
      return {
        action: "next",
        target: null,
        message: "Let's take a smaller step.",
        why: "You marked it too hard → picking easier questions next.",
      };
    case "too-easy":
      return {
        action: "next",
        target: null,
        message: "Then I'll push a little harder.",
        why: "You marked it too easy → picking harder questions next.",
      };
    case "helpful":
      return {
        action: "next",
        target: null,
        message: "Good. One more like that.",
        why: "You marked it helpful → keeping this explanation style.",
      };
  }
}

/** After the last clean answer of a pod. */
export function decideAfterPodComplete(memory: StudentMemory, pod: PodId): Decision {
  const progress = memory.progress[pod];
  const cleanAnswers = `${progress.correct} clean answers`;

  if (memory.returnTo) {
    return {
      action: "complete",
      target: memory.returnTo,
      message: `${POD_LABELS[pod]} are solid again. Let's go back to where we stopped.`,
      why: `Review passed with clean answers → ${POD_LABELS[pod]} reinforced. Returning to ${POD_LABELS[memory.returnTo]}.`,
    };
  }

  const nextIndex = POD_ORDER.indexOf(pod) + 1;
  const next = POD_ORDER[nextIndex];

  if (!next) {
    return {
      action: "mission-complete",
      target: null,
      message: `Mission complete. You just solved 2x/3 + 1 = 5 on your own.`,
      why: `${cleanAnswers} → ${POD_LABELS[pod]} mastered. Every pod is done.`,
    };
  }

  return {
    action: "complete",
    target: next,
    message: `${POD_LABELS[pod]}: done. Next up: ${POD_LABELS[next]}.`,
    why: `${cleanAnswers} → ${POD_LABELS[pod]} mastered. Unlocking ${POD_LABELS[next]}: ${POD_PLANS[next].tagline}`,
  };
}

export function eraseNoteDecision(note: StudentNote): Decision {
  return {
    action: "erase-note",
    target: null,
    message: `Erased: “${note.text}”.`,
    why: "You said that's not how you think. I'll stop planning around it.",
  };
}

/** What the hologram says while you're walking around. */
export function roamingLine(memory: StudentMemory, tutorPod: PodId, resumed: boolean): string {
  const status = memory.progress[tutorPod].status;

  if (status === "review") {
    return `Sit back down — a quick ${POD_LABELS[tutorPod].toLowerCase()} review, then we go back.`;
  }

  if (POD_ORDER.every((podId) => memory.progress[podId].status === "complete")) {
    return `Mission complete. Open my notebook to see how you think.`;
  }

  if (resumed) {
    return `Welcome back. Last time you were on ${POD_LABELS[tutorPod]} — take your desk and we pick up there.`;
  }

  if (tutorPod === POD_ORDER[0]) {
    return `Hi, I'm ${TUTOR_NAME}. Take the desk in front of mine — we start with ${POD_LABELS[tutorPod]}.`;
  }

  return `Next: ${POD_LABELS[tutorPod]}. Sit down when you're ready.`;
}
