"use client";

import { BrainCircuit } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { AdaptationSession } from "./analytics-data";
import { ChartTooltip } from "./chart-tooltip";

type AdaptationOverTimeChartProps = {
  readonly data: AdaptationSession[];
};

export function AdaptationOverTimeChart({ data }: AdaptationOverTimeChartProps) {
  const firstSession = data[0];
  const lastSession = data[data.length - 1];
  const understandingGain = Math.max(
    (lastSession?.understanding ?? 0) - (firstSession?.understanding ?? 0),
    0,
  );
  const helpReduction = Math.max((firstSession?.help_needed ?? 0) - (lastSession?.help_needed ?? 0), 0);
  const rememberedSessions = data.filter((session) => session.memory_used).map((session) => session.session);

  return (
    <div className="space-y-4" role="img" aria-label="Understanding, confidence, and help needed across sessions">
      <ResponsiveContainer width="100%" height={310}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="session"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<ChartTooltip valueSuffix="%" />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="understanding"
            name="Understanding"
            stroke="var(--chart-collaborative-1)"
            strokeWidth={3}
            dot={{ fill: "var(--chart-collaborative-1)", r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="confidence"
            name="Confidence"
            stroke="var(--chart-collaborative-2)"
            strokeWidth={2.5}
            dot={{ fill: "var(--chart-collaborative-2)", r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="help_needed"
            name="Extra help needed"
            stroke="var(--chart-collaborative-5)"
            strokeDasharray="6 4"
            strokeWidth={2.5}
            dot={{ fill: "var(--chart-collaborative-5)", r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
        <BrainCircuit className="size-4 shrink-0" aria-hidden />
        <span className="font-semibold">Emily reused saved learning notes in:</span>
        {rememberedSessions.map((session) => (
          <span key={session} className="rounded-md bg-white/80 px-2 py-1 font-medium dark:bg-white/10">
            {session}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center">
        <ChartSummary label="Understanding" value={`+${understandingGain} pts`} />
        <ChartSummary label="Less extra help" value={`-${helpReduction} pts`} />
        <ChartSummary label="Memory reused" value={`${rememberedSessions.length} times`} />
      </div>
    </div>
  );
}

function ChartSummary({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="px-2 pt-3">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
