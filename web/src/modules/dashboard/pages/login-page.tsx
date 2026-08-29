"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useTeacherAuth } from "../auth/use-teacher-auth";
import { GoogleIdentityButton } from "../components/google-identity-button";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const { error, signInWithGoogleIdToken, reportSignInError, status } = useTeacherAuth();
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => {
    if (status === "signed_in") {
      router.replace(nextPath);
    }
  }, [nextPath, router, status]);

  const handleCredential = useCallback(
    async (idToken: string) => {
      setExchanging(true);
      try {
        const user = await signInWithGoogleIdToken(idToken);
        if (user) {
          router.replace(nextPath);
        }
      } finally {
        setExchanging(false);
      }
    },
    [nextPath, router, signInWithGoogleIdToken],
  );

  const handleLoadError = useCallback(() => {
    reportSignInError("Couldn't load Google sign-in. Check your connection and reload the page.");
  }, [reportSignInError]);

  const busy = exchanging || status === "checking";

  return (
    <main className="flex min-h-svh flex-col justify-center bg-primary text-slate-950 lg:grid lg:grid-cols-2 lg:bg-white">
      {/* Brand half: solid primary, copy only. */}
      <section className="flex flex-col items-center gap-8 bg-primary px-6 pt-8 pb-6 text-center text-primary-foreground sm:px-10 lg:items-start lg:justify-between lg:gap-10 lg:rounded-r-[25%] lg:px-16 lg:py-14 lg:text-left">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
          ClassGame
        </p>
        <div className="max-w-xl">
          <h1 className="text-3xl font-bold sm:text-4xl lg:text-6xl">
            Teacher dashboard
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-white/85 sm:text-lg sm:leading-8 lg:mx-0">
            Set what your class should reinforce, then read Emily&apos;s
            notebook after students play.
          </p>
        </div>
        <p className="hidden text-sm text-white/60 lg:block">
          Emily leads, asks why, takes notes. You read the notebook.
        </p>
      </section>

      {/* Sign-in half: a white card on the purple page on phones, the plain white half on desktop. */}
      <section className="flex justify-center px-4 pb-8 pt-2 text-center sm:px-10 lg:items-center lg:py-12 lg:text-left">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-slate-950 shadow-2xl shadow-black/20 sm:p-8 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none">
          <h2 className="text-2xl font-bold">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Teachers use Google. Students enter from the game.
          </p>

          <div className="mt-8">
            <GoogleIdentityButton onCredential={handleCredential} onLoadError={handleLoadError} disabled={busy} />
            {busy ? (
              <p className="mt-3 text-xs text-slate-500" role="status">
                {status === "checking" ? "Checking your session..." : "Signing in..."}
              </p>
            ) : null}
          </div>

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
