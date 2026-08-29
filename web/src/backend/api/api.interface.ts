export enum IApiRequestMethod {
  GET = "GET",
  DELETE = "DELETE",
  POST = "POST",
  PUT = "PUT",
}

export interface IApiRequest {
  method: IApiRequestMethod;
  path: string;
  data?: unknown;
  headers?: Headers;
  access_token?: string;
  keepalive?: boolean;
}

export interface IApiStudentSession {
  mission_code: string;
  student_name: string;
}

export interface IApiStudentSessionValidation {
  mission_code: string;
}

export interface IApiStudentSessionValidationResponse {
  valid: boolean;
}

export interface IApiStudentPresence {
  mission_id: string;
  subject: string;
  stage_id: string;
  stage_name: string;
  status:
    | "exploring"
    | "learning"
    | "thinking"
    | "reviewing"
    | "paused"
    | "completed";
}

export type IApiStudentLearningStatus =
  | "exploring"
  | "learning"
  | "thinking"
  | "reviewing"
  | "paused"
  | "completed";

export interface IApiStudentLearningSnapshotRequest {
  mission_id: string;
  status: IApiStudentLearningStatus;
  snapshot: IApiStudentLearningSnapshot;
}

export interface IApiStudentLearningSnapshot {
  revision: number;
  progress: IApiStudentStageProgress[];
  notes: IApiStudentLearningNote[];
  preferences: IApiStudentPreferences;
  decisions: IApiStudentDecision[];
  events: IApiStudentLearningEvent[];
  redirected: boolean;
  return_to: string;
  last_pod: string;
  checkpoint: IApiStudentSessionCheckpoint;
}

export interface IApiStudentSessionCheckpoint {
  stage_id: string;
  question_id: string;
  phase: string;
  step_index: number;
  explain_index: number;
  lines: string[];
  wrong_choice: string;
  wrong_misconception_id: string;
  decision_action: string;
  decision_target: string;
  decision_message: string;
  decision_why: string;
  tutor_message: string;
  why_prompt: string;
  clean: boolean;
  seated: boolean;
}

export interface IApiStudentStageProgress {
  stage_id: string;
  status: "locked" | "ready" | "review" | "complete" | string;
  queue: string[];
  pool: string[];
  correct: number;
  required: number;
}

export interface IApiStudentLearningNote {
  id: string;
  misconception_id: string;
  text: string;
  kind: "misconception" | "habit" | string;
  skill: string;
  evidence: string[];
  count: number;
  created_at: number;
}

export interface IApiStudentPreferences {
  explanation_style: "steps" | "visual" | string;
  difficulty_bias: number;
}

export interface IApiStudentDecision {
  id: string;
  at: number;
  action: string;
  message: string;
  why: string;
}

export interface IApiStudentLearningEvent {
  id: string;
  sequence: number;
  type:
    | "question"
    | "answer"
    | "reasoning"
    | "feedback"
    | "adaptation"
    | "mastery"
    | string;
  stage_id: string;
  question_id: string;
  title: string;
  detail: string;
  outcome:
    | "neutral"
    | "correct"
    | "incorrect"
    | "support"
    | "complete"
    | string;
  occurred_at: number;
}

