"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { MisconceptionSignal } from "./analytics-data";
import { ChartTooltip } from "./chart-tooltip";

type MisconceptionsChartProps = {
  readonly data: MisconceptionSignal[];
};

export function MisconceptionsChart({ data }: MisconceptionsChartProps) {
  return (
    <div role="img" aria-label="Most common misconceptions captured by Emily">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={126}
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip valueSuffix=" signals" />} />
          <Bar dataKey="signals" name="Captured signals" fill="var(--chart-rose)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
