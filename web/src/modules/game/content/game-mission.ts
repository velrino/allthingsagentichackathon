import type { IApiStudentMission } from "@/backend/api/api.interface";

import {
  MISCONCEPTIONS,
  MISSION_GOAL,
  MISSION_ID,
  MISSION_SUBJECT,
  MISSION_TITLE,
  POD_PLANS,
  QUESTIONS,
  type Misconception,
  type Question,
} from "./algebra-mission";
import { POD_ORDER, type PodId } from "../types/game";

export type GameStage = {
  readonly slot: PodId;
  readonly sourceId: string;
  readonly title: string;
  readonly goal: string;
  readonly tagline: string;
  readonly primary: readonly string[];
  readonly reinforcement: readonly string[];
  readonly required: number;
};

export type GameMission = {
  readonly id: string;
  readonly publishedRevision: number;
  readonly title: string;
  readonly subject: string;
  readonly gradeLevel: string;
  readonly learningGoal: string;
  readonly stages: Record<PodId, GameStage>;
  readonly questions: readonly Question[];
  readonly sourceQuestionIds: Readonly<Record<string, string>>;
  readonly sourceQuestionStageIds: Readonly<Record<string, string>>;
  readonly sourceStageSlots: Readonly<Record<string, PodId>>;
  readonly misconceptions: readonly Misconception[];
};

export const FALLBACK_GAME_MISSION: GameMission = {
  id: MISSION_ID,
  publishedRevision: 0,
  title: MISSION_TITLE,
  subject: MISSION_SUBJECT,
  gradeLevel: "",
  learningGoal: MISSION_GOAL,
  stages: {
    fractions: {
      slot: "fractions",
      sourceId: "fractions",
      title: "Fractions",
      goal: POD_PLANS.fractions.tagline,
      tagline: POD_PLANS.fractions.tagline,
      primary: POD_PLANS.fractions.primary,
      reinforcement: POD_PLANS.fractions.reinforcement,
      required: POD_PLANS.fractions.required,
    },
    "simple-equations": {
      slot: "simple-equations",
      sourceId: "simple-equations",
      title: "Simple equations",
      goal: POD_PLANS["simple-equations"].tagline,
      tagline: POD_PLANS["simple-equations"].tagline,
      primary: POD_PLANS["simple-equations"].primary,
      reinforcement: POD_PLANS["simple-equations"].reinforcement,
      required: POD_PLANS["simple-equations"].required,
    },
    "two-step-equations": {
      slot: "two-step-equations",
      sourceId: "two-step-equations",
      title: "Two-step equations",
      goal: POD_PLANS["two-step-equations"].tagline,
      tagline: POD_PLANS["two-step-equations"].tagline,
      primary: POD_PLANS["two-step-equations"].primary,
      reinforcement: POD_PLANS["two-step-equations"].reinforcement,
      required: POD_PLANS["two-step-equations"].required,
    },
  },
  questions: QUESTIONS,
  sourceQuestionIds: Object.fromEntries(
    QUESTIONS.map((question) => [question.id, question.id]),
  ),
  sourceQuestionStageIds: Object.fromEntries(
    QUESTIONS.map((question) => [question.id, question.skill]),
  ),
  sourceStageSlots: Object.fromEntries(POD_ORDER.map((slot) => [slot, slot])),
  misconceptions: MISCONCEPTIONS,
};

export function buildGameMission(source: IApiStudentMission | undefined): GameMission {
  if (!source || source.stages.length === 0 || source.preview_questions.length === 0) {
    return FALLBACK_GAME_MISSION;
  }

  const sourceStages = POD_ORDER.map((_, index) =>
    source.stages[Math.min(index, source.stages.length - 1)],
  );
  const slotByStageId = new Map<string, PodId>();
  const sourceStageSlots: Record<string, PodId> = {};
  source.stages.forEach((stage, index) => {
    const slot = POD_ORDER[Math.min(index, POD_ORDER.length - 1)];
    slotByStageId.set(normalizeKey(stage.id), slot);
    sourceStageSlots[normalizeKey(stage.id)] = slot;
  });

  const questions: Question[] = [];
  const sourceQuestionIds: Record<string, string> = {};
  const sourceQuestionStageIds: Record<string, string> = {};
  const misconceptions: Misconception[] = [];
  const questionIDsBySlot = new Map<PodId, string[]>(POD_ORDER.map((slot) => [slot, []]));

  source.preview_questions.forEach((question, index) => {
    const slot = slotByStageId.get(normalizeKey(question.stage_id)) ?? POD_ORDER[index % POD_ORDER.length];
    const converted = convertQuestion(question, slot, misconceptions, index);
    questions.push(converted);
    sourceQuestionIds[converted.id] = question.id;
    sourceQuestionStageIds[converted.id] =
      question.stage_id || sourceStages[POD_ORDER.indexOf(slot)].id || slot;
    questionIDsBySlot.get(slot)?.push(converted.id);
  });

  // A mission always has three visible progress steps. Legacy missions may not
  // have stage_id on questions, so ensure every step has at least one grounded
  // question by cloning the nearest published question into the empty slot.
  for (const [index, slot] of POD_ORDER.entries()) {
    const ids = questionIDsBySlot.get(slot);
    if (ids && ids.length > 0) {
      continue;
    }
    const sourceQuestion = source.preview_questions[index % source.preview_questions.length];
    const converted = convertQuestion(sourceQuestion, slot, misconceptions, questions.length, `-${index + 1}`);
    questions.push(converted);
    sourceQuestionIds[converted.id] = sourceQuestion.id;
    sourceQuestionStageIds[converted.id] =
      sourceQuestion.stage_id || sourceStages[index].id || slot;
    questionIDsBySlot.set(slot, [converted.id]);
  }

  const stages = {} as Record<PodId, GameStage>;
  POD_ORDER.forEach((slot, index) => {
    const stage = sourceStages[index];
    const ids = questionIDsBySlot.get(slot) ?? [];
    stages[slot] = {
      slot,
      sourceId: stage.id || slot,
      title: stage.title || `Step ${index + 1}`,
      goal: stage.goal || source.learning_goal,
      tagline: stage.goal || source.learning_goal,
      primary: ids,
      reinforcement: [],
      required: Math.max(1, Math.min(2, ids.length)),
    };
  });

  return {
    id: source.id,
    publishedRevision: source.published_revision,
    title: source.title || "Class mission",
    subject: source.subject || "Classroom learning",
    gradeLevel: source.grade_level,
    learningGoal: source.learning_goal,
    stages,
    questions,
    sourceQuestionIds,
    sourceQuestionStageIds,
    sourceStageSlots,
    misconceptions,
  };
}

