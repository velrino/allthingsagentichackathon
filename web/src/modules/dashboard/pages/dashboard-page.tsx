"use client";

import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Gamepad2,
  NotebookTabs,
  TrendingUp,
  Users,
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
  IApiTeacherClassActivity,
} from "@/backend/api/api.interface";
import { Main } from "@/components/layout/main";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useTeacherAuth } from "../auth/use-teacher-auth";
import { ActivityBuilder, type ActivityBuilderForm } from "../components/activity-builder";
import { AgentInterventionChart } from "../components/analytics/agent-intervention-chart";
import { AnalyticsCard } from "../components/analytics/analytics-card";
import {
  buildLearningSignalDataset,
  buildMisconceptionDataset,
  demoInterventionOutcomes,
} from "../components/analytics/analytics-data";
import { CollaborativeLearningChart } from "../components/analytics/collaborative-learning-chart";
import { MisconceptionsChart } from "../components/analytics/misconceptions-chart";
import { DashboardShell } from "../components/dashboard-shell";
import { MetricCard } from "../components/metric-card";
import { RecentPlayersTable } from "../components/recent-players-table";
import { StudentsTable } from "../components/students-table";
import { rememberSelectedClass, resolveSelectedClassId, upsertTeacherClass } from "../utils/teacher-class-state";

type DashboardTab = "overview" | "activity" | "students" | "notebook";

const hashByTab: Record<DashboardTab, string> = {
  overview: "#overview",
  activity: "#activity-builder",
  students: "#students",
  notebook: "#notebook",
};

const tabByHash: Record<string, DashboardTab> = {
  "#overview": "overview",
  "#activity-builder": "activity",
  "#students": "students",
  "#notebook": "notebook",
};

