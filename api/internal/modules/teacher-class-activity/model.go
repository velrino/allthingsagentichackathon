package teacherclassactivity

import (
	"time"

	"classgame-api/internal/modules/orchestrator"
	teacherclass "classgame-api/internal/modules/teacher-class"
)

const (
	ActivitiesCollectionName = "activities"
	StatusPreview            = "preview"
	StatusPublished          = "published"
)

type ActivityDocument struct {
	ID                       string                            `firestore:"id" json:"id"`
	ClassID                  string                            `firestore:"class_id" json:"class_id"`
	ClassCode                string                            `firestore:"class_code" json:"class_code"`
	ClassName                string                            `firestore:"class_name" json:"class_name"`
	ActivityName             string                            `firestore:"activity_name" json:"activity_name"`
	Title                    string                            `firestore:"title" json:"title"`
	Summary                  string                            `firestore:"summary" json:"summary"`
	Subject                  string                            `firestore:"subject" json:"subject"`
	GradeLevel               string                            `firestore:"grade_level" json:"grade_level"`
	LearningGoal             string                            `firestore:"learning_goal" json:"learning_goal"`
	TeacherPrompt            string                            `firestore:"teacher_prompt" json:"teacher_prompt"`
	Attachments              []ActivityAttachment              `firestore:"attachments" json:"attachments"`
	PreviewQuestions         []orchestrator.PreviewQuestion    `firestore:"preview_questions" json:"preview_questions"`
	SuggestedDurationMinutes int                               `firestore:"suggested_duration_minutes" json:"suggested_duration_minutes"`
	Stages                   []orchestrator.ActivityStage      `firestore:"stages" json:"stages"`
	Suggestions              []orchestrator.ActivitySuggestion `firestore:"suggestions" json:"suggestions"`
	PositiveSignals          []string                          `firestore:"positive_signals" json:"positive_signals"`
	ImprovementSignals       []string                          `firestore:"improvement_signals" json:"improvement_signals"`
	Orchestration            ActivityOrchestration             `firestore:"orchestration" json:"orchestration"`
	Status                   string                            `firestore:"status" json:"status"`
	CreatedBy                teacherclass.TeacherSummary       `firestore:"created_by" json:"created_by"`
	UpdatedBy                teacherclass.TeacherSummary       `firestore:"updated_by" json:"updated_by"`
	PublishedAt              time.Time                         `firestore:"published_at" json:"published_at"`
	CreatedAt                time.Time                         `firestore:"created_at" json:"created_at"`
	UpdatedAt                time.Time                         `firestore:"updated_at" json:"updated_at"`
}

type ActivityAttachment struct {
	UploadcareUUID string `firestore:"uploadcare_uuid" json:"uploadcare_uuid"`
	CDNURL         string `firestore:"cdn_url" json:"cdn_url"`
	FileName       string `firestore:"file_name" json:"file_name"`
	MimeType       string `firestore:"mime_type" json:"mime_type"`
	SizeBytes      int64  `firestore:"size_bytes" json:"size_bytes"`
}

type ActivityOrchestration struct {
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

type CreateActivityInput struct {
	ClassID       string
	ClassName     string
	ActivityName  string
	Subject       string
	GradeLevel    string
	LearningGoal  string
	TeacherPrompt string
	Attachments   []ActivityAttachment
	Teacher       teacherclass.TeacherSummary
	Blueprint     orchestrator.ActivityBlueprint
	Status        string
	PublishedAt   time.Time
	Timestamp     time.Time
}
