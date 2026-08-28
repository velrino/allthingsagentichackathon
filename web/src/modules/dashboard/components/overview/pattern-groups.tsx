import { cn } from "@/lib/utils";

import type { PatternGroup, PatternLevel } from "../analytics/analytics-data";
import { StudentChip } from "./student-chip";

export type PatternVariant = "growth" | "strength";

type PatternGroupsProps = {
  readonly emptyMessage: string;
  readonly groups: PatternGroup[];
  readonly limit?: number;
  readonly totalStudents: number;
  readonly variant: PatternVariant;
};

type LevelStyle = {
  readonly dot: string;
  readonly label: string;
  readonly row: string;
};

const levelOrder: PatternLevel[] = ["high", "medium", "low"];

const levelStyles: Record<PatternVariant, Record<PatternLevel, LevelStyle>> = {
  growth: {
    high: { label: "Strong need", dot: "bg-rose-500", row: "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200" },
    medium: { label: "Moderate", dot: "bg-orange-400", row: "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200" },
    low: { label: "Mild", dot: "bg-amber-400", row: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" },
  },
  strength: {
    high: { label: "Excels", dot: "bg-emerald-600", row: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100" },
    medium: { label: "Solid", dot: "bg-emerald-400", row: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" },
    low: { label: "Emerging", dot: "bg-teal-300", row: "bg-teal-50 text-teal-800 dark:bg-teal-950/30 dark:text-teal-200" },
  },
};

export function PatternGroups({ emptyMessage, groups, limit = 6, totalStudents, variant }: PatternGroupsProps) {
  const visibleGroups = groups.slice(0, limit);
  const styles = levelStyles[variant];
  const countVerb = variant === "growth" ? "need work" : "demonstrate";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {levelOrder.map((level) => (
          <span key={level} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", styles[level].dot)} aria-hidden />
            {styles[level].label}
          </span>
        ))}
      </div>

      {visibleGroups.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleGroups.map((group) => (
            <article key={group.pattern} className="flex min-w-0 flex-col rounded-lg border border-border bg-card">
              <header className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold leading-5">{group.pattern}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {group.students.length} of {totalStudents} {countVerb}
                </p>
              </header>
              <div className="grid gap-2 p-3">
                {levelOrder.map((level) => {
                  const students = group.students.filter((student) => student.level === level);
                  if (students.length === 0) {
                    return null;
                  }
                  const style = styles[level];

                  return (
                    <div key={level} className="grid gap-2">
                      <p className={cn("flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold", style.row)}>
                        <span className={cn("size-2 rounded-full", style.dot)} aria-hidden />
                        {style.label}
                        <span className="opacity-70">· {students.length}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 px-1">
                        {students.map((student) => (
                          <StudentChip key={student.id} name={student.name} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
