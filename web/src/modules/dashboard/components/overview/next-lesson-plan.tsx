import { BookOpenCheck, LifeBuoy, Sparkles, Users, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { PlannedSuggestion, SuggestionTier } from "../analytics/analytics-data";

type NextLessonPlanProps = {
  readonly canBuild: boolean;
  readonly suggestions: PlannedSuggestion[];
  readonly onBuildNextMission: () => void;
};

const tierMeta: Record<SuggestionTier, { readonly detail: string; readonly icon: LucideIcon; readonly iconClassName: string; readonly label: string }> = {
  reteaching: {
    label: "Reteaching",
    detail: "Tier 2 · targeted small-group support",
    icon: LifeBuoy,
    iconClassName: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-200",
  },
  whole_class: {
    label: "Next steps",
    detail: "Tier 1 · whole-class next moves",
    icon: Users,
    iconClassName: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200",
  },
  enrichment: {
    label: "Enrichment",
    detail: "Tier 1 · extend for advanced learners",
    icon: Sparkles,
    iconClassName: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
  },
};

export function NextLessonPlan({ canBuild, onBuildNextMission, suggestions }: NextLessonPlanProps) {
  return (
    <div className="space-y-4">
      {suggestions.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {suggestions.map((suggestion) => {
            const meta = tierMeta[suggestion.tier];
            const Icon = meta.icon;

            return (
              <article key={suggestion.id} className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", meta.iconClassName)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{meta.label}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{meta.detail}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold leading-5">{suggestion.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{suggestion.activity}</p>
                {suggestion.reason ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    <span className="font-semibold text-foreground">Why: </span>
                    {suggestion.reason}
                  </p>
                ) : null}
                {suggestion.questions.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                    {suggestion.questions.slice(0, 2).map((question) => (
                      <li key={question} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                        <span aria-hidden>“</span>
                        <span>{question}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {suggestion.focus_skills.length > 0 ? (
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                    {suggestion.focus_skills.map((skill) => (
                      <span key={skill} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
          Publish a mission and Emily will suggest what to reteach, what to do with the whole class, and how to stretch
          the students who are ahead.
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Turn these patterns into tomorrow&apos;s mission</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Opens the Mission Builder with the class patterns already written into the teacher prompt. You can edit before
            Emily processes it.
          </p>
        </div>
        <Button type="button" disabled={!canBuild} onClick={onBuildNextMission} className="shrink-0">
          <BookOpenCheck className="size-4" aria-hidden />
          Build tomorrow&apos;s mission
        </Button>
      </div>
    </div>
  );
}
