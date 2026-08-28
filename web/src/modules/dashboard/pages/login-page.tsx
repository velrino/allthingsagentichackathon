"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useTeacherAuth } from "../auth/use-teacher-auth";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const { error, signInWithGoogle, status } = useTeacherAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "signed_in") {
      router.replace(nextPath);
    }
  }, [nextPath, router, status]);

  async function handleGoogleSignIn() {
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace(nextPath);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-svh bg-slate-950 px-4 py-6 text-white sm:px-6">
      <section className="mx-auto grid w-full max-w-6xl content-center gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase text-cyan-300">ClassGame</p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Teacher dashboard</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-300">
            Set what your class should reinforce, then read Emily&apos;s notebook after students play.
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-white p-5 text-slate-950 shadow-2xl sm:p-6">
          <div>
            <h2 className="text-2xl font-bold">Sign in</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Teachers use Google. Students enter from the game.</p>
          </div>

          <button
            type="button"
            disabled={submitting || status === "checking"}
            onClick={handleGoogleSignIn}
            className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="grid size-5 place-items-center rounded-full border border-slate-300 text-xs font-black text-cyan-700">
              G
            </span>
            {submitting || status === "checking" ? "Checking..." : "Continue with Google"}
          </button>

          {error ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}
