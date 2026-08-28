"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { InterventionOutcome } from "./analytics-data";
import { ChartTooltip } from "./chart-tooltip";

type AgentInterventionChartProps = {
  readonly data: InterventionOutcome[];
};

export function AgentInterventionChart({ data }: AgentInterventionChartProps) {
  return (
    <div role="img" aria-label="How students progressed independently, with Emily, or with teacher support">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="stage"
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
          <Bar
            dataKey="independent"
            name="Independent"
            stackId="outcomes"
            fill="var(--chart-purple-1)"
            radius={[0, 0, 3, 3]}
          />
          <Bar dataKey="guided" name="Guided by Emily" stackId="outcomes" fill="var(--chart-purple-2)" />
          <Bar
            dataKey="teacher_support"
            name="Teacher support"
            stackId="outcomes"
            fill="var(--chart-purple-3)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
