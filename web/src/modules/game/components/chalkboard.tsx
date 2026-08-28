"use client";

import { useState } from "react";

import { buildWhyOptions } from "../agent/mock-tutor";
import { MISSION_TITLE, TUTOR_NAME, type Explanation, type Question, type Visual } from "../content/algebra-mission";
import { shuffledMoves, type Lesson } from "../state/session-reducer";
import type { PodProgress, StudentNote } from "../state/student-memory";
import { POD_LABELS, type ExplanationStyle, type FeedbackValue, type PodId } from "../types/game";
import { PodDots } from "./game-hud";

type ChalkboardProps = {
  readonly lesson: Lesson;
  readonly progress: Record<PodId, PodProgress>;
  readonly notes: readonly StudentNote[];
  readonly explanationStyle: ExplanationStyle;
  readonly onChoose: (index: number) => void;
  readonly onStep: (index: number) => void;
  readonly onWhy: (reasoning: { misconceptionId: string } | { text: string }) => void;
  readonly onExplainNext: () => void;
  readonly onFeedback: (value: FeedbackValue) => void;
  readonly onContinue: () => void;
  readonly onStand: () => void;
  readonly onOpenNotebook: () => void;
};

/** Slight, deterministic tilt per option so the board reads as handwriting, not a form. */
const TILT = ["-rotate-1", "rotate-1", "rotate-[0.5deg]", "-rotate-[1.5deg]"];

const chalkButton =
  "chalk-line chalk pointer-events-auto rounded-sm border-2 px-4 py-3 text-2xl leading-none transition hover:bg-white/10 active:bg-white/15 active:translate-y-px disabled:opacity-40 sm:text-3xl";
const chalkPrimary = `${chalkButton} border-chalk-accent text-chalk-accent`;

const FEEDBACK: readonly { value: FeedbackValue; label: string; emoji: string }[] = [
  { value: "helpful", label: "Helpful", emoji: "👍" },
  { value: "confusing", label: "Confusing", emoji: "😵‍💫" },
  { value: "too-easy", label: "Too easy", emoji: "🥱" },
  { value: "too-hard", label: "Too hard", emoji: "🔥" },
];

// ── visuals ─────────────────────────────────────────────────────────────────

function FractionBar({ num, den, label }: { readonly num: number; readonly den: number; readonly label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="chalk w-24 text-right text-xl">{label}</span>
      <div className="chalk-line flex h-8 flex-1 gap-[3px] rounded-sm border-2 p-[3px]">
        {Array.from({ length: den }, (_, index) => (
          <div key={index} className={`flex-1 rounded-[2px] ${index < num ? "bg-chalk-ink/85" : "bg-white/5"}`} />
        ))}
      </div>
    </div>
  );
}

function ChainVisual({ lines, upTo }: { readonly lines: readonly string[]; readonly upTo: number }) {
  return (
    <ol className="chalk space-y-1">
      {lines.slice(0, upTo).map((line, index) => {
        const isOp = index % 2 === 1;

        return (
          <li key={`${line}-${index}`} className={`animate-pop ${isOp ? "pl-8 text-lg text-chalk-accent" : "text-3xl"}`}>
            {isOp ? `↓ ${line}` : line}
          </li>
        );
      })}
    </ol>
  );
}

function VisualExplanation({ visual, upTo }: { readonly visual: Visual; readonly upTo: number }) {
  if (visual.kind === "fraction-bars") {
    return (
      <div className="space-y-3">
        {visual.bars.slice(0, upTo).map((bar) => (
          <div key={bar.label} className="animate-pop">
            <FractionBar {...bar} />
          </div>
        ))}
      </div>
    );
  }

  // Each explanation step reveals one more "equation + move" pair.
  return <ChainVisual lines={visual.lines} upTo={Math.min(visual.lines.length, upTo * 2 + 1)} />;
}

// ── phases ──────────────────────────────────────────────────────────────────

function QuestionPhase({ lesson, onChoose, onStep }: Pick<ChalkboardProps, "lesson" | "onChoose" | "onStep">) {
  const { question } = lesson;

  if (question.kind === "choice") {
    return (
      <>
        <p className="chalk text-4xl leading-tight sm:text-5xl">{question.prompt}</p>
        <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
          {question.options.map((option, index) => (
            <button key={option.text} type="button" onClick={() => onChoose(index)} className={`${chalkButton} ${TILT[index % TILT.length]}`}>
              {option.text}
            </button>
          ))}
        </div>
      </>
    );
  }

  const moves = shuffledMoves(question.id, lesson.stepIndex, question.steps[lesson.stepIndex]);

  return (
    <>
      <p className="chalk text-base text-chalk-ink/70">Get x alone. Pick the next move.</p>
      <ol className="chalk mt-2 space-y-1">
        {lesson.lines.map((line, index) => (
          <li key={`${line}-${index}`} className={`text-4xl leading-tight sm:text-5xl ${index === 0 ? "" : "animate-pop"}`}>
            {line}
          </li>
        ))}
      </ol>
      <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
        {moves.map((move, index) => (
          <button key={move.op} type="button" onClick={() => onStep(index)} className={`${chalkButton} text-xl sm:text-2xl ${TILT[index % TILT.length]}`}>
            {move.op}
          </button>
        ))}
      </div>
    </>
  );
}

