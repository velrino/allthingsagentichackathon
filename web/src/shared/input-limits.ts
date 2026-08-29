export const INPUT_LIMITS = {
  className: 120,
  email: 254,
  gradeLevel: 80,
  learningGoal: 240,
  missionExpectedAnswer: 1000,
  missionName: 120,
  missionQuestionOption: 240,
  missionQuestionPrompt: 1000,
  missionSummary: 2000,
  missionTeacherPrompt: 1000,
  missionTitle: 160,
  search: 120,
  studentAnswer: 120,
  studentName: 40,
  studentReasoning: 800,
  subject: 80,
  password: 128,
} as const;

export function limitInput(value: string, maxLength: number) {
  return [...value].slice(0, maxLength).join("");
}
