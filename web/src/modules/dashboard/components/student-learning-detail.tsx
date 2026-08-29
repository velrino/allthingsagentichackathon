"use client";

import {
  BrainCircuit,
  CheckCircle2,
  History,
  Route,
  Sparkles,
  Target,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  IApiDashboardStudent,
  IApiStudentLearningAttempt,
  IApiStudentLearningEvent,
} from "@/backend/api/api.interface";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

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
    student?.attempts[0]?.id ?? "",
  );
  const attempt = useMemo(
    () =>
      student?.attempts.find((item) => item.id === selectedAttemptId) ??
      student?.attempts[0] ??
      null,
    [selectedAttemptId, student],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-border px-5 py-5 pe-14 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl">
                {student?.student_name ?? "Student learning path"}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-3xl leading-6">
                Observable answers, explicit explanations, feedback and tutor
                adaptations. This view never invents or exposes private
                chain-of-thought.
              </DialogDescription>
            </div>
            {attempt ? <AttemptStatus attempt={attempt} /> : null}
          </div>
        </DialogHeader>

        <div className="max-h-[calc(92dvh-118px)] overflow-y-auto px-5 pb-6 sm:px-6">
          {student && student.attempts.length > 1 ? (
            <div className="sticky top-0 z-10 -mx-5 flex gap-2 overflow-x-auto border-b border-border bg-background px-5 py-3 sm:-mx-6 sm:px-6">
              {student.attempts.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedAttemptId(item.id)}
                  className={`shrink-0 rounded-md border px-3 py-2 text-left text-xs transition ${
                    attempt?.id === item.id
                      ? "border-cyan-300 bg-cyan-50 text-cyan-950"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="block font-bold">
                    Attempt {student.attempts.length - index}
                  </span>
                  <span className="mt-0.5 block">
                    {item.subject || "Mission"} · rev. {item.published_revision}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {attempt ? (
            <Tabs defaultValue="summary" className="pt-5">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="flow">Learning flow</TabsTrigger>
                <TabsTrigger value="evidence">Evidence</TabsTrigger>
                <TabsTrigger value="memory">Memory</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-5 grid gap-5">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <BrainCircuit className="size-4 text-cyan-700" aria-hidden />
                    Evidence-based summary
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {attempt.trace.summary ||
                      "Emily is collecting observable evidence for this attempt."}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <SignalPanel
                    icon={CheckCircle2}
                    label="Strengths"
                    tone="emerald"
                    values={attempt.trace.strengths}
                  />
                  <SignalPanel
                    icon={Target}
                    label="Areas to revisit"
                    tone="amber"
                    values={attempt.trace.improvement_areas}
                  />
                </div>

                <AttemptProgress attempt={attempt} />
              </TabsContent>

              <TabsContent value="flow" className="mt-5">
                <div className="mb-3 flex items-start gap-3 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
                  <Route className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <p className="leading-6">
                    Nodes come from captured interactions. Gemini organizes the
                    completed path and connects support, retries and mastery.
                  </p>
                </div>
                <MissionFlowPreview
                  emptyMessage="Learning events will appear here as the student works."
                  flow={attempt.trace.flow}
                />
              </TabsContent>

              <TabsContent value="evidence" className="mt-5">
                <EvidenceTimeline events={attempt.snapshot.events} />
              </TabsContent>

              <TabsContent value="memory" className="mt-5 grid gap-4">
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-violet-950">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Sparkles className="size-4" aria-hidden />
                    Next adaptive turn
                  </div>
                  <p className="mt-3 text-sm leading-6">
                    {attempt.trace.next_adaptation ||
                      "Retrieve this attempt before the next student interaction."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MemoryStat
                    label="Recorded events"
                    value={String(attempt.snapshot.events.length)}
                  />
                  <MemoryStat
                    label="Notebook notes"
                    value={String(attempt.snapshot.notes.length)}
                  />
                  <MemoryStat
                    label="Explanation style"
                    value={attempt.snapshot.preferences.explanation_style || "steps"}
                  />
                </div>

                <div className="rounded-lg border border-border p-4 text-sm leading-6 text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    Trace provenance
                  </p>
                  <p className="mt-2">
                    {attempt.trace.generated_by_ai
                      ? `Generated by ${attempt.trace.model || "Gemini"} from ${attempt.trace.event_count} observable events.`
                      : `Built directly from ${attempt.trace.event_count} observable events${attempt.trace.fallback_reason ? ` · ${attempt.trace.fallback_reason}` : ""}.`}
                  </p>
                  <p className="mt-1">
                    Last activity: {formatDate(attempt.last_activity_at)}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="my-6 rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <History className="mx-auto size-6 text-muted-foreground" aria-hidden />
              <p className="mt-3 font-semibold">No recorded attempt yet</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The learning flow appears after this student starts answering
                inside the mission.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttemptStatus({
  attempt,
}: {
  readonly attempt: IApiStudentLearningAttempt;
}) {
  const completed = attempt.status === "completed";

  return (
    <span
      className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${
        completed
          ? "bg-emerald-100 text-emerald-800"
          : "bg-cyan-100 text-cyan-800"
      }`}
    >
      {completed ? "Completed" : "In progress"}
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
  readonly values: string[];
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
      : "border-amber-200 bg-amber-50/60 text-amber-950";

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-sm font-bold">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <ul className="mt-3 grid gap-2 text-sm leading-6">
        {(values.length > 0 ? values : ["More evidence is needed."]).map(
          (value) => (
            <li key={value} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{value}</span>
            </li>
          ),
        )}
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
      {attempt.snapshot.progress.map((stage) => {
        const percentage =
          stage.required > 0
            ? Math.min(100, Math.round((stage.correct / stage.required) * 100))
            : stage.status === "complete"
              ? 100
              : 0;

        return (
          <div key={stage.stage_id} className="rounded-lg border border-border p-4">
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

function EvidenceTimeline({
  events,
}: {
  readonly events: IApiStudentLearningEvent[];
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
        No observable events have been recorded yet.
      </div>
    );
  }

  return (
    <ol className="grid gap-3">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3 rounded-lg border border-border p-4">
          <span
            className={`mt-1 size-2.5 shrink-0 rounded-full ${eventTone(event.outcome)}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{event.title}</p>
              <span className="text-xs text-muted-foreground">
                #{event.sequence} · {formatEventTime(event.occurred_at)}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {event.detail}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground">
              <span className="rounded bg-muted px-2 py-1">{event.type}</span>
              <span className="rounded bg-muted px-2 py-1">{event.stage_id}</span>
              {event.question_id ? (
                <span className="rounded bg-muted px-2 py-1">
                  {event.question_id}
                </span>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function MemoryStat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-bold capitalize">{value}</p>
    </div>
  );
}

function eventTone(outcome: string) {
  if (outcome === "correct" || outcome === "complete") {
    return "bg-emerald-500";
  }
  if (outcome === "incorrect") {
    return "bg-amber-500";
  }
  if (outcome === "support") {
    return "bg-violet-500";
  }

  return "bg-slate-400";
}

function formatDate(value: string) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatEventTime(value: number) {
  if (!value) {
    return "time unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
