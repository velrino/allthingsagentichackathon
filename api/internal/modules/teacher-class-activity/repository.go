package teacherclassactivity

import (
	"context"
	"errors"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
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

func (repository *Repository) Create(
	ctx context.Context,
	input CreateActivityInput,
) (ActivityDocument, error) {
	activityRef := repository.client.Collection(teacherclass.CollectionName).
		Doc(input.ClassID).
		Collection(ActivitiesCollectionName).
		NewDoc()

	activity := buildActivityDocument(activityRef.ID, input)
	if _, err := activityRef.Set(ctx, activity.firestoreMap()); err != nil {
		return ActivityDocument{}, fmt.Errorf("write activity: %w", err)
	}

	return activity, nil
}

func (repository *Repository) Get(
	ctx context.Context,
	classID string,
	activityID string,
) (ActivityDocument, bool, error) {
	snapshot, err := repository.client.Collection(teacherclass.CollectionName).
		Doc(classID).
		Collection(ActivitiesCollectionName).
		Doc(activityID).
		Get(ctx)
	if status.Code(err) == codes.NotFound {
		return ActivityDocument{}, false, nil
	}
	if err != nil {
		return ActivityDocument{}, false, fmt.Errorf("read activity: %w", err)
	}

	var activity ActivityDocument
	if err := snapshot.DataTo(&activity); err != nil {
		return ActivityDocument{}, false, fmt.Errorf("decode activity: %w", err)
	}
	if activity.ID == "" {
		activity.ID = snapshot.Ref.ID
	}

	return activity, true, nil
}

func (repository *Repository) List(
	ctx context.Context,
	classID string,
	limit int,
) ([]ActivityDocument, error) {
	if limit <= 0 {
		limit = 10
	}

	iter := repository.client.Collection(teacherclass.CollectionName).
		Doc(classID).
		Collection(ActivitiesCollectionName).
		OrderBy("created_at", firestore.Desc).
		Limit(limit).
		Documents(ctx)
	defer iter.Stop()

	activities := make([]ActivityDocument, 0)
	for {
		snapshot, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("iterate activities: %w", err)
		}

		var activity ActivityDocument
		if err := snapshot.DataTo(&activity); err != nil {
			return nil, fmt.Errorf("decode activity %s: %w", snapshot.Ref.ID, err)
		}
		if activity.ID == "" {
			activity.ID = snapshot.Ref.ID
		}

		activities = append(activities, activity)
	}

	return activities, nil
}

func (repository *Repository) Publish(
	ctx context.Context,
	classID string,
	activityID string,
	teacherID string,
	timestamp time.Time,
) (ActivityDocument, error) {
	ref := repository.client.Collection(teacherclass.CollectionName).
		Doc(classID).
		Collection(ActivitiesCollectionName).
		Doc(activityID)

	var activity ActivityDocument
	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snapshot, err := tx.Get(ref)
		if status.Code(err) == codes.NotFound {
			return ErrActivityNotFound
		}
		if err != nil {
			return fmt.Errorf("read activity: %w", err)
		}
		if err := snapshot.DataTo(&activity); err != nil {
			return fmt.Errorf("decode activity: %w", err)
		}
		if activity.CreatedBy.ProviderUserID != teacherID {
			return teacherclass.ErrClassOwnedByAnotherTeacher
		}
		if activity.ID == "" {
			activity.ID = snapshot.Ref.ID
		}

		activity.Status = StatusPublished
		if activity.PublishedAt.IsZero() {
			activity.PublishedAt = timestamp
		}
		activity.UpdatedAt = timestamp

		return tx.Set(ref, map[string]any{
			"status":       activity.Status,
			"published_at": activity.PublishedAt,
			"updated_at":   activity.UpdatedAt,
		}, firestore.MergeAll)
	})
	if err != nil {
		return ActivityDocument{}, fmt.Errorf("publish activity: %w", err)
	}

	return activity, nil
}

