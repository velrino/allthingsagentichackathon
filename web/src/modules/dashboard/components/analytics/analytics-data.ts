import type { IApiDashboardStudent } from "@/backend/api/api.interface";

export type LearningSignal = {
  readonly name: string;
  readonly mastery: number;
  readonly confidence: number;
  readonly clarification_load: number;
};

export type InterventionOutcome = {
  readonly stage: string;
  readonly independent: number;
  readonly guided: number;
  readonly teacher_support: number;
};

export type MisconceptionSignal = {
  readonly name: string;
  readonly signals: number;
};

export type AdaptationSession = {
  readonly session: string;
  readonly understanding: number;
  readonly confidence: number;
  readonly help_needed: number;
  readonly memory_used: boolean;
};

export type ContextSourceSession = {
  readonly session: string;
  readonly current_conversation: number;
  readonly past_sessions: number;
  readonly student_memory: number;
  readonly lesson_materials: number;
};

export type MemoryDifficulty = "often" | "sometimes" | "rarely" | "resolved";

export type ConceptMemory = {
  readonly concept: string;
  readonly sessions: readonly MemoryDifficulty[];
};

export type AnalyticsDataset<T> = {
  readonly data: T[];
  readonly source: "demo" | "estimated" | "live";
};

const demoLearningSignals: LearningSignal[] = [
  { name: "Warm-up", mastery: 38, confidence: 34, clarification_load: 78 },
  { name: "Check 1", mastery: 49, confidence: 44, clarification_load: 66 },
  { name: "Guided", mastery: 61, confidence: 57, clarification_load: 52 },
  { name: "Retry", mastery: 69, confidence: 64, clarification_load: 42 },
  { name: "Explain", mastery: 76, confidence: 71, clarification_load: 31 },
  { name: "Exit", mastery: 84, confidence: 80, clarification_load: 24 },
];

export const demoInterventionOutcomes: InterventionOutcome[] = [
  { stage: "Start", independent: 22, guided: 44, teacher_support: 34 },
  { stage: "After a hint", independent: 35, guided: 48, teacher_support: 17 },
  { stage: "Practice", independent: 49, guided: 41, teacher_support: 10 },
  { stage: "Final task", independent: 66, guided: 29, teacher_support: 5 },
];

const demoMisconceptions: MisconceptionSignal[] = [
  { name: "Sign errors", signals: 9 },
  { name: "Fraction operations", signals: 7 },
  { name: "Order of operations", signals: 5 },
  { name: "Explaining reasoning", signals: 4 },
  { name: "Variable isolation", signals: 3 },
];

const demoAdaptationSessions: AdaptationSession[] = [
  { session: "Session 1", understanding: 38, confidence: 34, help_needed: 78, memory_used: false },
  { session: "Session 2", understanding: 49, confidence: 44, help_needed: 66, memory_used: true },
  { session: "Session 3", understanding: 61, confidence: 57, help_needed: 52, memory_used: false },
  { session: "Session 4", understanding: 71, confidence: 67, help_needed: 39, memory_used: true },
  { session: "Session 5", understanding: 84, confidence: 80, help_needed: 24, memory_used: true },
];

const demoContextSources: ContextSourceSession[] = [
  { session: "Session 1", current_conversation: 62, past_sessions: 0, student_memory: 8, lesson_materials: 30 },
  { session: "Session 2", current_conversation: 47, past_sessions: 18, student_memory: 14, lesson_materials: 21 },
  { session: "Session 3", current_conversation: 38, past_sessions: 24, student_memory: 19, lesson_materials: 19 },
  { session: "Session 4", current_conversation: 32, past_sessions: 27, student_memory: 25, lesson_materials: 16 },
  { session: "Session 5", current_conversation: 27, past_sessions: 30, student_memory: 30, lesson_materials: 13 },
];

const demoConceptMemory: ConceptMemory[] = [
  { concept: "Sign errors", sessions: ["often", "often", "sometimes", "sometimes", "rarely"] },
  { concept: "Fraction operations", sessions: ["often", "sometimes", "sometimes", "rarely", "resolved"] },
  { concept: "Order of operations", sessions: ["sometimes", "sometimes", "rarely", "resolved", "resolved"] },
  { concept: "Explaining reasoning", sessions: ["often", "often", "sometimes", "sometimes", "rarely"] },
];

export function buildAdaptationDataset(students: IApiDashboardStudent[]): AnalyticsDataset<AdaptationSession> {
  if (students.length === 0) {
    return { data: demoAdaptationSessions, source: "demo" };
  }

  const averageProgress =
    students.reduce((total, student) => total + student.progress.percentage, 0) / Math.max(students.length, 1);
  const attentionRatio =
    students.filter((student) => student.progress.status === "needs_attention").length / Math.max(students.length, 1);
  const confidenceBase = clamp(Math.round(averageProgress - attentionRatio * 16), 22, 88);
  const helpBase = clamp(Math.round(76 - averageProgress * 0.42 + attentionRatio * 22), 20, 86);

  return {
    source: "estimated",
    data: demoAdaptationSessions.map((session, index) => {
      const step = index / Math.max(demoAdaptationSessions.length - 1, 1);

      return {
        ...session,
        understanding: clamp(Math.round(averageProgress * (0.6 + step * 0.44)), 24, 96),
        confidence: clamp(Math.round(confidenceBase * (0.68 + step * 0.38)), 20, 94),
        help_needed: clamp(Math.round(helpBase * (1.16 - step * 0.7)), 8, 90),
      };
    }),
  };
}

