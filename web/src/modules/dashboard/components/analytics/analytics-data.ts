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
  { stage: "Warm-up", independent: 22, guided: 44, teacher_support: 34 },
  { stage: "Guided", independent: 35, guided: 48, teacher_support: 17 },
  { stage: "Retry", independent: 49, guided: 41, teacher_support: 10 },
  { stage: "Exit", independent: 66, guided: 29, teacher_support: 5 },
];

const demoMisconceptions: MisconceptionSignal[] = [
  { name: "Sign errors", signals: 9 },
  { name: "Fraction operations", signals: 7 },
  { name: "Order of operations", signals: 5 },
  { name: "Explaining reasoning", signals: 4 },
  { name: "Variable isolation", signals: 3 },
];

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

function shortenLabel(value: string, maximumLength: number) {
  if (value.length <= maximumLength) {
    return value;
  }

  return `${value.slice(0, maximumLength - 1).trimEnd()}...`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
