"use client";

import { BookOpenCheck, ClipboardList, Gamepad2, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { API } from "@/backend/api/api.endpoints";
import type {
  IApiDashboardStudent,
  IApiTeacherClass,
  IApiTeacherClassMission,
  IApiUpsertTeacherClassRequest,
} from "@/backend/api/api.interface";
import { Main } from "@/components/layout/main";
import { Button } from "@/components/ui/button";

import { useTeacherAuth } from "../auth/use-teacher-auth";
import { MissionBuilder, type MissionBuilderForm } from "../components/mission-builder";
import { ClassFormModal } from "../components/class-form-modal";
import { ClassesTable } from "../components/classes-table";
import { DashboardShell } from "../components/dashboard-shell";
import { MetricCard } from "../components/metric-card";
import { rememberSelectedClass, sortTeacherClasses, upsertTeacherClass } from "../utils/teacher-class-state";

export function ClassesPage() {
  const router = useRouter();
  const auth = useTeacherAuth();
  const [teacherClasses, setTeacherClasses] = useState<IApiTeacherClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<IApiTeacherClass | null>(null);
  const [missionClass, setMissionClass] = useState<IApiTeacherClass | null>(null);
  const [missionStudents, setMissionStudents] = useState<IApiDashboardStudent[]>([]);
  const [previewMission, setPreviewMission] = useState<IApiTeacherClassMission | null>(null);
  const [classFormOpen, setClassFormOpen] = useState(false);
  const [missionBuilderOpen, setMissionBuilderOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [classFormError, setClassFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (auth.status === "signed_out") {
      router.replace("/login?next=/dashboard/classes");
    }
  }, [auth.status, router]);

  useEffect(() => {
    if (auth.status !== "signed_in" || !auth.user) {
      return;
    }

    let cancelled = false;
    const user = auth.user;

    Promise.resolve()
      .then(async () => {
        setPageError(null);

        const token = await user.getIdToken();
        return API.teacherClasses.list(token);
      })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setTeacherClasses(sortTeacherClasses(response.teacher_classes));
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setPageError(caughtError instanceof Error ? caughtError.message : "Could not load classes.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.user]);

  const activeClasses = useMemo(
    () => teacherClasses.filter((teacherClass) => teacherClass.status !== "archived").length,
    [teacherClasses],
  );
  const publishedMissions = useMemo(
    () => teacherClasses.reduce((total, teacherClass) => total + teacherClass.mission_count, 0),
    [teacherClasses],
  );
  const playableClasses = useMemo(
    () => teacherClasses.filter((teacherClass) => Boolean(teacherClass.active_mission_id)).length,
    [teacherClasses],
  );

  function handleCreateClass() {
    setSelectedClass(null);
    setClassFormError(null);
    setClassFormOpen(true);
  }

  function handleOpenClass(teacherClass: IApiTeacherClass) {
    setSelectedClass(teacherClass);
    setClassFormError(null);
    setClassFormOpen(true);
  }

  async function handleSubmitClass(value: IApiUpsertTeacherClassRequest) {
    if (!auth.user) {
      return;
    }

    setSaving(true);
    setClassFormError(null);
    try {
      const token = await auth.user.getIdToken();
      const response = await API.teacherClasses.upsert(token, value);
      setTeacherClasses((current) => upsertTeacherClass(current, response.teacher_class));
      setSelectedClass(response.teacher_class);
      rememberSelectedClass(response.teacher_class.class_id);
    } catch (caughtError) {
      setClassFormError(caughtError instanceof Error ? caughtError.message : "Could not save class.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBuildMission(teacherClass: IApiTeacherClass) {
    if (!auth.user) {
      return;
    }

    rememberSelectedClass(teacherClass.class_id);
    setMissionClass(teacherClass);
    setMissionStudents([]);
    setPreviewMission(null);
    setMissionBuilderOpen(true);

    try {
      const token = await auth.user.getIdToken();
      const response = await API.dashboard.overview(token, {
        class_id: teacherClass.class_id,
      });
      setMissionStudents(response.students);
    } catch (caughtError) {
      setPageError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load students for this class.",
      );
    }
  }

  async function handleProcessMission(value: MissionBuilderForm) {
    if (!auth.user) {
      return;
    }

    setProcessing(true);
    setPageError(null);
    try {
      const token = await auth.user.getIdToken();
      const response = await API.teacherClassMissions.preview(token, value.class_id, {
        class_name: value.class_name,
        mission_name: value.mission_name,
        subject: value.subject,
        grade_level: value.grade_level,
        learning_goal: value.learning_goal,
        teacher_prompt: value.teacher_prompt,
        audience_type: value.audience_type,
        target_student_ids: value.target_student_ids,
        attachments: value.attachments,
      });
      setPreviewMission(response.mission);
    } catch (caughtError) {
      setPageError(caughtError instanceof Error ? caughtError.message : "Could not process class mission.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleApproveMission(mission: IApiTeacherClassMission) {
    if (!auth.user) {
      return;
    }

    setApproving(true);
    setPageError(null);
    try {
      const token = await auth.user.getIdToken();
      const response = await API.teacherClassMissions.approve(token, mission.class_id, mission.id);
      setPreviewMission(response.mission);

      const classesResponse = await API.teacherClasses.list(token);
      const nextClasses = sortTeacherClasses(classesResponse.teacher_classes);
      setTeacherClasses(nextClasses);
      setMissionClass(nextClasses.find((teacherClass) => teacherClass.class_id === mission.class_id) ?? missionClass);
      rememberSelectedClass(mission.class_id);
      setMissionBuilderOpen(false);
    } catch (caughtError) {
      setPageError(caughtError instanceof Error ? caughtError.message : "Could not publish class mission.");
    } finally {
      setApproving(false);
    }
  }

  async function handleSignOut() {
    await auth.signOutTeacher();
    router.replace("/login");
  }

  if (auth.status === "checking" || auth.status === "signed_out" || !auth.user) {
    return (
      <main className="grid min-h-svh place-items-center bg-slate-950 px-4 text-white">
        <div className="text-center">
          <p className="text-xs font-bold uppercase text-cyan-300">ClassGame</p>
          <p className="mt-3 text-lg font-semibold">Checking teacher session...</p>
        </div>
      </main>
    );
  }

  return (
    <DashboardShell
      teacherClasses={teacherClasses}
      user={auth.user}
      onSignOut={handleSignOut}
    >
      <Main id="main-content" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Classes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create class codes, define the content teachers want to reinforce, and launch student game missions.
            </p>
          </div>

          <Button type="button" onClick={handleCreateClass}>
            <Plus className="size-4" aria-hidden />
            New class
          </Button>
        </div>

        {pageError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {pageError}
          </p>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={BookOpenCheck}
            label="Classes"
            value={String(teacherClasses.length)}
            detail={`${activeClasses} active`}
          />
          <MetricCard
            icon={ClipboardList}
            label="Missions"
            value={String(publishedMissions)}
            detail="Published across classes"
          />
          <MetricCard icon={Users} label="Students" value="0" detail="Loaded after students play" />
          <MetricCard
            icon={Gamepad2}
            label="Ready to play"
            value={String(playableClasses)}
            detail="Classes with a published mission"
          />
        </section>

        <ClassesTable
          teacherClasses={teacherClasses}
          onBuildMission={handleBuildMission}
          onOpenClass={handleOpenClass}
        />

        <ClassFormModal
          key={selectedClass?.id ?? "new-class"}
          error={classFormError}
          open={classFormOpen}
          saving={saving}
          teacherClass={selectedClass}
          onOpenChange={setClassFormOpen}
          onSubmit={handleSubmitClass}
        />

        {missionClass ? (
          <MissionBuilder
            key={`classes:${missionClass.class_id}:${missionBuilderOpen ? "open" : "closed"}`}
            approving={approving}
            classId={missionClass.class_id}
            open={missionBuilderOpen}
            previewMission={previewMission}
            processing={processing}
            students={missionStudents}
            teacherClass={missionClass}
            onApprove={handleApproveMission}
            onOpenChange={setMissionBuilderOpen}
            onProcess={handleProcessMission}
          />
        ) : null}
      </Main>
    </DashboardShell>
  );
}
