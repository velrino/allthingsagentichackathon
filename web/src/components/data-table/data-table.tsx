"use client";

import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowData,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { DataTablePagination } from "./pagination";
import { DataTableToolbar } from "./toolbar";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
    thClassName?: string;
    tdClassName?: string;
  }
}

type DataTableProps<TData> = {
  readonly className?: string;
  readonly columns: ColumnDef<TData>[];
  readonly data: TData[];
  readonly emptyMessage?: string;
  readonly getGlobalFilterText: (row: TData) => string;
  readonly minWidthClassName?: string;
  readonly searchPlaceholder?: string;
  readonly onRowClick?: (row: TData) => void;
};

export function DataTable<TData>({
  className,
  columns,
  data,
  emptyMessage = "No results.",
  getGlobalFilterText,
  minWidthClassName = "min-w-[780px]",
  onRowClick,
  searchPlaceholder,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data,
    state: {
      columnVisibility,
      globalFilter,
      sorting,
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const searchValue = String(filterValue).toLowerCase().trim();
      if (!searchValue) {
        return true;
      }

      return getGlobalFilterText(row.original).toLowerCase().includes(searchValue);
    },
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const shouldShowPagination = table.getPageCount() > 1;

  return (
    <div className={cn("flex flex-1 flex-col gap-4 max-sm:has-[div[role='toolbar']]:mb-16", className)}>
      <div role="toolbar">
        <DataTableToolbar table={table} searchPlaceholder={searchPlaceholder} />
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <Table className={minWidthClassName}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(header.column.columnDef.meta?.className, header.column.columnDef.meta?.thClassName)}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(cell.column.columnDef.meta?.className, cell.column.columnDef.meta?.tdClassName)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {shouldShowPagination ? (
        <DataTablePagination table={table} className="mt-auto" />
      ) : null}
    </div>
  );
}
