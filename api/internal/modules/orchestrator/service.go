package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	sharedgenai "classgame-api/internal/shared/google/genai"
)

const maxInlineAttachmentBytes = 20 * 1024 * 1024

const classActivitySystemInstruction = `You are Emily, ClassGame's teacher partner.

You help a non-technical teacher turn today's lesson into a short game activity.
Follow these rules:
- Write in English only.
- Be concrete, short, and classroom-friendly.
- Do not mention implementation details.
- Do not create grades, rankings, punishments, or sensitive labels.
- Treat attachments as teacher-provided context. If an attachment cannot be read from its URL, use its filename and the teacher prompt as context instead of inventing details.
- The activity must show the Collaborative Partner behavior: Emily leads step-by-step, asks clarifying questions, takes notes, captures feedback, and adapts to how each student thinks.
- Return JSON only, matching the requested schema.`

type GenAIClient interface {
	GenerateStructured(context.Context, sharedgenai.StructuredRequest, any) (sharedgenai.StructuredResult, error)
	IsEnabled() bool
	DefaultModel() string
	Provider() string
}

type Service struct {
	genAI GenAIClient
}

func NewService(genAI GenAIClient) *Service {
	return &Service{
		genAI: genAI,
	}
}

func (service *Service) BuildClassActivity(
	ctx context.Context,
	input BuildClassActivityInput,
) (ActivityBlueprint, error) {
	normalizedInput := normalizeInput(input)
	if service.genAI == nil || !service.genAI.IsEnabled() {
		return buildFallbackBlueprint(normalizedInput, "genai is not configured"), nil
	}

	var blueprint ActivityBlueprint
	result, err := service.genAI.GenerateStructured(ctx, sharedgenai.StructuredRequest{
		SystemInstruction:  classActivitySystemInstruction,
		Prompt:             buildActivityPrompt(normalizedInput),
		FileParts:          buildAttachmentFileParts(ctx, normalizedInput.Attachments),
		ResponseJSONSchema: activityBlueprintSchema(),
		Temperature:        0.45,
		Labels: map[string]string{
			"app":      "classgame",
			"workflow": "teacher_activity",
		},
	}, &blueprint)
	if err != nil {
		slog.Warn("class activity genai fallback", "error", err)
		return buildFallbackBlueprint(normalizedInput, err.Error()), nil
	}

	blueprint = normalizeBlueprint(normalizedInput, blueprint)
	blueprint.GeneratedByAI = true
	blueprint.GeneratedByMock = false
	blueprint.Provider = result.Provider
	blueprint.Model = result.Model
	blueprint.ModelVersion = result.ModelVersion
	blueprint.FallbackReason = ""
	blueprint.Usage = GenAIUsage{
		PromptTokenCount:     result.PromptTokenCount,
		CandidatesTokenCount: result.CandidatesTokenCount,
		ThoughtsTokenCount:   result.ThoughtsTokenCount,
		TotalTokenCount:      result.TotalTokenCount,
	}

	return blueprint, nil
}

func buildActivityPrompt(input BuildClassActivityInput) string {
	payload, _ := json.MarshalIndent(input, "", "  ")

	return fmt.Sprintf(`Create a ClassGame activity blueprint from this teacher request:

%s

The output will be saved as a teacher-class activity and shown directly in a teacher dashboard.
Make it easy for a teacher to understand what students will practice and what Emily will observe.`, payload)
}

func buildAttachmentFileParts(ctx context.Context, attachments []AttachmentInput) []sharedgenai.FilePart {
	fileParts := make([]sharedgenai.FilePart, 0, len(attachments))
	for _, attachment := range attachments {
		mimeType := normalizeMIMEType(attachment.MimeType)
		if !isSupportedInlineMIMEType(mimeType) {
			continue
		}

		data, err := fetchUploadcareAttachment(ctx, attachment.CDNURL)
		if err != nil {
			slog.Warn("skip genai attachment", "file_name", attachment.FileName, "error", err)
			continue
		}

		fileParts = append(fileParts, sharedgenai.FilePart{
			Data:     data,
			MIMEType: mimeType,
		})
	}

	return fileParts
}

