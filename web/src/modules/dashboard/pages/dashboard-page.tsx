"use client";

import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardCopy,
  Gamepad2,
  NotebookTabs,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { API } from "@/backend/api/api.endpoints";
import type {
  IApiApproveTeacherClassMissionRequest,
  IApiDashboardOverviewResponse,
  IApiDashboardStudent,
  IApiClassLearningSummary,
  IApiSuggestion,
  IApiTeacherClass,
  IApiTeacherClassMission,
} from "@/backend/api/api.interface";
import { Main } from "@/components/layout/main";
import { Button } from "@/components/ui/button";
import { miaAnalytics } from "@/lib/mia-analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFirebaseDb } from "@/shared/firebase/client";

import { useTeacherAuth } from "../auth/use-teacher-auth";
import {
  MissionBuilder,
  type MissionBuilderForm,
} from "../components/mission-builder";
import { missionIsStandaloneDraft } from "../utils/mission-lifecycle";
import { AnalyticsCard } from "../components/analytics/analytics-card";
import {
  buildClassGlance,
  buildClassSummary,
  buildGrowthPatterns,
  buildMissionFunnel,
  buildNextMissionPrompt,
  buildStrengthPatterns,
  planSuggestions,
  type ClassGlance,
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
import { StudentLearningDetail } from "../components/student-learning-detail";
import { normalizeMissionPreviewQuestions } from "../utils/mission-preview";
import {
  rememberSelectedClass,
  resolveSelectedClassId,
  upsertTeacherClass,
} from "../utils/teacher-class-state";

type DashboardTab = "overview" | "mission" | "students" | "notebook";

const defaultDashboardTab: DashboardTab = "overview";

const hashByTab: Record<DashboardTab, string> = {
  mission: "#mission-builder",
  students: "#students",
  notebook: "#notebook",
  overview: "#overview",
};

const tabByHash: Record<string, DashboardTab> = {
  "#mission-builder": "mission",
  "#students": "students",
  "#notebook": "notebook",
  "#overview": "overview",
};

export function DashboardPage({
  initialClassId,
}: { readonly initialClassId?: string } = {}) {
  const router = useRouter();
  const auth = useTeacherAuth();
  const [activeTab, setActiveTab] =
    useState<DashboardTab>(defaultDashboardTab);
  const [overview, setOverview] =
    useState<IApiDashboardOverviewResponse | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<IApiTeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classesLoading, setClassesLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [missionBuilderOpen, setMissionBuilderOpen] = useState(false);
  const [previewMission, setPreviewMission] =
    useState<IApiTeacherClassMission | null>(null);
  const [missions, setMissions] = useState<IApiTeacherClassMission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deletingMissionId, setDeletingMissionId] = useState<string | null>(
    null,
  );
  const [draftPrompt, setDraftPrompt] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [shareCodeLabel, setShareCodeLabel] = useState("Share code");
  const [selectedStudent, setSelectedStudent] =
    useState<IApiDashboardStudent | null>(null);

  useEffect(() => {
    function syncTabFromHash() {
      setActiveTab(tabByHash[window.location.hash] ?? defaultDashboardTab);
    }

    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);

    return () => {
      window.removeEventListener("hashchange", syncTabFromHash);
    };
  }, []);

  useEffect(() => {
    if (auth.status !== "signed_in" || !auth.user) {
      return;
    }

    let cancelled = false;
    const user = auth.user;

    Promise.resolve()
      .then(async () => {
        setClassesLoading(true);
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
          resolveSelectedClassId(
            initialClassId ?? current,
            response.teacher_classes,
          ),
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
          setClassesLoading(false);
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
        setOverviewLoading(true);
        setOverview(null);
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
          setOverviewLoading(false);
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
        setSelectedStudent((current) =>
          current
            ? (response.students.find((student) => student.id === current.id) ??
              null)
            : null,
        );
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

    let refreshTimer: number | null = null;
    let receivedInitialAttempts = false;
    let receivedInitialSummary = false;
    const queueRealtimeRefresh = () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshOverviewInBackground();
      }, 250);
    };
    const database = getFirebaseDb();
    const unsubscribeAttempts = onSnapshot(
      query(
        collection(database, "student_mission_attempts"),
        where("class_id", "==", classId),
      ),
      () => {
        if (receivedInitialAttempts) {
          queueRealtimeRefresh();
        }
        receivedInitialAttempts = true;
      },
      () => {
        // Rules may not be deployed yet; the fallback refresh remains active.
      },
    );
    const unsubscribeSummary = onSnapshot(
      doc(database, "class_learning_summaries", classId),
      () => {
        if (receivedInitialSummary) {
          queueRealtimeRefresh();
        }
        receivedInitialSummary = true;
      },
      () => {
        // Keep the last API snapshot and use the fallback refresh below.
      },
    );
    const interval = window.setInterval(refreshOverviewInBackground, 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshOverviewInBackground();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      unsubscribeAttempts();
      unsubscribeSummary();
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
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
  const studentViewHref = classCode
    ? `/home?classCode=${encodeURIComponent(classCode)}`
    : "/home";
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
  const summaryStudentCount = students.length;
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

    const isCreatingMission = !value.mission_id?.trim();
    setProcessing(true);
    setError(null);
    try {
      const token = await auth.user.getIdToken();
      const response = await API.teacherClassMissions.preview(
        token,
        value.class_id,
        {
          mission_id: value.mission_id,
          expected_draft_revision: value.expected_draft_revision,
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
      setDraftVersion((current) => current + 1);
      setMissions((current) => upsertClassMission(current, response.mission));
      setSelectedClassId(response.mission.class_id);
      setMissionBuilderOpen(true);
      setActiveDashboardTab("mission");
      if (isCreatingMission) {
        miaAnalytics.missionCreated({
          class_id: response.mission.class_id,
          mission_id: response.mission.id,
        });
      }
    } catch (caughtError) {
      if (isCreatingMission) {
        miaAnalytics.missionCreationFailed(caughtError, {
          class_id: value.class_id,
        });
      }
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save this mission.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function handleApproveMission(mission: IApiTeacherClassMission) {
    if (!auth.user) {
      return;
    }

    let missionPublished = false;
    setApproving(true);
    setError(null);
    try {
      const token = await auth.user.getIdToken();
      const response = await API.teacherClassMissions.approve(
        token,
        mission.class_id,
        mission.id,
        buildApproveMissionRequest(mission),
      );
      missionPublished = true;
      miaAnalytics.missionPublished({
        class_id: response.mission.class_id,
        mission_id: response.mission.id,
      });
      setPreviewMission(response.mission);
      setMissions((current) => upsertClassMission(current, response.mission));
      await loadOverview(token, response.mission.class_id);
      setMissionBuilderOpen(false);
      setActiveDashboardTab("mission");
    } catch (caughtError) {
      if (!missionPublished) {
        miaAnalytics.missionPublishFailed(caughtError, {
          class_id: mission.class_id,
          mission_id: mission.id,
        });
      }
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not share this mission.",
      );
    } finally {
      setApproving(false);
    }
  }

  async function handleSignOut() {
    await auth.signOutTeacher();
  }

  function handleOpenMissionBuilder() {
    if (!selectedClassId) {
      router.push("/dashboard/classes");
      return;
    }

    setPreviewMission(null);
    setDraftPrompt(null);
    setError(null);
    setDraftVersion((current) => current + 1);
    setActiveDashboardTab("mission");
    setMissionBuilderOpen(true);
  }

  function handleEditMission(mission: IApiTeacherClassMission) {
    setPreviewMission(mission);
    setDraftPrompt(null);
    setError(null);
    setDraftVersion((current) => current + 1);
    setMissionBuilderOpen(true);
    setActiveDashboardTab("mission");
  }

  async function handleDeleteMission(mission: IApiTeacherClassMission) {
    if (!auth.user || deletingMissionId) {
      return;
    }

    const missionLabel =
      mission.mission_name || mission.title || "this mission";
    const isLive = activeMission?.id === mission.id;
    const confirmed = window.confirm(
      isLive
        ? `Remove “${missionLabel}”? It will disappear from the student classroom.`
        : `Remove “${missionLabel}”? It will disappear from this class mission list.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingMissionId(mission.id);
    setError(null);
    try {
      const token = await auth.user.getIdToken();
      await API.teacherClassMissions.remove(
        token,
        mission.class_id,
        mission.id,
      );
      setMissions((current) =>
        current.filter((item) => item.id !== mission.id),
      );

      if (previewMission?.id === mission.id) {
        setPreviewMission(null);
        setMissionBuilderOpen(false);
      }

      await loadOverview(token, mission.class_id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not remove this mission.",
      );
    } finally {
      setDeletingMissionId(null);
    }
  }

  function handleBuildNextMission() {
    if (!selectedClassId) {
      router.push("/dashboard/classes");
      return;
    }

    setPreviewMission(null);
    setError(null);
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

  function handleOpenStudents() {
    setActiveDashboardTab("students");
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

  return (
    <DashboardShell
      teacherClasses={teacherClasses}
      user={auth.user!}
      onSignOut={handleSignOut}
    >
      <Main id="main-content" className="space-y-5">
        <div
          id="overview"
          className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <p className="text-xs font-semibold text-[#9164f9]">CLASS HOME</p>
            <h1 className="mt-1 text-2xl font-bold">
              {selectedClass?.class_name || "Your class"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedClass
                ? [selectedClass.subject, selectedClass.grade_level]
                    .filter(Boolean)
                    .join(" · ")
                : "Create a class to get started."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {classCode ? <ClassCodeBadge value={classCode} compact /> : null}
            <Button variant="outline" asChild>
              <Link
                href={studentViewHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Gamepad2 className="size-4" aria-hidden />
                Student view
              </Link>
            </Button>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-[#9164f9]/35 bg-[#d2c2e9]/20 px-4 py-3 text-sm font-semibold text-foreground">
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
            <TabsList className="min-w-max bg-[#d2c2e9]/25">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="mission">Missions</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="notebook">Teacher notes</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent id="mission-builder" value="mission" className="mt-2">
            <ClassMissionsTable
              activeMissionId={activeMission?.id}
              deletingMissionId={deletingMissionId}
              missions={missions}
              loading={missionsLoading}
              onCreateMission={handleOpenMissionBuilder}
              onDeleteMission={handleDeleteMission}
              onEditMission={handleEditMission}
            />
          </TabsContent>

          <TabsContent id="students" value="students" className="mt-2">
            <StudentsTableSection
              classLearning={overview?.class_learning}
              students={students}
              onStudentClick={setSelectedStudent}
            />
          </TabsContent>

          <TabsContent id="notebook" value="notebook" className="mt-2">
            <NotebookPanel
              activeMission={activeMission}
              students={students}
              suggestions={suggestions}
            />
          </TabsContent>

          <TabsContent value="overview" className="mt-3 space-y-5">
            {classesLoading || overviewLoading ? (
              <DashboardLoadingState />
            ) : (
              <>
                <TodayGuide
                  activeMission={activeMission}
                  classCode={classCode}
                  glance={glance}
                  hasSelectedClass={hasSelectedClass}
                  teacherName={
                    overview?.teacher.display_name ??
                    auth.user?.displayName ??
                    ""
                  }
                  onCreateMission={handleOpenMissionBuilder}
                  onOpenStudents={handleOpenStudents}
                  onPlanFollowUp={handlePlanFollowUp}
                  onShareCode={handleShareCode}
                />

                <div className="grid min-w-0 gap-5 xl:grid-cols-2">
                  <ClassGlanceTiles
                    glance={glance}
                    shareCodeLabel={shareCodeLabel}
                    onPlanFollowUp={handlePlanFollowUp}
                    onShareCode={handleShareCode}
                  />

                  <AnalyticsCard
                    title="Where students are in today's mission"
                    description={
                      activeMission
                        ? "The longer the bar, the more students are at that step. Names below help you know who to check in with."
                        : "Publish a mission to see each student's current step here."
                    }
                    source={activeMission ? funnel.source : undefined}
                  >
                    <MissionFunnel
                      steps={funnel.data}
                      totalStudents={summaryStudentCount}
                    />
                  </AnalyticsCard>
                </div>

                <SectionHeading
                  eyebrow="WHAT MIA NOTICED"
                  title="What students found easy — and difficult"
                  detail="These notes come from students' answers and explanations, so you can plan without reading every response."
                  source={students.length > 0 ? patternSource : undefined}
                />
                <ClassPatternsSummary
                  growth={growthPatterns.data}
                  strengths={strengthPatterns.data}
                  summary={classSummary}
                  totalStudents={summaryStudentCount}
                />

                <div className="grid gap-x-5 gap-y-2 xl:grid-cols-2">
                  <section className="min-w-0">
                    <SectionHeading
                      eyebrow="REVIEW"
                      title="Students who may need help"
                      detail="Start with “check in soon”, then use the names to make a small group."
                    />
                    <div className="mt-3">
                      <PatternGroups
                        variant="growth"
                        groups={growthPatterns.data}
                        limit={4}
                        totalStudents={summaryStudentCount}
                        emptyMessage="Nothing to review yet. This section fills in after students explain their answers."
                      />
                    </div>
                  </section>

                  <section className="min-w-0">
                    <SectionHeading
                      eyebrow="BUILD ON"
                      title="Students showing confidence"
                      detail="Use these names for peer explanations, pairs, or an extra challenge."
                    />
                    <div className="mt-3">
                      <PatternGroups
                        variant="strength"
                        groups={strengthPatterns.data}
                        limit={4}
                        totalStudents={summaryStudentCount}
                        emptyMessage="Strengths will appear as students explain answers and finish steps."
                      />
                    </div>
                  </section>
                </div>

                <div id="next-lesson" className="scroll-mt-24">
                  <SectionHeading
                    eyebrow="NEXT LESSON"
                    title="Ready-to-use ideas"
                    detail="Choose a suggestion as-is, adapt it, or let Mia turn the class results into the next mission."
                    source={
                      plannedSuggestions.length > 0
                        ? overview?.generated_by_ai
                          ? "live"
                          : "estimated"
                        : undefined
                    }
                  />
                </div>
                <NextLessonPlan
                  canBuild={hasSelectedClass}
                  suggestions={plannedSuggestions}
                  onBuildNextMission={handleBuildNextMission}
                />

                <ActiveMissionCard
                  activeMission={activeMission}
                  classCode={classCode}
                  generatedByAi={overview?.generated_by_ai ?? false}
                  teacherClass={selectedClass}
                />

                <Card className="gap-0 border-[#dad2e6] py-0">
                  <CardHeader className="border-b border-[#dad2e6] bg-[#d2c2e9]/10 px-4 py-4 sm:px-6">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle>Latest student activity</CardTitle>
                        <CardDescription className="mt-2">
                          The 10 students who were active most recently.
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
              </>
            )}
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
            requestError={error}
            teacherClass={selectedClass}
            onApprove={handleApproveMission}
            onOpenChange={(open) => {
              setMissionBuilderOpen(open);
              if (!open) {
                setError(null);
              }
            }}
            onProcess={handleProcessMission}
          />
        ) : null}

        <StudentLearningDetail
          key={selectedStudent?.id ?? "no-student"}
          open={selectedStudent !== null}
          student={selectedStudent}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedStudent(null);
            }
          }}
        />
      </Main>
    </DashboardShell>
  );
}

function TodayGuide({
  activeMission,
  classCode,
  glance,
  hasSelectedClass,
  onCreateMission,
  onOpenStudents,
  onPlanFollowUp,
  onShareCode,
  teacherName,
}: {
  readonly activeMission: IApiTeacherClassMission | null;
  readonly classCode: string;
  readonly glance: ClassGlance;
  readonly hasSelectedClass: boolean;
  readonly onCreateMission: () => void;
  readonly onOpenStudents: () => void;
  readonly onPlanFollowUp: () => void;
  readonly onShareCode: () => void;
  readonly teacherName: string;
}) {
  const firstName = teacherName.trim().split(/\s+/)[0] || "there";
  const everyoneFinished =
    glance.total > 0 && glance.completed.length === glance.total;

  let guide = {
    detail: "Create a class, then Mia will help you prepare a mission for your students.",
    icon: BookOpenCheck,
    label: "Create a class",
    onClick: onCreateMission,
    title: "Start with your first class",
  };

  if (hasSelectedClass && !activeMission) {
    guide = {
      detail: "Tell Mia the subject and what you want students to learn. You will review the mission before anyone sees it.",
      icon: Sparkles,
      label: "Create today's mission",
      onClick: onCreateMission,
      title: "Let's prepare something for today",
    };
  } else if (activeMission && glance.total === 0) {
    guide = {
      detail: `Share code ${classCode || "from your class"}. Student progress will appear here automatically when they join.`,
      icon: ClipboardCopy,
      label: "Copy class code",
      onClick: onShareCode,
      title: "Your mission is ready — invite your students",
    };
  } else if (glance.needsAttention.length > 0) {
    const count = glance.needsAttention.length;
    guide = {
      detail: "Open the student list to see names, recent work, and where a quick conversation may help.",
      icon: CircleAlert,
      label: "See who needs help",
      onClick: onOpenStudents,
      title: `${count} ${count === 1 ? "student may" : "students may"} need a check-in`,
    };
  } else if (everyoneFinished) {
    guide = {
      detail: "Use what Mia noticed to choose a review, a whole-class activity, or an extra challenge.",
      icon: PartyPopper,
      label: "Plan the next lesson",
      onClick: onPlanFollowUp,
      title: "Everyone finished — nice work!",
    };
  } else if (glance.playingNow.length > 0) {
    guide = {
      detail: "The charts below update as students work. You can keep teaching and check back whenever you need to.",
      icon: Gamepad2,
      label: "View student details",
      onClick: onOpenStudents,
      title: "Your class is working right now",
    };
  } else if (activeMission) {
    guide = {
      detail: "The mission is published. Share the code when class starts, then progress will update here automatically.",
      icon: ClipboardCopy,
      label: "Share class code",
      onClick: onShareCode,
      title: "Everything is ready for your students",
    };
  }

  const GuideIcon = guide.icon;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#c0a3ef] bg-gradient-to-br from-[#9164f9] via-[#9e74f7] to-[#b593f2] p-5 text-white shadow-sm sm:p-6">
      <div
        className="pointer-events-none absolute -top-20 -right-12 size-56 rounded-full border-[32px] border-white/10"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-3xl items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/18 ring-1 ring-white/25">
            <GuideIcon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-white/75">
              HI {firstName.toLocaleUpperCase("en")} · HERE&apos;S WHAT MATTERS TODAY
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              {guide.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
              {guide.detail}
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={guide.onClick}
          className="shrink-0 bg-white text-[#6841c4] hover:bg-[#e2e2e2]"
        >
          {guide.label}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-5" aria-label="Loading class dashboard" aria-busy="true">
      <div className="h-40 animate-pulse rounded-2xl bg-[#d2c2e9]/45" />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-96 animate-pulse rounded-xl bg-[#e2e2e2]" />
        <div className="h-96 animate-pulse rounded-xl bg-[#e2e2e2]" />
      </div>
    </div>
  );
}

function ActiveMissionCard({
  activeMission,
  classCode,
  generatedByAi,
  teacherClass,
}: {
  readonly activeMission: IApiTeacherClassMission | null;
  readonly classCode: string;
  readonly generatedByAi: boolean;
  readonly teacherClass: IApiTeacherClass | null;
}) {
  return (
    <Card className="gap-0 border-[#dad2e6] py-0">
      <CardHeader className="border-b border-[#dad2e6] bg-[#d2c2e9]/10 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[#9164f9]">
              TODAY&apos;S PLAN
            </p>
            <CardTitle className="mt-2 text-2xl">
              {activeMission?.title ?? "No mission shared yet"}
            </CardTitle>
            <CardDescription className="mt-2 max-w-2xl leading-6">
              {teacherClass
                ? (activeMission?.summary ??
                  "Tell Mia what students should practice. You can review every question before sharing it with the class.")
                : "Create a class first. It will have its own code, missions, students, and notes."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            value={activeMission?.status ?? teacherClass?.status ?? "draft"}
          />
          {generatedByAi ? <BadgeTone tone="violet">Built with Mia</BadgeTone> : null}
          <BadgeTone tone="soft">
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
              label="Suggested time"
              value={`${activeMission.suggested_duration_minutes} minutes`}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#c9b3ec] bg-[#d2c2e9]/15 p-4 text-sm leading-6 text-muted-foreground">
            {teacherClass
              ? "No mission has been shared yet. Create one, review it, and then share it with students."
              : "No class selected. Create a class, then prepare its first mission."}
          </div>
        )}

        {activeMission ? (
          <div className="grid gap-3">
            <h3 className="text-sm font-semibold">What students will do</h3>
            <div className="grid gap-2">
              {activeMission.stages.map((stage, index) => (
                <div
                  key={stage.id}
                  className="flex gap-3 rounded-xl border border-[#dad2e6] bg-[#d2c2e9]/10 p-3"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#9164f9] text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{stage.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {stage.goal}
                    </p>
                  </div>
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
  readonly source?: "estimated" | "live";
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
  readonly source: "estimated" | "live";
}) {
  const label = {
    estimated: "From student work",
    live: "Updates automatically",
  }[source];
  const className = {
    estimated: "bg-[#d2c2e9]/35 text-[#6841c4]",
    live: "bg-[#c0a3ef]/25 text-[#6841c4]",
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
  classLearning,
  students,
  onStudentClick,
}: {
  readonly classLearning?: IApiClassLearningSummary;
  readonly students: IApiDashboardStudent[];
  readonly onStudentClick: (student: IApiDashboardStudent) => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Students</h2>
        <p className="text-sm text-muted-foreground">
          {students.length} in this class
        </p>
      </div>
      {classLearning && classLearning.students_with_evidence > 0 ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#dad2e6] bg-[#d2c2e9]/15 p-4">
            <p className="text-xs font-semibold text-[#6841c4] uppercase">
              LEARNING HISTORY
            </p>
            <p className="mt-2 text-2xl font-black">
              {classLearning.students_with_evidence}/{students.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              students with work Mia can summarize
            </p>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {classLearning.completed_attempts}/{classLearning.total_attempts}{" "}
              missions finished
            </p>
            {classLearning.abandoned_attempts > 0 ? (
              <p className="mt-1 text-xs font-semibold text-[#6841c4]">
                {classLearning.abandoned_attempts} left before finishing
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-[#c9b3ec] bg-[#c9b3ec]/20 p-4">
            <p className="text-xs font-semibold text-[#6841c4] uppercase">
              A STRENGTH SHOWING UP OFTEN
            </p>
            <p className="mt-2 text-sm font-bold text-foreground">
              {classLearning.common_strengths[0]?.label ??
                "More completed evidence needed"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {classLearning.common_strengths[0]?.count ?? 0} students
            </p>
          </div>
          <div className="rounded-xl border border-[#b593f2] bg-[#b593f2]/15 p-4">
            <p className="text-xs font-semibold text-[#6841c4] uppercase">
              TRY NEXT
            </p>
            <p className="mt-2 text-sm leading-6 font-semibold text-foreground">
              {classLearning.next_adaptation}
            </p>
          </div>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Select a student to see progress, recent answers, and Mia&apos;s notes.
      </p>
      <StudentsTable students={students} onStudentClick={onStudentClick} />
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
    (student) =>
      student.progress.status === "needs_attention" ||
      student.progress.status === "abandoned",
  );
  const completedStudents = students.filter(
    (student) => student.progress.status === "completed",
  );

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Card className="gap-0 border-[#dad2e6] py-0 lg:col-span-2">
        <CardHeader className="border-b border-[#dad2e6] bg-[#d2c2e9]/10 px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-[#9164f9] text-white">
              <NotebookTabs className="size-5" aria-hidden />
            </div>
            <div>
              <CardTitle>Teacher notes</CardTitle>
              <CardDescription className="mt-2 leading-6">
                A short, readable summary of what students are learning and what may help next.
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
            title="A positive sign"
            value={
              completedStudents.length > 0
                ? `${completedStudents.length} students completed the mission.`
                : "Completed missions will appear after students play."
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

      <Card className="gap-0 border-[#dad2e6] py-0">
        <CardHeader className="border-b border-[#dad2e6] bg-[#d2c2e9]/10 px-4 py-4 sm:px-6">
          <CardTitle>Next lesson notes</CardTitle>
          <CardDescription className="mt-2 leading-6">
            Ideas you can use or adapt.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-4 py-5 sm:px-6">
          {(suggestions.length > 0 ? suggestions.slice(0, 3) : []).map(
            (suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-xl border border-[#dad2e6] p-3"
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
              Share a mission and collect student work to unlock lesson ideas.
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
    <div className="flex gap-3 rounded-xl border border-[#dad2e6] p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-[#9164f9]" aria-hidden />
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
    <div className="rounded-xl border border-[#dad2e6] bg-[#d2c2e9]/10 p-3">
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
      <div className="flex items-center gap-2 rounded-xl border border-[#c9b3ec] bg-[#d2c2e9]/20 px-3 py-1.5 text-sm">
        <span className="text-[11px] font-bold uppercase text-primary">
          Code
        </span>
        <span className="font-mono text-base font-black text-[#6841c4]">
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#c9b3ec] bg-[#d2c2e9]/20 px-3 py-2 text-sm">
      <span className="block text-xs font-bold uppercase text-primary">
        Class code
      </span>
      <span className="mt-1 block font-mono text-lg font-black text-[#6841c4]">
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ value }: { readonly value: string }) {
  return (
    <BadgeTone tone={value === "published" ? "violet" : "muted"}>
      {statusLabel(value)}
    </BadgeTone>
  );
}

function BadgeTone({
  children,
  tone,
}: {
  readonly children: string;
  readonly tone: "muted" | "soft" | "violet";
}) {
  const classNameByTone = {
    muted: "bg-[#e2e2e2] text-foreground",
    soft: "bg-[#d2c2e9]/35 text-[#6841c4]",
    violet: "bg-[#9164f9] text-white",
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
    return "Shared with students";
  }

  if (value === "preview") {
    return "Ready to review";
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
    ...missions.filter(
      (current) =>
        current.id !== mission.id &&
        !shouldDropStandaloneDraftAfterUpsert(current, mission),
    ),
  ].sort(
    (left, right) =>
      toTimestamp(right.updated_at) - toTimestamp(left.updated_at),
  );
}

function shouldDropStandaloneDraftAfterUpsert(
  current: IApiTeacherClassMission,
  incoming: IApiTeacherClassMission,
) {
  return (
    current.class_id === incoming.class_id &&
    missionIsStandaloneDraft(incoming) &&
    missionIsStandaloneDraft(current)
  );
}

function buildApproveMissionRequest(
  mission: IApiTeacherClassMission,
): IApiApproveTeacherClassMissionRequest {
  return {
    expected_draft_revision: mission.draft_revision,
    draft: {
      title: mission.title,
      summary: mission.summary,
      preview_questions: normalizeMissionPreviewQuestions(
        mission.preview_questions,
      ),
    },
  };
}

function toTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toDashboardTab(value: string): DashboardTab {
  if (
    value === "mission" ||
    value === "students" ||
    value === "notebook" ||
    value === "overview"
  ) {
    return value;
  }

  return defaultDashboardTab;
}
