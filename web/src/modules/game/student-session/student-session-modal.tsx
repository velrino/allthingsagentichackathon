"use client";

import { useId, useState } from "react";

import { demoClassCode } from "@/shared/demo-class";

export type StudentSessionFormValue = {
  readonly classId: string;
  readonly studentName: string;
};

type StudentSessionModalProps = {
  readonly error: string | null;
  readonly loading: boolean;
  readonly onSubmit: (value: StudentSessionFormValue) => void;
};

export function StudentSessionModal({ error, loading, onSubmit }: StudentSessionModalProps) {
  const classIdInputId = useId();
  const studentNameInputId = useId();
  const [classId, setClassId] = useState(demoClassCode);
  const [studentName, setStudentName] = useState("");
  const canSubmit = classId.trim().length >= 2 && studentName.trim().length >= 2 && !loading;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-slate-950/72 px-4 py-[max(env(safe-area-inset-top),1rem)] backdrop-blur-md">
      <section className="glass w-full max-w-sm rounded-2xl p-5 text-white shadow-2xl shadow-black/40">
        <div className="text-center">
          <p className="font-display text-[0.68rem] font-semibold tracking-[0.22em] text-cyan-200 uppercase">ClassGame</p>
          <h1 className="font-display mt-2 text-2xl font-bold tracking-tight">Enter the class</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Emily will save your progress for your teacher&apos;s class notebook.</p>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (canSubmit) {
              onSubmit({ classId, studentName });
            }
          }}
        >
          <div>
            <label htmlFor={classIdInputId} className="font-display text-xs font-semibold tracking-[0.16em] text-slate-300 uppercase">
              Class ID
            </label>
            <input
              id={classIdInputId}
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              disabled={loading}
              autoComplete="off"
              className="mt-2 h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-center font-display text-base font-semibold tracking-[0.08em] text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/70 focus:bg-white/12 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor={studentNameInputId} className="font-display text-xs font-semibold tracking-[0.16em] text-slate-300 uppercase">
              Student name
            </label>
            <input
              id={studentNameInputId}
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              disabled={loading}
              autoFocus
              autoComplete="name"
              placeholder="Your name"
              className="mt-2 h-12 w-full rounded-xl border border-white/12 bg-white/8 px-4 text-center text-base font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/70 focus:bg-white/12 disabled:opacity-60"
            />
          </div>

          {error ? <p className="rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-sm leading-5 text-red-100">{error}</p> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="cta font-display flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-bold tracking-tight transition hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Entering..." : "Start mission"}
          </button>
        </form>
      </section>
    </div>
  );
}
