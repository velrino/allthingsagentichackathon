"use client";

import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Gamepad2,
  NotebookTabs,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { API } from "@/backend/api/api.endpoints";
import type {
  IApiDashboardOverviewResponse,
  IApiDashboardStudent,
  IApiSuggestion,
  IApiTeacherClass,
  IApiTeacherClassMission,
} from "@/backend/api/api.interface";
import { Main } from "@/components/layout/main";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useTeacherAuth } from "../auth/use-teacher-auth";
import {
  MissionBuilder,
  type MissionBuilderForm,
} from "../components/mission-builder";
import { AnalyticsCard } from "../components/analytics/analytics-card";
import {
  buildClassGlance,
  buildClassSummary,
  buildGrowthPatterns,
  buildMissionFunnel,
  buildNextMissionPrompt,
  buildStrengthPatterns,
  planSuggestions,
} from "../components/analytics/analytics-data";
import { ClassMissionsTable } from "../components/class-missions-table";
import { DashboardShell } from "../components/dashboard-shell";
import { ClassGlanceTiles } from "../components/overview/class-glance-tiles";
import { ClassPatternsSummary } from "../components/overview/class-patterns-summary";
import { MissionFunnel } from "../components/overview/mission-funnel";
import { NextLessonPlan } from "../components/overview/next-lesson-plan";
import { PatternGroups } from "../components/overview/pattern-groups";
import { RecentPlayersTable } from "../components/recent-players-table";
import { StudentsTable } from "../components/students-table";
import {
  rememberSelectedClass,
  resolveSelectedClassId,
  upsertTeacherClass,
} from "../utils/teacher-class-state";

type DashboardTab = "overview" | "mission" | "students" | "notebook";

const hashByTab: Record<DashboardTab, string> = {
  overview: "#overview",
  mission: "#mission-builder",
  students: "#students",
  notebook: "#notebook",
};

const tabByHash: Record<string, DashboardTab> = {
  "#overview": "overview",
  "#mission-builder": "mission",
  "#students": "students",
  "#notebook": "notebook",
};

