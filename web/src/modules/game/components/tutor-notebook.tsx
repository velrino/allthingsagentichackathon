"use client";

import { TUTOR_NAME } from "../content/algebra-mission";
import type { StudentMemory } from "../state/student-memory";
import { POD_LABELS } from "../types/game";

type TutorNotebookProps = {
  readonly memory: StudentMemory;
  readonly onClose: () => void;
  readonly onDispute: (noteId: string) => void;
  readonly onReset: () => void;
};

const KIND_LABEL = { misconception: "how you think", habit: "habit" } as const;

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * The tutor's notebook. Everything the agent believes about the student, out in
 * the open — and every note can be pushed back on. That push-back is the feedback
 * loop the challenge asks for.
 */
export function TutorNotebook({ memory, onClose, onDispute, onReset }: TutorNotebookProps) {
  const { notes, preferences, decisions } = memory;

  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-[2px]" role="dialog" aria-label={`${TUTOR_NAME}'s notebook`}>
      <button type="button" aria-label="Close notebook" className="flex-1" onClick={onClose} />

      <aside className="flex h-full w-full max-w-md flex-col bg-[#f4ead2] text-[#2b2114] shadow-2xl">
        <header className="flex items-start justify-between border-b border-[#c9b892] px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
          <div>
            <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-[#7a5c2e] uppercase">{TUTOR_NAME}&apos;s notebook</p>
            <h2 className="chalk mt-1 text-2xl text-[#2b2114] [text-shadow:none]">How you think</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[#c9b892] px-3 py-1.5 text-sm font-medium hover:bg-[#e8dcbd]">
            Close
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="text-xs font-semibold tracking-[0.14em] text-[#7a5c2e] uppercase">Notes ({notes.length})</h3>

            {notes.length === 0 ? (
              <p className="mt-2 text-sm text-[#5b4a2e]">Nothing yet. I write here when I learn how you reason — usually right after a slip.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {notes.map((note) => (
                  <li key={note.id} className="paper-note relative rounded-sm px-4 pt-4 pb-3">
                    <div className="flex items-center gap-2 text-[0.65rem] font-semibold tracking-wide text-[#7a5c2e] uppercase">
                      <span>{KIND_LABEL[note.kind]}</span>
                      <span aria-hidden>·</span>
                      <span>{POD_LABELS[note.skill]}</span>
                      {note.count > 1 ? <span className="ml-auto rounded-full bg-[#d64545] px-1.5 text-white">seen ×{note.count}</span> : null}
                    </div>
                    <p className="chalk mt-1 text-lg leading-snug text-[#2b2114] [text-shadow:none]">{note.text}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[#5b4a2e]">
                      <span>from {note.evidence.join(", ")}</span>
                      <button
                        type="button"
                        onClick={() => onDispute(note.id)}
                        className="rounded border border-[#b89a6a] px-2 py-1 font-medium hover:bg-[#e8dcbd]"
                      >
                        That&apos;s not how I think
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold tracking-[0.14em] text-[#7a5c2e] uppercase">How I&apos;m adapting</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-white/50 p-3">
                <dt className="text-[#7a5c2e]">Explanations</dt>
                <dd className="font-semibold">{preferences.explanationStyle === "visual" ? "Drawn, step by step" : "Written, step by step"}</dd>
              </div>
              <div className="rounded-md bg-white/50 p-3">
                <dt className="text-[#7a5c2e]">Difficulty</dt>
                <dd className="font-semibold">
                  {preferences.difficultyBias === 0 ? "Normal" : preferences.difficultyBias < 0 ? "Easier first" : "Harder first"}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-xs font-semibold tracking-[0.14em] text-[#7a5c2e] uppercase">Decisions ({decisions.length})</h3>

            {decisions.length === 0 ? (
              <p className="mt-2 text-sm text-[#5b4a2e]">Every time I change the plan, I&apos;ll say why here.</p>
            ) : (
              <ol className="mt-2 space-y-2">
                {decisions.map((entry) => (
                  <li key={entry.id} className="rounded-md border border-[#d8c9a3] bg-white/40 p-3 text-sm">
                    <div className="flex items-center justify-between text-[0.65rem] font-semibold tracking-wide text-[#7a5c2e] uppercase">
                      <span>{entry.action.replace("-", " ")}</span>
                      <span>{formatTime(entry.at)}</span>
                    </div>
                    <p className="mt-1 font-medium">{entry.message}</p>
                    <p className="mt-1 text-[#5b4a2e]">Why: {entry.why}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <footer className="border-t border-[#c9b892] px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <button type="button" onClick={onReset} className="text-xs font-medium text-[#7a5c2e] underline-offset-2 hover:underline">
            Forget everything and restart the mission
          </button>
        </footer>
      </aside>
    </div>
  );
}
