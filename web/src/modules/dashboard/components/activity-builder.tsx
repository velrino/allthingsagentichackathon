"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import type {
  IApiCreateTeacherClassActivityRequest,
  IApiTeacherClass,
  IApiTeacherClassActivity,
} from "@/backend/api/api.interface";
import { Button } from "@/components/ui/button";

import { DashboardModal } from "./dashboard-modal";
import { uploadActivityFiles } from "../upload/uploadcare-client";

export type ActivityBuilderForm = IApiCreateTeacherClassActivityRequest & {
  class_id: string;
};

type ActivityBuilderProps = {
  readonly activeActivity: IApiTeacherClassActivity | null;
  readonly approving: boolean;
  readonly classId: string;
  /** Pre-written teacher prompt, e.g. built from the class patterns on the dashboard. */
  readonly draftPrompt?: string;
  readonly open: boolean;
  readonly previewActivity: IApiTeacherClassActivity | null;
  readonly processing: boolean;
  readonly teacherClass: IApiTeacherClass | null;
  readonly onApprove: (activity: IApiTeacherClassActivity) => Promise<void>;
  readonly onOpenChange: (open: boolean) => void;
  readonly onProcess: (value: ActivityBuilderForm) => Promise<void>;
};

export function ActivityBuilder({
  activeActivity,
  approving,
  classId,
  draftPrompt,
  onApprove,
  onOpenChange,
  onProcess,
  open,
  previewActivity,
  processing,
  teacherClass,
}: ActivityBuilderProps) {
  const [form, setForm] = useState<ActivityBuilderForm>(() => ({
    class_id: classId,
    class_name: activeActivity?.class_name ?? teacherClass?.class_name ?? "",
    activity_name: activeActivity?.activity_name ?? "",
    subject: activeActivity?.subject ?? teacherClass?.subject ?? "",
    grade_level: activeActivity?.grade_level ?? teacherClass?.grade_level ?? "",
    learning_goal: activeActivity?.learning_goal ?? "",
    teacher_prompt: draftPrompt ?? activeActivity?.teacher_prompt ?? "",
    attachments: activeActivity?.attachments ?? [],
  }));
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const visibleActivity = previewActivity ?? activeActivity;
  const canApprove = visibleActivity?.status === "preview";
  const shareCode = visibleActivity?.status === "published" ? visibleActivity.class_code : activeActivity?.class_code;
  const busy = processing || approving || uploading;
  const selectedFileLabel = useMemo(() => {
    if (selectedFiles.length === 0) {
      return "No files selected";
    }

    return selectedFiles.map((file) => file.name).join(", ");
  }, [selectedFiles]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);

    try {
      setUploading(selectedFiles.length > 0);
      const uploadedAttachments = selectedFiles.length > 0 ? await uploadActivityFiles(selectedFiles) : form.attachments;
      await onProcess({
        ...form,
        class_id: classId,
        attachments: uploadedAttachments,
      });
      setForm((current) => ({
        ...current,
        attachments: uploadedAttachments,
      }));
      setSelectedFiles([]);
    } catch (caughtError) {
      setUploadError(caughtError instanceof Error ? caughtError.message : "Could not upload activity files.");
    } finally {
      setUploading(false);
    }
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(event.target.files ?? []));
  }

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title="Emily Activity Builder"
      description="Create a practice activity for the selected class. Review the preview before the class code is shared."
      size="xl"
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <form className="rounded-lg border border-border" onSubmit={handleSubmit}>
          <header className="border-b border-border px-4 py-4 sm:px-6">
            <p className="text-xs font-bold uppercase text-cyan-700">Selected class</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{teacherClass?.class_name || classId}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {teacherClass?.subject || "No subject set"} {teacherClass?.grade_level ? `- ${teacherClass.grade_level}` : ""}
                </p>
              </div>
              <ClassCodeBadge value={teacherClass?.class_code || classId} />
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                Class code
                <input
                  value={classId}
                  disabled
                  className="h-10 rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold text-muted-foreground outline-none"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-foreground">
                Activity name
                <input
                  required
                  value={form.activity_name}
                  onChange={(event) => setForm((current) => ({ ...current, activity_name: event.target.value }))}
                  placeholder="Fractions in equations review"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-foreground">
                Subject
                <input
                  required
                  value={form.subject}
                  onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Mathematics"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-foreground">
                Grade level
                <input
                  value={form.grade_level}
                  onChange={(event) => setForm((current) => ({ ...current, grade_level: event.target.value }))}
                  placeholder="7th grade"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
            </div>

            <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
              Learning goal
              <input
                required
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
                value={form.teacher_prompt}
                onChange={(event) => setForm((current) => ({ ...current, teacher_prompt: event.target.value }))}
                placeholder="What did students study today? What should Emily watch for? What should count as success?"
                className="min-h-40 rounded-md border border-input bg-background px-3 py-3 text-sm leading-6 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>

            <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
              Optional files
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
                onChange={handleFilesChange}
                className="rounded-md border border-dashed border-input px-3 py-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:border-ring"
              />
              <span className="text-xs font-medium text-muted-foreground">{selectedFileLabel}</span>
            </label>

            {form.attachments.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {form.attachments.map((attachment) => (
                  <span
                    key={attachment.uploadcare_uuid}
                    className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    {attachment.file_name}
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
              <Button type="submit" disabled={busy}>
                {busy ? "Processing..." : "Process with Emily"}
              </Button>
            </div>
          </div>
        </form>

        <aside className="rounded-lg border border-border">
          <header className="border-b border-border px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-cyan-700">Student preview</p>
                <h3 className="mt-2 text-lg font-semibold">{visibleActivity?.title ?? "Waiting for Emily"}</h3>
              </div>
              {visibleActivity ? (
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold uppercase text-muted-foreground">
                  {visibleActivity.status}
                </span>
              ) : null}
            </div>
          </header>

          <div className="grid gap-4 px-4 py-5 sm:px-6">
            {shareCode ? <ClassCodeBadge value={shareCode} /> : null}
            {visibleActivity ? (
              <>
                <p className="text-sm leading-6 text-muted-foreground">{visibleActivity.summary}</p>

                <div className="grid gap-2">
                  {visibleActivity.preview_questions.map((question, index) => (
                    <article key={question.id} className="rounded-md border border-border p-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Question {index + 1}</p>
                      <h4 className="mt-2 font-semibold text-foreground">{question.prompt}</h4>
                      {question.options.length > 0 ? (
                        <div className="mt-3 grid gap-2">
                          {question.options.map((option) => (
                            <span key={option} className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                              {option}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-3 text-sm font-semibold text-emerald-700">{question.expected_answer}</p>
                    </article>
                  ))}
                </div>

                {visibleActivity.orchestration.generated_by_mock ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                    Local fallback generated this preview.
                  </p>
                ) : null}

                {canApprove ? (
                  <Button
                    type="button"
                    disabled={approving}
                    onClick={() => onApprove(visibleActivity)}
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    {approving ? "Publishing..." : "Approve and publish"}
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                The preview will appear here after Emily processes the activity.
              </p>
            )}
          </div>
        </aside>
      </section>
    </DashboardModal>
  );
}

function ClassCodeBadge({ value }: { readonly value: string }) {
  return (
    <div className="w-fit rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
      <span className="block text-xs font-bold uppercase text-emerald-700">Class code</span>
      <span className="mt-1 block font-mono text-base font-black text-emerald-900">{value}</span>
    </div>
  );
}