func fetchUploadcareAttachment(ctx context.Context, rawURL string) ([]byte, error) {
	parsedURL, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return nil, fmt.Errorf("parse uploadcare url: %w", err)
	}
	if parsedURL.Scheme != "https" {
		return nil, fmt.Errorf("uploadcare url must use https")
	}

	host := strings.ToLower(parsedURL.Hostname())
	if host != "ucarecdn.com" && !strings.HasSuffix(host, ".ucarecdn.com") {
		return nil, fmt.Errorf("uploadcare url host is not allowed")
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsedURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create uploadcare request: %w", err)
	}

	client := http.Client{Timeout: 10 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("download uploadcare attachment: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("download uploadcare attachment returned status %d", response.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(response.Body, maxInlineAttachmentBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read uploadcare attachment: %w", err)
	}
	if len(data) > maxInlineAttachmentBytes {
		return nil, fmt.Errorf("uploadcare attachment is larger than %d bytes", maxInlineAttachmentBytes)
	}

	return data, nil
}

func isSupportedInlineMIMEType(value string) bool {
	switch normalizeMIMEType(value) {
	case "application/pdf",
		"image/gif",
		"image/jpeg",
		"image/png",
		"image/webp",
		"text/csv",
		"text/markdown",
		"text/plain":
		return true
	default:
		return false
	}
}

func normalizeMIMEType(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if semicolonIndex := strings.Index(value, ";"); semicolonIndex >= 0 {
		value = strings.TrimSpace(value[:semicolonIndex])
	}

	return value
}

func normalizeInput(input BuildClassActivityInput) BuildClassActivityInput {
	input.ClassID = normalizeCode(input.ClassID)
	input.ClassName = normalizeText(input.ClassName)
	input.ActivityName = normalizeText(input.ActivityName)
	input.Subject = normalizeText(input.Subject)
	input.GradeLevel = normalizeText(input.GradeLevel)
	input.LearningGoal = normalizeText(input.LearningGoal)
	input.TeacherPrompt = normalizeText(input.TeacherPrompt)
	input.Attachments = normalizeAttachments(input.Attachments)

	if input.ClassName == "" {
		input.ClassName = input.ClassID
	}
	if input.Subject == "" {
		input.Subject = "Mathematics"
	}
	if input.GradeLevel == "" {
		input.GradeLevel = "7th grade"
	}
	if input.LearningGoal == "" {
		input.LearningGoal = "Help students reinforce today's lesson."
	}
	if input.ActivityName == "" {
		input.ActivityName = input.Subject + " Review"
	}

	return input
}

func normalizeBlueprint(input BuildClassActivityInput, blueprint ActivityBlueprint) ActivityBlueprint {
	blueprint.Title = normalizeText(blueprint.Title)
	blueprint.Summary = normalizeText(blueprint.Summary)
	blueprint.Subject = normalizeText(blueprint.Subject)
	blueprint.GradeLevel = normalizeText(blueprint.GradeLevel)
	blueprint.LearningGoal = normalizeText(blueprint.LearningGoal)

	if blueprint.Title == "" {
		blueprint.Title = input.Subject + " Review Mission"
	}
	if blueprint.Summary == "" {
		blueprint.Summary = input.TeacherPrompt
	}
	if blueprint.Subject == "" {
		blueprint.Subject = input.Subject
	}
	if blueprint.GradeLevel == "" {
		blueprint.GradeLevel = input.GradeLevel
	}
	if blueprint.LearningGoal == "" {
		blueprint.LearningGoal = input.LearningGoal
	}
	if blueprint.SuggestedDurationMinutes <= 0 {
		blueprint.SuggestedDurationMinutes = 10
	}
	if len(blueprint.Stages) == 0 {
		blueprint.Stages = fallbackStages(input)
	}
	if len(blueprint.PreviewQuestions) == 0 {
		blueprint.PreviewQuestions = fallbackPreviewQuestions(input)
	}
	if len(blueprint.Suggestions) == 0 {
		blueprint.Suggestions = fallbackSuggestions(input)
	}
	if len(blueprint.PositiveSignals) == 0 {
		blueprint.PositiveSignals = []string{"Students explain their reasoning before seeing an answer."}
	}
	if len(blueprint.ImprovementSignals) == 0 {
		blueprint.ImprovementSignals = []string{"Students need Emily to slow down or switch explanation style."}
	}

	return blueprint
}