export function buildContextSourceDataset(students: IApiDashboardStudent[]): AnalyticsDataset<ContextSourceSession> {
  if (students.length === 0) {
    return { data: demoContextSources, source: "demo" };
  }

  const notebookDepth = clamp(
    students.reduce((total, student) => total + student.notebook_notes, 0),
    0,
    18,
  );

  return {
    source: "estimated",
    data: demoContextSources.map((session, index) => {
      const memoryBoost = Math.min(Math.round(notebookDepth / 3), 6);
      const studentMemory = clamp(session.student_memory + Math.round((memoryBoost * index) / 4), 8, 36);
      const pastSessions = session.past_sessions;
      const lessonMaterials = session.lesson_materials;

      return {
        ...session,
        student_memory: studentMemory,
        current_conversation: 100 - pastSessions - studentMemory - lessonMaterials,
      };
    }),
  };
}

export function buildConceptMemoryDataset(students: IApiDashboardStudent[]): AnalyticsDataset<ConceptMemory> {
  const counts = collectImprovementAreas(students);
  if (counts.length === 0) {
    return { data: demoConceptMemory, source: "demo" };
  }

  const patterns: readonly (readonly MemoryDifficulty[])[] = [
    ["often", "often", "sometimes", "sometimes", "rarely"],
    ["often", "sometimes", "sometimes", "rarely", "resolved"],
    ["sometimes", "sometimes", "rarely", "resolved", "resolved"],
    ["sometimes", "rarely", "rarely", "resolved", "resolved"],
  ];

  return {
    source: "estimated",
    data: counts.slice(0, 4).map((entry, index) => ({
      concept: shortenLabel(entry.label, 28),
      sessions: patterns[Math.min(index, patterns.length - 1)],
    })),
  };
}

export function buildLearningSignalDataset(students: IApiDashboardStudent[]): AnalyticsDataset<LearningSignal> {
  if (students.length === 0) {
    return { data: demoLearningSignals, source: "demo" };
  }

  const averageProgress =
    students.reduce((total, student) => total + student.progress.percentage, 0) / Math.max(students.length, 1);
  const attentionRatio =
    students.filter((student) => student.progress.status === "needs_attention").length / Math.max(students.length, 1);
  const confidenceBase = clamp(Math.round(averageProgress - attentionRatio * 18), 18, 92);
  const clarificationBase = clamp(Math.round(72 - averageProgress * 0.45 + attentionRatio * 24), 18, 88);

  return {
    source: "estimated",
    data: demoLearningSignals.map((signal, index) => {
      const step = index / Math.max(demoLearningSignals.length - 1, 1);

      return {
        ...signal,
        mastery: clamp(Math.round(averageProgress * (0.62 + step * 0.42)), 24, 96),
        confidence: clamp(Math.round(confidenceBase * (0.68 + step * 0.38)), 20, 94),
        clarification_load: clamp(Math.round(clarificationBase * (1.18 - step * 0.72)), 8, 90),
      };
    }),
  };
}

export function buildMisconceptionDataset(
  students: IApiDashboardStudent[],
): AnalyticsDataset<MisconceptionSignal> {
  const counts = new Map<string, { label: string; signals: number }>();

  for (const student of students) {
    for (const improvementArea of student.improvement_areas) {
      const label = improvementArea.trim();
      if (!label) {
        continue;
      }

      const key = label.toLocaleLowerCase("en");
      const current = counts.get(key);
      counts.set(key, {
        label: current?.label ?? label,
        signals: (current?.signals ?? 0) + 1,
      });
    }
  }

  if (counts.size === 0) {
    return { data: demoMisconceptions, source: "demo" };
  }

  return {
    source: "live",
    data: [...counts.values()]
      .sort((left, right) => right.signals - left.signals)
      .slice(0, 5)
      .map((entry) => ({
        name: shortenLabel(entry.label, 24),
        signals: entry.signals,
      })),
  };
}

function collectImprovementAreas(students: IApiDashboardStudent[]) {
  const counts = new Map<string, { label: string; signals: number }>();

  for (const student of students) {
    for (const improvementArea of student.improvement_areas) {
      const label = improvementArea.trim();
      if (!label) {
        continue;
      }

      const key = label.toLocaleLowerCase("en");
      const current = counts.get(key);
      counts.set(key, {
        label: current?.label ?? label,
        signals: (current?.signals ?? 0) + 1,
      });
    }
  }

  return [...counts.values()].sort((left, right) => right.signals - left.signals);
}

function shortenLabel(value: string, maximumLength: number) {
  if (value.length <= maximumLength) {
    return value;
  }

  return `${value.slice(0, maximumLength - 1).trimEnd()}...`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
