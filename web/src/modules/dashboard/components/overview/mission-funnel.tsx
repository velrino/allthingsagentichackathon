import { cn } from "@/lib/utils";

import type { FunnelStep, FunnelStepKind } from "../analytics/analytics-data";
import { StudentChip } from "./student-chip";

type MissionFunnelProps = {
  readonly steps: FunnelStep[];
  readonly totalStudents: number;
};

const barStyles: Record<FunnelStepKind, string> = {
  not_started: "bg-amber-300 dark:bg-amber-500/70",
  stage: "bg-primary",
  completed: "bg-emerald-500",
};

const MAX_VISIBLE_CHIPS = 4;

export function MissionFunnel({ steps, totalStudents }: MissionFunnelProps) {
  const maxCount = Math.max(1, ...steps.map((step) => step.students.length));

  return (
    <div className="overflow-x-auto pb-1">
      <ol
        className="grid min-w-[560px] gap-3"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        aria-label="Where students are in the mission"
      >
        {steps.map((step) => {
          const count = step.students.length;
          const height = count === 0 ? 4 : Math.max(12, Math.round((count / maxCount) * 100));
          const hiddenCount = Math.max(0, count - MAX_VISIBLE_CHIPS);

          return (
            <li key={step.id} className="flex min-w-0 flex-col">
              <div className="flex h-32 flex-col justify-end">
                <p className="mb-1 text-center text-sm font-bold">{count}</p>
                <div
                  className={cn("mx-auto w-full max-w-24 rounded-t-md transition-[height]", barStyles[step.kind], count === 0 && "bg-muted")}
                  style={{ height: `${height}%` }}
                  aria-hidden
                />
              </div>
              <p className="mt-2 border-t border-border pt-2 text-center text-xs font-semibold text-muted-foreground">
                {step.label}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                {step.students.slice(0, MAX_VISIBLE_CHIPS).map((student) => (
                  <StudentChip key={student.id} name={student.name} className="max-w-full" />
                ))}
                {hiddenCount > 0 ? (
                  <span
                    className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground"
                    title={step.students.slice(MAX_VISIBLE_CHIPS).map((student) => student.name).join(", ")}
                  >
                    +{hiddenCount}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        {totalStudents} {totalStudents === 1 ? "student" : "students"} in this class. Positions update from the game every few seconds.
      </p>
    </div>
  );
}