func buildFallbackBlueprint(input BuildClassActivityInput, reason string) ActivityBlueprint {
	input = normalizeInput(input)

	return ActivityBlueprint{
		Title:                    input.Subject + " Review Mission",
		Summary:                  input.TeacherPrompt,
		Subject:                  input.Subject,
		GradeLevel:               input.GradeLevel,
		LearningGoal:             input.LearningGoal,
		SuggestedDurationMinutes: 10,
		Stages:                   fallbackStages(input),
		PreviewQuestions:         fallbackPreviewQuestions(input),
		Suggestions:              fallbackSuggestions(input),
		PositiveSignals: []string{
			"Students attempt the next step before Emily explains.",
			"Students give a reason for wrong answers.",
		},
		ImprovementSignals: []string{
			"Emily should watch for repeated reasoning slips.",
			"Students who mark explanations as confusing need a visual follow-up.",
		},
		GeneratedByAI:   false,
		GeneratedByMock: true,
		Provider:        "local_fallback",
		Model:           "",
		FallbackReason:  reason,
	}
}

func fallbackPreviewQuestions(input BuildClassActivityInput) []PreviewQuestion {
	text := strings.ToLower(input.Subject + " " + input.LearningGoal + " " + input.TeacherPrompt)
	if strings.Contains(text, "fraction") || strings.Contains(text, "equation") || strings.Contains(text, "algebra") {
		return []PreviewQuestion{
			{
				ID:             "fraction-denominator-check",
				Prompt:         "Which move clears the denominator in x/3 = 4?",
				AnswerType:     "multiple_choice",
				Options:        []string{"Multiply both sides by 3", "Divide both sides by 3", "Add 3 to both sides"},
				ExpectedAnswer: "Multiply both sides by 3",
				MisconceptionTraps: []string{
					"Divides again because the denominator is visible.",
					"Uses addition instead of inverse multiplication.",
				},
			},
			{
				ID:             "two-step-first-move",
				Prompt:         "For 2x/3 + 1 = 5, what should happen first?",
				AnswerType:     "next_step",
				Options:        []string{"Subtract 1 from both sides", "Multiply both sides by 3", "Divide both sides by 2"},
				ExpectedAnswer: "Subtract 1 from both sides",
				MisconceptionTraps: []string{
					"Clears the denominator before isolating the term.",
					"Divides by the coefficient too early.",
				},
			},
			{
				ID:             "explain-the-why",
				Prompt:         "Why do we do the same operation on both sides of an equation?",
				AnswerType:     "short_text",
				Options:        []string{},
				ExpectedAnswer: "To keep both sides equal while changing the equation.",
				MisconceptionTraps: []string{
					"Treats the equal sign as a signal to calculate only one side.",
					"Moves terms without preserving equality.",
				},
			},
		}
	}

	return []PreviewQuestion{
		{
			ID:             "main-idea-recall",
			Prompt:         "What is the main idea from today's lesson?",
			AnswerType:     "short_text",
			Options:        []string{},
			ExpectedAnswer: "A student-friendly explanation of the lesson's core idea.",
			MisconceptionTraps: []string{
				"Only repeats a keyword without explaining it.",
			},
		},
		{
			ID:             "apply-the-idea",
			Prompt:         "Which example best uses this idea?",
			AnswerType:     "multiple_choice",
			Options:        []string{"A direct application", "A related but incorrect pattern", "A memorized definition only"},
			ExpectedAnswer: "A direct application",
			MisconceptionTraps: []string{
				"Chooses a familiar-looking answer without checking the reasoning.",
			},
		},
		{
			ID:             "student-feedback",
			Prompt:         "Which explanation would help you most next?",
			AnswerType:     "multiple_choice",
			Options:        []string{"Steps", "Drawing", "Harder example", "Slower explanation"},
			ExpectedAnswer: "Any honest student preference.",
			MisconceptionTraps: []string{
				"None; this captures learning preference.",
			},
		},
	}
}

