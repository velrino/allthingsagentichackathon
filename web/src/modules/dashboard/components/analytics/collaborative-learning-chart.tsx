"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { LearningSignal } from "./analytics-data";
import { ChartTooltip } from "./chart-tooltip";

type CollaborativeLearningChartProps = {
  readonly data: LearningSignal[];
};

export function CollaborativeLearningChart({ data }: CollaborativeLearningChartProps) {
  const gradientId = `mastery-fill-${useId().replaceAll(":", "")}`;
  const firstSignal = data[0];
  const lastSignal = data[data.length - 1];
  const clarificationReduction = Math.max(
    (firstSignal?.clarification_load ?? 0) - (lastSignal?.clarification_load ?? 0),
    0,
  );

  return (
    <div className="space-y-4" role="img" aria-label="Mastery, confidence, and clarification load across the activity">
      <ResponsiveContainer width="100%" height={330}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-primary)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            direction="ltr"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<ChartTooltip valueSuffix="%" />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="mastery"
            name="Skill mastery"
            stroke="var(--chart-primary)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
          <Line
            type="monotone"
            dataKey="confidence"
            name="Student confidence"
            stroke="var(--chart-cyan)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="clarification_load"
            name="Clarification load"
            stroke="var(--chart-amber)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="grid divide-y divide-border border-t border-border text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <ChartInsight
          label="Blockers reduced"
          value={`${clarificationReduction} pts`}
          detail="Lower clarification load by the exit task"
        />
        <ChartInsight label="Captured feedback" value="18" detail="Notebook signals in the activity" />
        <ChartInsight label="Next adaptation" value="3 skills" detail="Queued for the next lesson" />
      </div>
    </div>
  );
}

function ChartInsight({ detail, label, value }: { readonly detail: string; readonly label: string; readonly value: string }) {
  return (
    <div className="px-3 py-3 first:ps-0 last:pe-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}
