"use client";

import { useCallback, useState, type FormEvent } from "react";

import type {
  IApiCreateTeacherClassMissionRequest,
  IApiDashboardStudent,
  IApiMissionAttachment,
  IApiTeacherClass,
  IApiTeacherClassMission,
} from "@/backend/api/api.interface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DashboardModal } from "./dashboard-modal";
import { MissionFileUploader } from "../upload/mission-file-uploader";

export type MissionBuilderForm = IApiCreateTeacherClassMissionRequest & {
  class_id: string;
};

type MissionBuilderDraft = Omit<
  MissionBuilderForm,
  "class_id" | "class_name" | "subject" | "grade_level"
>;

type MissionBuilderProps = {
  readonly approving: boolean;
  readonly classId: string;
  /** Pre-written teacher prompt, e.g. built from the class patterns on the dashboard. */
  readonly draftPrompt?: string;
  readonly open: boolean;
  readonly previewMission: IApiTeacherClassMission | null;
  readonly processing: boolean;
  readonly students: IApiDashboardStudent[];
  readonly teacherClass: IApiTeacherClass | null;
  readonly onApprove: (mission: IApiTeacherClassMission) => Promise<void>;
  readonly onOpenChange: (open: boolean) => void;
  readonly onProcess: (value: MissionBuilderForm) => Promise<void>;
};

