"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { DEMO_TEACHER } from "../auth/demo-account";
import { useTeacherAuth } from "../auth/use-teacher-auth";
import { GoogleIdentityButton } from "../components/google-identity-button";

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const { error, signInWithGoogleIdToken, signInWithEmail, reportSignInError, status } = useTeacherAuth();
  const [exchanging, setExchanging] = useState(false);
  // Pre-filled with the shared demo teacher; still editable for anyone with their own account.
  const [email, setEmail] = useState<string>(DEMO_TEACHER.email);
  const [password, setPassword] = useState<string>(DEMO_TEACHER.password);

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

  const handleEmailSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setExchanging(true);
      try {
        const user = await signInWithEmail(email, password);
        if (user) {
          router.replace(nextPath);
        }
      } finally {
        setExchanging(false);
      }
    },
    [email, nextPath, password, router, signInWithEmail],
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

          <div className="mt-6">
            <GoogleIdentityButton onCredential={handleCredential} onLoadError={handleLoadError} disabled={busy} />
          </div>

          <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form className="space-y-3 text-left" onSubmit={handleEmailSubmit} noValidate>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
                className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
            </label>
            <button
              type="submit"
              disabled={busy || email.trim() === "" || password === ""}
              className="h-11 w-full rounded-md bg-primary text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (status === "checking" ? "Checking your session..." : "Signing in...") : "Sign in"}
            </button>
            <p className="text-center text-xs text-slate-500">Demo teacher account for the hackathon jury — already filled in.</p>
          </form>

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
