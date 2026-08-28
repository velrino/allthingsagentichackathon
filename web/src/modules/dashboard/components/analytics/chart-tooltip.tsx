export type DashboardTooltipEntry = {
  readonly color?: string;
  readonly name?: string;
  readonly value?: number | string;
};

type ChartTooltipProps = {
  readonly active?: boolean;
  readonly label?: string;
  readonly payload?: readonly DashboardTooltipEntry[];
  readonly valueSuffix?: string;
};

export function ChartTooltip({ active, label, payload, valueSuffix = "" }: ChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      {label ? <p className="mb-2 font-semibold">{label}</p> : null}
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-medium">
              {entry.value}
              {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
