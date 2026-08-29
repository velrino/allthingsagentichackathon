import type {
  IApiDashboardStudent,
  IApiSuggestion,
  IApiTeacherClassMission,
} from "@/backend/api/api.interface";
import { POD_LABELS, POD_ORDER, type PodId } from "@/modules/game/types/game";

export type AnalyticsSource = "demo" | "estimated" | "live";

export type AnalyticsDataset<T> = {
  readonly data: T;
  readonly source: AnalyticsSource;
};

export type StudentRef = {
  readonly id: string;
  readonly name: string;
};

/** Class glance: computed from live game presence only. */
export type ClassGlance = {
  readonly total: number;
  readonly notStarted: StudentRef[];
  readonly playingNow: StudentRef[];
  readonly atTheDesk: StudentRef[];
  readonly inReview: StudentRef[];
  readonly leftEarly: StudentRef[];
  readonly completed: StudentRef[];
};

export type FunnelStepKind = "not_started" | "stage" | "completed";

export type FunnelStep = {
  readonly id: string;
  readonly label: string;
  readonly kind: FunnelStepKind;
  readonly students: StudentRef[];
};

/** high = strongest signal (strong need / excels), low = weakest (mild / emerging). */
export type PatternLevel = "high" | "medium" | "low";

export type PatternStudent = StudentRef & {
  readonly level: PatternLevel;
};

export type PatternGroup = {
  readonly pattern: string;
  readonly students: PatternStudent[];
};

export type SuggestionTier = "reteaching" | "whole_class" | "enrichment";

export type PlannedSuggestion = IApiSuggestion & {
  readonly tier: SuggestionTier;
};

const demoStudents: StudentRef[] = [
  { id: "demo-maya", name: "Maya Silva" },
  { id: "demo-theo", name: "Theo Park" },
  { id: "demo-ana", name: "Ana Costa" },
  { id: "demo-luca", name: "Luca Rossi" },
  { id: "demo-noor", name: "Noor Haddad" },
  { id: "demo-ravi", name: "Ravi Menon" },
  { id: "demo-june", name: "June Okafor" },
  { id: "demo-eli", name: "Eli Brandt" },
];

const demoGrowthPatterns: PatternGroup[] = [
  {
    pattern: "Divides instead of multiplying to clear a denominator",
    students: [
      { ...demoStudents[3], level: "high" },
      { ...demoStudents[0], level: "medium" },
      { ...demoStudents[5], level: "medium" },
      { ...demoStudents[7], level: "low" },
    ],
  },
  {
    pattern: "Adds numerators and denominators straight across",
    students: [
      { ...demoStudents[3], level: "high" },
      { ...demoStudents[4], level: "medium" },
      { ...demoStudents[1], level: "low" },
    ],
  },
  {
    pattern: "Moves a term without doing the same on both sides",
    students: [
      { ...demoStudents[2], level: "medium" },
      { ...demoStudents[6], level: "low" },
    ],
  },
];

const demoStrengthPatterns: PatternGroup[] = [
  {
    pattern: "Explains the reason before seeing the answer",
    students: [
      { ...demoStudents[1], level: "high" },
      { ...demoStudents[2], level: "high" },
      { ...demoStudents[6], level: "medium" },
      { ...demoStudents[4], level: "medium" },
      { ...demoStudents[0], level: "low" },
    ],
  },
  {
    pattern: "Keeps trying after a wrong answer",
    students: [
      { ...demoStudents[0], level: "high" },
      { ...demoStudents[5], level: "high" },
      { ...demoStudents[7], level: "medium" },
      { ...demoStudents[3], level: "low" },
    ],
  },
  {
    pattern: "Picks the right next move in two-step equations",
    students: [
      { ...demoStudents[1], level: "high" },
      { ...demoStudents[2], level: "medium" },
      { ...demoStudents[6], level: "medium" },
    ],
  },
];

const demoFunnel: FunnelStep[] = [
  { id: "not_started", label: "Not started", kind: "not_started", students: [demoStudents[7]] },
  { id: "fractions", label: POD_LABELS.fractions, kind: "stage", students: [demoStudents[3], demoStudents[4]] },
  {
    id: "simple-equations",
    label: POD_LABELS["simple-equations"],
    kind: "stage",
    students: [demoStudents[0], demoStudents[5]],
  },
  {
    id: "two-step-equations",
    label: POD_LABELS["two-step-equations"],
    kind: "stage",
    students: [demoStudents[2]],
  },
  { id: "completed", label: "Completed", kind: "completed", students: [demoStudents[1], demoStudents[6]] },
];

