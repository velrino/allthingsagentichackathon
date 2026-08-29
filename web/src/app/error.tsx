"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { miaAnalytics } from "@/lib/mia-analytics";

export default function AppError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    miaAnalytics.captureException(error, {
      error_boundary: "app",
      next_error_digest: error.digest,
    });
  }, [error]);

  return (
    <main className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold text-muted-foreground">ClassGame</p>
        <h1 className="mt-2 text-2xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The error was recorded. Try loading this part of the app again.
        </p>
        <Button className="mt-6" type="button" onClick={reset}>
          Try again
        </Button>
      </section>
    </main>
  );
}
