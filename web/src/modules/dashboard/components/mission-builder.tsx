"use client";

import {
  ExternalLink,
  File,
  FileText,
  FileType2,
  LoaderCircle,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import type {
  IApiCreateTeacherClassMissionRequest,
  IApiDashboardStudent,
  IApiMissionAttachment,
  IApiMissionPreviewQuestion,
  IApiTeacherClass,
  IApiTeacherClassMission,
} from "@/backend/api/api.interface";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { DashboardModal } from "./dashboard-modal";
import { MissionFlowPreview } from "./mission-flow-preview";
import { MissionFileUploader } from "../upload/mission-file-uploader";
import { missionHasPublishedRevision } from "../utils/mission-lifecycle";

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
  const [persistedAttachments, setPersistedAttachments] = useState<
    IApiMissionAttachment[]
  >(() => previewMission?.attachments ?? []);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [previewAttachment, setPreviewAttachment] =
    useState<IApiMissionAttachment | null>(null);
  const [editableMission, setEditableMission] =
    useState<IApiTeacherClassMission | null>(() => previewMission);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const visibleMission = previewMission;
  const previewDraft = editableMission ?? visibleMission;
  const guardrailBlocked = Boolean(
    previewDraft?.education_guardrail &&
    !previewDraft.education_guardrail.allowed &&
    previewDraft.education_guardrail.reason.trim(),
  );
  const canShowApprove = Boolean(
    previewDraft &&
    !guardrailBlocked &&
    (previewDraft.status === "preview" || previewDraft.has_unpublished_changes),
  );
  const canApprove = Boolean(
    previewDraft && canShowApprove && previewMissionCanBeApproved(previewDraft),
  );
  const missionCode = previewDraft?.mission_code;
  const hasLiveRevision = Boolean(
    previewDraft && missionHasPublishedRevision(previewDraft),
  );
  const editingMission = Boolean(form.mission_id);
  const busy = processing || approving || uploading;
  const showPreview = processing || Boolean(visibleMission);
  const classDetailsReady = Boolean(
    teacherClass?.class_name.trim() && teacherClass.subject.trim(),
  );
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

  const handleAttachmentsChange = useCallback(
    (attachments: IApiMissionAttachment[]) => {
      setForm((current) => ({
        ...current,
        attachments: mergeMissionAttachments(
          persistedAttachments,
          attachments,
        ).filter(
          (attachment) => !removedAttachmentIds.has(attachment.uploadcare_uuid),
        ),
      }));
    },
    [persistedAttachments, removedAttachmentIds],
  );

  function toggleStudent(studentId: string) {
    setForm((current) => ({
      ...current,
      target_student_ids: current.target_student_ids.includes(studentId)
        ? current.target_student_ids.filter((id) => id !== studentId)
        : [...current.target_student_ids, studentId],
    }));
  }

  function removeAttachment(uploadcareUUID: string) {
    setRemovedAttachmentIds((current) => {
      const next = new Set(current);
      next.add(uploadcareUUID);
      return next;
    });
    setPersistedAttachments((current) =>
      current.filter(
        (attachment) => attachment.uploadcare_uuid !== uploadcareUUID,
      ),
    );
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter(
        (attachment) => attachment.uploadcare_uuid !== uploadcareUUID,
      ),
    }));
    setPreviewAttachment((current) =>
      current?.uploadcare_uuid === uploadcareUUID ? null : current,
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setPreviewAttachment(null);
    }

    onOpenChange(nextOpen);
  }

  function updateEditableMission(
    updater: (mission: IApiTeacherClassMission) => IApiTeacherClassMission,
  ) {
    setEditableMission((current) => {
      const sourceMission = current ?? visibleMission;

      return sourceMission ? updater(sourceMission) : current;
    });
  }

  return (
    <DashboardModal
      open={open}
      onOpenChange={handleOpenChange}
      title={editingMission ? "Edit mission" : "Create mission"}
      description={
        editingMission
          ? "Update this mission draft. Students keep the published revision until you approve the new preview."
          : "Add a mission for this class. Emily will generate a student preview for you to review before publishing."
      }
      size="xl"
    >
      <section className="flex flex-col lg:flex-row">
        <form
          className="min-w-0 flex-1 rounded-lg border border-border"
          onSubmit={handleSubmit}
        >
          <header className="border-b border-border px-4 py-4 sm:px-6">
            <p className="text-xs font-bold uppercase text-cyan-700">
              Selected class
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold">
                  {teacherClass?.class_name || classId}
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {teacherClass?.subject || "No subject set"}{" "}
                  {teacherClass?.grade_level
                    ? `- ${teacherClass.grade_level}`
                    : ""}
                </p>
              </div>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6">
            {hasLiveRevision ? (
              <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                The current published revision stays live until you approve
                these draft changes.
              </p>
            ) : null}

            <label className="grid gap-2 text-sm font-medium text-foreground">
              Mission name
              <input
                required
                minLength={2}
                value={form.mission_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    mission_name: event.target.value,
                  }))
                }
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
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    learning_goal: event.target.value,
                  }))
                }
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
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    teacher_prompt: event.target.value,
                  }))
                }
                placeholder="What did students study today? What should Emily watch for? What should count as success?"
                className="min-h-40 rounded-md border border-input bg-background px-3 py-3 text-sm leading-6 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>

            <fieldset className="mt-4 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-semibold text-foreground">
                Who is this mission for?
              </legend>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This helps you organize missions. Anyone with the mission code
                can still join.
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
                      <span className="font-medium">
                        {student.student_name}
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
            </fieldset>

            <div className="mt-4 grid gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Optional files
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  PDF, PNG, JPEG, DOCX, or TXT only. Up to 5 files, 20 MB each.
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
              <UploadedMissionFilesGrid
                attachments={form.attachments}
                disabled={busy}
                onPreview={setPreviewAttachment}
                onRemove={removeAttachment}
              />
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
              ? "mt-4 grid-rows-[1fr] opacity-100 lg:mt-0 lg:ml-4 lg:w-[520px] lg:translate-x-0"
              : "pointer-events-none mt-0 grid-rows-[0fr] translate-y-2 opacity-0 lg:ml-0 lg:w-0 lg:translate-x-4 lg:translate-y-0",
          )}
        >
          <div className="min-h-0 overflow-hidden lg:w-[520px]">
            <aside className="relative rounded-lg border border-border">
              {processing && previewDraft ? <PreviewLoadingOverlay /> : null}
              <header className="border-b border-border px-4 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase text-cyan-700">
                      Preview
                    </p>
                    {previewDraft ? (
                      <EditablePreviewField
                        ariaLabel="Mission title"
                        disabled={busy}
                        value={previewDraft.title}
                        onChange={(title) =>
                          updateEditableMission((mission) => ({
                            ...mission,
                            title,
                          }))
                        }
                        className="mt-2 text-lg font-semibold leading-7 text-foreground"
                      />
                    ) : (
                      <h3 className="mt-2 text-lg font-semibold">
                        Waiting for Emily
                      </h3>
                    )}
                  </div>
                  {previewDraft ? (
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold uppercase text-muted-foreground">
                      {previewDraft.status}
                    </span>
                  ) : null}
                </div>
              </header>

              <div className="grid gap-4 px-4 py-5 sm:px-6">
                {missionCode ? (
                  <ClassCodeBadge label="Mission code" value={missionCode} />
                ) : null}
                {previewDraft ? (
                  <>
                    {previewDraft.education_guardrail &&
                    !previewDraft.education_guardrail.allowed ? (
                      <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                        {previewDraft.education_guardrail.reason}
                      </p>
                    ) : previewDraft.education_guardrail?.attachment_notes ? (
                      <p className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-semibold leading-5 text-cyan-800">
                        {previewDraft.education_guardrail.attachment_notes}
                      </p>
                    ) : null}

                    <Tabs defaultValue="preview">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                        <TabsTrigger value="flow">Flow</TabsTrigger>
                      </TabsList>

                      <TabsContent value="preview" className="mt-3 grid gap-4">
                        <EditableMissionPreview
                          disabled={busy}
                          mission={previewDraft}
                          onMissionChange={updateEditableMission}
                        />
                      </TabsContent>

                      <TabsContent value="flow" className="mt-3">
                        <MissionFlowPreview
                          flow={previewDraft.mission_flow}
                        />
                      </TabsContent>
                    </Tabs>

                    {previewDraft.orchestration.generated_by_mock ? (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                        Local fallback generated this preview.
                      </p>
                    ) : null}

                    {canShowApprove ? (
                      <div className="grid gap-2">
                        {!canApprove ? (
                          <p className="text-xs font-medium text-muted-foreground">
                            Title, summary, prompt, and expected answer are
                            required before approval.
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          disabled={!canApprove || approving || processing}
                          onClick={() => {
                            if (!previewDraft) {
                              return;
                            }

                            void onApprove(previewDraft);
                          }}
                          className="bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                          {approving
                            ? "Publishing..."
                            : hasLiveRevision
                              ? "Approve and publish changes"
                              : "Approve and assign to class"}
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : processing ? (
                  <PreviewLoadingState />
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    The preview will appear here after Emily processes the
                    mission.
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>
      <AttachmentPreviewModal
        attachment={previewAttachment}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPreviewAttachment(null);
          }
        }}
      />
    </DashboardModal>
  );
}

type EditableMissionPreviewProps = {
  readonly disabled: boolean;
  readonly mission: IApiTeacherClassMission;
  readonly onMissionChange: (
    updater: (mission: IApiTeacherClassMission) => IApiTeacherClassMission,
  ) => void;
};

function EditableMissionPreview({
  disabled,
  mission,
  onMissionChange,
}: EditableMissionPreviewProps) {
  function updateQuestion(
    questionId: string,
    updater: (
      question: IApiMissionPreviewQuestion,
    ) => IApiMissionPreviewQuestion,
  ) {
    onMissionChange((current) => ({
      ...current,
      preview_questions: current.preview_questions.map((question) =>
        question.id === questionId ? updater(question) : question,
      ),
    }));
  }

  return (
    <div className="grid gap-4">
      <p className="text-xs font-medium text-muted-foreground">
        Click any text field to adjust the preview before approving.
      </p>

      <label className="grid gap-2 text-sm font-medium text-foreground">
        Summary
        <EditablePreviewField
          ariaLabel="Mission summary"
          disabled={disabled}
          minRows={4}
          value={mission.summary}
          onChange={(summary) =>
            onMissionChange((current) => ({
              ...current,
              summary,
            }))
          }
          className="text-sm leading-6 text-muted-foreground"
        />
      </label>

      <div className="grid gap-2">
        {mission.preview_questions.map((question, index) => (
          <article
            key={question.id}
            className="rounded-md border border-border p-3"
          >
            <p className="text-xs font-bold uppercase text-muted-foreground">
              Question {index + 1}
            </p>

            <label className="mt-3 grid gap-2 text-sm font-medium text-foreground">
              Prompt
              <EditablePreviewField
                ariaLabel={`Question ${index + 1} prompt`}
                disabled={disabled}
                minRows={3}
                value={question.prompt}
                onChange={(prompt) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    prompt,
                  }))
                }
                className="font-semibold text-foreground"
              />
            </label>

            {question.options.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {question.options.map((option, optionIndex) => (
                  <input
                    key={`${question.id}:option:${optionIndex}`}
                    aria-label={`Question ${index + 1} option ${optionIndex + 1}`}
                    disabled={disabled}
                    value={option}
                    onChange={(event) =>
                      updateQuestion(question.id, (current) => ({
                        ...current,
                        options: current.options.map((currentOption, index) =>
                          index === optionIndex
                            ? event.target.value
                            : currentOption,
                        ),
                      }))
                    }
                    className="rounded-md border border-transparent bg-muted px-3 py-2 text-sm text-muted-foreground outline-none transition focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                ))}
              </div>
            ) : null}

            <label className="mt-3 grid gap-2 text-sm font-medium text-emerald-700">
              Expected answer
              <EditablePreviewField
                ariaLabel={`Question ${index + 1} expected answer`}
                disabled={disabled}
                minRows={2}
                value={question.expected_answer}
                onChange={(expectedAnswer) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    expected_answer: expectedAnswer,
                  }))
                }
                className="font-semibold text-emerald-700"
              />
            </label>
          </article>
        ))}
      </div>
    </div>
  );
}

