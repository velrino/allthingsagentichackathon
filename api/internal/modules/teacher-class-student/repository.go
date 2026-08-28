package teacherclassstudent

import (
	"context"
	"fmt"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	teacherclass "classgame-api/internal/modules/teacher-class"
)

type Repository struct {
	client *firestore.Client
}

func NewRepository(client *firestore.Client) *Repository {
	return &Repository{
		client: client,
	}
}

func (repository *Repository) Get(
	ctx context.Context,
	classID string,
	studentID string,
) (ClassStudentDocument, bool, error) {
	snapshot, err := repository.documentRef(classID, studentID).Get(ctx)
	if status.Code(err) == codes.NotFound {
		return ClassStudentDocument{}, false, nil
	}
	if err != nil {
		return ClassStudentDocument{}, false, fmt.Errorf("read class student: %w", err)
	}

	var student ClassStudentDocument
	if err := snapshot.DataTo(&student); err != nil {
		return ClassStudentDocument{}, false, fmt.Errorf("decode class student: %w", err)
	}
	if student.ID == "" {
		student.ID = snapshot.Ref.ID
	}

	return student, true, nil
}

func (repository *Repository) UpsertActivitySummary(
	ctx context.Context,
	input UpsertStudentActivitySummaryInput,
) (ClassStudentDocument, error) {
	input = normalizeInput(input)
	ref := repository.documentRef(input.ClassID, input.StudentID)

	var student ClassStudentDocument
	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		createdAt := input.Timestamp
		activitySummaries := map[string]StudentActivitySummary{}
		notebookNotes := []StudentNotebookNote{}

		snapshot, err := tx.Get(ref)
		switch {
		case err == nil:
			if err := snapshot.DataTo(&student); err != nil {
				return fmt.Errorf("decode class student: %w", err)
			}
			if !student.CreatedAt.IsZero() {
				createdAt = student.CreatedAt
			}
			activitySummaries = student.ActivitySummaries
			notebookNotes = student.NotebookNotes
		case status.Code(err) != codes.NotFound:
			return fmt.Errorf("read class student: %w", err)
		}

		if activitySummaries == nil {
			activitySummaries = map[string]StudentActivitySummary{}
		}
		if input.ActivitySummary.ActivityID != "" {
			activitySummaries[input.ActivitySummary.ActivityID] = input.ActivitySummary
		}
		notebookNotes = append(notebookNotes, input.NotebookNotes...)

		student = ClassStudentDocument{
			ID:                ref.ID,
			ClassID:           input.ClassID,
			StudentID:         input.StudentID,
			StudentName:       input.StudentName,
			CurrentActivityID: input.CurrentActivityID,
			ThinkingSummary:   input.ThinkingSummary,
			ActivitySummaries: activitySummaries,
			NotebookNotes:     notebookNotes,
			FeedbackSummary:   input.FeedbackSummary,
			CreatedAt:         createdAt,
			UpdatedAt:         input.Timestamp,
		}

		return tx.Set(ref, student.firestoreMap(), firestore.MergeAll)
	})
	if err != nil {
		return ClassStudentDocument{}, fmt.Errorf("upsert student activity summary: %w", err)
	}

	return student, nil
}

func (repository *Repository) documentRef(classID string, studentID string) *firestore.DocumentRef {
	return repository.client.Collection(teacherclass.CollectionName).
		Doc(normalizeCode(classID)).
		Collection(CollectionName).
		Doc(strings.TrimSpace(studentID))
}

func (student ClassStudentDocument) firestoreMap() map[string]any {
	return map[string]any{
		"id":                  student.ID,
		"class_id":            student.ClassID,
		"student_id":          student.StudentID,
		"student_name":        student.StudentName,
		"current_activity_id": student.CurrentActivityID,
		"thinking_summary": map[string]any{
			"preferred_explanation_style": student.ThinkingSummary.PreferredExplanationStyle,
			"reasoning_patterns":          student.ThinkingSummary.ReasoningPatterns,
			"strengths":                   student.ThinkingSummary.Strengths,
			"improvement_areas":           student.ThinkingSummary.ImprovementAreas,
			"last_updated_at":             student.ThinkingSummary.LastUpdatedAt,
		},
		"activity_summaries": student.ActivitySummaries,
		"notebook_notes":     student.NotebookNotes,
		"feedback_summary": map[string]any{
			"helpful_count":   student.FeedbackSummary.HelpfulCount,
			"confusing_count": student.FeedbackSummary.ConfusingCount,
			"too_easy_count":  student.FeedbackSummary.TooEasyCount,
			"too_hard_count":  student.FeedbackSummary.TooHardCount,
		},
		"created_at": student.CreatedAt,
		"updated_at": student.UpdatedAt,
	}
}

func normalizeInput(input UpsertStudentActivitySummaryInput) UpsertStudentActivitySummaryInput {
	if input.Timestamp.IsZero() {
		input.Timestamp = time.Now()
	}
	input.ClassID = normalizeCode(input.ClassID)
	input.StudentID = strings.TrimSpace(input.StudentID)
	input.StudentName = normalizeText(input.StudentName)
	input.CurrentActivityID = strings.TrimSpace(input.CurrentActivityID)
	input.ActivitySummary.ActivityID = strings.TrimSpace(input.ActivitySummary.ActivityID)
	input.ActivitySummary.UpdatedAt = nonZeroTime(input.ActivitySummary.UpdatedAt, input.Timestamp)
	input.ThinkingSummary.LastUpdatedAt = nonZeroTime(input.ThinkingSummary.LastUpdatedAt, input.Timestamp)

	return input
}

func nonZeroTime(value time.Time, fallback time.Time) time.Time {
	if !value.IsZero() {
		return value
	}
	if !fallback.IsZero() {
		return fallback
	}

	return time.Now()
}

func normalizeCode(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizeText(value string) string {
	return strings.Join(strings.Fields(value), " ")
}
