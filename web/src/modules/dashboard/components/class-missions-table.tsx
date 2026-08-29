"use client";

import { ClipboardList, Plus } from "lucide-react";

import type { IApiTeacherClassMission } from "@/backend/api/api.interface";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ClassMissionsTableProps = {
  readonly activeMissionId?: string;
  readonly missions: IApiTeacherClassMission[];
  readonly loading: boolean;
  readonly onCreateMission: () => void;
};

export function ClassMissionsTable({
  activeMissionId,
  missions,
  loading,
  onCreateMission,
}: ClassMissionsTableProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Missions</CardTitle>
            <CardDescription className="mt-1.5 max-w-2xl leading-6">
              Create missions for this class, review Emily&apos;s preview, and
              see what is currently available to students.
            </CardDescription>
          </div>
          <Button type="button" className="shrink-0" onClick={onCreateMission}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">New mission</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="px-4 py-14 text-center text-sm font-medium text-muted-foreground sm:px-6">
            Loading missions...
          </div>
        ) : missions.length === 0 ? (
          <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
                <ClipboardList className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold text-foreground">
                No missions yet
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                Create the first mission for this class. Emily will prepare a
                student preview before you publish it.
              </p>
              <Button type="button" className="mt-5" onClick={onCreateMission}>
                <Plus className="size-4" aria-hidden />
                Create first mission
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {missions.map((mission) => (
                <MissionMobileRow
                  key={mission.id}
                  mission={mission}
                  active={mission.id === activeMissionId}
                />
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-6">Mission</TableHead>
                    <TableHead>Mission code</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pe-6 text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missions.map((mission) => (
                    <TableRow key={mission.id}>
                      <TableCell className="max-w-64 ps-6">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-foreground">
                              {mission.mission_name || mission.title}
                            </p>
                            {mission.id === activeMissionId ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                Live
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {mission.subject || "Subject not set"} ·{" "}
                            {formatDuration(mission.suggested_duration_minutes)}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {mission.learning_goal || "No learning goal provided"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <MissionCode value={mission.mission_code} />
                      </TableCell>
                      <TableCell>
                        <AudienceLabel mission={mission} />
                      </TableCell>
                      <TableCell>
                        <MissionStatus status={mission.status} />
                      </TableCell>
                      <TableCell className="pe-6 text-right text-muted-foreground">
                        {formatDate(mission.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MissionMobileRow({
  active,
  mission,
}: {
  readonly active: boolean;
  readonly mission: IApiTeacherClassMission;
}) {
  return (
    <article className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-foreground">
              {mission.mission_name || mission.title}
            </h3>
            {active ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                Live
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {mission.subject || "Subject not set"}
          </p>
        </div>
        <MissionStatus status={mission.status} />
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-5 text-muted-foreground">
        {mission.learning_goal || "No learning goal provided"}
      </p>
      <div className="mt-3">
        <MissionCode value={mission.mission_code} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <AudienceLabel mission={mission} />
        <span>{formatDate(mission.updated_at)}</span>
      </div>
    </article>
  );
}

function MissionCode({ value }: { readonly value: string }) {
  return value ? (
    <span className="inline-flex rounded-md bg-slate-950 px-2.5 py-1 font-mono text-xs font-bold tracking-[0.12em] text-white">
      {value}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">Not generated</span>
  );
}

function AudienceLabel({
  mission,
}: {
  readonly mission: IApiTeacherClassMission;
}) {
  const targetCount = mission.target_student_ids?.length ?? 0;

  if (
    mission.audience_type === "selected" &&
    targetCount > 0
  ) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {targetCount} {targetCount === 1 ? "student" : "students"}
      </span>
    );
  }

  return (
    <span className="text-xs font-medium text-muted-foreground">
      Everyone
    </span>
  );
}

function MissionStatus({ status }: { readonly status: string }) {
  const published = status === "published";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
        published
          ? "bg-emerald-100 text-emerald-800"
          : "bg-violet-100 text-violet-800",
      )}
    >
      {published ? "Published" : "Preview"}
    </span>
  );
}

function formatDuration(minutes: number) {
  return minutes > 0 ? `${minutes} min` : "Not estimated";
}

function formatDate(value: string) {
  if (!value) {
    return "Not updated";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not updated";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
