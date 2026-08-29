import type {
  IApiStudentClass,
  IApiStudentMission,
} from "@/backend/api/api.interface";

const studentClassSessionKey = "classgame:student-class-session";
const studentMissionSessionKey = "classgame:student-mission-session";
export const studentClassSessionChangedEvent =
  "classgame:student-class-session-changed";

export type StudentClassSession = {
  readonly classId: string;
  readonly classCode: string;
  readonly className: string;
  readonly subject: string;
  readonly gradeLevel: string;
  readonly studentName: string;
};

export type StudentMissionSession = {
  readonly attemptId: string;
  readonly classCode: string;
  readonly missionId: string;
  readonly publishedRevision: number;
  readonly subject: string;
  readonly mission: IApiStudentMission;
};

export function saveStudentClassSession(
  studentClass: IApiStudentClass,
  studentName: string,
) {
  const session: StudentClassSession = {
    classId: studentClass.id,
    classCode: studentClass.class_code,
    className: studentClass.class_name,
    subject: studentClass.subject,
    gradeLevel: studentClass.grade_level,
    studentName,
  };
  window.localStorage.setItem(studentClassSessionKey, JSON.stringify(session));
  window.sessionStorage.removeItem(studentClassSessionKey);
  window.dispatchEvent(new Event(studentClassSessionChangedEvent));
}

export function readStudentClassSession(): StudentClassSession | null {
  try {
    const localValue = window.localStorage.getItem(studentClassSessionKey);
    if (localValue) {
      return JSON.parse(localValue) as StudentClassSession;
    }

    // Preserve a session created before class sessions were shared across tabs.
    const value = window.sessionStorage.getItem(studentClassSessionKey);
    if (value) {
      window.localStorage.setItem(studentClassSessionKey, value);
      window.sessionStorage.removeItem(studentClassSessionKey);
    }
    return value ? (JSON.parse(value) as StudentClassSession) : null;
  } catch {
    return null;
  }
}

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

export function clearStudentSession() {
  window.localStorage.removeItem(studentClassSessionKey);
  window.sessionStorage.removeItem(studentClassSessionKey);
  clearStudentMissionSession();
  window.dispatchEvent(new Event(studentClassSessionChangedEvent));
}
