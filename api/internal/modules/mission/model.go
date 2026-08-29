package mission

import (
	"time"

	"classgame-api/internal/modules/orchestrator"
	teacherclass "classgame-api/internal/modules/teacher-class"
)

const (
	MissionsCollectionName     = "missions"
	MissionCodesCollectionName = "mission_codes"
	AudienceAll                = "all"
	AudienceSelected           = "selected"
	StatusPreview              = "preview"
	StatusPublished            = "published"
)

type MissionDocument struct {
	ID                       string                           `firestore:"id" json:"id"`
	MissionCode              string                           `firestore:"mission_code" json:"mission_code"`
	ClassID                  string                           `firestore:"class_id" json:"class_id"`
	ClassCode                string                           `firestore:"class_code" json:"class_code"`
	ClassName                string                           `firestore:"class_name" json:"class_name"`
	MissionName              string                           `firestore:"mission_name" json:"mission_name"`
	Title                    string                           `firestore:"title" json:"title"`
	Summary                  string                           `firestore:"summary" json:"summary"`
	Subject                  string                           `firestore:"subject" json:"subject"`
	GradeLevel               string                           `firestore:"grade_level" json:"grade_level"`
	LearningGoal             string                           `firestore:"learning_goal" json:"learning_goal"`
	TeacherPrompt            string                           `firestore:"teacher_prompt" json:"teacher_prompt"`
	AudienceType             string                           `firestore:"audience_type" json:"audience_type"`
	TargetStudentIDs         []string                         `firestore:"target_student_ids" json:"target_student_ids"`
	Attachments              []MissionAttachment              `firestore:"attachments" json:"attachments"`
	PreviewQuestions         []orchestrator.PreviewQuestion   `firestore:"preview_questions" json:"preview_questions"`
	SuggestedDurationMinutes int                              `firestore:"suggested_duration_minutes" json:"suggested_duration_minutes"`
	Stages                   []orchestrator.MissionStage      `firestore:"stages" json:"stages"`
	Suggestions              []orchestrator.MissionSuggestion `firestore:"suggestions" json:"suggestions"`
	PositiveSignals          []string                         `firestore:"positive_signals" json:"positive_signals"`
	ImprovementSignals       []string                         `firestore:"improvement_signals" json:"improvement_signals"`
	Orchestration            MissionOrchestration             `firestore:"orchestration" json:"orchestration"`
	Status                   string                           `firestore:"status" json:"status"`
	CreatedBy                teacherclass.TeacherSummary      `firestore:"created_by" json:"created_by"`
	UpdatedBy                teacherclass.TeacherSummary      `firestore:"updated_by" json:"updated_by"`
	PublishedAt              time.Time                        `firestore:"published_at" json:"published_at"`
	CreatedAt                time.Time                        `firestore:"created_at" json:"created_at"`
	UpdatedAt                time.Time                        `firestore:"updated_at" json:"updated_at"`
}

type MissionAttachment struct {
	UploadcareUUID string `firestore:"uploadcare_uuid" json:"uploadcare_uuid"`
	CDNURL         string `firestore:"cdn_url" json:"cdn_url"`
	FileName       string `firestore:"file_name" json:"file_name"`
	MimeType       string `firestore:"mime_type" json:"mime_type"`
	SizeBytes      int64  `firestore:"size_bytes" json:"size_bytes"`
}

type MissionOrchestration struct {
	Provider             string `firestore:"provider" json:"provider"`
	Model                string `firestore:"model" json:"model"`
	ModelVersion         string `firestore:"model_version" json:"model_version"`
	GeneratedByAI        bool   `firestore:"generated_by_ai" json:"generated_by_ai"`
	GeneratedByMock      bool   `firestore:"generated_by_mock" json:"generated_by_mock"`
	FallbackReason       string `firestore:"fallback_reason" json:"fallback_reason"`
	PromptTokenCount     int32  `firestore:"prompt_token_count" json:"prompt_token_count"`
	CandidatesTokenCount int32  `firestore:"candidates_token_count" json:"candidates_token_count"`
	ThoughtsTokenCount   int32  `firestore:"thoughts_token_count" json:"thoughts_token_count"`
	TotalTokenCount      int32  `firestore:"total_token_count" json:"total_token_count"`
}

type CreateMissionInput struct {
	MissionCode      string
	ClassID          string
	ClassCode        string
	ClassName        string
	MissionName      string
	Subject          string
	GradeLevel       string
	LearningGoal     string
	TeacherPrompt    string
	AudienceType     string
	TargetStudentIDs []string
	Attachments      []MissionAttachment
	Teacher          teacherclass.TeacherSummary
	Blueprint        orchestrator.MissionBlueprint
	Status           string
	PublishedAt      time.Time
	Timestamp        time.Time
}
