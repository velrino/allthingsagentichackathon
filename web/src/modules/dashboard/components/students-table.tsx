"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import type { IApiDashboardStudent } from "@/backend/api/api.interface";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { formatDate } from "@/lib/date";

type StudentsTableProps = {
  readonly students: IApiDashboardStudent[];
  readonly onStudentClick?: (student: IApiDashboardStudent) => void;
};

export function StudentsTable({ students, onStudentClick }: StudentsTableProps) {
  const columns = useMemo<ColumnDef<IApiDashboardStudent>[]>(
    () => [
      {
        accessorKey: "student_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Student" />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.student_name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(row.original.last_activity_at, {
                fallback: "No mission",
                preset: "date-time",
              })}
            </p>
          </div>
        ),
        meta: {
          className: "ps-4 max-w-0 w-[24%]",
        },
      },
      {
        id: "progress",
        accessorFn: (row) => row.progress.percentage,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Progress" />,
        cell: ({ row }) => (
          <div className="w-56">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-foreground">{row.original.progress.percentage}%</span>
              <span className={statusClassName(row.original.progress.status)}>
                {statusLabel(row.original.progress.status)}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-cyan-500"
                style={{ width: `${row.original.progress.percentage}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {row.original.progress.completed_questions}/{row.original.progress.total_questions} questions
            </p>
          </div>
        ),
        meta: {
          className: "ps-1",
          tdClassName: "ps-4",
        },
      },
      {
        id: "strengths",
        accessorFn: (row) => row.strengths.join(", "),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Positive signals" />,
        cell: ({ row }) => (
          <span className="block max-w-[260px] truncate text-muted-foreground">{row.original.strengths.join(", ")}</span>
        ),
        meta: {
          className: "ps-1",
          tdClassName: "ps-4",
        },
      },
      {
        id: "improvement_areas",
        accessorFn: (row) => row.improvement_areas.join(", "),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Improve" />,
        cell: ({ row }) => (
          <span className="block max-w-[260px] truncate text-muted-foreground">
            {row.original.improvement_areas.join(", ")}
          </span>
        ),
        meta: {
          className: "ps-1",
          tdClassName: "ps-4",
        },
      },
      {
        id: "attempts",
        accessorFn: (row) => row.attempts.length,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Tasks" />,
        cell: ({ row }) => (
          <div>
            <span className="rounded-md bg-violet-50 px-2 py-1 font-semibold text-violet-700">
              {row.original.attempts.length} {row.original.attempts.length === 1 ? "attempt" : "attempts"}
            </span>
            <p className="mt-2 text-xs font-medium text-cyan-700">View learning path</p>
          </div>
        ),
        meta: {
          className: "ps-1",
          tdClassName: "ps-4",
        },
      },
      {
        accessorKey: "notebook_notes",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Notes" />,
        cell: ({ row }) => (
          <span className="rounded-md bg-muted px-2 py-1 font-semibold text-muted-foreground">
            {row.original.notebook_notes}
          </span>
        ),
        meta: {
          className: "ps-1 pe-4",
          tdClassName: "ps-4 pe-4",
        },
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={students}
      emptyMessage="No students yet."
      getGlobalFilterText={(student) =>
        [
          student.student_name,
          student.class_id,
          student.progress.status,
          student.strengths.join(" "),
          student.improvement_areas.join(" "),
        ].join(" ")
      }
      minWidthClassName="min-w-[980px]"
      onRowClick={onStudentClick}
      searchPlaceholder="Filter students..."
    />
  );
}

function statusLabel(status: string) {
  if (status === "completed") {
    return "Completed";
  }
  if (status === "needs_attention") {
    return "Needs help";
  }
  if (status === "abandoned") {
    return "Left early";
  }

  return "In progress";
}

function statusClassName(status: string) {
  const base = "rounded-md px-2 py-1 text-xs font-bold";

  if (status === "completed") {
    return `${base} bg-emerald-50 text-emerald-700`;
  }
  if (status === "needs_attention") {
    return `${base} bg-rose-50 text-rose-700`;
  }
  if (status === "abandoned") {
    return `${base} bg-amber-50 text-amber-800`;
  }

  return `${base} bg-cyan-50 text-cyan-700`;
}
