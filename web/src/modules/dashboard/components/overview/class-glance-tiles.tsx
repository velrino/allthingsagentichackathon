import { ArrowRight, type LucideIcon } from "lucide-react";
import { CheckCircle2, Gamepad2, Hourglass, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ClassGlance } from "../analytics/analytics-data";

type Tone = "amber" | "cyan" | "violet" | "emerald";

type GlanceTile = {
  readonly action?: { readonly label: string; readonly onClick: () => void };
  readonly detail: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone: Tone;
  readonly total: number;
  readonly value: number;
};

type ClassGlanceTilesProps = {
  readonly glance: ClassGlance;
  readonly shareCodeLabel: string;
  readonly onPlanFollowUp: () => void;
  readonly onShareCode: () => void;
};

const toneStyles: Record<Tone, { readonly surface: string; readonly label: string; readonly value: string; readonly action: string }> = {
  amber: {
    surface: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
    label: "text-amber-700 dark:text-amber-300",
    value: "text-amber-900 dark:text-amber-100",
    action: "text-amber-800 hover:text-amber-950 dark:text-amber-200",
  },
  cyan: {
    surface: "border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/40",
    label: "text-cyan-700 dark:text-cyan-300",
    value: "text-cyan-900 dark:text-cyan-100",
    action: "text-cyan-800 hover:text-cyan-950 dark:text-cyan-200",
  },
  violet: {
    surface: "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40",
    label: "text-violet-700 dark:text-violet-300",
    value: "text-violet-900 dark:text-violet-100",
    action: "text-violet-800 hover:text-violet-950 dark:text-violet-200",
  },
  emerald: {
    surface: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
    label: "text-emerald-700 dark:text-emerald-300",
    value: "text-emerald-900 dark:text-emerald-100",
    action: "text-emerald-800 hover:text-emerald-950 dark:text-emerald-200",
  },
};

export function ClassGlanceTiles({ glance, onPlanFollowUp, onShareCode, shareCodeLabel }: ClassGlanceTilesProps) {
  const tiles: GlanceTile[] = [
    {
      tone: "amber",
      icon: Hourglass,
      label: "Not started",
      value: glance.notStarted.length,
      total: glance.total,
      detail: glance.notStarted.length > 0 ? "Joined the class, haven't opened the mission" : "Everyone has opened the mission",
      action: { label: shareCodeLabel, onClick: onShareCode },
    },
    {
      tone: "cyan",
      icon: Gamepad2,
      label: "Playing now",
      value: glance.playingNow.length,
      total: glance.total,
      detail: `${glance.atTheDesk.length} at the desk with Emily`,
    },
    {
      tone: "violet",
      icon: RotateCcw,
      label: "In a review",
      value: glance.inReview.length,
      total: glance.total,
      detail: "Emily reopened an earlier topic for them",
    },
    {
      tone: "emerald",
      icon: CheckCircle2,
      label: "Completed",
      value: glance.completed.length,
      total: glance.total,
      detail: "Finished the whole mission",
      action: { label: "Plan follow-up", onClick: onPlanFollowUp },
    },
  ];

  return (
    <section aria-label="Class at a glance" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => {
        const style = toneStyles[tile.tone];
        const Icon = tile.icon;

        return (
          <article key={tile.label} className={cn("flex min-h-28 flex-col justify-between rounded-lg border p-4", style.surface)}>
            <div className="flex items-start justify-between gap-2">
              <p className={cn("text-[11px] font-bold tracking-wide uppercase", style.label)}>{tile.label}</p>
              <Icon className={cn("size-4 shrink-0", style.label)} aria-hidden />
            </div>
            <p className={cn("mt-2 text-3xl font-bold leading-none", style.value)}>
              {tile.value}
              <span className={cn("ms-1 text-sm font-semibold opacity-70", style.value)}>/ {tile.total}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
              <p className="text-xs text-muted-foreground">{tile.detail}</p>
              {tile.action ? (
                <button
                  type="button"
                  onClick={tile.action.onClick}
                  className={cn("inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline", style.action)}
                >
                  {tile.action.label}
                  <ArrowRight className="size-3" aria-hidden />
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
