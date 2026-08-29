import { cn } from "@/lib/utils";

type PageLoadingFallbackProps = {
  readonly className?: string;
  readonly message?: string;
};

export function PageLoadingFallback({
  className,
  message = "Loading...",
}: PageLoadingFallbackProps) {
  return (
    <main
      className={cn(
        "grid min-h-svh place-items-center bg-background px-4 text-foreground",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
        <span className="size-2 animate-pulse rounded-full bg-primary" />
        {message}
      </div>
    </main>
  );
}
