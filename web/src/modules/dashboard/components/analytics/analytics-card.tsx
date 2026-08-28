import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AnalyticsSource = "demo" | "estimated" | "live";

type AnalyticsCardProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly description: string;
  readonly source?: AnalyticsSource;
  readonly title: string;
};

const sourceLabels: Record<AnalyticsSource, string> = {
  demo: "Example",
  estimated: "Based on class signals",
  live: "Live class data",
};

const sourceStyles: Record<AnalyticsSource, string> = {
  demo: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  estimated: "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200",
  live: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
};

export function AnalyticsCard({
  children,
  className,
  contentClassName,
  description,
  source,
  title,
}: AnalyticsCardProps) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          {source ? (
            <span className={cn("rounded-md px-2 py-1 text-[11px] font-semibold", sourceStyles[source])}>
              {sourceLabels[source]}
            </span>
          ) : null}
        </div>
        <CardDescription className="max-w-3xl leading-5">{description}</CardDescription>
      </CardHeader>
      <CardContent className={cn("min-w-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
