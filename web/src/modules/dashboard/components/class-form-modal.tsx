"use client";

import { useId, useState, type FormEvent } from "react";

import type { IApiTeacherClass, IApiUpsertTeacherClassRequest } from "@/backend/api/api.interface";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { demoClassCode } from "@/shared/demo-class";

type ClassFormModalProps = {
  readonly error: string | null;
  readonly open: boolean;
  readonly saving: boolean;
  readonly teacherClass: IApiTeacherClass | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (value: IApiUpsertTeacherClassRequest) => Promise<void>;
};

export function ClassFormModal({
  error,
  onOpenChange,
  onSubmit,
  open,
  saving,
  teacherClass,
}: ClassFormModalProps) {
  const isEdit = Boolean(teacherClass);
  const formId = useId();
  const classCodeInputId = useId();
  const classNameInputId = useId();
  const subjectInputId = useId();
  const gradeLevelInputId = useId();
  const [form, setForm] = useState<IApiUpsertTeacherClassRequest>(() => ({
    class_id: teacherClass?.class_id ?? "",
    class_name: teacherClass?.class_name ?? "",
    subject: teacherClass?.subject ?? "",
    grade_level: teacherClass?.grade_level ?? "",
  }));

  const canSubmit = form.class_id.trim().length >= 2 && form.subject.trim().length >= 2 && !saving;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    await onSubmit({
      class_id: normalizeClassCode(form.class_id),
      class_name: form.class_name.trim(),
      grade_level: form.grade_level.trim(),
      subject: form.subject.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="dashboard-theme sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="text-start">
          <DialogTitle>{isEdit ? "Edit class" : "Add new class"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this class here. " : "Create a class code here. "}
            Each class owns its activities, students, and notebook.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(560px,calc(100svh-12rem))] w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3">
          <form id={formId} className="space-y-4 px-0.5" onSubmit={handleSubmit}>
            <FieldRow label="Class code" htmlFor={classCodeInputId}>
              <Input
                id={classCodeInputId}
                required
                value={form.class_id}
                onChange={(event) => setForm((current) => ({ ...current, class_id: event.target.value }))}
                placeholder={demoClassCode}
                autoComplete="off"
                className="font-semibold uppercase"
                disabled={saving || isEdit}
              />
            </FieldRow>

            <FieldRow label="Class name" htmlFor={classNameInputId}>
              <Input
                id={classNameInputId}
                value={form.class_name}
                onChange={(event) => setForm((current) => ({ ...current, class_name: event.target.value }))}
                placeholder="Algebra Lab"
                autoComplete="off"
                disabled={saving}
              />
            </FieldRow>

            <FieldRow label="Subject" htmlFor={subjectInputId}>
              <Input
                id={subjectInputId}
                required
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                placeholder="Mathematics"
                autoComplete="off"
                disabled={saving}
              />
            </FieldRow>

            <FieldRow label="Grade level" htmlFor={gradeLevelInputId}>
              <Input
                id={gradeLevelInputId}
                value={form.grade_level}
                onChange={(event) => setForm((current) => ({ ...current, grade_level: event.target.value }))}
                placeholder="7th grade"
                autoComplete="off"
                disabled={saving}
              />
            </FieldRow>

            {teacherClass ? (
              <div className="grid gap-3 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-3">
                <ClassMeta label="Activities" value={String(teacherClass.activity_count)} />
                <ClassMeta label="Status" value={teacherClass.status || "active"} />
                <ClassMeta label="Updated" value={formatDate(teacherClass.updated_at)} />
              </div>
            ) : null}

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </form>
        </div>

        <DialogFooter>
          <Button type="submit" form={formId} disabled={!canSubmit}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
  children,
  htmlFor,
  label,
}: {
  readonly children: React.ReactNode;
  readonly htmlFor: string;
  readonly label: string;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-y-1 sm:grid-cols-6 sm:gap-x-4">
      <label className="text-sm font-medium text-foreground sm:col-span-2 sm:text-end" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="sm:col-span-4">{children}</div>
    </div>
  );
}

function ClassMeta({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function normalizeClassCode(value: string) {
  return value.trim().toUpperCase();
}

function formatDate(value: string) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
