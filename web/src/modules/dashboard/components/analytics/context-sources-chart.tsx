"use client";

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { ContextSourceSession } from "./analytics-data";
import { ChartTooltip } from "./chart-tooltip";

type ContextSourcesChartProps = {
  readonly data: ContextSourceSession[];
};

export function ContextSourcesChart({ data }: ContextSourcesChartProps) {
  const lastSession = data[data.length - 1];
  const rememberedContext = (lastSession?.past_sessions ?? 0) + (lastSession?.student_memory ?? 0);

  return (
    <div className="space-y-4" role="img" aria-label="Information Emily checked before replying in each session">
      <ResponsiveContainer width="100%" height={310}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barSize={28}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            dataKey="session"
            type="category"
            width={72}
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip valueSuffix="%" />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <Bar
            dataKey="current_conversation"
            name="Current conversation"
            stackId="context"
            fill="var(--chart-collaborative-1)"
            radius={[4, 0, 0, 4]}
          />
          <Bar
            dataKey="past_sessions"
            name="Earlier sessions"
            stackId="context"
            fill="var(--chart-collaborative-2)"
          />
          <Bar
            dataKey="student_memory"
            name="Saved student notes"
            stackId="context"
            fill="var(--chart-collaborative-5)"
          />
          <Bar
            dataKey="lesson_materials"
            name="Lesson materials"
            stackId="context"
            fill="var(--chart-collaborative-7)"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
        By the latest session, <strong>{rememberedContext}%</strong> of the context came from earlier sessions and
        saved student notes. Emily is not starting from zero.
      </div>
    </div>
  );
}