export function MissionBuilder({
  approving,
  classId,
  draftPrompt,
  onApprove,
  onOpenChange,
  onProcess,
  open,
  previewMission,
  processing,
  students,
  teacherClass,
}: MissionBuilderProps) {
  const [form, setForm] = useState<MissionBuilderDraft>(() =>
    buildMissionBuilderDraft(previewMission, draftPrompt),
  );
  const [persistedAttachments, setPersistedAttachments] = useState<IApiMissionAttachment[]>(() =>
    previewMission?.attachments ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const visibleMission = previewMission;
  const canApprove = Boolean(
    visibleMission &&
      (visibleMission.status === "preview" || visibleMission.has_unpublished_changes),
  );
  const missionCode = visibleMission?.mission_code;
  const hasLiveRevision = Boolean(
    (visibleMission?.published_revision ?? 0) > 0 || visibleMission?.published_at,
  );
  const editingMission = Boolean(form.mission_id);
  const busy = processing || approving || uploading;
  const showPreview = processing || Boolean(visibleMission);
  const classDetailsReady = Boolean(teacherClass?.class_name.trim() && teacherClass.subject.trim());
  const remainingFileSlots = Math.max(0, 5 - persistedAttachments.length);
  const canSubmit =
    !busy &&
    classDetailsReady &&
    (form.audience_type === "all" || form.target_student_ids.length > 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);

    if (!teacherClass) {
      setUploadError("Class details are still loading. Try again in a moment.");
      return;
    }

    await onProcess({
      ...form,
      class_id: teacherClass.class_id || classId,
      class_name: teacherClass.class_name,
      subject: teacherClass.subject,
      grade_level: teacherClass.grade_level,
    });
  }

  const handleAttachmentsChange = useCallback((attachments: IApiMissionAttachment[]) => {
    setForm((current) => ({
      ...current,
      attachments: mergeMissionAttachments(persistedAttachments, attachments),
    }));
  }, [persistedAttachments]);

  function toggleStudent(studentId: string) {
    setForm((current) => ({
      ...current,
      target_student_ids: current.target_student_ids.includes(studentId)
        ? current.target_student_ids.filter((id) => id !== studentId)
        : [...current.target_student_ids, studentId],
    }));
  }

  function removePersistedAttachment(uploadcareUUID: string) {
    setPersistedAttachments((current) =>
      current.filter((attachment) => attachment.uploadcare_uuid !== uploadcareUUID),
    );
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter(
        (attachment) => attachment.uploadcare_uuid !== uploadcareUUID,
      ),
    }));
  }

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title={editingMission ? "Edit mission" : "Create mission"}
      description={
        editingMission
          ? "Update this mission draft. Students keep the published revision until you approve the new preview."
          : "Add a mission for this class. Emily will generate a student preview for you to review before publishing."
      }
      size="xl"
    >
      <section className="flex flex-col lg:flex-row">
        <form className="min-w-0 flex-1 rounded-lg border border-border" onSubmit={handleSubmit}>
          <header className="border-b border-border px-4 py-4 sm:px-6">
            <p className="text-xs font-bold uppercase text-cyan-700">Selected class</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{teacherClass?.class_name || classId}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {teacherClass?.subject || "No subject set"} {teacherClass?.grade_level ? `- ${teacherClass.grade_level}` : ""}
                </p>
              </div>
              <ClassCodeBadge label="Class code" value={teacherClass?.class_code || classId} />
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6">
            {hasLiveRevision ? (
              <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                The current published revision stays live until you approve these draft changes.
              </p>
            ) : null}

            <label className="grid gap-2 text-sm font-medium text-foreground">
              Mission name
              <input
                required
                minLength={2}
                value={form.mission_name}
                onChange={(event) => setForm((current) => ({ ...current, mission_name: event.target.value }))}
                placeholder="Fractions in equations review"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>

            <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
              Learning goal
              <input
                required
                minLength={6}
                value={form.learning_goal}
                onChange={(event) => setForm((current) => ({ ...current, learning_goal: event.target.value }))}
                placeholder="Help students review fractions inside two-step equations."
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>

            <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
              Teacher prompt
              <textarea
                required
                minLength={10}
                value={form.teacher_prompt}
                onChange={(event) => setForm((current) => ({ ...current, teacher_prompt: event.target.value }))}
                placeholder="What did students study today? What should Emily watch for? What should count as success?"
                className="min-h-40 rounded-md border border-input bg-background px-3 py-3 text-sm leading-6 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>

            <fieldset className="mt-4 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-foreground">
                Who is this mission for?
              </legend>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This helps you organize missions. Anyone with the mission
                code can still join.
              </p>

              <div className="mt-3 grid gap-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/40">
                  <input
                    type="radio"
                    name="mission-audience"
                    value="all"
                    checked={form.audience_type === "all"}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        audience_type: "all",
                        target_student_ids: [],
                      }))
                    }
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      Everyone in the class
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      Includes students who join the class later.
                    </span>
                  </span>
                </label>

                {students.length > 0 ? (
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted/40">
                    <input
                      type="radio"
                      name="mission-audience"
                      value="selected"
                      checked={form.audience_type === "selected"}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          audience_type: "selected",
                        }))
                      }
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        Selected students
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        Choose one or more students as the intended audience.
                      </span>
                    </span>
                  </label>
                ) : null}
              </div>

              {form.audience_type === "selected" ? (
                <div className="mt-3 max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {students.map((student) => (
                    <label
                      key={student.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={form.target_student_ids.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="size-4 rounded accent-primary"
                      />
                      <span className="font-medium">{student.student_name}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </fieldset>

            <div className="mt-4 grid gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">Optional files</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Up to 5 files, 20 MB each. Uploads are temporary and expire after 24 hours.
                </p>
              </div>
              <MissionFileUploader
                disabled={processing || approving}
                maxFiles={remainingFileSlots}
                onAttachmentsChange={handleAttachmentsChange}
                onErrorChange={setUploadError}
                onUploadingChange={setUploading}
              />
            </div>

            {form.attachments.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {form.attachments.map((attachment) => (
                  <span
                    key={attachment.uploadcare_uuid}
                    className="inline-flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    {attachment.file_name}
                    {persistedAttachments.some(
                      (persisted) => persisted.uploadcare_uuid === attachment.uploadcare_uuid,
                    ) ? (
                      <button
                        type="button"
                        aria-label={`Remove ${attachment.file_name}`}
                        disabled={busy}
                        onClick={() => removePersistedAttachment(attachment.uploadcare_uuid)}
                        className="text-base leading-none text-muted-foreground hover:text-rose-700"
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}

            {uploadError ? (
              <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {uploadError}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end">
              <Button type="submit" disabled={!canSubmit}>
                {uploading
                  ? "Uploading files..."
                  : processing
                    ? "Generating preview..."
                    : visibleMission
                      ? "Update preview"
                      : "Generate preview"}
              </Button>
            </div>
          </div>
        </form>

        <div
          aria-hidden={!showPreview}
          inert={showPreview ? undefined : true}
          className={cn(
            "grid min-w-0 overflow-hidden transition-[grid-template-rows,margin,width,opacity,transform] duration-500 ease-out motion-reduce:transition-none lg:shrink-0",
            showPreview
              ? "mt-4 grid-rows-[1fr] opacity-100 lg:mt-0 lg:ml-4 lg:w-[420px] lg:translate-x-0"
              : "pointer-events-none mt-0 grid-rows-[0fr] translate-y-2 opacity-0 lg:ml-0 lg:w-0 lg:translate-x-4 lg:translate-y-0",
          )}
        >
          <div className="min-h-0 overflow-hidden lg:w-[420px]">
            <aside className="rounded-lg border border-border">
              <header className="border-b border-border px-4 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-cyan-700">Student preview</p>
                    <h3 className="mt-2 text-lg font-semibold">
                      {visibleMission?.title ?? "Waiting for Emily"}
                    </h3>
                  </div>
                  {visibleMission ? (
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold uppercase text-muted-foreground">
                      {visibleMission.status}
                    </span>
                  ) : null}
                </div>
              </header>

              <div className="grid gap-4 px-4 py-5 sm:px-6">
                {missionCode ? (
                  <ClassCodeBadge label="Mission code" value={missionCode} />
                ) : null}
                {visibleMission ? (
                  <>
                    <p className="text-sm leading-6 text-muted-foreground">{visibleMission.summary}</p>

                    <div className="grid gap-2">
                      {visibleMission.preview_questions.map((question, index) => (
                        <article key={question.id} className="rounded-md border border-border p-3">
                          <p className="text-xs font-bold uppercase text-muted-foreground">
                            Question {index + 1}
                          </p>
                          <h4 className="mt-2 font-semibold text-foreground">{question.prompt}</h4>
                          {question.options.length > 0 ? (
                            <div className="mt-3 grid gap-2">
                              {question.options.map((option) => (
                                <span
                                  key={option}
                                  className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
                                >
                                  {option}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <p className="mt-3 text-sm font-semibold text-emerald-700">
                            {question.expected_answer}
                          </p>
                        </article>
                      ))}
                    </div>

                    {visibleMission.orchestration.generated_by_mock ? (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                        Local fallback generated this preview.
                      </p>
                    ) : null}

                    {canApprove ? (
                      <Button
                        type="button"
                        disabled={approving}
                        onClick={() => onApprove(visibleMission)}
                        className="bg-emerald-600 text-white hover:bg-emerald-500"
                      >
                        {approving
                          ? "Publishing..."
                          : hasLiveRevision
                            ? "Approve and publish changes"
                            : "Approve and assign to class"}
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    The preview will appear here after Emily processes the mission.
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </DashboardModal>
  );
}

function buildMissionBuilderDraft(
  mission: IApiTeacherClassMission | null,
  draftPrompt?: string,
): MissionBuilderDraft {
  return {
    mission_id: mission?.id,
    expected_draft_revision: mission?.draft_revision,
    mission_name: mission?.mission_name ?? "",
    learning_goal: mission?.learning_goal ?? "",
    teacher_prompt: mission?.teacher_prompt ?? draftPrompt ?? "",
    audience_type: mission?.audience_type ?? "all",
    target_student_ids: mission?.target_student_ids ?? [],
    attachments: mission?.attachments ?? [],
  };
}

function mergeMissionAttachments(
  persisted: IApiMissionAttachment[],
  uploaded: IApiMissionAttachment[],
) {
  const attachments = new Map<string, IApiMissionAttachment>();
  for (const attachment of [...persisted, ...uploaded]) {
    attachments.set(attachment.uploadcare_uuid, attachment);
  }

  return [...attachments.values()];
}

function ClassCodeBadge({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="w-fit rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
      <span className="block text-xs font-bold uppercase text-emerald-700">{label}</span>
      <span className="mt-1 block font-mono text-base font-black text-emerald-900">{value}</span>
    </div>
  );
}