export function DashboardPage() {
  const router = useRouter();
  const auth = useTeacherAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [overview, setOverview] = useState<IApiDashboardOverviewResponse | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<IApiTeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [activityBuilderOpen, setActivityBuilderOpen] = useState(false);
  const [previewActivity, setPreviewActivity] = useState<IApiTeacherClassActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [approving, setApproving] = useState(false);

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
        setSelectedClassId((current) => resolveSelectedClassId(current, response.teacher_classes));
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Could not load classes.");
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
  }, [auth.status, auth.user]);

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
          setTeacherClasses((current) => upsertTeacherClass(current, teacherClass));
        }
        rememberSelectedClass(response.class_id);
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Could not load dashboard.");
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
        const response = await API.dashboard.overview(token, { class_id: classId });
        if (cancelled) {
          return;
        }

        setOverview(response);
        const teacherClass = response.teacher_class;
        if (teacherClass) {
          setTeacherClasses((current) => upsertTeacherClass(current, teacherClass));
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
    if (overview?.teacher_class && overview.teacher_class.class_id === selectedClassId) {
      return overview.teacher_class;
    }

    return teacherClasses.find((teacherClass) => teacherClass.class_id === selectedClassId) ?? null;
  }, [overview?.teacher_class, selectedClassId, teacherClasses]);

  const metrics = overview?.metrics;
  const activeActivity = overview?.active_activity ?? null;
  const suggestions = overview?.suggestions ?? [];
  const students = useMemo(() => overview?.students ?? [], [overview?.students]);
  const classCode = previewActivity?.class_code ?? activeActivity?.class_code ?? selectedClass?.class_code ?? overview?.class_code ?? "";
  const hasSelectedClass = Boolean(selectedClassId);
  const learningSignalDataset = useMemo(() => buildLearningSignalDataset(students), [students]);
  const misconceptionDataset = useMemo(() => buildMisconceptionDataset(students), [students]);

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

  async function handleProcessActivity(value: ActivityBuilderForm) {
    if (!auth.user) {
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const token = await auth.user.getIdToken();
      const response = await API.teacherClassActivities.preview(token, value.class_id, {
        class_name: value.class_name,
        activity_name: value.activity_name,
        subject: value.subject,
        grade_level: value.grade_level,
        learning_goal: value.learning_goal,
        teacher_prompt: value.teacher_prompt,
        attachments: value.attachments,
      });
      setPreviewActivity(response.activity);
      setSelectedClassId(response.activity.class_id);
      setActivityBuilderOpen(true);
      setActiveDashboardTab("activity");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not process class activity.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleApproveActivity(activity: IApiTeacherClassActivity) {
    if (!auth.user) {
      return;
    }

    setApproving(true);
    setError(null);
    try {
      const token = await auth.user.getIdToken();
      const response = await API.teacherClassActivities.approve(token, activity.class_id, activity.id);
      setPreviewActivity(response.activity);
      await loadOverview(token, response.activity.class_id);
      setActiveDashboardTab("overview");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not publish class activity.");
    } finally {
      setApproving(false);
    }
  }

  async function handleSignOut() {
    await auth.signOutTeacher();
    router.replace("/login");
  }

  function handleOpenActivityBuilder() {
    if (!selectedClassId) {
      router.push("/dashboard/classes");
      return;
    }

    setActivityBuilderOpen(true);
    setActiveDashboardTab("activity");
  }

  function setActiveDashboardTab(value: DashboardTab) {
    setActiveTab(value);

    const nextHash = hashByTab[value];
    if (typeof window !== "undefined" && window.location.hash !== nextHash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
      window.dispatchEvent(new Event("hashchange"));
    }
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
    <DashboardShell user={auth.user} onSignOut={handleSignOut}>
      <Main id="main-content" className="space-y-4">
        <div id="overview" className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedClass
                ? `${selectedClass.class_name || selectedClass.class_code} - ${selectedClass.subject}`
                : "Create a class before publishing activities to students."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
            <Button type="button" disabled={!hasSelectedClass} onClick={handleOpenActivityBuilder}>
              <ClipboardList className="size-4" aria-hidden />
              {hasSelectedClass ? "Build activity" : "Create class first"}
            </Button>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        <Tabs value={activeTab} onValueChange={(value) => setActiveDashboardTab(toDashboardTab(value))}>
          <div className="overflow-x-auto pb-1">
            <TabsList className="min-w-max">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity Builder</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="notebook">Notebook</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-2 space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={Users}
                label="Students"
                value={String(metrics?.total_students ?? 0)}
                detail={`${metrics?.active_students ?? 0} active in this class`}
              />
              <MetricCard
                icon={CheckCircle2}
                label="Completed"
                value={String(metrics?.completed_students ?? 0)}
                detail="Finished the current activity"
              />
              <MetricCard
                icon={TrendingUp}
                label="Average progress"
                value={`${metrics?.average_progress ?? 0}%`}
                detail="Across visible students"
              />
              <MetricCard
                icon={AlertTriangle}
                label="Needs attention"
                value={String(metrics?.needs_attention ?? 0)}
                detail={`${metrics?.notebook_notes ?? 0} notebook notes`}
              />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-7">
              <AnalyticsCard
                className="col-span-1 lg:col-span-4"
                title="Agent intervention outcomes"
                description="The share of students progressing independently, with Emily's guidance, or with teacher support."
                source="demo"
              >
                <AgentInterventionChart data={demoInterventionOutcomes} />
              </AnalyticsCard>

              <Card className="col-span-1 lg:col-span-3">
                <CardHeader>
                  <CardTitle>Emily notebook</CardTitle>
                  <CardDescription>
                    {students.length > 0
                      ? `${students.length} student signals available for this class.`
                      : "Student signals will appear after students play."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentStudentSignals students={students} suggestions={suggestions} />
                </CardContent>
              </Card>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <AnalyticsCard
                contentClassName="ps-2 sm:ps-4"
                title="Collaborative learning signals"
                description="How mastery, confidence, and clarification needs change as Emily adapts the activity."
                source={learningSignalDataset.source}
              >
                <CollaborativeLearningChart data={learningSignalDataset.data} />
              </AnalyticsCard>

              <AnalyticsCard
                title="Common misconceptions"
                description="The reasoning patterns Emily captures most often, ranked so the next lesson has a clear focus."
                source={misconceptionDataset.source}
              >
                <MisconceptionsChart data={misconceptionDataset.data} />
              </AnalyticsCard>
            </section>

            <Card className="gap-0 py-0">
              <CardHeader className="border-b border-border px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Recent players</CardTitle>
                    <CardDescription className="mt-2">
                      Live game presence for the 10 most recently active students in this class.
                    </CardDescription>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Newest first</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 py-5 sm:px-6">
                <RecentPlayersTable
                  fallbackSubject={activeActivity?.subject ?? selectedClass?.subject}
                  students={students}
                />
              </CardContent>
            </Card>

            <ActiveActivityCard
              activeActivity={activeActivity}
              classCode={classCode}
              generatedByAi={overview?.generated_by_ai ?? false}
              generatedByMock={overview?.generated_by_mock ?? false}
              teacherClass={selectedClass}
            />
          </TabsContent>

          <TabsContent id="activity-builder" value="activity" className="mt-2">
            <ActivityBuilderLauncherCard
              classCode={classCode}
              teacherClass={selectedClass}
              onOpenActivityBuilder={handleOpenActivityBuilder}
            />
          </TabsContent>

          <TabsContent id="students" value="students" className="mt-2">
            <StudentsTableSection students={students} />
          </TabsContent>

          <TabsContent id="notebook" value="notebook" className="mt-2">
            <NotebookPanel activeActivity={activeActivity} students={students} suggestions={suggestions} />
          </TabsContent>
        </Tabs>

        {selectedClassId ? (
          <ActivityBuilder
            key={`${selectedClassId}:${activeActivity?.id ?? "empty"}:${previewActivity?.id ?? "preview"}`}
            activeActivity={activeActivity}
            approving={approving}
            classId={selectedClassId}
            open={activityBuilderOpen}
            previewActivity={previewActivity}
            processing={processing}
            teacherClass={selectedClass}
            onApprove={handleApproveActivity}
            onOpenChange={setActivityBuilderOpen}
            onProcess={handleProcessActivity}
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

function ActiveActivityCard({
  activeActivity,
  classCode,
  generatedByAi,
  generatedByMock,
  teacherClass,
}: {
  readonly activeActivity: IApiTeacherClassActivity | null;
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
            <p className="text-xs font-bold uppercase text-cyan-700">Current class plan</p>
            <CardTitle className="mt-2 text-2xl">{activeActivity?.title ?? "Set today's class activity"}</CardTitle>
            <CardDescription className="mt-2 max-w-2xl leading-6">
              {teacherClass
                ? activeActivity?.summary ??
                  "Tell Emily what students should study or reinforce. She will ask for the right context, generate a preview, and keep the class activity grounded in your goal."
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
          <StatusBadge value={activeActivity?.status ?? teacherClass?.status ?? "draft"} />
          {generatedByAi ? <BadgeTone tone="emerald">Gemini</BadgeTone> : null}
          {generatedByMock ? <BadgeTone tone="amber">Fallback</BadgeTone> : null}
          <BadgeTone tone="cyan">{activeActivity?.subject ?? teacherClass?.subject ?? "No subject yet"}</BadgeTone>
        </div>

        {activeActivity ? (
          <div className="grid gap-4 md:grid-cols-3">
            <InfoPanel label="Class" value={activeActivity.class_name || teacherClass?.class_name || classCode} />
            <InfoPanel label="Grade" value={activeActivity.grade_level || teacherClass?.grade_level || "Not set"} />
            <InfoPanel label="Duration" value={`${activeActivity.suggested_duration_minutes} minutes`} />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            {teacherClass
              ? "No published activity yet. Open the Activity Builder to create a preview and publish the code students will use inside the game."
              : "No class selected. Create a class, then publish the first activity for that specific class code."}
          </div>
        )}

        {activeActivity ? (
          <div className="grid gap-3">
            <h3 className="text-sm font-semibold">Learning flow</h3>
            <div className="grid gap-2">
              {activeActivity.stages.map((stage) => (
                <div key={stage.id} className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="font-semibold">{stage.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{stage.goal}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActivityBuilderLauncherCard({
  classCode,
  onOpenActivityBuilder,
  teacherClass,
}: {
  readonly classCode: string;
  readonly onOpenActivityBuilder: () => void;
  readonly teacherClass: IApiTeacherClass | null;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-cyan-700">Activity Builder</p>
            <CardTitle className="mt-2">Open Emily Activity Builder</CardTitle>
            <CardDescription className="mt-2 max-w-2xl leading-6">
              {teacherClass
                ? "Create or revise the current activity for this class. Emily will generate a student-facing preview before you publish."
                : "Create a class first so the activity belongs to the right class code."}
            </CardDescription>
          </div>
          {classCode ? <ClassCodeBadge value={classCode} /> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm leading-6 text-muted-foreground">
          {teacherClass
            ? `${teacherClass.class_name || teacherClass.class_code} is selected.`
            : "No class is selected for this teacher yet."}
        </p>
        {teacherClass ? (
          <Button type="button" onClick={onOpenActivityBuilder}>
            <ClipboardList className="size-4" aria-hidden />
            Build activity
          </Button>
        ) : (
          <Button asChild>
            <Link href="/dashboard/classes">
              <BookOpenCheck className="size-4" aria-hidden />
              Create class
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RecentStudentSignals({
  students,
  suggestions,
}: {
  readonly students: IApiDashboardStudent[];
  readonly suggestions: IApiSuggestion[];
}) {
  const visibleStudents = [...students].sort(compareStudentSignals).slice(0, 5);

  if (visibleStudents.length === 0) {
    const visibleSuggestions = suggestions.length > 0 ? suggestions.slice(0, 3) : starterSuggestions();

    return (
      <div className="space-y-6">
        {visibleSuggestions.map((suggestion) => (
          <div key={suggestion.id} className="flex items-start gap-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-bold">
              AI
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm leading-none font-medium">{suggestion.title}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{suggestion.reason}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {visibleStudents.map((student) => (
        <div key={student.id} className="flex items-center gap-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-bold">
            {studentInitials(student.student_name)}
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm leading-none font-medium">{student.student_name}</p>
              <p className="truncate text-sm text-muted-foreground">{student.improvement_areas[0] ?? "No notes yet"}</p>
            </div>
            <div className="font-medium">{student.progress.percentage}%</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StudentsTableSection({ students }: { readonly students: IApiDashboardStudent[] }) {
  return (
    <section className="flex flex-1 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Students</h2>
        <p className="text-sm text-muted-foreground">{students.length} in this class</p>
      </div>
      <StudentsTable students={students} />
    </section>
  );
}

function compareStudentSignals(left: IApiDashboardStudent, right: IApiDashboardStudent) {
  const leftNeedsAttention = left.progress.status === "needs_attention" ? 1 : 0;
  const rightNeedsAttention = right.progress.status === "needs_attention" ? 1 : 0;
  if (leftNeedsAttention !== rightNeedsAttention) {
    return rightNeedsAttention - leftNeedsAttention;
  }

  return new Date(right.last_activity_at).getTime() - new Date(left.last_activity_at).getTime();
}

function studentInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function starterSuggestions(): IApiSuggestion[] {
  return [
    {
      id: "starter",
      title: "Start with a teacher prompt",
      reason: "Emily needs the class goal, grade level, and the point students found confusing.",
      activity: "Create a short diagnostic activity before students enter the game.",
      questions: [],
      focus_skills: ["Teacher context"],
    },
  ];
}

function NotebookPanel({
  activeActivity,
  students,
  suggestions,
}: {
  readonly activeActivity: IApiTeacherClassActivity | null;
  readonly students: IApiDashboardStudent[];
  readonly suggestions: IApiSuggestion[];
}) {
  const attentionStudents = students.filter((student) => student.progress.status === "needs_attention");
  const completedStudents = students.filter((student) => student.progress.status === "completed");

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
                Emily captures how students solve problems, where they hesitate, and what should change in the next
                activity.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-3 px-4 py-5 sm:px-6">
          <NotebookRow
            icon={BookOpenCheck}
            title="Current focus"
            value={activeActivity?.learning_goal ?? "No active learning goal yet."}
          />
          <NotebookRow
            icon={CheckCircle2}
            title="Positive signal"
            value={
              completedStudents.length > 0
                ? `${completedStudents.length} students completed the activity.`
                : "Completion signals will appear after students play."
            }
          />
          <NotebookRow
            icon={AlertTriangle}
            title="Needs follow-up"
            value={
              attentionStudents.length > 0
                ? attentionStudents.map((student) => student.student_name).join(", ")
                : "No students marked as needing attention yet."
            }
          />
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b border-border px-4 py-4 sm:px-6">
          <CardTitle>Next lesson notes</CardTitle>
          <CardDescription className="mt-2 leading-6">A short planning queue for the teacher.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-4 py-5 sm:px-6">
          {(suggestions.length > 0 ? suggestions.slice(0, 3) : []).map((suggestion) => (
            <div key={suggestion.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-semibold">{suggestion.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{suggestion.activity}</p>
            </div>
          ))}
          {suggestions.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Publish an activity and collect student attempts to unlock better lesson notes.
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

function InfoPanel({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ClassCodeBadge({ value }: { readonly value: string }) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
      <span className="block text-xs font-bold uppercase text-emerald-700">Class code</span>
      <span className="mt-1 block font-mono text-lg font-black text-emerald-900">{value}</span>
    </div>
  );
}

function StatusBadge({ value }: { readonly value: string }) {
  return <BadgeTone tone={value === "published" ? "emerald" : "slate"}>{statusLabel(value)}</BadgeTone>;
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
    <span className={`w-fit rounded-md px-2.5 py-1 text-xs font-bold uppercase ${classNameByTone[tone]}`}>
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

function toDashboardTab(value: string): DashboardTab {
  if (value === "activity" || value === "students" || value === "notebook") {
    return value;
  }

  return "overview";
}