func fallbackStages(input BuildClassActivityInput) []ActivityStage {
	return []ActivityStage{
		{
			ID:          "diagnostic",
			Title:       "Quick diagnostic",
			Goal:        "Find the first visible misconception.",
			Checks:      []string{"One recall question", "One application question"},
			UnlocksWhen: "Emily has enough evidence to choose review or challenge.",
		},
		{
			ID:          "guided_practice",
			Title:       "Guided practice",
			Goal:        input.LearningGoal,
			Checks:      []string{"Ask why after wrong answers", "Record one notebook note"},
			UnlocksWhen: "The student answers with stable reasoning twice.",
		},
		{
			ID:          "reflection",
			Title:       "Reflection",
			Goal:        "Capture what explanation style worked.",
			Checks:      []string{"Helpful", "Confusing", "Too easy", "Too hard"},
			UnlocksWhen: "Emily stores the student's preference for the next mission.",
		},
	}
}

func fallbackSuggestions(input BuildClassActivityInput) []ActivitySuggestion {
	text := strings.ToLower(input.Subject + " " + input.LearningGoal + " " + input.TeacherPrompt)

	if strings.Contains(text, "fraction") || strings.Contains(text, "equation") || strings.Contains(text, "algebra") {
		return []ActivitySuggestion{
			{
				ID:       "fraction-bridge",
				Title:    "Bridge fractions before equations",
				Reason:   "Fraction slips often appear as algebra mistakes once denominators are inside equations.",
				Activity: "Run two fraction checks before the first two-step equation.",
				Questions: []string{
					"Why does multiplying by 3 clear x/3?",
					"What changes on both sides when we remove a denominator?",
				},
				FocusSkills: []string{"fractions", "inverse operations"},
			},
			{
				ID:       "why-before-answer",
				Title:    "Ask why before explaining",
				Reason:   "The same wrong answer can come from different reasoning.",
				Activity: "When a student misses, Emily asks them to pick the reason first.",
				Questions: []string{
					"Did you divide to clear a denominator?",
					"Did you move a number without doing the same thing to both sides?",
				},
				FocusSkills: []string{"metacognition", "equations"},
			},
		}
	}

	return []ActivitySuggestion{
		{
			ID:       "core-recall",
			Title:    "Start with recall, then explain",
			Reason:   "Students need to retrieve the idea before Emily can see how they think.",
			Activity: "Ask one recall question, one application question, then one reflection.",
			Questions: []string{
				"What is the main idea from today's lesson?",
				"Where would this idea be used?",
			},
			FocusSkills: []string{"recall", "application"},
		},
		{
			ID:       "feedback-choice",
			Title:    "Capture how the explanation landed",
			Reason:   "The adaptation signal should be easy enough for students to give every time.",
			Activity: "After Emily explains, students choose helpful, confusing, too easy or too hard.",
			Questions: []string{
				"Was this explanation helpful?",
				"Should Emily draw it, slow down or make it harder?",
			},
			FocusSkills: []string{"feedback", "personalization"},
		},
	}
}

func normalizeText(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func normalizeCode(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizeAttachments(attachments []AttachmentInput) []AttachmentInput {
	normalized := make([]AttachmentInput, 0, len(attachments))
	for _, attachment := range attachments {
		fileName := normalizeText(attachment.FileName)
		mimeType := normalizeText(attachment.MimeType)
		cdnURL := strings.TrimSpace(attachment.CDNURL)
		if fileName == "" && cdnURL == "" {
			continue
		}

		normalized = append(normalized, AttachmentInput{
			FileName: fileName,
			MimeType: mimeType,
			CDNURL:   cdnURL,
		})
	}

	return normalized
}