function EditablePreviewField({
  ariaLabel,
  className,
  disabled,
  minRows = 1,
  onChange,
  value,
}: {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly disabled: boolean;
  readonly minRows?: number;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <textarea
      aria-label={ariaLabel}
      disabled={disabled}
      rows={minRows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "w-full resize-none rounded-md border border-transparent bg-transparent p-0 outline-none transition focus:border-ring focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
    />
  );
}

function PreviewLoadingState() {
  return (
    <div className="grid min-h-72 place-items-center rounded-md border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <div className="grid justify-items-center gap-3">
        <LoaderCircle
          className="size-7 animate-spin text-primary"
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Generating preview...
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Emily is reading the prompt and attachments.
          </p>
        </div>
      </div>
    </div>
  );
}

function PreviewLoadingOverlay() {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center rounded-lg bg-background/80 backdrop-blur-sm">
      <div className="grid justify-items-center gap-3 rounded-md border border-border bg-background px-5 py-4 shadow-lg">
        <LoaderCircle
          className="size-6 animate-spin text-primary"
          aria-hidden
        />
        <p className="text-sm font-semibold text-foreground">
          Updating preview...
        </p>
      </div>
    </div>
  );
}

function previewMissionCanBeApproved(mission: IApiTeacherClassMission) {
  return (
    mission.title.trim().length >= 2 &&
    mission.summary.trim().length >= 10 &&
    mission.preview_questions.length > 0 &&
    mission.preview_questions.every(
      (question) =>
        question.prompt.trim().length >= 2 &&
        question.expected_answer.trim().length > 0,
    )
  );
}