export function DashboardPage({ initialClassId }: { readonly initialClassId?: string } = {}) {
  const router = useRouter();
  const auth = useTeacherAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [overview, setOverview] =
    useState<IApiDashboardOverviewResponse | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<IApiTeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [missionBuilderOpen, setMissionBuilderOpen] = useState(false);
  const [previewMission, setPreviewMission] =
    useState<IApiTeacherClassMission | null>(null);
  const [missions, setMissions] = useState<IApiTeacherClassMission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [shareCodeLabel, setShareCodeLabel] = useState("Share code");

  useEffect(() => {
    function syncTabFromHash() {
      setActiveTab(tabByHash[window.location.hash] ?? "overview");
    }

    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);

    return () => {
      window.removeEventListener("hashchange", syncTabFromHash);
    };
  }, []);

  useEffect(() => {
    if (auth.status === "signed_out") {
      router.replace("/login?next=/dashboard");
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
        setLoading(true);
        setError(null);

        const token = await user.getIdToken();
        return API.teacherClasses.list(token);
      })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setTeacherClasses(response.teacher_classes);
        setSelectedClassId((current) =>
          resolveSelectedClassId(initialClassId ?? current, response.teacher_classes),
        );
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Could not load classes.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.user, initialClassId]);

  useEffect(() => {
    if (auth.status !== "signed_in" || !auth.user) {
      return;
    }

    if (!selectedClassId) {
      return;
    }

    let cancelled = false;
    const user = auth.user;

    Promise.resolve()
      .then(async () => {
        setLoading(true);
        setError(null);

        const token = await user.getIdToken();
        return API.dashboard.overview(token, {
          class_id: selectedClassId,
        });
      })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setOverview(response);
        const teacherClass = response.teacher_class;
        if (teacherClass) {
          setTeacherClasses((current) =>
            upsertTeacherClass(current, teacherClass),
          );
        }
        rememberSelectedClass(response.class_id);
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Could not load dashboard.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.user, selectedClassId]);

  useEffect(() => {
    if (auth.status !== "signed_in" || !auth.user || !selectedClassId) {
      return;
    }

    let cancelled = false;
    const user = auth.user;
    const classId = selectedClassId;

    Promise.resolve()
      .then(async () => {
        setMissionsLoading(true);
        const token = await user.getIdToken();
        return API.teacherClassMissions.list(token, classId);
      })
      .then((response) => {
        if (!cancelled) {
          setMissions(response.missions);
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Could not load class missions.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMissionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.user, selectedClassId]);

  useEffect(() => {
    if (auth.status !== "signed_in" || !auth.user || !selectedClassId) {
      return;
    }

    let cancelled = false;
    let refreshing = false;
    const user = auth.user;
    const classId = selectedClassId;

    async function refreshOverviewInBackground() {
      if (cancelled || refreshing || document.visibilityState !== "visible") {
        return;
      }

      refreshing = true;
      try {
        const token = await user.getIdToken();
        const response = await API.dashboard.overview(token, {
          class_id: classId,
        });
        if (cancelled) {
          return;
        }

        setOverview(response);
        const teacherClass = response.teacher_class;
        if (teacherClass) {
          setTeacherClasses((current) =>
            upsertTeacherClass(current, teacherClass),
          );
        }
      } catch {
        // Keep the last successful dashboard snapshot during transient refresh failures.
      } finally {
        refreshing = false;
      }
    }

    const interval = window.setInterval(refreshOverviewInBackground, 8_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshOverviewInBackground();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [auth.status, auth.user, selectedClassId]);

  const selectedClass = useMemo(() => {
    if (
      overview?.teacher_class &&
      overview.teacher_class.class_id === selectedClassId
    ) {
      return overview.teacher_class;
    }

    return (
      teacherClasses.find(
        (teacherClass) => teacherClass.class_id === selectedClassId,
      ) ?? null
    );
  }, [overview?.teacher_class, selectedClassId, teacherClasses]);

  const activeMission = overview?.active_mission ?? null;
  const suggestions = useMemo(
    () => overview?.suggestions ?? [],
    [overview?.suggestions],
  );
  const students = useMemo(
    () => overview?.students ?? [],
    [overview?.students],
  );
  const classCode =
    previewMission?.class_code ??
    activeMission?.class_code ??
    selectedClass?.class_code ??
    overview?.class_code ??
    "";
  const hasSelectedClass = Boolean(selectedClassId);
  const glance = useMemo(() => buildClassGlance(students), [students]);
  const funnel = useMemo(
    () => buildMissionFunnel(students, activeMission),
    [students, activeMission],
  );
  const growthPatterns = useMemo(
    () => buildGrowthPatterns(students),
    [students],
  );
  const strengthPatterns = useMemo(
    () => buildStrengthPatterns(students),
    [students],
  );
  const patternSource = growthPatterns.source;
  const summaryStudentCount =
    students.length > 0 ? students.length : demoStudentCount(growthPatterns.data, strengthPatterns.data);
  const classSummary = useMemo(
    () =>
      buildClassSummary(
        growthPatterns.data,
        strengthPatterns.data,
        summaryStudentCount,
      ),
    [growthPatterns.data, strengthPatterns.data, summaryStudentCount],
  );
  const plannedSuggestions = useMemo(
    () => planSuggestions(suggestions),
    [suggestions],
  );

  async function loadOverview(token: string, classId: string) {
    const response = await API.dashboard.overview(token, {
      class_id: classId,
    });

    setOverview(response);
    setSelectedClassId(response.class_id);
    const teacherClass = response.teacher_class;
    if (teacherClass) {
      setTeacherClasses((current) => upsertTeacherClass(current, teacherClass));
    }
    rememberSelectedClass(response.class_id);
  }

  async function handleProcessMission(value: MissionBuilderForm) {
    if (!auth.user) {
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const token = await auth.user.getIdToken();
      const response = await API.teacherClassMissions.preview(
        token,
        value.class_id,
        {
          class_name: value.class_name,
          mission_name: value.mission_name,
          subject: value.subject,
          grade_level: value.grade_level,
          learning_goal: value.learning_goal,
          teacher_prompt: value.teacher_prompt,
          audience_type: value.audience_type,
          target_student_ids: value.target_student_ids,
          attachments: value.attachments,
        },
      );
      setPreviewMission(response.mission);
      setMissions((current) =>
        upsertClassMission(current, response.mission),
      );
      setSelectedClassId(response.mission.class_id);
      setMissionBuilderOpen(true);
      setActiveDashboardTab("mission");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not process class mission.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function handleApproveMission(mission: IApiTeacherClassMission) {
    if (!auth.user) {
      return;
    }

    setApproving(true);
    setError(null);
    try {
      const token = await auth.user.getIdToken();
      const response = await API.teacherClassMissions.approve(
        token,
        mission.class_id,
        mission.id,
      );
      setPreviewMission(response.mission);
      setMissions((current) =>
        upsertClassMission(current, response.mission),
      );
      await loadOverview(token, response.mission.class_id);
      setMissionBuilderOpen(false);
      setActiveDashboardTab("mission");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not publish class mission.",
      );
    } finally {
      setApproving(false);
    }
  }

  async function handleSignOut() {
    await auth.signOutTeacher();
    router.replace("/login");
  }

  function handleOpenMissionBuilder() {
    if (!selectedClassId) {
      router.push("/dashboard/classes");
      return;
    }

    setPreviewMission(null);
    setDraftPrompt(null);
    setDraftVersion((current) => current + 1);
    setActiveDashboardTab("mission");
    setMissionBuilderOpen(true);
  }

  function handleBuildNextMission() {
    if (!selectedClassId) {
      router.push("/dashboard/classes");
      return;
    }

    setPreviewMission(null);
    setDraftPrompt(
      buildNextMissionPrompt(
        growthPatterns.data,
        strengthPatterns.data,
        activeMission,
      ),
    );
    setDraftVersion((current) => current + 1);
    setMissionBuilderOpen(true);
    setActiveDashboardTab("mission");
  }

  function handlePlanFollowUp() {
    setActiveDashboardTab("overview");
    window.requestAnimationFrame(() => {
      document
        .getElementById("next-lesson")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleShareCode() {
    if (!classCode) {
      router.push("/dashboard/classes");
      return;
    }

    try {
      await navigator.clipboard.writeText(classCode);
      setShareCodeLabel("Code copied");
    } catch {
      setShareCodeLabel(`Code: ${classCode}`);
    }
    window.setTimeout(() => setShareCodeLabel("Share code"), 2_000);
  }

  function setActiveDashboardTab(value: DashboardTab) {
    setActiveTab(value);

    const nextHash = hashByTab[value];
    if (typeof window !== "undefined" && window.location.hash !== nextHash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${nextHash}`,
      );
      window.dispatchEvent(new Event("hashchange"));
    }
  }

  if (
    auth.status === "checking" ||
    auth.status === "signed_out" ||
    !auth.user
  ) {
    return (
      <main className="grid min-h-svh place-items-center bg-slate-950 px-4 text-white">
        <div className="text-center">
          <p className="text-xs font-bold uppercase text-cyan-300">ClassGame</p>
          <p className="mt-3 text-lg font-semibold">
            Checking teacher session...
          </p>
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
        <div
          id="overview"
          className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedClass
                ? `${selectedClass.class_name || selectedClass.class_code} - ${selectedClass.subject}`
                : "Create a class before publishing missions to students."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {classCode ? <ClassCodeBadge value={classCode} compact /> : null}
            <Button variant="outline" asChild>
              <Link href="/home">
                <Gamepad2 className="size-4" aria-hidden />
                Open game
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/classes">
                <BookOpenCheck className="size-4" aria-hidden />
                Classes
              </Link>
            </Button>
            <Button
              type="button"
              disabled={!hasSelectedClass}
              onClick={handleOpenMissionBuilder}
            >
              <ClipboardList className="size-4" aria-hidden />
              {hasSelectedClass ? "New mission" : "Create class first"}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveDashboardTab(toDashboardTab(value))
          }
        >
          <div className="overflow-x-auto pb-1">
            <TabsList className="min-w-max">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="mission">Missions</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="notebook">Notebook</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-2 space-y-4">
            <SectionHeading
              eyebrow="Overview"
              title="Class at a glance"
              detail={
                students.length > 0
                  ? `${students.length} students joined with the class code. Counts come from live game presence.`
                  : "Counts come from live game presence and will fill in as students join with the class code."
              }
            />
            <ClassGlanceTiles
              glance={glance}
              shareCodeLabel={shareCodeLabel}
              onPlanFollowUp={handlePlanFollowUp}
              onShareCode={handleShareCode}
            />

            <AnalyticsCard
              title="Where the class is in the mission"
              description="Each column is a stage of the mission. Students move right as Emily unlocks the next stage; a review sends them back one column for a moment."
              source={funnel.source}
            >
              <MissionFunnel
                steps={funnel.data}
                totalStudents={students.length > 0 ? students.length : summaryStudentCount}
              />
            </AnalyticsCard>

            <SectionHeading
              eyebrow="Patterns"
              title="What stood out across the class"
              detail="Emily writes down how each student reasons. These are the patterns she saw most often."
              source={patternSource}
            />
            <ClassPatternsSummary
              growth={growthPatterns.data}
              strengths={strengthPatterns.data}
              summary={classSummary}
              totalStudents={summaryStudentCount}
            />

            <SectionHeading
              eyebrow="Areas for growth"
              title="See where students need to grow"
              detail="Grouped by pattern. Strong need means Emily saw it repeatedly; mild means it showed up once."
              source={patternSource}
            />
            <PatternGroups
              variant="growth"
              groups={growthPatterns.data}
              totalStudents={summaryStudentCount}
              emptyMessage="No growth patterns yet. They appear after students answer and explain their reasoning to Emily."
            />

            <SectionHeading
              eyebrow="Strengths"
              title="See who's showing each strength"
              detail="Use this to pair students, or to pick who can explain a step to the class."
              source={patternSource}
            />
            <PatternGroups
              variant="strength"
              groups={strengthPatterns.data}
              totalStudents={summaryStudentCount}
              emptyMessage="No strengths recorded yet. Emily notes them as students explain answers and finish stages."
            />

            <div id="next-lesson" className="scroll-mt-24">
              <SectionHeading
                eyebrow="Next lesson"
                title="Plan the follow-up"
                detail="Emily's suggestions for reteaching, the whole class, and the students who are ahead."
                source={activeMission ? (overview?.generated_by_ai ? "live" : "estimated") : undefined}
              />
            </div>
            <NextLessonPlan
              canBuild={hasSelectedClass}
              suggestions={plannedSuggestions}
              onBuildNextMission={handleBuildNextMission}
            />

            <Card className="gap-0 py-0">
              <CardHeader className="border-b border-border px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Recent players</CardTitle>
                    <CardDescription className="mt-2">
                      Live game presence for the 10 most recently active
                      students in this class.
                    </CardDescription>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Newest first
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <RecentPlayersTable
                  fallbackSubject={
                    activeMission?.subject ?? selectedClass?.subject
                  }
                  students={students}
                />
              </CardContent>
            </Card>

            <ActiveMissionCard
              activeMission={activeMission}
              classCode={classCode}
              generatedByAi={overview?.generated_by_ai ?? false}
              generatedByMock={overview?.generated_by_mock ?? false}
              teacherClass={selectedClass}
            />
          </TabsContent>

          <TabsContent id="mission-builder" value="mission" className="mt-2">
            <ClassMissionsTable
              activeMissionId={activeMission?.id}
              missions={missions}
              loading={missionsLoading}
              onCreateMission={handleOpenMissionBuilder}
            />
          </TabsContent>

          <TabsContent id="students" value="students" className="mt-2">
            <StudentsTableSection students={students} />
          </TabsContent>

          <TabsContent id="notebook" value="notebook" className="mt-2">
            <NotebookPanel
              activeMission={activeMission}
              students={students}
              suggestions={suggestions}
            />
          </TabsContent>
        </Tabs>

        {selectedClassId ? (
          <MissionBuilder
            key={`${selectedClassId}:${draftVersion}`}
            approving={approving}
            classId={selectedClassId}
            draftPrompt={draftPrompt ?? undefined}
            open={missionBuilderOpen}
            previewMission={previewMission}
            processing={processing}
            students={students}
            teacherClass={selectedClass}
            onApprove={handleApproveMission}
            onOpenChange={setMissionBuilderOpen}
            onProcess={handleProcessMission}
          />
        ) : null}

        {loading ? (
          <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-xl">
            Loading dashboard...
          </div>
        ) : null}
      </Main>
    </DashboardShell>
  );
}

function ActiveMissionCard({
  activeMission,
  classCode,
  generatedByAi,
  generatedByMock,
  teacherClass,
}: {
  readonly activeMission: IApiTeacherClassMission | null;
  readonly classCode: string;
  readonly generatedByAi: boolean;
  readonly generatedByMock: boolean;
  readonly teacherClass: IApiTeacherClass | null;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-cyan-700">
              Current class plan
            </p>
            <CardTitle className="mt-2 text-2xl">
              {activeMission?.title ?? "Set today's class mission"}
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl leading-6">
              {teacherClass
                ? (activeMission?.summary ??
                  "Tell Emily what students should study or reinforce. She will ask for the right context, generate a preview, and keep the class mission grounded in your goal.")
                : "Create a class first. Each class gets its own code, assignments, students, and notebook."}
            </CardDescription>
          </div>
          {classCode ? (
            <ClassCodeBadge value={classCode} />
          ) : (
            <Button variant="outline" asChild>
              <Link href="/dashboard/classes">Create class</Link>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            value={activeMission?.status ?? teacherClass?.status ?? "draft"}
          />
          {generatedByAi ? <BadgeTone tone="emerald">Gemini</BadgeTone> : null}
          {generatedByMock ? (
            <BadgeTone tone="amber">Fallback</BadgeTone>
          ) : null}
          <BadgeTone tone="cyan">
            {activeMission?.subject ??
              teacherClass?.subject ??
              "No subject yet"}
          </BadgeTone>
        </div>

        {activeMission ? (
          <div className="grid gap-4 md:grid-cols-3">
            <InfoPanel
              label="Class"
              value={
                activeMission.class_name ||
                teacherClass?.class_name ||
                classCode
              }
            />
            <InfoPanel
              label="Grade"
              value={
                activeMission.grade_level ||
                teacherClass?.grade_level ||
                "Not set"
              }
            />
            <InfoPanel
              label="Duration"
              value={`${activeMission.suggested_duration_minutes} minutes`}
            />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            {teacherClass
              ? "No published mission yet. Open the Mission Builder to create a preview and publish the code students will use inside the game."
              : "No class selected. Create a class, then publish the first mission for that specific class code."}
          </div>
        )}

        {activeMission ? (
          <div className="grid gap-3">
            <h3 className="text-sm font-semibold">Learning flow</h3>
            <div className="grid gap-2">
              {activeMission.stages.map((stage) => (
                <div
                  key={stage.id}
                  className="rounded-md border border-border bg-muted/40 p-3"
                >
                  <p className="font-semibold">{stage.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {stage.goal}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SectionHeading({
  detail,
  eyebrow,
  source,
  title,
}: {
  readonly detail: string;
  readonly eyebrow: string;
  readonly source?: "demo" | "estimated" | "live";
  readonly title: string;
}) {
  return (
    <div className="flex flex-col gap-1 pt-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          {detail}
        </p>
      </div>
      {source ? <SourceBadge source={source} /> : null}
    </div>
  );
}

function SourceBadge({
  source,
}: {
  readonly source: "demo" | "estimated" | "live";
}) {
  const label = {
    demo: "Example data",
    estimated: "Based on class signals",
    live: "Live class data",
  }[source];
  const className = {
    demo: "bg-amber-50 text-amber-800",
    estimated: "bg-cyan-50 text-cyan-800",
    live: "bg-emerald-50 text-emerald-800",
  }[source];

  return (
    <span
      className={`w-fit shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function StudentsTableSection({
  students,
}: {
  readonly students: IApiDashboardStudent[];
}) {
  return (
    <section className="flex flex-1 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Students</h2>
        <p className="text-sm text-muted-foreground">
          {students.length} in this class
        </p>
      </div>
      <StudentsTable students={students} />
    </section>
  );
}

function NotebookPanel({
  activeMission,
  students,
  suggestions,
}: {
  readonly activeMission: IApiTeacherClassMission | null;
  readonly students: IApiDashboardStudent[];
  readonly suggestions: IApiSuggestion[];
}) {
  const attentionStudents = students.filter(
    (student) => student.progress.status === "needs_attention",
  );
  const completedStudents = students.filter(
    (student) => student.progress.status === "completed",
  );

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Card className="gap-0 py-0 lg:col-span-2">
        <CardHeader className="border-b border-border px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-cyan-50 text-cyan-700">
              <NotebookTabs className="size-5" aria-hidden />
            </div>
            <div>
              <CardTitle>Class notebook</CardTitle>
              <CardDescription className="mt-2 leading-6">
                Emily captures how students solve problems, where they hesitate,
                and what should change in the next mission.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 px-4 py-5 sm:px-6">
          <NotebookRow
            icon={BookOpenCheck}
            title="Current focus"
            value={
              activeMission?.learning_goal ?? "No active learning goal yet."
            }
          />
          <NotebookRow
            icon={CheckCircle2}
            title="Positive signal"
            value={
              completedStudents.length > 0
                ? `${completedStudents.length} students completed the mission.`
                : "Completion signals will appear after students play."
            }
          />
          <NotebookRow
            icon={AlertTriangle}
            title="Needs follow-up"
            value={
              attentionStudents.length > 0
                ? attentionStudents
                    .map((student) => student.student_name)
                    .join(", ")
                : "No students marked as needing attention yet."
            }
          />
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b border-border px-4 py-4 sm:px-6">
          <CardTitle>Next lesson notes</CardTitle>
          <CardDescription className="mt-2 leading-6">
            A short planning queue for the teacher.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-4 py-5 sm:px-6">
          {(suggestions.length > 0 ? suggestions.slice(0, 3) : []).map(
            (suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-md border border-border p-3"
              >
                <p className="text-sm font-semibold">{suggestion.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {suggestion.activity}
                </p>
              </div>
            ),
          )}
          {suggestions.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Publish a mission and collect student attempts to unlock better
              lesson notes.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

function NotebookRow({
  icon: Icon,
  title,
  value,
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly value: string;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-border p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-cyan-700" aria-hidden />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

function InfoPanel({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ClassCodeBadge({
  compact = false,
  value,
}: {
  readonly compact?: boolean;
  readonly value: string;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm">
        <span className="text-[11px] font-bold uppercase text-emerald-700">
          Code
        </span>
        <span className="font-mono text-base font-black text-emerald-900">
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
      <span className="block text-xs font-bold uppercase text-emerald-700">
        Class code
      </span>
      <span className="mt-1 block font-mono text-lg font-black text-emerald-900">
        {value}
      </span>
    </div>
  );
}

function demoStudentCount(...groups: { students: { id: string }[] }[][]) {
  const ids = new Set<string>();
  for (const group of groups.flat()) {
    for (const student of group.students) {
      ids.add(student.id);
    }
  }

  return ids.size;
}

function StatusBadge({ value }: { readonly value: string }) {
  return (
    <BadgeTone tone={value === "published" ? "emerald" : "slate"}>
      {statusLabel(value)}
    </BadgeTone>
  );
}

function BadgeTone({
  children,
  tone,
}: {
  readonly children: string;
  readonly tone: "amber" | "cyan" | "emerald" | "slate";
}) {
  const classNameByTone = {
    amber: "bg-amber-50 text-amber-700",
    cyan: "bg-cyan-50 text-cyan-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`w-fit rounded-md px-2.5 py-1 text-xs font-bold uppercase ${classNameByTone[tone]}`}
    >
      {children}
    </span>
  );
}

function statusLabel(value: string) {
  if (value === "published") {
    return "Published";
  }

  if (value === "preview") {
    return "Preview";
  }

  if (value === "draft") {
    return "Draft";
  }

  return value;
}

function upsertClassMission(
  missions: IApiTeacherClassMission[],
  mission: IApiTeacherClassMission,
) {
  return [
    mission,
    ...missions.filter((current) => current.id !== mission.id),
  ].sort(
    (left, right) =>
      toTimestamp(right.updated_at) - toTimestamp(left.updated_at),
  );
}

function toTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toDashboardTab(value: string): DashboardTab {
  if (value === "mission" || value === "students" || value === "notebook") {
    return value;
  }

  return "overview";
}