export interface IApiStudentSessionUser {
  id: string;
  identity: {
    provider: string;
    provider_user_id: string;
    auth_method: string;
    sign_in_provider: string;
  };
  profile: {
    display_name: string;
    email: string;
    email_verified: boolean;
    photo_url: string;
  };
  student: {
    organization_id: string;
    district_id: string;
    school_id: string;
    class_id: string;
    mission_id: string;
    mission_code: string;
    student_name: string;
  };
  activity: {
    first_seen_at: string;
    last_seen_at: string;
    login_count: number;
    current_game: {
      attempt_id: string;
      mission_id: string;
      published_revision: number;
      subject: string;
      stage_id: string;
      stage_name: string;
      status: string;
      started_at: string;
      last_heartbeat_at: string;
    };
  };
  roles: string[];
  is_guest: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IApiStudentSessionResponse {
  user: IApiStudentSessionUser;
  mission?: IApiStudentMission;
}

export interface IApiStudentMission {
  id: string;
  mission_code: string;
  published_revision: number;
  mission_name: string;
  title: string;
  subject: string;
  grade_level: string;
  learning_goal: string;
  stages: IApiMissionStage[];
  preview_questions: IApiMissionPreviewQuestion[];
}

export interface IApiStudentLearningResponse {
  attempt: IApiStudentLearningResumeAttempt | null;
}

export interface IApiStudentLearningResumeAttempt {
  id: string;
  mission_id: string;
  published_revision: number;
  status: IApiStudentLearningStatus | "abandoned" | string;
  snapshot: {
    revision: number;
    progress: IApiStudentStageProgress[];
    preferences: IApiStudentPreferences;
    redirected: boolean;
    return_to: string;
    last_pod: string;
    checkpoint: IApiStudentSessionCheckpoint;
  };
  last_event_sequence: number;
  started_at: string;
  last_activity_at: string;
}

export interface IApiStudentTutorTurnRequest {
  mission_id: string;
  event_id: string;
  type: "answer" | "reasoning" | "feedback" | "resume";
  stage_id: string;
  question_id: string;
  prompt: string;
  student_response: string;
  expected_answer: string;
  outcome: "neutral" | "correct" | "incorrect" | "support" | "complete";
  explicit_reasoning: string;
  feedback: string;
}

export interface IApiStudentTutorTurnResponse {
  turn: {
    turn_id: string;
    sequence: number;
    message: string;
    why_prompt: string;
    explanation_steps: string[];
    explanation_style: "steps" | "visual";
    difficulty_bias: -1 | 0 | 1;
    next_action: "continue" | "ask_reasoning" | "explain" | "retry" | "complete";
  };
}

export interface IApiStudentLearningAttempt {
  id: string;
  organization_id: string;
  district_id: string;
  school_id: string;
  student_id: string;
  student_name: string;
  class_id: string;
  mission_id: string;
  mission_code: string;
  published_revision: number;
  subject: string;
  status: IApiStudentLearningStatus | string;
  snapshot: IApiStudentLearningSnapshot;
  tutor_turns: IApiStudentTutorTurn[];
  trace: IApiStudentLearningTrace;
  trace_state: "live" | "pending" | "processing" | "ready" | "failed" | string;
  started_at: string;
  last_activity_at: string;
  completed_at: string;
  abandoned_at: string;
  created_at: string;
  updated_at: string;
}

export interface IApiStudentTutorTurn {
  id: string;
  sequence: number;
  type: string;
  stage_id: string;
  question_id: string;
  prompt: string;
  student_response: string;
  expected_answer: string;
  outcome: string;
  explicit_reasoning: string;
  feedback: string;
  tutor: {
    message: string;
    why_prompt: string;
    explanation_steps: string[];
    explanation_style: string;
    difficulty_bias: number;
    next_action: string;
    teacher_observation: string;
    retrieved_chunk_ids: string[];
    evidence_event_ids: string[];
    generated_by_ai: boolean;
    provider: string;
    model: string;
    model_version: string;
    fallback_reason: string;
  };
  created_at: string;
}

export interface IApiStudentLearningTrace {
  summary: string;
  strengths: string[];
  improvement_areas: string[];
  next_adaptation: string;
  flow: IApiMissionFlow;
  finalized: boolean;
  event_count: number;
  generated_by_ai: boolean;
  generated_by_mock: boolean;
  provider: string;
  model: string;
  model_version: string;
  fallback_reason: string;
  usage: {
    prompt_token_count: number;
    candidates_token_count: number;
    thoughts_token_count: number;
    total_token_count: number;
  };
}

export interface IApiDashboardOverviewRequest {
  class_id?: string;
}

export interface IApiMissionAttachment {
  uploadcare_uuid: string;
  cdn_url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage?: {
    status: "pending" | "copying" | "stored" | "failed" | string;
    bucket?: string;
    object_path?: string;
    gs_uri?: string;
    mime_type?: string;
    size_bytes?: number;
    attempts?: number;
    retryable?: boolean;
    error?: string;
    updated_at?: string;
    stored_at?: string;
  };
}

export interface IApiCreateTeacherClassMissionRequest {
  mission_id?: string;
  expected_draft_revision?: number;
  class_id?: string;
  class_name: string;
  mission_name: string;
  subject: string;
  grade_level: string;
  learning_goal: string;
  teacher_prompt: string;
  audience_type: "all" | "selected";
  target_student_ids: string[];
  attachments: IApiMissionAttachment[];
}

export interface IApiUpsertTeacherClassRequest {
  class_id?: string;
  class_name: string;
  subject: string;
  grade_level: string;
}

export interface IApiTeacher {
  provider_user_id: string;
  display_name: string;
  email: string;
  photo_url: string;
}

export interface IApiSuggestion {
  id: string;
  title: string;
  reason: string;
  activity: string;
  questions: string[];
  focus_skills: string[];
}

export interface IApiTeacherClass {
  id: string;
  organization_id: string;
  district_id: string;
  school_id: string;
  class_id: string;
  class_code: string;
  class_name: string;
  subject: string;
  grade_level: string;
  teacher_id: string;
  teacher: IApiTeacher;
  active_mission_id: string;
  mission_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface IApiMissionStage {
  id: string;
  title: string;
  goal: string;
  checks: string[];
  unlocks_when: string;
}

export interface IApiMissionPreviewQuestion {
  id: string;
  stage_id: string;
  prompt: string;
  answer_type: "multiple_choice" | "next_step" | "short_text" | string;
  options: string[] | null;
  expected_answer: string;
  explanation_steps: string[] | null;
  misconception_traps: string[] | null;
}

export interface IApiMissionKnowledgeChunk {
  id: string;
  source: string;
  title: string;
  content: string;
  keywords: string[];
}

export interface IApiEducationGuardrail {
  allowed: boolean;
  reason: string;
  used_attachments: boolean;
  attachment_notes: string;
}

export interface IApiMissionFlow {
  nodes: IApiMissionFlowNode[];
  edges: IApiMissionFlowEdge[];
}

export interface IApiMissionFlowNode {
  id: string;
  kind:
    | "start"
    | "setup"
    | "activity"
    | "question"
    | "decision"
    | "feedback"
    | "complete"
    | "guardrail"
    | "answer"
    | "misconception"
    | "adaptation"
    | "mastery"
    | string;
  label: string;
  description: string;
  evidence_event_ids: string[];
  position: {
    x: number;
    y: number;
  };
}

export interface IApiMissionFlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface IApiMissionOrchestration {
  provider: string;
  model: string;
  model_version: string;
  generated_by_ai: boolean;
  generated_by_mock: boolean;
  fallback_reason: string;
  prompt_token_count: number;
  candidates_token_count: number;
  thoughts_token_count: number;
  total_token_count: number;
}

export interface IApiTeacherClassMission {
  id: string;
  mission_code: string;
  organization_id: string;
  district_id: string;
  school_id: string;
  teacher_id: string;
  class_id: string;
  class_code: string;
  class_name: string;
  mission_name: string;
  title: string;
  summary: string;
  subject: string;
  grade_level: string;
  learning_goal: string;
  teacher_prompt: string;
  audience_type: "all" | "selected";
  target_student_ids: string[];
  attachments: IApiMissionAttachment[];
  preview_questions: IApiMissionPreviewQuestion[];
  knowledge_chunks: IApiMissionKnowledgeChunk[];
  suggested_duration_minutes: number;
  stages: IApiMissionStage[];
  suggestions: IApiSuggestion[];
  positive_signals: string[];
  improvement_signals: string[];
  education_guardrail: IApiEducationGuardrail;
  mission_flow: IApiMissionFlow;
  orchestration: IApiMissionOrchestration;
  status: string;
  draft_revision?: number;
  published_revision?: number;
  has_unpublished_changes?: boolean;
  deleted_at?: string | null;
  created_by: IApiTeacher;
  updated_by: IApiTeacher;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface IApiTeacherClassMissionResponse {
  mission: IApiTeacherClassMission;
}

export interface IApiApproveTeacherClassMissionDraft {
  title: string;
  summary: string;
  preview_questions: IApiMissionPreviewQuestion[];
}

export interface IApiApproveTeacherClassMissionRequest {
  expected_draft_revision?: number;
  draft?: IApiApproveTeacherClassMissionDraft;
}

export interface IApiTeacherClassMissionsResponse {
  missions: IApiTeacherClassMission[];
}

export interface IApiTeacherClassResponse {
  teacher_class: IApiTeacherClass;
}

export interface IApiTeacherClassesResponse {
  teacher_classes: IApiTeacherClass[];
}

export interface IApiDashboardMetrics {
  total_students: number;
  active_students: number;
  completed_students: number;
  average_progress: number;
  needs_attention: number;
  abandoned_students: number;
  notebook_notes: number;
}

export interface IApiStudentProgress {
  completed_questions: number;
  total_questions: number;
  percentage: number;
  status: "completed" | "in_progress" | "needs_attention" | "not_started" | string;
}

export interface IApiDashboardStudent {
  id: string;
  student_name: string;
  class_id: string;
  progress: IApiStudentProgress;
  strengths: string[];
  improvement_areas: string[];
  last_activity_at: string;
  notebook_notes: number;
  attempts: IApiStudentLearningAttempt[];
  session?: {
    mission_id: string;
    subject: string;
    stage_id: string;
    stage_name: string;
    status: string;
    is_online: boolean;
    started_at: string;
    last_heartbeat_at: string;
  };
}

export interface IApiClassLearningPattern {
  label: string;
  count: number;
  student_ids: string[];
  student_names: string[];
}

export interface IApiClassLearningSummary {
  total_attempts: number;
  completed_attempts: number;
  abandoned_attempts: number;
  students_with_evidence: number;
  common_strengths: IApiClassLearningPattern[];
  common_needs: IApiClassLearningPattern[];
  next_adaptation: string;
}

export interface IApiDashboardOverviewResponse {
  organization_id: string;
  district_id: string;
  school_id: string;
  class_id: string;
  class_code: string;
  teacher_class: IApiTeacherClass | null;
  active_mission: IApiTeacherClassMission | null;
  metrics: IApiDashboardMetrics;
  students: IApiDashboardStudent[];
  class_learning: IApiClassLearningSummary;
  suggestions: IApiSuggestion[];
  generated_by_ai: boolean;
  generated_by_mock: boolean;
  teacher: IApiTeacher;
}