type AttachmentKind = "docx" | "file" | "image" | "pdf" | "txt";

const attachmentKindLabel: Record<AttachmentKind, string> = {
  docx: "DOCX",
  file: "FILE",
  image: "IMAGE",
  pdf: "PDF",
  txt: "TXT",
};

const textPreviewLimit = 200_000;

function UploadedMissionFilesGrid({
  attachments,
  disabled,
  onPreview,
  onRemove,
}: {
  readonly attachments: IApiMissionAttachment[];
  readonly disabled: boolean;
  readonly onPreview: (attachment: IApiMissionAttachment) => void;
  readonly onRemove: (uploadcareUUID: string) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => {
        const kind = getAttachmentKind(attachment);

        return (
          <div key={attachment.uploadcare_uuid} className="relative">
            <button
              type="button"
              className="flex h-full w-full min-w-0 items-center gap-3 rounded-md border border-border bg-background p-3 text-start shadow-sm transition hover:border-primary/30 hover:bg-primary/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onPreview(attachment)}
            >
              <AttachmentFileIcon attachment={attachment} kind={kind} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {attachment.file_name}
                </span>
                <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                  {attachmentKindLabel[kind]} -{" "}
                  {formatFileSize(attachment.size_bytes)}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-label={`Remove ${attachment.file_name}`}
              disabled={disabled}
              onClick={() => onRemove(attachment.uploadcare_uuid)}
              className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-foreground text-background shadow-sm transition hover:bg-destructive hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AttachmentFileIcon({
  attachment,
  kind,
}: {
  readonly attachment: IApiMissionAttachment;
  readonly kind: AttachmentKind;
}) {
  if (kind === "image") {
    return (
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.cdn_url}
          alt=""
          className="size-full object-cover"
        />
      </span>
    );
  }

  const Icon =
    kind === "pdf"
      ? FileType2
      : kind === "txt"
        ? FileText
        : kind === "docx"
          ? File
          : File;

  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

function AttachmentPreviewModal({
  attachment,
  onOpenChange,
}: {
  readonly attachment: IApiMissionAttachment | null;
  readonly onOpenChange: (open: boolean) => void;
}) {
  if (!attachment) {
    return null;
  }

  const kind = getAttachmentKind(attachment);

  return (
    <DashboardModal
      open
      onOpenChange={onOpenChange}
      title={attachment.file_name}
      description={`${attachmentKindLabel[kind]} - ${formatFileSize(attachment.size_bytes)}`}
      size="xl"
    >
      <AttachmentPreview attachment={attachment} kind={kind} />
    </DashboardModal>
  );
}

function AttachmentPreview({
  attachment,
  kind,
}: {
  readonly attachment: IApiMissionAttachment;
  readonly kind: AttachmentKind;
}) {
  if (kind === "image") {
    return (
      <div className="grid gap-3">
        <div className="grid max-h-[70svh] place-items-center overflow-auto rounded-md border border-border bg-muted/30 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.cdn_url}
            alt={attachment.file_name}
            className="max-h-[calc(70svh-1.5rem)] max-w-full rounded object-contain"
          />
        </div>
        <AttachmentPreviewActions attachment={attachment} />
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div className="grid gap-3">
        <iframe
          title={attachment.file_name}
          src={attachment.cdn_url}
          className="h-[70svh] w-full rounded-md border border-border bg-white"
        />
        <AttachmentPreviewActions attachment={attachment} />
      </div>
    );
  }

  if (kind === "txt") {
    return (
      <TextAttachmentPreview
        key={attachment.uploadcare_uuid}
        attachment={attachment}
      />
    );
  }

  if (kind === "docx") {
    return (
      <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-md bg-primary/10 text-primary">
          <File className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {attachment.file_name}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            DOCX files cannot be previewed natively in the browser.
          </p>
        </div>
        <AttachmentPreviewActions attachment={attachment} />
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-6 text-center">
      <File className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium text-muted-foreground">
        Preview is not available for this file type.
      </p>
      <AttachmentPreviewActions attachment={attachment} />
    </div>
  );
}

function TextAttachmentPreview({
  attachment,
}: {
  readonly attachment: IApiMissionAttachment;
}) {
  const [state, setState] = useState<{
    readonly error: string | null;
    readonly loading: boolean;
    readonly text: string;
    readonly truncated: boolean;
  }>({
    error: null,
    loading: true,
    text: "",
    truncated: false,
  });

  useEffect(() => {
    const controller = new AbortController();

    fetch(attachment.cdn_url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not load text preview.");
        }

        return response.text();
      })
      .then((text) => {
        setState({
          error: null,
          loading: false,
          text: text.slice(0, textPreviewLimit),
          truncated: text.length > textPreviewLimit,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : "Could not load text preview.",
          loading: false,
          text: "",
          truncated: false,
        });
      });

    return () => controller.abort();
  }, [attachment.cdn_url]);

  if (state.loading) {
    return (
      <div className="grid min-h-52 place-items-center rounded-md border border-border bg-muted/30 text-sm font-medium text-muted-foreground">
        Loading preview...
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {state.error}
        </p>
        <AttachmentPreviewActions attachment={attachment} />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <pre className="max-h-[70svh] overflow-auto rounded-md border border-border bg-muted/30 p-4 text-start text-xs leading-5 text-foreground">
        {state.text}
      </pre>
      {state.truncated ? (
        <p className="text-xs font-medium text-muted-foreground">
          Preview truncated. Open the original file to view everything.
        </p>
      ) : null}
      <AttachmentPreviewActions attachment={attachment} />
    </div>
  );
}

function AttachmentPreviewActions({
  attachment,
}: {
  readonly attachment: IApiMissionAttachment;
}) {
  return (
    <div className="flex justify-end">
      <Button variant="outline" asChild>
        <a href={attachment.cdn_url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-4" aria-hidden />
          Open original
        </a>
      </Button>
    </div>
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

function getAttachmentKind(attachment: IApiMissionAttachment): AttachmentKind {
  const mimeType = attachment.mime_type.toLocaleLowerCase();
  const fileName = attachment.file_name.toLocaleLowerCase();

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg")
  ) {
    return "image";
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    return "docx";
  }

  if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
    return "txt";
  }

  return "file";
}

function formatFileSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB"];
  let value = sizeBytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function ClassCodeBadge({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="w-fit rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm">
      <span className="block text-xs font-bold uppercase text-primary">
        {label}
      </span>
      <span className="mt-1 block font-mono text-base font-black text-[#3f20c8]">
        {value}
      </span>
    </div>
  );
}
