package orchestrator

type BuildClassActivityInput struct {
	ClassID       string            `json:"class_id"`
	ClassName     string            `json:"class_name"`
	ActivityName  string            `json:"activity_name"`
	Subject       string            `json:"subject"`
	GradeLevel    string            `json:"grade_level"`
	LearningGoal  string            `json:"learning_goal"`
	TeacherPrompt string            `json:"teacher_prompt"`
	Attachments   []AttachmentInput `json:"attachments"`
}

type ActivityBlueprint struct {
	Title                    string               `json:"title"`
	Summary                  string               `json:"summary"`
	Subject                  string               `json:"subject"`
	GradeLevel               string               `json:"grade_level"`
	LearningGoal             string               `json:"learning_goal"`
	SuggestedDurationMinutes int                  `json:"suggested_duration_minutes"`
	Stages                   []ActivityStage      `json:"stages"`
	PreviewQuestions         []PreviewQuestion    `json:"preview_questions"`
	Suggestions              []ActivitySuggestion `json:"suggestions"`
	PositiveSignals          []string             `json:"positive_signals"`
	ImprovementSignals       []string             `json:"improvement_signals"`
	GeneratedByAI            bool                 `json:"generated_by_ai"`
	GeneratedByMock          bool                 `json:"generated_by_mock"`
	Provider                 string               `json:"provider"`
	Model                    string               `json:"model"`
	ModelVersion             string               `json:"model_version"`
	FallbackReason           string               `json:"fallback_reason"`
	Usage                    GenAIUsage           `json:"usage"`
}

type ActivityStage struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Goal        string   `json:"goal"`
	Checks      []string `json:"checks"`
	UnlocksWhen string   `json:"unlocks_when"`
}

type ActivitySuggestion struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Reason      string   `json:"reason"`
	Activity    string   `json:"activity"`
	Questions   []string `json:"questions"`
	FocusSkills []string `json:"focus_skills"`
}

type PreviewQuestion struct {
	ID                 string   `json:"id"`
	Prompt             string   `json:"prompt"`
	AnswerType         string   `json:"answer_type"`
	Options            []string `json:"options"`
	ExpectedAnswer     string   `json:"expected_answer"`
	MisconceptionTraps []string `json:"misconception_traps"`
}

type AttachmentInput struct {
	FileName string `json:"file_name"`
	MimeType string `json:"mime_type"`
	CDNURL   string `json:"cdn_url"`
}

type GenAIUsage struct {
	PromptTokenCount     int32 `json:"prompt_token_count"`
	CandidatesTokenCount int32 `json:"candidates_token_count"`
	ThoughtsTokenCount   int32 `json:"thoughts_token_count"`
	TotalTokenCount      int32 `json:"total_token_count"`
}
