"use client";

import type { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type DataTableViewOptionsProps<TData> = {
  readonly table: Table<TData>;
};

export function DataTableViewOptions<TData>({ table }: DataTableViewOptionsProps<TData>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const columns = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide());

  if (columns.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative hidden lg:block">
      <Button type="button" variant="outline" size="sm" className="ms-auto h-8" onClick={() => setOpen((value) => !value)}>
        <Settings2 className="size-4" aria-hidden />
        View
      </Button>

      {open ? (
        <div className="absolute right-0 top-10 z-20 w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Toggle columns</p>
          <div className="my-1 h-px bg-border" />
          {columns.map((column) => (
            <label
              key={column.id}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm capitalize hover:bg-accent hover:text-accent-foreground"
            >
              <input
                type="checkbox"
                checked={column.getIsVisible()}
                onChange={(event) => column.toggleVisibility(event.target.checked)}
                className="size-4 rounded border-input"
              />
              {column.id.replaceAll("_", " ")}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
