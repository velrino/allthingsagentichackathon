import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type MainProps = ComponentProps<"main"> & {
  fixed?: boolean;
  fluid?: boolean;
};

export function Main({ className, fixed, fluid, ...props }: MainProps) {
  return (
    <main
      data-layout={fixed ? "fixed" : "auto"}
      className={cn(
        "px-4 py-6",
        fixed && "flex grow flex-col overflow-hidden",
        !fluid && "mx-auto w-full max-w-7xl",
        className,
      )}
      {...props}
    />
  );
}
