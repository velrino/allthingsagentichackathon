package dashboard

import (
	"time"

	mission "classgame-api/internal/modules/mission"
	"classgame-api/internal/modules/orchestrator"
	teacherclass "classgame-api/internal/modules/teacher-class"
)

type OverviewResponse struct {
	ClassID         string                     `json:"class_id"`
	ClassCode       string                     `json:"class_code"`
	TeacherClass    *TeacherClassResponse      `json:"teacher_class"`
	ActiveMission   *MissionResponse           `json:"active_mission"`
	Metrics         DashboardMetricsResponse   `json:"metrics"`
	Students        []StudentDashboardResponse `json:"students"`
	Suggestions     []SuggestionResponse       `json:"suggestions"`
	GeneratedByAI   bool                       `json:"generated_by_ai"`
	GeneratedByMock bool                       `json:"generated_by_mock"`
	Teacher         TeacherResponse            `json:"teacher"`
}

type TeacherClassResponse struct {
	ID              string          `json:"id"`
	ClassID         string          `json:"class_id"`
	ClassCode       string          `json:"class_code"`
	ClassName       string          `json:"class_name"`
	Subject         string          `json:"subject"`
	GradeLevel      string          `json:"grade_level"`
	TeacherID       string          `json:"teacher_id"`
	Teacher         TeacherResponse `json:"teacher"`
	ActiveMissionID string          `json:"active_mission_id"`
	MissionCount    int64           `json:"mission_count"`
	Status          string          `json:"status"`
	CreatedAt       string          `json:"created_at"`
	UpdatedAt       string          `json:"updated_at"`
}

type MissionResponse struct {
	ID                       string                `json:"id"`
	ClassID                  string                `json:"class_id"`
	ClassCode                string                `json:"class_code"`
	ClassName                string                `json:"class_name"`
	MissionName              string                `json:"mission_name"`
	Title                    string                `json:"title"`
	Summary                  string                `json:"summary"`
	Subject                  string                `json:"subject"`
	GradeLevel               string                `json:"grade_level"`
	LearningGoal             string                `json:"learning_goal"`
	TeacherPrompt            string                `json:"teacher_prompt"`
	Attachments              []AttachmentResponse  `json:"attachments"`
	PreviewQuestions         []PreviewQuestion     `json:"preview_questions"`
	SuggestedDurationMinutes int                   `json:"suggested_duration_minutes"`
	Stages                   []StageResponse       `json:"stages"`
	Suggestions              []SuggestionResponse  `json:"suggestions"`
	PositiveSignals          []string              `json:"positive_signals"`
	ImprovementSignals       []string              `json:"improvement_signals"`
	Orchestration            OrchestrationResponse `json:"orchestration"`
	Status                   string                `json:"status"`
	CreatedBy                TeacherResponse       `json:"created_by"`
	UpdatedBy                TeacherResponse       `json:"updated_by"`
	PublishedAt              string                `json:"published_at"`
	CreatedAt                string                `json:"created_at"`
	UpdatedAt                string                `json:"updated_at"`
}

type AttachmentResponse struct {
	UploadcareUUID string `json:"uploadcare_uuid"`
	CDNURL         string `json:"cdn_url"`
	FileName       string `json:"file_name"`
	MimeType       string `json:"mime_type"`
	SizeBytes      int64  `json:"size_bytes"`
}

type PreviewQuestion struct {
	ID                 string   `json:"id"`
	Prompt             string   `json:"prompt"`
	AnswerType         string   `json:"answer_type"`
	Options            []string `json:"options"`
	ExpectedAnswer     string   `json:"expected_answer"`
	MisconceptionTraps []string `json:"misconception_traps"`
}

type StageResponse struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Goal        string   `json:"goal"`
	Checks      []string `json:"checks"`
	UnlocksWhen string   `json:"unlocks_when"`
}

type OrchestrationResponse struct {
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

type SuggestionResponse struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Reason      string   `json:"reason"`
	Activity    string   `json:"activity"`
	Questions   []string `json:"questions"`
	FocusSkills []string `json:"focus_skills"`
}

type DashboardMetricsResponse struct {
	TotalStudents     int   `json:"total_students"`
	ActiveStudents    int   `json:"active_students"`
	CompletedStudents int   `json:"completed_students"`
	AverageProgress   int   `json:"average_progress"`
	NeedsAttention    int   `json:"needs_attention"`
	NotebookNotes     int64 `json:"notebook_notes"`
}

type StudentDashboardResponse struct {
	ID               string                     `json:"id"`
	StudentName      string                     `json:"student_name"`
	ClassID          string                     `json:"class_id"`
	Progress         StudentProgressResponse    `json:"progress"`
	Strengths        []string                   `json:"strengths"`
	ImprovementAreas []string                   `json:"improvement_areas"`
	LastActivityAt   string                     `json:"last_activity_at"`
	NotebookNotes    int64                      `json:"notebook_notes"`
	Session          StudentGameSessionResponse `json:"session"`
}

