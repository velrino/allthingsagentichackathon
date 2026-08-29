"use client";

import {
  collection,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef, useState } from "react";

import {
  getStudentFirebaseAuth,
  getStudentFirebaseDb,
} from "@/shared/firebase/client";

import {
  readStudentClassSession,
  studentClassSessionChangedEvent,
  type StudentClassSession,
} from "./student-mission-session";

export type StudentClassMission = {
  readonly id: string;
  readonly publishedRevision: number;
  readonly missionName: string;
  readonly title: string;
  readonly summary: string;
  readonly subject: string;
  readonly gradeLevel: string;
  readonly learningGoal: string;
  readonly suggestedDurationMinutes: number;
  readonly publishedAt: number;
};

type StudentClassMissionsOptions = {
  readonly activeMissionID?: string;
  readonly onClassUnavailable?: () => void;
  readonly onMissionUnavailable?: () => void;
};

export function useStudentClassMissions(
  options: StudentClassMissionsOptions = {},
) {
  const [classSession, setClassSession] =
    useState<StudentClassSession | null>(null);
  const [studentID, setStudentID] = useState("");
  const [missions, setMissions] = useState<StudentClassMission[]>([]);
  const [completedMissionKeys, setCompletedMissionKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [missionsReady, setMissionsReady] = useState(false);
  const [missionScope, setMissionScope] = useState("");
  const [completionScope, setCompletionScope] = useState("");
  const activeMissionIDRef = useRef(options.activeMissionID ?? "");
  const onClassUnavailableRef = useRef(options.onClassUnavailable);
  const onMissionUnavailableRef = useRef(options.onMissionUnavailable);

  useEffect(() => {
    activeMissionIDRef.current = options.activeMissionID ?? "";
    onClassUnavailableRef.current = options.onClassUnavailable;
    onMissionUnavailableRef.current = options.onMissionUnavailable;
  }, [
    options.activeMissionID,
    options.onClassUnavailable,
    options.onMissionUnavailable,
  ]);

  useEffect(() => {
    const refreshClassSession = () => {
      setClassSession(readStudentClassSession());
    };
    refreshClassSession();
    window.addEventListener(
      studentClassSessionChangedEvent,
      refreshClassSession,
    );
    return () => {
      window.removeEventListener(
        studentClassSessionChangedEvent,
        refreshClassSession,
      );
    };
  }, []);

  useEffect(
    () =>
      onAuthStateChanged(getStudentFirebaseAuth(), (user) => {
        setStudentID(user?.isAnonymous ? user.uid : "");
      }),
    [],
  );

  useEffect(() => {
    if (!classSession || !studentID) {
      return;
    }

    const scope = `${classSession.classId}:${studentID}`;
    const database = getStudentFirebaseDb();
    const unsubscribeClass = onSnapshot(
      doc(database, "teacher_classes", classSession.classId),
      (snapshot) => {
        if (
          (!snapshot.exists() || snapshot.data().status !== "active") &&
          readStudentClassSession()?.classId === classSession.classId
        ) {
          onClassUnavailableRef.current?.();
        }
      },
      () => {
        // The API validation still protects restored sessions if rules lag deployment.
      },
    );
    const unsubscribeMissions = onSnapshot(
      collection(
        database,
        "student_class_missions",
        classSession.classId,
        "missions",
      ),
      (snapshot) => {
        const next = snapshot.docs
          .map((mission) => studentClassMissionFromData(mission.id, mission.data()))
          .filter((mission): mission is StudentClassMission => mission !== null)
          .sort((left, right) => right.publishedAt - left.publishedAt);
        setMissionScope(scope);
        setMissions(next);
        setMissionsReady(true);
        const activeMissionID = activeMissionIDRef.current;
        if (
          activeMissionID &&
          readStudentClassSession()?.classId === classSession.classId &&
          !next.some((mission) => mission.id === activeMissionID)
        ) {
          onMissionUnavailableRef.current?.();
        }
      },
      () => {
        setMissionsReady(false);
      },
    );
    const unsubscribeCompletions = onSnapshot(
      collection(
        database,
        "student_mission_completions",
        studentID,
        "missions",
      ),
      (snapshot) => {
        const completed = new Set<string>();
        snapshot.docs.forEach((attempt) => {
          const data = attempt.data();
          if (
            data.class_id === classSession.classId &&
            data.status === "completed" &&
            typeof data.mission_id === "string" &&
            typeof data.published_revision === "number"
          ) {
            completed.add(
              studentMissionRevisionKey(
                data.mission_id,
                data.published_revision,
              ),
            );
          }
        });
        setCompletionScope(scope);
        setCompletedMissionKeys(completed);
      },
      () => {
        // Mission selection remains usable if attempt rules have not propagated yet.
      },
    );

    return () => {
      unsubscribeClass();
      unsubscribeMissions();
      unsubscribeCompletions();
    };
  }, [classSession, studentID]);

  const currentScope =
    classSession && studentID ? `${classSession.classId}:${studentID}` : "";

  return {
    classSession,
    completedMissionKeys:
      currentScope && completionScope === currentScope
        ? completedMissionKeys
        : new Set<string>(),
    missions:
      currentScope && missionScope === currentScope ? missions : [],
    missionsReady:
      Boolean(currentScope) &&
      missionScope === currentScope &&
      missionsReady,
  };
}

export function studentMissionRevisionKey(
  missionID: string,
  publishedRevision: number,
) {
  return `${missionID}:${publishedRevision}`;
}

function studentClassMissionFromData(
  documentID: string,
  data: Record<string, unknown>,
): StudentClassMission | null {
  const id = text(data.id) || documentID;
  const publishedRevision = number(data.published_revision);
  const title = text(data.title) || text(data.mission_name);
  if (!id || publishedRevision <= 0 || !title || data.status !== "published") {
    return null;
  }

  return {
    id,
    publishedRevision,
    missionName: text(data.mission_name) || title,
    title,
    summary: text(data.summary),
    subject: text(data.subject),
    gradeLevel: text(data.grade_level),
    learningGoal: text(data.learning_goal),
    suggestedDurationMinutes: number(data.suggested_duration_minutes),
    publishedAt: timestampMilliseconds(data.published_at),
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function timestampMilliseconds(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  return 0;
}