function CorrectPhase({ lesson, onContinue }: Pick<ChalkboardProps, "lesson" | "onContinue">) {
  const lastLine = lesson.question.kind === "steps" ? lesson.lines[lesson.lines.length - 1] : lesson.question.options.find((o) => o.correct)?.text;

  return (
    <>
      <p className="chalk animate-pop text-6xl text-chalk-right">✓</p>
      <p className="chalk mt-2 text-4xl">{lastLine}</p>
      <p className="chalk mt-4 text-xl text-chalk-ink/80">{lesson.clean ? "Clean. That one counts." : "Right — and now you know why."}</p>
      <div className="mt-auto pt-6">
        <button type="button" onClick={onContinue} className={`${chalkPrimary} w-full`}>
          Next →
        </button>
      </div>
    </>
  );
}

function WhyPhase({ lesson, onWhy }: Pick<ChalkboardProps, "lesson" | "onWhy">) {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const wrong = lesson.wrong;

  if (!wrong) {
    return null;
  }

  const options = buildWhyOptions(lesson.question, wrong.misconception);
  const isSteps = lesson.question.kind === "steps";

  return (
    <>
      {isSteps ? (
        // Show what the wrong move actually did to the equation: the +1 didn't disappear, it doubled.
        <ol className="chalk mb-3 space-y-1">
          {lesson.lines.map((line, index) => {
            const isLast = index === lesson.lines.length - 1;

            return (
              <li key={`${line}-${index}`} className={`text-3xl leading-tight sm:text-4xl ${isLast ? "animate-pop text-chalk-wrong" : "text-chalk-ink/60"}`}>
                {isLast ? `${wrong.chosen} → ${line}` : line}
              </li>
            );
          })}
        </ol>
      ) : null}
      <p className="chalk text-2xl text-chalk-wrong sm:text-3xl">Not yet — and I&apos;m not telling you the answer.</p>
      <p className="chalk mt-3 text-4xl leading-tight sm:text-5xl">
        Why did you pick <span className="underline decoration-wavy decoration-chalk-wrong/70">{wrong.chosen}</span>?
      </p>

      {writing ? (
        <form
          className="mt-auto flex flex-col gap-3 pt-6"
          onSubmit={(event) => {
            event.preventDefault();

            if (text.trim().length > 1) {
              onWhy({ text });
            }
          }}
        >
          <textarea
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="Tell me how you were thinking…"
            className="chalk chalk-line pointer-events-auto w-full resize-none rounded-sm border-2 bg-transparent px-3 py-2 text-xl outline-none placeholder:text-chalk-ink/40"
          />
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setWriting(false)} className={`${chalkButton} text-xl`}>
              Back
            </button>
            <button type="submit" disabled={text.trim().length < 2} className={`${chalkPrimary} text-xl`}>
              That&apos;s why
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-auto grid gap-3 pt-6">
          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onWhy({ misconceptionId: option.id })}
              className={`${chalkButton} text-left text-xl sm:text-2xl ${TILT[index % TILT.length]}`}
            >
              “{option.label}”
            </button>
          ))}
          <button type="button" onClick={() => setWriting(true)} className={`${chalkButton} text-xl text-chalk-ink/80`}>
            ✎ Write it in my own words
          </button>
        </div>
      )}
    </>
  );
}