type StudentGameSessionResponse struct {
	MissionID       string `json:"mission_id"`
	Subject         string `json:"subject"`
	StageID         string `json:"stage_id"`
	StageName       string `json:"stage_name"`
	Status          string `json:"status"`
	IsOnline        bool   `json:"is_online"`
	StartedAt       string `json:"started_at"`
	LastHeartbeatAt string `json:"last_heartbeat_at"`
}

type StudentProgressResponse struct {
	CompletedQuestions int    `json:"completed_questions"`
	TotalQuestions     int    `json:"total_questions"`
	Percentage         int    `json:"percentage"`
	Status             string `json:"status"`
}

type TeacherResponse struct {
	ProviderUserID string `json:"provider_user_id"`
	DisplayName    string `json:"display_name"`
	Email          string `json:"email"`
	PhotoURL       string `json:"photo_url"`
}

func ToOverviewResponse(overview DashboardOverview) OverviewResponse {
	return OverviewResponse{
		ClassID:         overview.ClassID,
		ClassCode:       overview.ClassCode,
		TeacherClass:    toTeacherClassResponse(overview.TeacherClass),
		ActiveMission:   toMissionResponse(overview.ActiveMission),
		Metrics:         toMetricsResponse(overview.Metrics),
		Students:        toStudentResponses(overview.Students),
		Suggestions:     toSuggestionResponses(overview.Suggestions),
		GeneratedByAI:   overview.GeneratedByAI,
		GeneratedByMock: overview.GeneratedByMock,
		Teacher:         toTeacherResponse(overview.Teacher),
	}
}

func toTeacherClassResponse(teacherClass *teacherclass.TeacherClassDocument) *TeacherClassResponse {
	if teacherClass == nil {
		return nil
	}

	return &TeacherClassResponse{
		ID:              teacherClass.ID,
		ClassID:         teacherClass.ClassID,
		ClassCode:       teacherClass.ClassCode,
		ClassName:       teacherClass.ClassName,
		Subject:         teacherClass.Subject,
		GradeLevel:      teacherClass.GradeLevel,
		TeacherID:       teacherClass.TeacherID,
		Teacher:         toClassTeacherResponse(teacherClass.Teacher),
		ActiveMissionID: teacherClass.ActiveMissionID,
		MissionCount:    teacherClass.MissionCount,
		Status:          teacherClass.Status,
		CreatedAt:       formatTime(teacherClass.CreatedAt),
		UpdatedAt:       formatTime(teacherClass.UpdatedAt),
	}
}

func toMissionResponse(mission *mission.MissionDocument) *MissionResponse {
	if mission == nil {
		return nil
	}

	return &MissionResponse{
		ID:                       mission.ID,
		ClassID:                  mission.ClassID,
		ClassCode:                mission.ClassCode,
		ClassName:                mission.ClassName,
		MissionName:              mission.MissionName,
		Title:                    mission.Title,
		Summary:                  mission.Summary,
		Subject:                  mission.Subject,
		GradeLevel:               mission.GradeLevel,
		LearningGoal:             mission.LearningGoal,
		TeacherPrompt:            mission.TeacherPrompt,
		Attachments:              toAttachmentResponses(mission.Attachments),
		PreviewQuestions:         toPreviewQuestions(mission.PreviewQuestions),
		SuggestedDurationMinutes: mission.SuggestedDurationMinutes,
		Stages:                   toStageResponses(mission.Stages),
		Suggestions:              toSuggestionResponses(mission.Suggestions),
		PositiveSignals:          mission.PositiveSignals,
		ImprovementSignals:       mission.ImprovementSignals,
		Orchestration: OrchestrationResponse{
			Provider:             mission.Orchestration.Provider,
			Model:                mission.Orchestration.Model,
			ModelVersion:         mission.Orchestration.ModelVersion,
			GeneratedByAI:        mission.Orchestration.GeneratedByAI,
			GeneratedByMock:      mission.Orchestration.GeneratedByMock,
			FallbackReason:       mission.Orchestration.FallbackReason,
			PromptTokenCount:     mission.Orchestration.PromptTokenCount,
			CandidatesTokenCount: mission.Orchestration.CandidatesTokenCount,
			ThoughtsTokenCount:   mission.Orchestration.ThoughtsTokenCount,
			TotalTokenCount:      mission.Orchestration.TotalTokenCount,
		},
		Status:      mission.Status,
		CreatedBy:   toClassTeacherResponse(mission.CreatedBy),
		UpdatedBy:   toClassTeacherResponse(mission.UpdatedBy),
		PublishedAt: formatTime(mission.PublishedAt),
		CreatedAt:   formatTime(mission.CreatedAt),
		UpdatedAt:   formatTime(mission.UpdatedAt),
	}
}

