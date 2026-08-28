package teacherclassstudent

import (
	"context"
	"errors"
	"strings"
	"time"
)

var ErrInvalidStudentActivitySummary = errors.New("invalid student activity summary")

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

func (service *Service) UpsertActivitySummary(
	ctx context.Context,
	input UpsertStudentActivitySummaryInput,
) (ClassStudentDocument, error) {
	if service.repository == nil {
		return ClassStudentDocument{}, errors.New("teacher class student repository is not configured")
	}

	input = normalizeInput(input)
	if input.ClassID == "" || input.StudentID == "" || input.ActivitySummary.ActivityID == "" {
		return ClassStudentDocument{}, ErrInvalidStudentActivitySummary
	}
	if input.CurrentActivityID == "" {
		input.CurrentActivityID = input.ActivitySummary.ActivityID
	}
	if input.StudentName == "" {
		input.StudentName = "Unnamed student"
	}
	if input.Timestamp.IsZero() {
		input.Timestamp = time.Now()
	}

	input.ThinkingSummary = normalizeThinkingSummary(input.ThinkingSummary, input.Timestamp)
	input.NotebookNotes = normalizeNotebookNotes(input.NotebookNotes, input.ActivitySummary.ActivityID, input.Timestamp)

	return service.repository.UpsertActivitySummary(ctx, input)
}

func normalizeThinkingSummary(
	summary StudentThinkingSummary,
	timestamp time.Time,
) StudentThinkingSummary {
	summary.PreferredExplanationStyle = normalizeText(summary.PreferredExplanationStyle)
	summary.ReasoningPatterns = normalizeStrings(summary.ReasoningPatterns)
	summary.Strengths = normalizeStrings(summary.Strengths)
	summary.ImprovementAreas = normalizeStrings(summary.ImprovementAreas)
	summary.LastUpdatedAt = nonZeroTime(summary.LastUpdatedAt, timestamp)

	return summary
}

func normalizeNotebookNotes(
	notes []StudentNotebookNote,
	defaultActivityID string,
	timestamp time.Time,
) []StudentNotebookNote {
	normalized := make([]StudentNotebookNote, 0, len(notes))
	for _, note := range notes {
		note.ID = strings.TrimSpace(note.ID)
		note.ActivityID = strings.TrimSpace(note.ActivityID)
		note.Skill = normalizeText(note.Skill)
		note.Kind = normalizeText(note.Kind)
		note.Text = normalizeText(note.Text)
		note.Evidence = normalizeStrings(note.Evidence)
		if note.ActivityID == "" {
			note.ActivityID = defaultActivityID
		}
		if note.Text == "" {
			continue
		}
		if note.ID == "" {
			note.ID = note.ActivityID + ":" + note.Kind + ":" + note.Skill
		}
		if note.Count <= 0 {
			note.Count = 1
		}
		note.CreatedAt = nonZeroTime(note.CreatedAt, timestamp)
		note.UpdatedAt = nonZeroTime(note.UpdatedAt, timestamp)

		normalized = append(normalized, note)
	}

	return normalized
}

func normalizeStrings(values []string) []string {
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		text := normalizeText(value)
		if text != "" {
			normalized = append(normalized, text)
		}
	}

	return normalized
}
