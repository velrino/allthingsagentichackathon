"use client";

import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INPUT_LIMITS, limitInput } from "@/shared/input-limits";

import { DataTableViewOptions } from "./view-options";

type DataTableToolbarProps<TData> = {
  readonly searchPlaceholder?: string;
  readonly table: Table<TData>;
};

export function DataTableToolbar<TData>({ searchPlaceholder = "Filter...", table }: DataTableToolbarProps<TData>) {
  const globalFilter = table.getState().globalFilter ?? "";
  const isFiltered = String(globalFilter).length > 0 || table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-1 flex-col-reverse items-start gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder={searchPlaceholder}
          value={String(globalFilter)}
          onChange={(event) =>
            table.setGlobalFilter(
              limitInput(event.target.value, INPUT_LIMITS.search),
            )
          }
          maxLength={INPUT_LIMITS.search}
          className="h-8 w-full sm:w-48 lg:w-64"
        />
        {isFiltered ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              table.setGlobalFilter("");
            }}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ms-2 size-4" aria-hidden />
          </Button>
        ) : null}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
