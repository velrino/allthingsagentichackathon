"use client";

import {
  BrainCircuit,
  CheckCircle2,
  History,
  LoaderCircle,
  MessageCircleMore,
  Route,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  IApiDashboardStudent,
  IApiStudentLearningAttempt,
  IApiStudentLearningEvent,
  IApiStudentTutorTurn,
} from "@/backend/api/api.interface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/date";

import { DashboardModal } from "./dashboard-modal";
import { MissionFlowPreview } from "./mission-flow-preview";

type StudentLearningDetailProps = {
  readonly open: boolean;
  readonly student: IApiDashboardStudent | null;
  readonly onOpenChange: (open: boolean) => void;
};

export function StudentLearningDetail({
  open,
  student,
  onOpenChange,
}: StudentLearningDetailProps) {
  const [selectedAttemptId, setSelectedAttemptId] = useState(
    safeList(student?.attempts)[0]?.id ?? "",
  );
  const [activeTab, setActiveTab] = useState("conversation");
  const attempts = useMemo(() => safeList(student?.attempts), [student]);
  const attempt = useMemo(
    () =>
      attempts.find((item) => item.id === selectedAttemptId) ??
      attempts[0] ??
      null,
    [attempts, selectedAttemptId],
  );

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title={student?.student_name ?? "Student learning path"}
      description="Observable answers, explicit explanations, feedback, and tutor adaptations. This view never invents or exposes private chain-of-thought."
      size="xl"
      layout="fill"
    >
      {attempt ? (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="shrink-0 border-b border-border bg-muted/20 px-4 py-3 sm:px-6">
            {attempts.length > 1 ? (
              <AttemptSwitcher
                attempts={attempts}
                selectedId={attempt.id}
                onSelect={setSelectedAttemptId}
              />
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList className="grid w-full grid-cols-4 sm:inline-flex sm:w-fit">
                <TabsTrigger value="conversation">
                  <MessageCircleMore aria-hidden />
                  <span className="sr-only sm:not-sr-only">Conversation</span>
                </TabsTrigger>
                <TabsTrigger value="summary">
                  <BrainCircuit aria-hidden />
                  <span className="sr-only sm:not-sr-only">Summary</span>
                </TabsTrigger>
                <TabsTrigger value="flow">
                  <Route aria-hidden />
                  <span className="sr-only sm:not-sr-only">Learning flow</span>
                </TabsTrigger>
                <TabsTrigger value="memory">
                  <Sparkles aria-hidden />
                  <span className="sr-only sm:not-sr-only">Memory</span>
                </TabsTrigger>
              </TabsList>

              <div className="flex flex-wrap items-center gap-2">
                <AttemptStatus attempt={attempt} />
                <LiveUpdateStatus attempt={attempt} />
              </div>
            </div>
          </div>

          <TabsContent
            value="conversation"
            className="flex min-h-0 flex-1 flex-col"
          >
            <LearningConversation
              active={activeTab === "conversation"}
              attempt={attempt}
              studentName={
                student?.student_name || attempt.student_name || "Student"
              }
            />
          </TabsContent>

          <TabsContent
            value="summary"
            className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto p-4 sm:p-6"
          >
            {attempt.status === "abandoned" || attempt.status === "paused" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <p className="text-sm font-bold">
                  {attempt.status === "abandoned"
                    ? "Student left before finishing"
                    : "Student paused this mission"}
                </p>
                <p className="mt-2 text-sm leading-6">
                  Last checkpoint: {checkpointLabel(attempt)}. Their next visit
                  resumes from this exact step.
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                <BrainCircuit className="size-4 text-cyan-700" aria-hidden />
                Evidence-based summary
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {attempt.trace?.summary ||
                  "Emily is collecting observable evidence for this attempt."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SignalPanel
                icon={CheckCircle2}
                label="Strengths"
                tone="emerald"
                values={attempt.trace?.strengths}
              />
              <SignalPanel
                icon={Target}
                label="Areas to revisit"
                tone="amber"
                values={attempt.trace?.improvement_areas}
              />
            </div>

            <AttemptProgress attempt={attempt} />
          </TabsContent>

          <TabsContent
            value="flow"
            className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          >
            <div className="mb-3 flex items-start gap-3 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
              <Route className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="leading-6">
                Nodes come from captured interactions. Gemini organizes the
                completed path and connects support, retries and mastery.
              </p>
            </div>
            <MissionFlowPreview
              emptyMessage="Learning events will appear here as the student works."
              flow={attempt.trace?.flow}
            />
          </TabsContent>

          <TabsContent
            value="memory"
            className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto p-4 sm:p-6"
          >
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-violet-950">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Sparkles className="size-4" aria-hidden />
                Next adaptive turn
              </div>
              <p className="mt-3 text-sm leading-6">
                {attempt.trace?.next_adaptation ||
                  "Retrieve this attempt before the next student interaction."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MemoryStat
                label="Recorded events"
                value={String(safeList(attempt.snapshot?.events).length)}
              />
              <MemoryStat
                label="Teacher notes"
                value={String(safeList(attempt.snapshot?.notes).length)}
              />
              <MemoryStat
                label="Tutor turns"
                value={String(safeList(attempt.tutor_turns).length)}
              />
            </div>

            <div className="rounded-lg border border-border p-4 text-sm leading-6 text-muted-foreground">
              <p className="font-semibold text-foreground">Trace provenance</p>
              <p className="mt-2">
                {attempt.trace?.generated_by_ai
                  ? `Generated by ${attempt.trace.model || "Gemini"} from ${attempt.trace.event_count} observable events.`
                  : `Built directly from ${attempt.trace?.event_count ?? 0} observable events${attempt.trace?.fallback_reason ? ` · ${attempt.trace.fallback_reason}` : ""}.`}
              </p>
              <p className="mt-1">
                Last activity:{" "}
                {formatDate(attempt.last_activity_at, {
                  fallback: "Not available",
                  preset: "date-time",
                  relative: true,
                })}
              </p>
              <p className="mt-1">
                Processing state: {attempt.trace_state || "live"}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-sm">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
              <History className="size-5 text-muted-foreground" aria-hidden />
            </span>
            <p className="mt-4 font-semibold">No recorded attempt yet</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The learning flow appears after this student starts answering
              inside the mission.
            </p>
          </div>
        </div>
      )}
    </DashboardModal>
  );
}

function AttemptSwitcher({
  attempts,
  selectedId,
  onSelect,
}: {
  readonly attempts: readonly IApiStudentLearningAttempt[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-xs font-semibold text-muted-foreground">
        Attempts
      </span>
      {attempts.map((item, index) => {
        const selected = item.id === selectedId;

        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(item.id)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${
              selected
                ? "border-cyan-300 bg-cyan-50 font-bold text-cyan-950"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            #{attempts.length - index} · {item.subject || "Mission"} · rev.{" "}
            {item.published_revision}
          </button>
        );
      })}
    </div>
  );
}

function AttemptStatus({
  attempt,
}: {
  readonly attempt: IApiStudentLearningAttempt;
}) {
  const completed = attempt.status === "completed";
  const abandoned = attempt.status === "abandoned";
  const paused = attempt.status === "paused";

  return (
    <span
      className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${
        completed
          ? "bg-emerald-100 text-emerald-800"
          : abandoned
            ? "bg-rose-100 text-rose-800"
            : paused
              ? "bg-amber-100 text-amber-800"
              : "bg-cyan-100 text-cyan-800"
      }`}
    >
      {completed
        ? "Completed"
        : abandoned
          ? "Left early"
          : paused
            ? "Paused"
            : "In progress"}
    </span>
  );
}

function LiveUpdateStatus({
  attempt,
}: {
  readonly attempt: IApiStudentLearningAttempt;
}) {
  const processing = isInsightProcessing(attempt.trace_state);
  const failed = attempt.trace_state === "failed";
  const active = !["completed", "abandoned", "paused"].includes(attempt.status);
  const ready = attempt.trace_state === "ready";
  const label = processing
    ? "Updating insights"
    : failed
      ? "Insight update failed"
      : active
        ? "Live updates"
        : ready
          ? "Insights ready"
          : "Watching updates";
  const tone = failed
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : ready && !active
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-cyan-200 bg-cyan-50 text-cyan-700";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-bold ${tone}`}
      aria-live="polite"
    >
      {processing ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
      ) : ready && !active ? (
        <CheckCircle2 className="size-3.5" aria-hidden />
      ) : (
        <span
          className={`size-2 rounded-full ${failed ? "bg-rose-500" : "animate-pulse bg-cyan-500"}`}
          aria-hidden
        />
      )}
      {label}
    </span>
  );
}

function SignalPanel({
  icon: Icon,
  label,
  tone,
  values,
}: {
  readonly icon: typeof CheckCircle2;
  readonly label: string;
  readonly tone: "amber" | "emerald";
  readonly values: readonly string[] | null | undefined;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
      : "border-amber-200 bg-amber-50/60 text-amber-950";
  const safeValues = safeList(values);

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-sm font-bold">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <ul className="mt-3 grid gap-2 text-sm leading-6">
        {(safeValues.length > 0
          ? safeValues
          : ["More evidence is needed."]
        ).map((value) => (
          <li key={value} className="flex gap-2">
            <span aria-hidden>•</span>
            <span>{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AttemptProgress({
  attempt,
}: {
  readonly attempt: IApiStudentLearningAttempt;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {safeList(attempt.snapshot?.progress).map((stage) => {
        const percentage =
          stage.required > 0
            ? Math.min(100, Math.round((stage.correct / stage.required) * 100))
            : stage.status === "complete"
              ? 100
              : 0;

        return (
          <div
            key={stage.stage_id}
            className="rounded-lg border border-border p-4"
          >
            <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {stage.stage_id.replaceAll("-", " ")}
            </p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <span className="text-2xl font-black">{percentage}%</span>
              <span className="text-xs text-muted-foreground">
                {stage.correct}/{stage.required}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-cyan-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LearningConversation({
  active,
  attempt,
  studentName,
}: {
  readonly active: boolean;
  readonly attempt: IApiStudentLearningAttempt;
  readonly studentName: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const previousVersionRef = useRef("");
  const turns = [...safeList(attempt.tutor_turns)].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const canHavePendingTurn =
    (attempt.trace_state || "live") === "live" &&
    !["completed", "abandoned", "paused"].includes(attempt.status);
  const pendingEvent = canHavePendingTurn
    ? latestPendingEvent(attempt.snapshot?.events, turns)
    : null;
  const processingConclusion = isInsightProcessing(attempt.trace_state);
  const conclusionReady = attempt.trace_state === "ready";
  const conclusionFailed = attempt.trace_state === "failed";
  const version = `${attempt.id}:${attempt.updated_at}:${turns.length}:${pendingEvent?.id ?? "none"}:${attempt.trace_state}`;
  const hasMessages =
    turns.length > 0 ||
    pendingEvent !== null ||
    processingConclusion ||
    conclusionReady ||
    conclusionFailed;

  useEffect(() => {
    if (!active) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: previousVersionRef.current ? "smooth" : "auto",
      });
      previousVersionRef.current = version;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [active, version]);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-muted/30">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-4 py-3 sm:px-6">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700">
          <MessageCircleMore className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold">Emily and {studentName}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            New messages appear here automatically.
          </p>
        </div>
      </header>

      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
        aria-live="polite"
      >
        {hasMessages ? (
          <ol className="grid gap-6">
            {turns.map((turn) => (
              <TutorConversationTurn
                key={turn.id}
                studentName={studentName}
                turn={turn}
              />
            ))}

            {pendingEvent ? (
              <li className="grid gap-3">
                <EmilyMessage
                  label="Emily asked"
                  text={pendingEvent.title || "Current activity"}
                />
                <StudentMessage
                  label={studentName}
                  outcome={pendingEvent.outcome}
                  text={pendingEvent.detail || "Answer submitted."}
                  timestamp={pendingEvent.occurred_at}
                />
                <EmilyMessage
                  conclusionLoading
                  label="Emily is thinking"
                  loading
                  text="Reviewing the latest answer"
                />
              </li>
            ) : null}

            {processingConclusion ? (
              <li>
                <EmilyMessage
                  conclusionLoading
                  label="Emily · Mission report"
                  loading
                  text="Reviewing all answers"
                />
              </li>
            ) : conclusionReady ? (
              <li>
                <EmilyMessage
                  conclusion={
                    attempt.trace?.summary ||
                    "The observable learning report is ready."
                  }
                  label="Emily · Mission report"
                  text="I finished the learning report."
                />
              </li>
            ) : conclusionFailed ? (
              <li>
                <EmilyMessage
                  conclusion="The live answers above are still available for review."
                  label="Emily · Mission report"
                  text="I could not finish the AI conclusion."
                />
              </li>
            ) : null}
          </ol>
        ) : (
          <div className="grid h-full min-h-64 place-items-center text-center">
            <div>
              <MessageCircleMore
                className="mx-auto size-6 text-muted-foreground"
                aria-hidden
              />
              <p className="mt-3 text-sm font-semibold">No messages yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                The first answer will appear here while {studentName} plays.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TutorConversationTurn({
  studentName,
  turn,
}: {
  readonly studentName: string;
  readonly turn: IApiStudentTutorTurn;
}) {
  const response =
    turn.explicit_reasoning ||
    turn.student_response ||
    turn.feedback ||
    "No written response.";

  return (
    <li className="grid gap-3">
      {turn.prompt ? (
        <EmilyMessage label="Emily asked" text={turn.prompt} />
      ) : null}
      <StudentMessage
        label={studentName}
        outcome={turn.outcome}
        text={response}
        timestamp={turn.created_at}
      />
      <EmilyMessage
        conclusion={turn.tutor?.teacher_observation}
        explanationSteps={turn.tutor?.explanation_steps}
        label="Emily replied"
        retrievedChunkIDs={turn.tutor?.retrieved_chunk_ids}
        text={turn.tutor?.message || "No AI reply was recorded."}
      />
    </li>
  );
}

function EmilyMessage({
  conclusion,
  conclusionLoading = false,
  explanationSteps,
  label,
  loading = false,
  retrievedChunkIDs,
  text,
}: {
  readonly conclusion?: string | null;
  readonly conclusionLoading?: boolean;
  readonly explanationSteps?: readonly string[] | null;
  readonly label: string;
  readonly loading?: boolean;
  readonly retrievedChunkIDs?: readonly string[] | null;
  readonly text: string;
}) {
  return (
    <div className="flex max-w-[92%] items-end gap-2 sm:max-w-[82%]">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="mb-1 text-xs font-semibold text-muted-foreground">
          {label}
        </p>
        <div className="rounded-e-2xl rounded-tl-2xl border border-violet-200 bg-white px-4 py-3 shadow-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-sm font-medium text-violet-800">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              <span>{text}</span>
              <span className="tracking-[0.18em]" aria-label="processing">
                ...
              </span>
            </div>
          ) : (
            <p className="text-sm leading-6 text-foreground">{text}</p>
          )}

          {safeList(explanationSteps).length > 0 ? (
            <ol className="mt-3 grid gap-1.5 border-t border-violet-100 pt-3 text-xs leading-5 text-muted-foreground">
              {safeList(explanationSteps).map((step, index) => (
                <li key={`${index}:${step}`} className="flex gap-2">
                  <span className="font-bold text-violet-600">
                    {index + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {conclusion || conclusionLoading ? (
            <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
                AI conclusion for the teacher
              </p>
              {conclusionLoading ? (
                <div className="mt-1.5 flex items-center gap-2 text-sm text-violet-950">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                  <span className="tracking-[0.2em]" aria-label="processing">
                    ...
                  </span>
                </div>
              ) : (
                <p className="mt-1.5 text-sm leading-6 text-violet-950">
                  {conclusion}
                </p>
              )}
            </div>
          ) : null}

          {safeList(retrievedChunkIDs).length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {safeList(retrievedChunkIDs).map((chunkID) => (
                <span
                  key={chunkID}
                  className="rounded bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700"
                >
                  RAG · {chunkID}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StudentMessage({
  label,
  outcome,
  text,
  timestamp,
}: {
  readonly label: string;
  readonly outcome: string;
  readonly text: string;
  readonly timestamp: number | string;
}) {
  return (
    <div className="ml-auto flex max-w-[92%] flex-row-reverse items-end gap-2 sm:max-w-[82%]">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cyan-100 text-cyan-700">
        <UserRound className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>
            {formatDate(timestamp, {
              fallback: "now",
              preset: "time",
            })}
          </span>
          <span className="font-semibold">{label}</span>
        </div>
        <div className="rounded-s-2xl rounded-tr-2xl bg-cyan-700 px-4 py-3 text-white shadow-sm">
          <p className="text-sm leading-6">{text}</p>
          {outcome ? (
            <span className="mt-2 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              {outcome}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function latestPendingEvent(
  events: readonly IApiStudentLearningEvent[] | null | undefined,
  turns: readonly IApiStudentTutorTurn[],
): IApiStudentLearningEvent | null {
  const latestEvent = [...safeList(events)]
    .filter((event) => ["answer", "reasoning", "feedback"].includes(event.type))
    .sort((left, right) => left.sequence - right.sequence)
    .at(-1);
  if (!latestEvent) {
    return null;
  }

  const coveredEventIDs = new Set(
    turns.flatMap((turn) => safeList(turn.tutor?.evidence_event_ids)),
  );
  if (coveredEventIDs.has(latestEvent.id)) {
    return null;
  }

  const latestTurnTimestamp = turns.reduce(
    (latest, turn) => Math.max(latest, dateValue(turn.created_at)),
    0,
  );
  return latestTurnTimestamp >= latestEvent.occurred_at ? null : latestEvent;
}

function MemoryStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-bold capitalize">{value}</p>
    </div>
  );
}

function isInsightProcessing(traceState: string | null | undefined) {
  return traceState === "pending" || traceState === "processing";
}

function dateValue(value: number | string) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function checkpointLabel(attempt: IApiStudentLearningAttempt) {
  const checkpoint = attempt.snapshot?.checkpoint;
  const stage = checkpoint?.stage_id?.replaceAll("-", " ") || "mission start";
  const phase = checkpoint?.phase?.replaceAll("-", " ") || "between questions";
  return `${stage}, ${phase}${checkpoint?.question_id ? ` (${checkpoint.question_id})` : ""}`;
}

function safeList<Value>(
  values: readonly Value[] | null | undefined,
): readonly Value[] {
  return Array.isArray(values) ? values : [];
}
