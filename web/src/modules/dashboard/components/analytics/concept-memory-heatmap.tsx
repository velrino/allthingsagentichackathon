"use client";

import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ConceptMemory, MemoryDifficulty } from "./analytics-data";

type ConceptMemoryHeatmapProps = {
  readonly data: ConceptMemory[];
};

const sessionLabels = ["Session 1", "Session 2", "Session 3", "Session 4", "Session 5"];

const difficultyStyles: Record<MemoryDifficulty, { className: string; label: string }> = {
  often: { className: "bg-[#6236ff] text-white", label: "Often" },
  sometimes: { className: "bg-[#a376ff] text-white", label: "Sometimes" },
  rarely: { className: "bg-[#dfc7ff] text-purple-950", label: "Rarely" },
  resolved: { className: "bg-emerald-100 text-emerald-900", label: "Resolved" },
};

export function ConceptMemoryHeatmap({ data }: ConceptMemoryHeatmapProps) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[720px] grid-cols-[minmax(160px,1.5fr)_repeat(5,minmax(90px,1fr))] gap-2">
          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Learning pattern</div>
          {sessionLabels.map((session) => (
            <div key={session} className="px-2 py-1 text-center text-xs font-semibold text-muted-foreground">
              {session}
            </div>
          ))}

          {data.flatMap((row) => [
            <div key={`${row.concept}-label`} className="flex min-h-14 items-center rounded-md bg-muted/50 px-3 text-sm font-medium">
              {row.concept}
            </div>,
            ...row.sessions.map((difficulty, index) => {
              const style = difficultyStyles[difficulty];
              return (
                <div
                  key={`${row.concept}-${sessionLabels[index]}`}
                  className={cn("flex min-h-14 items-center justify-center gap-1.5 rounded-md px-2 text-center text-xs font-semibold", style.className)}
                  aria-label={`${row.concept}, ${sessionLabels[index]}: ${style.label}`}
                >
                  {difficulty === "resolved" ? <CheckCircle2 className="size-3.5" aria-hidden /> : null}
                  {style.label}
                </div>
              );
            }),
          ])}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {(Object.entries(difficultyStyles) as [MemoryDifficulty, (typeof difficultyStyles)[MemoryDifficulty]][]).map(
          ([difficulty, style]) => (
            <span key={difficulty} className="flex items-center gap-2">
              <span className={cn("size-3 rounded-sm", style.className)} aria-hidden />
              {style.label}
            </span>
          ),
        )}
        <span className="sm:ms-auto">Lighter cells mean less help was needed.</span>
      </div>
    </div>
  );
}
