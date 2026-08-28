import { BrainCircuit, CheckCircle2, Search, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type MemoryReceiptsProps = {
  readonly learningGoal?: string;
  readonly progress?: number;
  readonly rememberedSignal?: string;
  readonly studentName?: string;
};

export function MemoryReceipts({
  learningGoal = "Explain the reasoning behind each answer.",
  progress,
  rememberedSignal = "Sign errors tend to appear in multi-step problems.",
  studentName = "Maya",
}: MemoryReceiptsProps) {
  const receipts = [
    {
      detail: `${studentName}: ${rememberedSignal}`,
      icon: BrainCircuit,
      label: "Remembered",
      source: "Saved from earlier work",
    },
    {
      detail: `Emily checked that note together with today's goal: “${learningGoal}”`,
      icon: Search,
      label: "Checked before replying",
      source: "Context retrieved in real time",
    },
    {
      detail: "Emily used shorter steps, a visual example, and one guided question.",
      icon: Sparkles,
      label: "Changed her approach",
      source: "Personalized explanation",
    },
    {
      detail: progress === undefined ? "The next task needed less support." : `${studentName} now shows ${progress}% progress.`,
      icon: CheckCircle2,
      label: "Observed",
      source: "Latest learning signal",
    },
  ];

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>What Emily remembered and used</CardTitle>
        <CardDescription className="leading-5">Concrete examples behind the charts, in plain language.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {receipts.map((receipt) => {
          const Icon = receipt.icon;
          return (
            <div key={receipt.label} className="flex gap-3 rounded-lg border border-border bg-muted/25 p-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-md bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200">
                <Icon className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-semibold">{receipt.label}</p>
                  <p className="text-[11px] text-muted-foreground">{receipt.source}</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{receipt.detail}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