export function getMissionQuestion(mission: GameMission, id: string): Question {
  const question = mission.questions.find((item) => item.id === id);
  if (!question) {
    throw new Error(`Unknown mission question: ${id}`);
  }

  return question;
}

export function getMissionMisconception(
  mission: GameMission,
  id: string | undefined,
): Misconception | null {
  return id ? mission.misconceptions.find((item) => item.id === id) ?? null : null;
}

export function stageLabel(mission: GameMission, slot: PodId) {
  return mission.stages[slot].title;
}

export function sourceStageID(
  mission: GameMission,
  slot: PodId,
  questionID?: string,
) {
  return (
    (questionID ? mission.sourceQuestionStageIds[questionID] : undefined) ??
    mission.stages[slot].sourceId
  );
}

export function sourceQuestionID(mission: GameMission, questionID: string) {
  return mission.sourceQuestionIds[questionID] ?? questionID;
}

export function slotForStageID(
  mission: GameMission,
  stageID: string,
): PodId | null {
  const normalized = normalizeKey(stageID);

  if (mission.sourceStageSlots[normalized]) {
    return mission.sourceStageSlots[normalized];
  }

  return (
    POD_ORDER.find(
      (slot) =>
        normalizeKey(slot) === normalized ||
        normalizeKey(mission.stages[slot].sourceId) === normalized,
    ) ?? null
  );
}

function convertQuestion(
  source: IApiStudentMission["preview_questions"][number],
  slot: PodId,
  misconceptions: Misconception[],
  index: number,
  idSuffix = "",
): Question {
  const id = `${safeID(source.id || `question-${index + 1}`)}${idSuffix}`;
  const expected = cleanText(source.expected_answer);
  const sourceOptions = cleanTextList(source.options);
  const sourceTraps = cleanTextList(source.misconception_traps);
  const options = uniqueStrings([expected, ...sourceOptions, ...sourceTraps])
    .filter(Boolean)
    .slice(0, 4);
  if (options.length < 2) {
    options.push("I need another clue");
  }

  const choiceOptions = options.map((text, optionIndex) => {
    const correct = normalizeAnswer(text) === normalizeAnswer(expected);
    if (correct) {
      return { text, correct: true as const };
    }
    const misconceptionId = `${id}-choice-${optionIndex + 1}`;
    const trap =
      sourceTraps[optionIndex] ??
      `Chose “${text}” instead of checking the mission evidence.`;
    misconceptions.push({
      id: misconceptionId,
      skill: slot,
      reasoning: `“${text}” looked like the best match`,
      note: trap,
      kind: "misconception",
    });
    return { text, misconception: misconceptionId };
  });

  const explanationSteps = cleanTextList(source.explanation_steps);
  const steps = explanationSteps.length
    ? explanationSteps
    : [`Connect the question to the learning goal.`, `The expected answer is: ${expected}`];

  return {
    kind: "choice",
    id,
    skill: slot,
    difficulty: difficultyForIndex(index),
    prompt: cleanText(source.prompt) || "Answer the mission question.",
    options: choiceOptions,
    explanation: {
      steps,
      visual: {
        kind: "chain",
        lines: [cleanText(source.prompt), ...steps, expected].filter(Boolean),
      },
    },
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanTextList(value: unknown) {
  return Array.isArray(value) ? value.map(cleanText).filter(Boolean) : [];
}

function difficultyForIndex(index: number): 1 | 2 | 3 {
  return ((index % 3) + 1) as 1 | 2 | 3;
}

function normalizeAnswer(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[.!?]+$/g, "");
}

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[_\s]+/g, "-");
}

function safeID(value: string) {
  return normalizeKey(value).replace(/[^a-z0-9-]/g, "") || "question";
}

function uniqueStrings(values: readonly string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeAnswer(value);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