func toMetricsResponse(metrics DashboardMetrics) DashboardMetricsResponse {
	return DashboardMetricsResponse{
		TotalStudents:     metrics.TotalStudents,
		ActiveStudents:    metrics.ActiveStudents,
		CompletedStudents: metrics.CompletedStudents,
		AverageProgress:   metrics.AverageProgress,
		NeedsAttention:    metrics.NeedsAttention,
		NotebookNotes:     metrics.NotebookNotes,
	}
}

func toStudentResponses(students []StudentDashboardItem) []StudentDashboardResponse {
	responses := make([]StudentDashboardResponse, 0, len(students))

	for _, student := range students {
		responses = append(responses, StudentDashboardResponse{
			ID:          student.ID,
			StudentName: student.StudentName,
			ClassID:     student.ClassID,
			Progress: StudentProgressResponse{
				CompletedQuestions: student.Progress.CompletedQuestions,
				TotalQuestions:     student.Progress.TotalQuestions,
				Percentage:         student.Progress.Percentage,
				Status:             student.Progress.Status,
			},
			Strengths:        student.Strengths,
			ImprovementAreas: student.ImprovementAreas,
			LastActivityAt:   formatTime(student.LastActivityAt),
			NotebookNotes:    student.NotebookNotes,
			Session: StudentGameSessionResponse{
				MissionID:       student.Session.MissionID,
				Subject:         student.Session.Subject,
				StageID:         student.Session.StageID,
				StageName:       student.Session.StageName,
				Status:          student.Session.Status,
				IsOnline:        student.Session.IsOnline,
				StartedAt:       formatTime(student.Session.StartedAt),
				LastHeartbeatAt: formatTime(student.Session.LastHeartbeatAt),
			},
		})
	}

	return responses
}

func toStageResponses(stages []orchestrator.MissionStage) []StageResponse {
	responses := make([]StageResponse, 0, len(stages))

	for _, stage := range stages {
		responses = append(responses, StageResponse{
			ID:          stage.ID,
			Title:       stage.Title,
			Goal:        stage.Goal,
			Checks:      stage.Checks,
			UnlocksWhen: stage.UnlocksWhen,
		})
	}

	return responses
}

func toAttachmentResponses(attachments []mission.MissionAttachment) []AttachmentResponse {
	responses := make([]AttachmentResponse, 0, len(attachments))

	for _, attachment := range attachments {
		responses = append(responses, AttachmentResponse{
			UploadcareUUID: attachment.UploadcareUUID,
			CDNURL:         attachment.CDNURL,
			FileName:       attachment.FileName,
			MimeType:       attachment.MimeType,
			SizeBytes:      attachment.SizeBytes,
		})
	}

	return responses
}

func toPreviewQuestions(questions []orchestrator.PreviewQuestion) []PreviewQuestion {
	responses := make([]PreviewQuestion, 0, len(questions))

	for _, question := range questions {
		responses = append(responses, PreviewQuestion{
			ID:                 question.ID,
			Prompt:             question.Prompt,
			AnswerType:         question.AnswerType,
			Options:            question.Options,
			ExpectedAnswer:     question.ExpectedAnswer,
			MisconceptionTraps: question.MisconceptionTraps,
		})
	}

	return responses
}

func toSuggestionResponses(suggestions []orchestrator.MissionSuggestion) []SuggestionResponse {
	responses := make([]SuggestionResponse, 0, len(suggestions))

	for _, suggestion := range suggestions {
		responses = append(responses, SuggestionResponse{
			ID:          suggestion.ID,
			Title:       suggestion.Title,
			Reason:      suggestion.Reason,
			Activity:    suggestion.Activity,
			Questions:   suggestion.Questions,
			FocusSkills: suggestion.FocusSkills,
		})
	}

	return responses
}

func toTeacherResponse(teacher TeacherSummary) TeacherResponse {
	return TeacherResponse{
		ProviderUserID: teacher.ProviderUserID,
		DisplayName:    teacher.DisplayName,
		Email:          teacher.Email,
		PhotoURL:       teacher.PhotoURL,
	}
}

func toClassTeacherResponse(teacher teacherclass.TeacherSummary) TeacherResponse {
	return TeacherResponse{
		ProviderUserID: teacher.ProviderUserID,
		DisplayName:    teacher.DisplayName,
		Email:          teacher.Email,
		PhotoURL:       teacher.PhotoURL,
	}
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}

	return value.UTC().Format(time.RFC3339Nano)
}
