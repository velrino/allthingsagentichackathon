"use client";

import { Plus } from "lucide-react";
import { useId, useMemo, useState, type FormEvent } from "react";

import type { IApiTeacherClass, IApiUpsertTeacherClassRequest } from "@/backend/api/api.interface";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/date";

const subjectSuggestions = [
  "Mathematics",
  "English Language Arts",
  "Science",
  "Social Studies",
  "Computer Science",
  "World Languages",
  "Art",
  "Music",
  "Physical Education",
];

const gradeLevelSuggestions = [
  "Pre-K",
  "Kindergarten",
  "1st grade",
  "2nd grade",
  "3rd grade",
  "4th grade",
  "5th grade",
  "6th grade",
  "7th grade",
  "8th grade",
  "9th grade",
  "10th grade",
  "11th grade",
  "12th grade",
  "Higher education",
  "Adult learning",
];

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
  const classNameInputId = useId();
  const subjectInputId = useId();
  const gradeLevelInputId = useId();
  const [comboboxPortalContainer, setComboboxPortalContainer] = useState<HTMLElement | null>(null);
  const [form, setForm] = useState<IApiUpsertTeacherClassRequest>(() => ({
    class_id: teacherClass?.class_id ?? "",
    class_name: teacherClass?.class_name ?? "",
    subject: teacherClass?.subject ?? "",
    grade_level: teacherClass?.grade_level ?? "",
  }));

  const canSubmit = form.subject.trim().length >= 2 && !saving;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    await onSubmit({
      ...(teacherClass ? { class_id: teacherClass.class_id } : {}),
      class_name: form.class_name.trim(),
      grade_level: form.grade_level.trim(),
      subject: form.subject.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={setComboboxPortalContainer}
        className="dashboard-theme sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="text-start">
          <DialogTitle>{isEdit ? "Edit class" : "Add new class"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the class details. The sharing code stays the same."
              : "Add the class details. We will generate a short, unique sharing code after creation."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(560px,calc(100svh-12rem))] w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3">
          <form id={formId} className="space-y-4 px-0.5" onSubmit={handleSubmit}>
            {teacherClass ? (
              <div className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 dark:border-cyan-900 dark:bg-cyan-950/40">
                <p className="text-xs font-semibold text-cyan-800 dark:text-cyan-200">Class sharing code</p>
                <p className="mt-1 font-mono text-xl font-bold tracking-[0.16em] text-cyan-950 dark:text-cyan-50">
                  {teacherClass.class_code}
                </p>
                <p className="mt-1 text-xs text-cyan-800/80 dark:text-cyan-200/80">
                  Students use this code to enter the class.
                </p>
              </div>
            ) : null}

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
              <CreatableFieldCombobox
                id={subjectInputId}
                required
                value={form.subject}
                onValueChange={(subject) => setForm((current) => ({ ...current, subject }))}
                suggestions={subjectSuggestions}
                placeholder="Mathematics"
                portalContainer={comboboxPortalContainer}
                disabled={saving}
              />
            </FieldRow>

            <FieldRow label="Grade level" htmlFor={gradeLevelInputId}>
              <CreatableFieldCombobox
                id={gradeLevelInputId}
                value={form.grade_level}
                onValueChange={(gradeLevel) => setForm((current) => ({ ...current, grade_level: gradeLevel }))}
                suggestions={gradeLevelSuggestions}
                placeholder="7th grade"
                portalContainer={comboboxPortalContainer}
                disabled={saving}
              />
            </FieldRow>

            {teacherClass ? (
              <div className="grid gap-3 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-3">
                <ClassMeta label="Missions" value={String(teacherClass.mission_count)} />
                <ClassMeta label="Status" value={teacherClass.status || "active"} />
                <ClassMeta
                  label="Updated"
                  value={formatDate(teacherClass.updated_at, {
                    fallback: "Never",
                    preset: "date-time",
                  })}
                />
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

type CreatableOption = {
  readonly create?: boolean;
  readonly value: string;
};

function CreatableFieldCombobox({
  disabled,
  id,
  onValueChange,
  placeholder,
  portalContainer,
  required,
  suggestions,
  value,
}: {
  readonly disabled: boolean;
  readonly id: string;
  readonly onValueChange: (value: string) => void;
  readonly placeholder: string;
  readonly portalContainer: HTMLElement | null;
  readonly required?: boolean;
  readonly suggestions: readonly string[];
  readonly value: string;
}) {
  const [createdValues, setCreatedValues] = useState<string[]>(() => {
    const initialValue = value.trim();
    const isSuggested = suggestions.some(
      (suggestion) => suggestion.toLocaleLowerCase() === initialValue.toLocaleLowerCase(),
    );

    return initialValue && !isSuggested ? [initialValue] : [];
  });
  const availableValues = useMemo(
    () => [...suggestions, ...createdValues],
    [createdValues, suggestions],
  );
  const items = useMemo<CreatableOption[]>(() => {
    const suggestedItems = availableValues.map((suggestion) => ({ value: suggestion }));
    const trimmedValue = value.trim();
    const hasExactMatch = availableValues.some(
      (suggestion) => suggestion.toLocaleLowerCase() === trimmedValue.toLocaleLowerCase(),
    );

    if (!trimmedValue || hasExactMatch) {
      return suggestedItems;
    }

    return [...suggestedItems, { create: true, value: trimmedValue }];
  }, [availableValues, value]);
  const selectedItem =
    items.find(
      (item) =>
        !item.create &&
        item.value.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
    ) ?? null;

  return (
    <Combobox
      autoHighlight
      disabled={disabled}
      inputValue={value}
      items={items}
      value={selectedItem}
      isItemEqualToValue={(item, selected) => item.value === selected.value}
      itemToStringLabel={(item) => item.value}
      itemToStringValue={(item) => item.value}
      onInputValueChange={(nextValue) => onValueChange(nextValue)}
      onValueChange={(nextItem) => {
        if (nextItem) {
          commitValue(nextItem.value);
        }
      }}
    >
      <ComboboxInput
        id={id}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
      />
      <ComboboxContent container={portalContainer}>
        <ComboboxEmpty>Type a new value to use it.</ComboboxEmpty>
        <ComboboxList>
          {(item: CreatableOption) => (
            <ComboboxItem
              key={`${item.create ? "create" : "option"}:${item.value}`}
              value={item}
            >
              {item.create ? (
                <>
                  <Plus className="size-4 text-primary" aria-hidden />
                  <span>
                    Use <strong>“{item.value}”</strong>
                  </span>
                </>
              ) : (
                item.value
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );

  function commitValue(nextValue: string) {
    const trimmedValue = nextValue.trim();
    if (!trimmedValue) {
      return;
    }

    setCreatedValues((current) => {
      const alreadyAvailable = [...suggestions, ...current].some(
        (item) => item.toLocaleLowerCase() === trimmedValue.toLocaleLowerCase(),
      );

      return alreadyAvailable ? current : [...current, trimmedValue];
    });
    onValueChange(trimmedValue);
  }
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