function ExplainPhase({
  lesson,
  explanationStyle,
  onExplainNext,
}: Pick<ChalkboardProps, "lesson" | "explanationStyle" | "onExplainNext">) {
  const explanation: Explanation = lesson.question.explanation;
  const shown = lesson.explainIndex + 1;
  const isLast = shown >= explanation.steps.length;

  return (
    <>
      <p className="chalk text-base text-chalk-ink/70">
        {explanationStyle === "visual" ? "Let me draw it." : "Step by step."} · {shown}/{explanation.steps.length}
      </p>

      {explanationStyle === "visual" ? (
        <div className="mt-3">
          <VisualExplanation visual={explanation.visual} upTo={shown} />
          <p key={shown} className="chalk animate-pop mt-4 text-2xl leading-snug sm:text-3xl">
            {explanation.steps[lesson.explainIndex]}
          </p>
        </div>
      ) : (
        <ol className="chalk mt-3 space-y-3">
          {explanation.steps.slice(0, shown).map((step, index) => (
            <li key={step} className={`flex gap-3 text-2xl leading-snug sm:text-3xl ${index === lesson.explainIndex ? "animate-pop" : "text-chalk-ink/70"}`}>
              <span className="text-chalk-accent">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-auto pt-6">
        <button type="button" onClick={onExplainNext} className={`${chalkPrimary} w-full`}>
          {isLast ? "Got it" : "Next step →"}
        </button>
      </div>
    </>
  );
}

function FeedbackPhase() {
  return (
    <>
      <p className="chalk text-4xl leading-tight sm:text-5xl">How was that explanation?</p>
      <p className="chalk mt-3 text-xl text-chalk-ink/70">Be honest — I change how I teach based on this.</p>
    </>
  );
}

function ThinkingPhase() {
  return (
    <div className="chalk flex flex-1 flex-col items-center justify-center gap-3 text-2xl text-chalk-ink/80">
      <span className="animate-think size-4 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" aria-hidden />
      {TUTOR_NAME} is thinking…
    </div>
  );
}

function DecisionPhase({ lesson, onContinue }: Pick<ChalkboardProps, "lesson" | "onContinue">) {
  const decision = lesson.decision;

  if (!decision) {
    return null;
  }

  const leaves = decision.action === "mission-complete";

  return (
    <>
      <p className="chalk text-base text-chalk-ink/70">{TUTOR_NAME} decided</p>
      <p className="chalk animate-pop mt-2 text-3xl leading-tight sm:text-4xl">{decision.message}</p>
      <div className="chalk-line mt-4 rounded-sm border-2 border-dashed border-chalk-accent/60 p-3">
        <p className="chalk text-sm tracking-[0.14em] text-chalk-accent uppercase">Why</p>
        <p className="chalk mt-1 text-xl leading-snug sm:text-2xl">{decision.why}</p>
      </div>
      <div className="mt-auto pt-6">
        <button type="button" onClick={onContinue} className={`${chalkPrimary} w-full`}>
          {leaves ? "Stand up →" : "Continue →"}
        </button>
      </div>
    </>
  );
}

// ── board ───────────────────────────────────────────────────────────────────

function questionLabel(question: Question) {
  return question.kind === "choice" ? "Multiple choice" : `${question.steps.length}-move equation`;
}

/**
 * The whole lesson lives on this board — Bully's math class, minus the timer.
 * Question and options in chalk; the tutor's notes pinned beside it.
 */
export function Chalkboard(props: ChalkboardProps) {
  const { lesson, progress, notes, onFeedback, onStand, onOpenNotebook } = props;
  const recentNotes = notes.slice(0, 3);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/45 backdrop-blur-[2px]">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 sm:px-6">
        <section className="chalk-board flex min-h-0 flex-1 flex-col rounded-md border-[10px] border-chalk-frame p-4 max-h-[68dvh] sm:max-h-none sm:p-6">
          <header className="flex items-start justify-between gap-3">
            <div className="chalk leading-tight">
              <p className="text-lg text-chalk-ink/80">
                {MISSION_TITLE} · {POD_LABELS[lesson.pod]}
              </p>
              <p className="text-base text-chalk-ink/60">
                Prof. {TUTOR_NAME} · {questionLabel(lesson.question)}
              </p>
            </div>
            <PodDots progress={progress} className="mt-1" />
          </header>

          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
            {lesson.phase === "question" ? <QuestionPhase {...props} /> : null}
            {lesson.phase === "correct" ? <CorrectPhase {...props} /> : null}
            {lesson.phase === "why" ? <WhyPhase key={lesson.question.id + lesson.stepIndex} {...props} /> : null}
            {lesson.phase === "explain" ? <ExplainPhase {...props} /> : null}
            {lesson.phase === "feedback" ? <FeedbackPhase /> : null}
            {lesson.phase === "thinking" ? <ThinkingPhase /> : null}
            {lesson.phase === "decision" ? <DecisionPhase {...props} /> : null}
          </div>
        </section>

        {/* Pinned notes: the tutor's notebook, as paper on the wall. */}
        <button
          type="button"
          onClick={onOpenNotebook}
          className="mt-auto flex items-center gap-2 overflow-x-auto rounded-md px-1 pt-3 pb-1 text-left"
          aria-label={`Open ${TUTOR_NAME}'s notebook`}
        >
          <span className="font-display shrink-0 text-[0.65rem] font-semibold tracking-[0.18em] text-slate-300 uppercase">📌 Notes</span>
          {recentNotes.length === 0 ? (
            <span className="text-xs text-slate-400">nothing pinned yet</span>
          ) : (
            recentNotes.map((note, index) => (
              <span
                key={note.id}
                className={`paper-note relative shrink-0 max-w-[14rem] truncate rounded-sm px-3 pt-2.5 pb-1.5 text-xs ${index === 0 ? "animate-pop" : ""} ${TILT[index]}`}
              >
                {note.text}
              </span>
            ))
          )}
          {notes.length > 3 ? <span className="shrink-0 text-xs text-slate-300">+{notes.length - 3}</span> : null}
        </button>

        <footer className="mt-2 flex items-center gap-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          {lesson.phase === "feedback" ? (
            <div className="grid flex-1 grid-cols-4 gap-2">
              {FEEDBACK.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onFeedback(item.value)}
                  className="glass font-display animate-rise flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[0.7rem] font-semibold text-white transition hover:bg-white/10 active:translate-y-px sm:text-xs"
                >
                  <span className="text-base leading-none" aria-hidden>
                    {item.emoji}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          {lesson.phase !== "feedback" ? (
            <button
              type="button"
              onClick={onStand}
              className="glass font-display h-12 shrink-0 rounded-full px-5 text-sm font-semibold text-white transition hover:bg-white/10 active:translate-y-px"
            >
              Stand up
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