export function buildClassGlance(students: IApiDashboardStudent[]): ClassGlance {
  const notStarted: StudentRef[] = [];
  const playingNow: StudentRef[] = [];
  const atTheDesk: StudentRef[] = [];
  const inReview: StudentRef[] = [];
  const leftEarly: StudentRef[] = [];
  const completed: StudentRef[] = [];

  for (const student of students) {
    const ref = toStudentRef(student);
    const session = student.session;
    const status = session?.status ?? "";

    if (!session || !session.started_at) {
      notStarted.push(ref);
      continue;
    }
    if (session.is_online) {
      playingNow.push(ref);
    }
    if (status === "learning" || status === "thinking" || status === "reviewing") {
      atTheDesk.push(ref);
    }
    if (status === "reviewing") {
      inReview.push(ref);
    }
    if (status === "abandoned" || student.progress.status === "abandoned") {
      leftEarly.push(ref);
    }
    if (status === "completed") {
      completed.push(ref);
    }
  }

  return {
    total: students.length,
    notStarted,
    playingNow,
    atTheDesk,
    inReview,
    leftEarly,
    completed,
  };
}

export function buildMissionFunnel(
  students: IApiDashboardStudent[],
  activeMission: IApiTeacherClassMission | null,
): AnalyticsDataset<FunnelStep[]> {
  if (students.length === 0) {
    return { data: demoFunnel, source: "demo" };
  }

  const notStarted: StudentRef[] = [];
  const completed: StudentRef[] = [];
  const byStage = new Map<string, { label: string; students: StudentRef[] }>();

  for (const student of students) {
    const ref = toStudentRef(student);
    const session = student.session;

    if (!session || !session.started_at) {
      notStarted.push(ref);
      continue;
    }
    if (session.status === "completed") {
      completed.push(ref);
      continue;
    }

    const stageId = session.stage_id || "unknown";
    const current = byStage.get(stageId);
    if (current) {
      current.students.push(ref);
    } else {
      byStage.set(stageId, {
        label: session.stage_name || stageLabelFromMission(stageId, activeMission) || "In the classroom",
        students: [ref],
      });
    }
  }

  // The game always reports the mission pods, so those columns are shown even when empty.
  // Stage ids from the published mission or unknown ids only appear when a student is there.
  const missionStageIds = activeMission?.stages.map((stage) => stage.id) ?? [];
  const orderedIds = unique([...POD_ORDER, ...missionStageIds, ...byStage.keys()]);

  const stageSteps: FunnelStep[] = orderedIds
    .filter((stageId) => byStage.has(stageId) || isPodId(stageId))
    .map((stageId) => ({
      id: stageId,
      kind: "stage" as const,
      label: byStage.get(stageId)?.label ?? (isPodId(stageId) ? POD_LABELS[stageId] : stageId),
      students: byStage.get(stageId)?.students ?? [],
    }));

  return {
    source: "live",
    data: [
      { id: "not_started", label: "Not started", kind: "not_started", students: notStarted },
      ...stageSteps,
      { id: "completed", label: "Completed", kind: "completed", students: completed },
    ],
  };
}

export function buildGrowthPatterns(students: IApiDashboardStudent[]): AnalyticsDataset<PatternGroup[]> {
  if (students.length === 0) {
    return { data: demoGrowthPatterns, source: "demo" };
  }

  return {
    source: "estimated",
    data: groupPatterns(students, (student) => student.improvement_areas, growthLevel),
  };
}

export function buildStrengthPatterns(students: IApiDashboardStudent[]): AnalyticsDataset<PatternGroup[]> {
  if (students.length === 0) {
    return { data: demoStrengthPatterns, source: "demo" };
  }

  return {
    source: "estimated",
    data: groupPatterns(students, (student) => student.strengths, strengthLevel),
  };
}

export function buildClassSummary(
  growth: PatternGroup[],
  strengths: PatternGroup[],
  totalStudents: number,
): string {
  const topGrowth = growth[0];
  const topStrength = strengths[0];
  const strongNeed = new Set(
    growth.flatMap((group) => group.students.filter((student) => student.level === "high").map((student) => student.id)),
  );

  const parts: string[] = [];
  if (topStrength) {
    parts.push(
      `${topStrength.students.length} of ${totalStudents} students ${lowerFirst(topStrength.pattern)}.`,
    );
  }
  if (topGrowth) {
    parts.push(
      `The most common pattern to work on is "${lowerFirst(topGrowth.pattern)}" (${topGrowth.students.length} of ${totalStudents}).`,
    );
  }
  if (strongNeed.size > 0) {
    parts.push(
      `${strongNeed.size} ${strongNeed.size === 1 ? "student needs" : "students need"} a short small-group review before the next mission.`,
    );
  }

  return parts.join(" ") || "Class patterns will appear after students play the mission.";
}

