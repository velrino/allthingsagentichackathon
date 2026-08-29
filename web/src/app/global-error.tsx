"use client";

import { useEffect } from "react";

import { miaAnalytics } from "@/lib/mia-analytics";

export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    miaAnalytics.captureException(error, {
      error_boundary: "global",
      next_error_digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#05070d",
          color: "white",
          display: "flex",
          fontFamily: "sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <main style={{ maxWidth: "420px" }}>
          <p style={{ color: "#94a3b8", fontSize: "14px" }}>ClassGame</p>
          <h1 style={{ fontSize: "28px", margin: "8px 0 0" }}>
            Something went wrong
          </h1>
          <p
            style={{
              color: "#cbd5e1",
              fontSize: "14px",
              lineHeight: 1.6,
              margin: "12px 0 0",
            }}
          >
            The error was recorded. Try loading the application again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#9164f9",
              border: 0,
              borderRadius: "8px",
              color: "white",
              cursor: "pointer",
              fontWeight: 700,
              marginTop: "24px",
              padding: "10px 18px",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
