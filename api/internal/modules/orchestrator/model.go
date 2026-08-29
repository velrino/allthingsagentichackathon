package orchestrator

type BuildMissionInput struct {
	ClassID       string            `json:"class_id"`
	ClassName     string            `json:"class_name"`
	MissionName   string            `json:"mission_name"`
	Subject       string            `json:"subject"`
	GradeLevel    string            `json:"grade_level"`
	LearningGoal  string            `json:"learning_goal"`
	TeacherPrompt string            `json:"teacher_prompt"`
	Attachments   []AttachmentInput `json:"attachments"`
}

type MissionBlueprint struct {
	Title                    string              `json:"title"`
	Summary                  string              `json:"summary"`
	Subject                  string              `json:"subject"`
	GradeLevel               string              `json:"grade_level"`
	LearningGoal             string              `json:"learning_goal"`
	SuggestedDurationMinutes int                 `json:"suggested_duration_minutes"`
	Stages                   []MissionStage      `json:"stages"`
	PreviewQuestions         []PreviewQuestion   `json:"preview_questions"`
	Suggestions              []MissionSuggestion `json:"suggestions"`
	PositiveSignals          []string            `json:"positive_signals"`
	ImprovementSignals       []string            `json:"improvement_signals"`
	EducationGuardrail       EducationGuardrail  `json:"education_guardrail"`
	MissionFlow              MissionFlow         `json:"mission_flow"`
	GeneratedByAI            bool                `json:"generated_by_ai"`
	GeneratedByMock          bool                `json:"generated_by_mock"`
	Provider                 string              `json:"provider"`
	Model                    string              `json:"model"`
	ModelVersion             string              `json:"model_version"`
	FallbackReason           string              `json:"fallback_reason"`
	Usage                    GenAIUsage          `json:"usage"`
}

type MissionStage struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Goal        string   `json:"goal"`
	Checks      []string `json:"checks"`
	UnlocksWhen string   `json:"unlocks_when"`
}

type MissionSuggestion struct {
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

type EducationGuardrail struct {
	Allowed         bool   `json:"allowed"`
	Reason          string `json:"reason"`
	UsedAttachments bool   `json:"used_attachments"`
	AttachmentNotes string `json:"attachment_notes"`
}

type MissionFlow struct {
	Nodes []MissionFlowNode `json:"nodes"`
	Edges []MissionFlowEdge `json:"edges"`
}

type MissionFlowNode struct {
	ID          string              `json:"id"`
	Kind        string              `json:"kind"`
	Label       string              `json:"label"`
	Description string              `json:"description"`
	Position    MissionFlowPosition `json:"position"`
}

type MissionFlowPosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type MissionFlowEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label"`
}
