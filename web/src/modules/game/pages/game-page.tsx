"use client";

import { signOut } from "firebase/auth";
import { useRef } from "react";

import { getStudentFirebaseAuth } from "@/shared/firebase/client";

import { Chalkboard } from "../components/chalkboard";
import { GameCanvas } from "../components/game-canvas";
import { GameHud } from "../components/game-hud";
import { sourceStageID, stageLabel } from "../content/game-mission";
import { useGameSession } from "../state/use-game-session";
import { StudentSessionGate } from "../student-session/student-session-gate";
import { clearStudentMissionSession } from "../student-session/student-mission-session";
import { useStudentPresence } from "../student-session/use-student-presence";
import type { MovementState } from "../types/game";

export function GamePage() {
  const movementRef = useRef<MovementState>({ forward: 0, right: 0 });
  const { session, report, directiveRef, avatarPresetId, handlers } = useGameSession();
  const seatedLesson = session.seatedAt && session.lesson ? session.lesson : null;
  const completedMission = Object.values(session.memory.progress).every((progress) => progress.status === "complete");
  const presenceStatus = completedMission
    ? "completed"
    : session.lesson?.phase === "thinking"
      ? "thinking"
      : session.seatedAt
        ? session.memory.progress[session.tutorPod].status === "review"
          ? "reviewing"
          : "learning"
        : "exploring";

  useStudentPresence({
    stage_id: sourceStageID(session.mission, session.tutorPod),
    stage_name: stageLabel(session.mission, session.tutorPod),
    status: presenceStatus,
  }, { enabled: session.hydrated });

  function handleEndStudentSession() {
    handlers.reset();
    clearStudentMissionSession();
    void signOut(getStudentFirebaseAuth()).catch(() => undefined);
  }

  return (
    <StudentSessionGate>
      <main className="relative isolate h-dvh overflow-hidden bg-[#05070d] text-white">
        <GameCanvas movementRef={movementRef} directiveRef={directiveRef} onReport={handlers.onReport} />

        {session.hydrated && seatedLesson ? (
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
            onEndSession={handleEndStudentSession}
          />
        ) : session.hydrated ? (
          <GameHud
            mission={session.mission}
            movementRef={movementRef}
            progress={session.memory.progress}
            tutorPod={session.tutorPod}
            tutorLine={session.hydrated ? session.tutorLine : ""}
            nearSeat={report.nearSeat}
            avatarPresetId={avatarPresetId}
            onSelectAvatar={handlers.selectAvatar}
            onSit={handlers.sit}
          />
        ) : null}
      </main>
    </StudentSessionGate>
  );
}
