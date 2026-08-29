"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import type {
  IApiCreateTeacherClassMissionRequest,
  IApiDashboardStudent,
  IApiTeacherClass,
  IApiTeacherClassMission,
} from "@/backend/api/api.interface";
import { Button } from "@/components/ui/button";

import { DashboardModal } from "./dashboard-modal";
import { uploadMissionFiles } from "../upload/uploadcare-client";

export type MissionBuilderForm = IApiCreateTeacherClassMissionRequest & {
  class_id: string;
};

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
  const [form, setForm] = useState<MissionBuilderForm>(() => ({
    class_id: classId,
    class_name: teacherClass?.class_name ?? "",
    mission_name: "",
    subject: teacherClass?.subject ?? "",
    grade_level: teacherClass?.grade_level ?? "",
    learning_goal: "",
    teacher_prompt: draftPrompt ?? "",
    audience_type: "all",
    target_student_ids: [],
    attachments: [],
  }));
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const visibleMission = previewMission;
  const canApprove = visibleMission?.status === "preview";
  const missionCode = visibleMission?.mission_code;
  const busy = processing || approving || uploading;
  const canSubmit =
    !busy &&
    (form.audience_type === "all" || form.target_student_ids.length > 0);
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
      const uploadedAttachments = selectedFiles.length > 0 ? await uploadMissionFiles(selectedFiles) : form.attachments;
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
      setUploadError(caughtError instanceof Error ? caughtError.message : "Could not upload mission files.");
    } finally {
      setUploading(false);
    }
  }

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(event.target.files ?? []));
  }

  function toggleStudent(studentId: string) {
    setForm((current) => ({
      ...current,
      target_student_ids: current.target_student_ids.includes(studentId)
        ? current.target_student_ids.filter((id) => id !== studentId)
        : [...current.target_student_ids, studentId],
    }));
  }

  return (
    <DashboardModal
      open={open}
      onOpenChange={onOpenChange}
      title="Create mission"
      description="Add a mission for this class. Emily will generate a student preview for you to review before publishing."
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
              <ClassCodeBadge label="Class code" value={teacherClass?.class_code || classId} />
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
              <Button type="submit" disabled={!canSubmit}>
                {busy ? "Generating preview..." : "Generate preview"}
              </Button>
            </div>
          </div>
        </form>

        <aside className="rounded-lg border border-border">
          <header className="border-b border-border px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-cyan-700">Student preview</p>
                <h3 className="mt-2 text-lg font-semibold">{visibleMission?.title ?? "Waiting for Emily"}</h3>
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
                    {approving ? "Assigning..." : "Approve and assign to class"}
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
      </section>
    </DashboardModal>
  );
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
