import type { IApiStudentMission } from "@/backend/api/api.interface";

const studentMissionSessionKey = "classgame:student-mission-session";

export type StudentMissionSession = {
  readonly attemptId: string;
  readonly missionCode: string;
  readonly missionId: string;
  readonly publishedRevision: number;
  readonly subject: string;
  readonly mission: IApiStudentMission;
};

export function saveStudentMissionSession(session: StudentMissionSession) {
  window.sessionStorage.setItem(studentMissionSessionKey, JSON.stringify(session));
}

export function readStudentMissionSession(): StudentMissionSession | null {
  try {
    const value = window.sessionStorage.getItem(studentMissionSessionKey);
    return value ? (JSON.parse(value) as StudentMissionSession) : null;
  } catch {
    return null;
  }
}

export function clearStudentMissionSession() {
  window.sessionStorage.removeItem(studentMissionSessionKey);
}
