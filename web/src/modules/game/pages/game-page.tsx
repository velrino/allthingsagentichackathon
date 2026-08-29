"use client";

import { signOut } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API } from "@/backend/api/api.endpoints";
import { getStudentFirebaseAuth } from "@/shared/firebase/client";

import { Chalkboard } from "../components/chalkboard";
import { GameCanvas } from "../components/game-canvas";
import { GameHud } from "../components/game-hud";
import { sourceStageID, stageLabel } from "../content/game-mission";
import { useGameSession } from "../state/use-game-session";
import {
  studentEntryCopy,
  studentSessionErrorScope,
} from "../student-session/student-entry-messages";
import {
  clearStudentMissionSession,
  clearStudentSession,
  saveStudentClassSession,
  saveStudentMissionSession,
} from "../student-session/student-mission-session";
import { StudentSessionGate } from "../student-session/student-session-gate";
import {
  studentMissionRevisionKey,
  useStudentClassMissions,
} from "../student-session/use-student-class-missions";
import {
  studentClassUnavailableEvent,
  studentSessionReadyEvent,
  useStudentPresence,
} from "../student-session/use-student-presence";
import type { MovementState } from "../types/game";

export function GamePage() {
  const movementRef = useRef<MovementState>({ forward: 0, right: 0 });
  const { session, report, directiveRef, avatarPresetId, handlers } =
    useGameSession();
  const [startingMissionID, setStartingMissionID] = useState("");
  const [missionStartError, setMissionStartError] = useState<string | null>(
    null,
  );
  const autoSitMissionIDRef = useRef("");

  const leaveMission = useCallback(() => {
    clearStudentMissionSession();
    handlers.leaveMission();
    setStartingMissionID("");
    autoSitMissionIDRef.current = "";
    setMissionStartError(null);
  }, [handlers]);

  const leaveClass = useCallback(() => {
    clearStudentSession();
    handlers.leaveMission();
    setStartingMissionID("");
    autoSitMissionIDRef.current = "";
    setMissionStartError(null);
    void signOut(getStudentFirebaseAuth()).catch(() => undefined);
  }, [handlers]);

  const leaveUnavailableClass = useCallback(() => {
    window.dispatchEvent(new Event(studentClassUnavailableEvent));
    leaveClass();
  }, [leaveClass]);

  const {
    classSession,
    completedMissionKeys: persistedCompletedMissionKeys,
    missions,
    missionsReady,
  } = useStudentClassMissions({
    activeMissionID: session.hydrated ? session.mission.id : "",
    onClassUnavailable: leaveUnavailableClass,
    onMissionUnavailable: leaveMission,
  });

  const seatedLesson =
    session.seatedAt && session.lesson ? session.lesson : null;
  const completedMission =
    session.hydrated &&
    Object.values(session.memory.progress).every(
      (progress) => progress.status === "complete",
    );
  const completedMissionKeys = useMemo(() => {
    const completed = new Set(persistedCompletedMissionKeys);
    if (completedMission) {
      completed.add(
        studentMissionRevisionKey(
          session.mission.id,
          session.mission.publishedRevision,
        ),
      );
    }
    return completed;
  }, [completedMission, persistedCompletedMissionKeys, session.mission]);
  const pendingMissions = useMemo(
    () =>
      missions.filter(
        (mission) =>
          !completedMissionKeys.has(
            studentMissionRevisionKey(
              mission.id,
              mission.publishedRevision,
            ),
          ),
      ),
    [completedMissionKeys, missions],
  );

  const presenceStatus = completedMission
    ? "completed"
    : session.lesson?.phase === "thinking"
      ? "thinking"
      : session.seatedAt
        ? session.memory.progress[session.tutorPod].status === "review"
          ? "reviewing"
          : "learning"
        : "exploring";

  useStudentPresence(
    {
      stage_id: sourceStageID(session.mission, session.tutorPod),
      stage_name: stageLabel(session.mission, session.tutorPod),
      status: presenceStatus,
    },
    {
      enabled: session.hydrated && startingMissionID === "",
      onClassUnavailable: leaveClass,
      onMissionUnavailable: leaveMission,
    },
  );

  useEffect(() => {
    const autoSitMissionID = autoSitMissionIDRef.current;
    if (
      !autoSitMissionID ||
      !session.hydrated ||
      session.mission.id !== autoSitMissionID
    ) {
      return;
    }

    autoSitMissionIDRef.current = "";
    handlers.sit();
  }, [handlers, session.hydrated, session.mission.id]);

  async function startMission(missionID: string) {
    const selectedMission = missions.find((mission) => mission.id === missionID);
    const user = getStudentFirebaseAuth().currentUser;
    if (!classSession || !selectedMission || !user?.isAnonymous) {
      setMissionStartError(studentEntryCopy.errors.offline);
      return false;
    }

    if (
      session.hydrated &&
      session.mission.id === selectedMission.id &&
      session.mission.publishedRevision === selectedMission.publishedRevision
    ) {
      handlers.sit();
      return true;
    }

    setStartingMissionID(missionID);
    setMissionStartError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await API.users.startStudentMission(idToken, {
        class_code: classSession.classCode,
        mission_id: missionID,
        student_name: classSession.studentName,
      });
      if (!response.mission) {
        throw new Error("The mission payload is unavailable.");
      }

      if (response.class) {
        saveStudentClassSession(response.class, classSession.studentName);
      }
      saveStudentMissionSession({
        attemptId: response.user.activity.current_game.attempt_id,
        classCode: classSession.classCode,
        missionId: response.mission.id,
        publishedRevision: response.mission.published_revision,
        subject: response.mission.subject,
        mission: response.mission,
      });
      autoSitMissionIDRef.current = response.mission.id;
      window.dispatchEvent(new Event(studentSessionReadyEvent));
      return true;
    } catch (error) {
      const scope = studentSessionErrorScope(error);
      if (scope === "class") {
        leaveUnavailableClass();
      } else if (scope === "mission") {
        setMissionStartError(studentEntryCopy.errors.missionUnavailable);
      } else {
        setMissionStartError(studentEntryCopy.errors.offline);
      }
      return false;
    } finally {
      setStartingMissionID("");
    }
  }

  return (
    <StudentSessionGate>
      <main className="relative isolate h-dvh overflow-hidden bg-[#05070d] text-white">
        <GameCanvas
          movementRef={movementRef}
          directiveRef={directiveRef}
          onReport={handlers.onReport}
          showSeatMarker={missionsReady && pendingMissions.length > 0}
        />

        {seatedLesson ? (
          <Chalkboard
            mission={session.mission}
            lesson={seatedLesson}
            progress={session.memory.progress}
            explanationStyle={session.memory.preferences.explanationStyle}
            onChoose={handlers.choose}
            onWriteAnswer={handlers.writeAnswer}
            onStep={handlers.step}
            onWhy={handlers.why}
            onExplainNext={handlers.explainNext}
            onFeedback={handlers.feedback}
            onContinue={handlers.continue}
            onStand={handlers.stand}
            onEndSession={leaveMission}
          />
        ) : (
          <GameHud
            key={classSession?.classId ?? "no-class"}
            mission={session.mission}
            missionActive={session.hydrated}
            className={classSession?.className ?? ""}
            missions={missions}
            completedMissionKeys={completedMissionKeys}
            pendingMissionCount={pendingMissions.length}
            missionsReady={missionsReady}
            startingMissionID={startingMissionID}
            missionStartError={missionStartError}
            movementRef={movementRef}
            progress={session.memory.progress}
            tutorPod={session.tutorPod}
            tutorLine={session.hydrated ? session.tutorLine : ""}
            nearSeat={report.nearSeat}
            avatarPresetId={avatarPresetId}
            onSelectAvatar={handlers.selectAvatar}
            onSelectMission={startMission}
            onEndSession={leaveClass}
          />
        )}
      </main>
    </StudentSessionGate>
  );
}
