"use client";

import { useRef } from "react";

import { Chalkboard } from "../components/chalkboard";
import { GameCanvas } from "../components/game-canvas";
import { GameHud } from "../components/game-hud";
import { TutorNotebook } from "../components/tutor-notebook";
import { useGameSession } from "../state/use-game-session";
import type { MovementState } from "../types/game";

export function GamePage() {
  const movementRef = useRef<MovementState>({ forward: 0, right: 0 });
  const { session, report, directiveRef, avatarPresetId, handlers } = useGameSession();
  const seatedLesson = session.seatedAt && session.lesson ? session.lesson : null;

  return (
    <main className="relative isolate h-dvh overflow-hidden bg-[#05070d] text-white">
      <GameCanvas movementRef={movementRef} directiveRef={directiveRef} onReport={handlers.onReport} />

      {seatedLesson ? (
        <Chalkboard
          lesson={seatedLesson}
          progress={session.memory.progress}
          notes={session.memory.notes}
          explanationStyle={session.memory.preferences.explanationStyle}
          onChoose={handlers.choose}
          onStep={handlers.step}
          onWhy={handlers.why}
          onExplainNext={handlers.explainNext}
          onFeedback={handlers.feedback}
          onContinue={handlers.continue}
          onStand={handlers.stand}
          onOpenNotebook={handlers.openNotebook}
        />
      ) : (
        <GameHud
          movementRef={movementRef}
          progress={session.memory.progress}
          tutorPod={session.tutorPod}
          tutorLine={session.hydrated ? session.tutorLine : ""}
          nearSeat={report.nearSeat}
          noteCount={session.memory.notes.length}
          noteFlash={session.noteFlash}
          avatarPresetId={avatarPresetId}
          onSelectAvatar={handlers.selectAvatar}
          onSit={handlers.sit}
          onOpenNotebook={handlers.openNotebook}
        />
      )}

      {session.notebookOpen ? (
        <TutorNotebook memory={session.memory} onClose={handlers.closeNotebook} onDispute={handlers.disputeNote} onReset={handlers.reset} />
      ) : null}
    </main>
  );
}
