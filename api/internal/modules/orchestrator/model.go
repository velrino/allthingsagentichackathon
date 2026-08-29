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
	PromptTokenCount     int32 `firestore:"prompt_token_count" json:"prompt_token_count"`
	CandidatesTokenCount int32 `firestore:"candidates_token_count" json:"candidates_token_count"`
	ThoughtsTokenCount   int32 `firestore:"thoughts_token_count" json:"thoughts_token_count"`
	TotalTokenCount      int32 `firestore:"total_token_count" json:"total_token_count"`
}

type EducationGuardrail struct {
	Allowed         bool   `json:"allowed"`
	Reason          string `json:"reason"`
	UsedAttachments bool   `json:"used_attachments"`
	AttachmentNotes string `json:"attachment_notes"`
}

type MissionFlow struct {
	Nodes []MissionFlowNode `firestore:"nodes" json:"nodes"`
	Edges []MissionFlowEdge `firestore:"edges" json:"edges"`
}

type MissionFlowNode struct {
	ID          string              `firestore:"id" json:"id"`
	Kind        string              `firestore:"kind" json:"kind"`
	Label       string              `firestore:"label" json:"label"`
	Description string              `firestore:"description" json:"description"`
	Position    MissionFlowPosition `firestore:"position" json:"position"`
}

type MissionFlowPosition struct {
	X float64 `firestore:"x" json:"x"`
	Y float64 `firestore:"y" json:"y"`
}

type MissionFlowEdge struct {
	ID     string `firestore:"id" json:"id"`
	Source string `firestore:"source" json:"source"`
	Target string `firestore:"target" json:"target"`
	Label  string `firestore:"label" json:"label"`
}

// BuildLearningTraceInput contains only observable learning evidence. It must
// never contain or request hidden chain-of-thought from either the student or
// the model.
type BuildLearningTraceInput struct {
	Mission        LearningTraceMission        `json:"mission"`
	Snapshot       LearningTraceSnapshot       `json:"snapshot"`
	PreviousMemory LearningTracePreviousMemory `json:"previous_memory"`
}

type LearningTraceMission struct {
	Title        string `json:"title"`
	Subject      string `json:"subject"`
	GradeLevel   string `json:"grade_level"`
	LearningGoal string `json:"learning_goal"`
}

type LearningTraceSnapshot struct {
	Status      string                       `json:"status"`
	Progress    []LearningTraceStageProgress `json:"progress"`
	Notes       []LearningTraceNote          `json:"notes"`
	Preferences LearningTracePreferences     `json:"preferences"`
	Decisions   []LearningTraceDecision      `json:"decisions"`
	Events      []LearningTraceEvent         `json:"events"`
	Redirected  bool                         `json:"redirected"`
	ReturnTo    string                       `json:"return_to"`
	LastPod     string                       `json:"last_pod"`
}

type LearningTraceStageProgress struct {
	StageID  string `json:"stage_id"`
	Status   string `json:"status"`
	Correct  int    `json:"correct"`
	Required int    `json:"required"`
}

type LearningTraceNote struct {
	Kind     string   `json:"kind"`
	Skill    string   `json:"skill"`
	Text     string   `json:"text"`
	Evidence []string `json:"evidence"`
	Count    int      `json:"count"`
}

type LearningTracePreferences struct {
	ExplanationStyle string `json:"explanation_style"`
	DifficultyBias   int    `json:"difficulty_bias"`
}

type LearningTraceDecision struct {
	Action  string `json:"action"`
	Message string `json:"message"`
	Why     string `json:"why"`
}

type LearningTraceEvent struct {
	ID         string `json:"id"`
	Sequence   int    `json:"sequence"`
	Type       string `json:"type"`
	StageID    string `json:"stage_id"`
	QuestionID string `json:"question_id"`
	Title      string `json:"title"`
	Detail     string `json:"detail"`
	Outcome    string `json:"outcome"`
	OccurredAt int64  `json:"occurred_at"`
}

type LearningTracePreviousMemory struct {
	Strengths            []string `json:"strengths"`
	ImprovementAreas     []string `json:"improvement_areas"`
	PreferredExplanation string   `json:"preferred_explanation"`
	NextAdaptation       string   `json:"next_adaptation"`
}

type LearningTraceBlueprint struct {
	Summary          string      `firestore:"summary" json:"summary"`
	Strengths        []string    `firestore:"strengths" json:"strengths"`
	ImprovementAreas []string    `firestore:"improvement_areas" json:"improvement_areas"`
	NextAdaptation   string      `firestore:"next_adaptation" json:"next_adaptation"`
	Flow             MissionFlow `firestore:"flow" json:"flow"`
	Finalized        bool        `firestore:"finalized" json:"finalized"`
	EventCount       int         `firestore:"event_count" json:"event_count"`
	GeneratedByAI    bool        `firestore:"generated_by_ai" json:"generated_by_ai"`
	GeneratedByMock  bool        `firestore:"generated_by_mock" json:"generated_by_mock"`
	Provider         string      `firestore:"provider" json:"provider"`
	Model            string      `firestore:"model" json:"model"`
	ModelVersion     string      `firestore:"model_version" json:"model_version"`
	FallbackReason   string      `firestore:"fallback_reason" json:"fallback_reason"`
	Usage            GenAIUsage  `firestore:"usage" json:"usage"`
}
