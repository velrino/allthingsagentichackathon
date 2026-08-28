import { Sparkles, Target, TrendingUp, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PatternGroup } from "../analytics/analytics-data";

type ClassPatternsSummaryProps = {
  readonly growth: PatternGroup[];
  readonly strengths: PatternGroup[];
  readonly summary: string;
  readonly totalStudents: number;
};

export function ClassPatternsSummary({ growth, strengths, summary, totalStudents }: ClassPatternsSummaryProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <PatternList
        eyebrow="Tier 1 · whole-class wins to build on"
        groups={strengths}
        icon={TrendingUp}
        iconClassName="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
        markerClassName="bg-emerald-500"
        title="Strengths"
        totalStudents={totalStudents}
      />
      <PatternList
        eyebrow="Tier 2 lens · use this to plan small-group review"
        groups={growth}
        icon={Target}
        iconClassName="bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-200"
        markerClassName="bg-orange-400"
        title="Areas for growth"
        totalStudents={totalStudents}
      />
      <article className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <h3 className="text-sm font-semibold">Overall assessment</h3>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{summary}</p>
      </article>
    </div>
  );
}

function PatternList({
  eyebrow,
  groups,
  icon: Icon,
  iconClassName,
  markerClassName,
  title,
  totalStudents,
}: {
  readonly eyebrow: string;
  readonly groups: PatternGroup[];
  readonly icon: LucideIcon;
  readonly iconClassName: string;
  readonly markerClassName: string;
  readonly title: string;
  readonly totalStudents: number;
}) {
  const visibleGroups = groups.slice(0, 3);

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", iconClassName)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{eyebrow}</p>
        </div>
      </div>
      {visibleGroups.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {visibleGroups.map((group) => (
            <li key={group.pattern} className="flex gap-2.5">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", markerClassName)} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm leading-5">{group.pattern}</p>
                <p className="text-xs text-muted-foreground">
                  {group.students.length}/{totalStudents} students
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Patterns will appear after students play.</p>
      )}
    </article>
  );
}