export function planSuggestions(suggestions: IApiSuggestion[]): PlannedSuggestion[] {
  const tierOrder: SuggestionTier[] = ["reteaching", "whole_class", "enrichment"];

  return suggestions.slice(0, 3).map((suggestion, index) => ({
    ...suggestion,
    tier: readTier(suggestion) ?? tierOrder[index] ?? "whole_class",
  }));
}

export function buildNextMissionPrompt(
  growth: PatternGroup[],
  strengths: PatternGroup[],
  activeMission: IApiTeacherClassMission | null,
): string {
  const lines: string[] = [];

  if (activeMission) {
    lines.push(`Follow-up to "${activeMission.title}" (${activeMission.learning_goal}).`);
  }

  const growthLines = growth.slice(0, 3).map((group) => {
    const strong = group.students.filter((student) => student.level === "high").map((student) => student.name);
    const suffix = strong.length > 0 ? ` Strongest need: ${strong.join(", ")}.` : "";
    return `- ${group.pattern} (${group.students.length} students).${suffix}`;
  });
  if (growthLines.length > 0) {
    lines.push("", "Patterns Emily noticed that students still need to work on:", ...growthLines);
  }

  const strengthLines = strengths.slice(0, 2).map((group) => `- ${group.pattern} (${group.students.length} students).`);
  if (strengthLines.length > 0) {
    lines.push("", "Strengths to build on:", ...strengthLines);
  }

  lines.push(
    "",
    "Please build a short review mission that starts with the most common pattern, asks students why before explaining, and gives the strongest students one harder example.",
  );

  return lines.join("\n");
}

function groupPatterns(
  students: IApiDashboardStudent[],
  pick: (student: IApiDashboardStudent) => string[],
  levelFor: (student: IApiDashboardStudent) => PatternLevel,
): PatternGroup[] {
  const groups = new Map<string, { pattern: string; students: Map<string, PatternStudent> }>();

  for (const student of students) {
    const level = levelFor(student);
    for (const raw of pick(student)) {
      const pattern = raw.trim();
      if (!pattern) {
        continue;
      }

      const key = pattern.toLocaleLowerCase("en");
      const group = groups.get(key) ?? { pattern, students: new Map<string, PatternStudent>() };
      group.students.set(student.id, { ...toStudentRef(student), level });
      groups.set(key, group);
    }
  }

  return [...groups.values()]
    .map((group) => ({
      pattern: group.pattern,
      students: [...group.students.values()].sort(compareByLevel),
    }))
    .sort((left, right) => right.students.length - left.students.length);
}

function growthLevel(student: IApiDashboardStudent): PatternLevel {
  if (
    student.progress.status === "needs_attention" ||
    student.progress.status === "abandoned"
  ) {
    return "high";
  }
  if (student.progress.status === "completed") {
    return "low";
  }

  return "medium";
}

function strengthLevel(student: IApiDashboardStudent): PatternLevel {
  if (student.progress.status === "completed") {
    return "high";
  }
  if (
    student.progress.status === "needs_attention" ||
    student.progress.status === "abandoned"
  ) {
    return "low";
  }

  return "medium";
}

const levelRank: Record<PatternLevel, number> = { high: 0, medium: 1, low: 2 };

function compareByLevel(left: PatternStudent, right: PatternStudent) {
  const rank = levelRank[left.level] - levelRank[right.level];
  return rank !== 0 ? rank : left.name.localeCompare(right.name);
}

function readTier(suggestion: IApiSuggestion): SuggestionTier | null {
  const tier = (suggestion as IApiSuggestion & { tier?: string }).tier;
  if (tier === "reteaching" || tier === "whole_class" || tier === "enrichment") {
    return tier;
  }

  return null;
}

function stageLabelFromMission(stageId: string, activeMission: IApiTeacherClassMission | null) {
  return activeMission?.stages.find((stage) => stage.id === stageId)?.title ?? "";
}

function isPodId(value: string): value is PodId {
  return (POD_ORDER as readonly string[]).includes(value);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function toStudentRef(student: IApiDashboardStudent): StudentRef {
  return { id: student.id, name: student.student_name };
}

function lowerFirst(value: string) {
  return value.charAt(0).toLocaleLowerCase("en") + value.slice(1);
}
