package teacherclassactivity

import (
	"time"

	"classgame-api/internal/modules/orchestrator"
	teacherclass "classgame-api/internal/modules/teacher-class"
)

type ActivityResponse struct {
	ID                       string                            `json:"id"`
	ClassID                  string                            `json:"class_id"`
	ClassCode                string                            `json:"class_code"`
	ClassName                string                            `json:"class_name"`
	ActivityName             string                            `json:"activity_name"`
	Title                    string                            `json:"title"`
	Summary                  string                            `json:"summary"`
	Subject                  string                            `json:"subject"`
	GradeLevel               string                            `json:"grade_level"`
	LearningGoal             string                            `json:"learning_goal"`
	TeacherPrompt            string                            `json:"teacher_prompt"`
	Attachments              []ActivityAttachment              `json:"attachments"`
	PreviewQuestions         []orchestrator.PreviewQuestion    `json:"preview_questions"`
	SuggestedDurationMinutes int                               `json:"suggested_duration_minutes"`
	Stages                   []orchestrator.ActivityStage      `json:"stages"`
	Suggestions              []orchestrator.ActivitySuggestion `json:"suggestions"`
	PositiveSignals          []string                          `json:"positive_signals"`
	ImprovementSignals       []string                          `json:"improvement_signals"`
	Orchestration            ActivityOrchestrationResponse     `json:"orchestration"`
	Status                   string                            `json:"status"`
	CreatedBy                teacherclass.TeacherResponse      `json:"created_by"`
	UpdatedBy                teacherclass.TeacherResponse      `json:"updated_by"`
	PublishedAt              string                            `json:"published_at"`
	CreatedAt                string                            `json:"created_at"`
	UpdatedAt                string                            `json:"updated_at"`
}

type ActivityOrchestrationResponse struct {
	Provider             string `json:"provider"`
	Model                string `json:"model"`
	ModelVersion         string `json:"model_version"`
	GeneratedByAI        bool   `json:"generated_by_ai"`
	GeneratedByMock      bool   `json:"generated_by_mock"`
	FallbackReason       string `json:"fallback_reason"`
	PromptTokenCount     int32  `json:"prompt_token_count"`
	CandidatesTokenCount int32  `json:"candidates_token_count"`
	ThoughtsTokenCount   int32  `json:"thoughts_token_count"`
	TotalTokenCount      int32  `json:"total_token_count"`
}

func ToResponse(activity ActivityDocument) ActivityResponse {
	return ActivityResponse{
		ID:                       activity.ID,
		ClassID:                  activity.ClassID,
		ClassCode:                activity.ClassCode,
		ClassName:                activity.ClassName,
		ActivityName:             activity.ActivityName,
		Title:                    activity.Title,
		Summary:                  activity.Summary,
		Subject:                  activity.Subject,
		GradeLevel:               activity.GradeLevel,
		LearningGoal:             activity.LearningGoal,
		TeacherPrompt:            activity.TeacherPrompt,
		Attachments:              activity.Attachments,
		PreviewQuestions:         activity.PreviewQuestions,
		SuggestedDurationMinutes: activity.SuggestedDurationMinutes,
		Stages:                   activity.Stages,
		Suggestions:              activity.Suggestions,
		PositiveSignals:          activity.PositiveSignals,
		ImprovementSignals:       activity.ImprovementSignals,
		Orchestration: ActivityOrchestrationResponse{
			Provider:             activity.Orchestration.Provider,
			Model:                activity.Orchestration.Model,
			ModelVersion:         activity.Orchestration.ModelVersion,
			GeneratedByAI:        activity.Orchestration.GeneratedByAI,
			GeneratedByMock:      activity.Orchestration.GeneratedByMock,
			FallbackReason:       activity.Orchestration.FallbackReason,
			PromptTokenCount:     activity.Orchestration.PromptTokenCount,
			CandidatesTokenCount: activity.Orchestration.CandidatesTokenCount,
			ThoughtsTokenCount:   activity.Orchestration.ThoughtsTokenCount,
			TotalTokenCount:      activity.Orchestration.TotalTokenCount,
		},
		Status:      activity.Status,
		CreatedBy:   toTeacherResponse(activity.CreatedBy),
		UpdatedBy:   toTeacherResponse(activity.UpdatedBy),
		PublishedAt: formatTime(activity.PublishedAt),
		CreatedAt:   formatTime(activity.CreatedAt),
		UpdatedAt:   formatTime(activity.UpdatedAt),
	}
}

func ToResponses(activities []ActivityDocument) []ActivityResponse {
	responses := make([]ActivityResponse, 0, len(activities))

	for _, activity := range activities {
		responses = append(responses, ToResponse(activity))
	}

	return responses
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}

	return value.UTC().Format(time.RFC3339Nano)
}

func toTeacherResponse(teacher teacherclass.TeacherSummary) teacherclass.TeacherResponse {
	return teacherclass.TeacherResponse{
		ProviderUserID: teacher.ProviderUserID,
		DisplayName:    teacher.DisplayName,
		Email:          teacher.Email,
		PhotoURL:       teacher.PhotoURL,
	}
}