func buildActivityDocument(id string, input CreateActivityInput) ActivityDocument {
	blueprint := input.Blueprint
	status := input.Status
	if status == "" {
		status = StatusPreview
	}

	return ActivityDocument{
		ID:                       id,
		ClassID:                  input.ClassID,
		ClassCode:                input.ClassID,
		ClassName:                input.ClassName,
		ActivityName:             input.ActivityName,
		Title:                    blueprint.Title,
		Summary:                  blueprint.Summary,
		Subject:                  blueprint.Subject,
		GradeLevel:               blueprint.GradeLevel,
		LearningGoal:             blueprint.LearningGoal,
		TeacherPrompt:            input.TeacherPrompt,
		Attachments:              input.Attachments,
		PreviewQuestions:         blueprint.PreviewQuestions,
		SuggestedDurationMinutes: blueprint.SuggestedDurationMinutes,
		Stages:                   blueprint.Stages,
		Suggestions:              blueprint.Suggestions,
		PositiveSignals:          blueprint.PositiveSignals,
		ImprovementSignals:       blueprint.ImprovementSignals,
		Orchestration: ActivityOrchestration{
			Provider:             blueprint.Provider,
			Model:                blueprint.Model,
			ModelVersion:         blueprint.ModelVersion,
			GeneratedByAI:        blueprint.GeneratedByAI,
			GeneratedByMock:      blueprint.GeneratedByMock,
			FallbackReason:       blueprint.FallbackReason,
			PromptTokenCount:     blueprint.Usage.PromptTokenCount,
			CandidatesTokenCount: blueprint.Usage.CandidatesTokenCount,
			ThoughtsTokenCount:   blueprint.Usage.ThoughtsTokenCount,
			TotalTokenCount:      blueprint.Usage.TotalTokenCount,
		},
		Status:      status,
		CreatedBy:   input.Teacher,
		UpdatedBy:   input.Teacher,
		PublishedAt: input.PublishedAt,
		CreatedAt:   input.Timestamp,
		UpdatedAt:   input.Timestamp,
	}
}

func (activity ActivityDocument) firestoreMap() map[string]any {
	return map[string]any{
		"id":                         activity.ID,
		"class_id":                   activity.ClassID,
		"class_code":                 activity.ClassCode,
		"class_name":                 activity.ClassName,
		"activity_name":              activity.ActivityName,
		"title":                      activity.Title,
		"summary":                    activity.Summary,
		"subject":                    activity.Subject,
		"grade_level":                activity.GradeLevel,
		"learning_goal":              activity.LearningGoal,
		"teacher_prompt":             activity.TeacherPrompt,
		"attachments":                activity.Attachments,
		"preview_questions":          activity.PreviewQuestions,
		"suggested_duration_minutes": activity.SuggestedDurationMinutes,
		"stages":                     activity.Stages,
		"suggestions":                activity.Suggestions,
		"positive_signals":           activity.PositiveSignals,
		"improvement_signals":        activity.ImprovementSignals,
		"orchestration": map[string]any{
			"provider":               activity.Orchestration.Provider,
			"model":                  activity.Orchestration.Model,
			"model_version":          activity.Orchestration.ModelVersion,
			"generated_by_ai":        activity.Orchestration.GeneratedByAI,
			"generated_by_mock":      activity.Orchestration.GeneratedByMock,
			"fallback_reason":        activity.Orchestration.FallbackReason,
			"prompt_token_count":     activity.Orchestration.PromptTokenCount,
			"candidates_token_count": activity.Orchestration.CandidatesTokenCount,
			"thoughts_token_count":   activity.Orchestration.ThoughtsTokenCount,
			"total_token_count":      activity.Orchestration.TotalTokenCount,
		},
		"status":       activity.Status,
		"created_by":   activity.CreatedBy,
		"updated_by":   activity.UpdatedBy,
		"published_at": activity.PublishedAt,
		"created_at":   activity.CreatedAt,
		"updated_at":   activity.UpdatedAt,
	}
}
