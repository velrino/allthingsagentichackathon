package mission

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
	input CreateMissionInput,
) (MissionDocument, error) {
	missionRef := repository.client.Collection(teacherclass.CollectionName).
		Doc(input.ClassID).
		Collection(MissionsCollectionName).
		NewDoc()
	codeRef := repository.client.Collection(MissionCodesCollectionName).
		Doc(input.MissionCode)

	mission := buildMissionDocument(missionRef.ID, input)
	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		_, err := tx.Get(codeRef)
		switch {
		case err == nil:
			return ErrMissionCodeUnavailable
		case status.Code(err) != codes.NotFound:
			return fmt.Errorf("check mission code: %w", err)
		}

		if err := tx.Create(missionRef, mission.firestoreMap()); err != nil {
			return fmt.Errorf("create mission: %w", err)
		}

		return tx.Create(codeRef, map[string]any{
			"mission_code": input.MissionCode,
			"mission_id":   mission.ID,
			"class_id":     mission.ClassID,
			"status":       mission.Status,
			"created_at":   mission.CreatedAt,
			"updated_at":   mission.UpdatedAt,
		})
	})
	if err != nil {
		return MissionDocument{}, fmt.Errorf("write mission: %w", err)
	}

	return mission, nil
}

func (repository *Repository) GetByCode(
	ctx context.Context,
	missionCode string,
) (MissionDocument, bool, error) {
	codeSnapshot, err := repository.client.Collection(MissionCodesCollectionName).
		Doc(normalizeCode(missionCode)).
		Get(ctx)
	if status.Code(err) == codes.NotFound {
		return MissionDocument{}, false, nil
	}
	if err != nil {
		return MissionDocument{}, false, fmt.Errorf("read mission code: %w", err)
	}

	var code missionCodeDocument
	if err := codeSnapshot.DataTo(&code); err != nil {
		return MissionDocument{}, false, fmt.Errorf("decode mission code: %w", err)
	}

	return repository.Get(ctx, code.ClassID, code.MissionID)
}

func (repository *Repository) Get(
	ctx context.Context,
	classID string,
	missionID string,
) (MissionDocument, bool, error) {
	snapshot, err := repository.client.Collection(teacherclass.CollectionName).
		Doc(classID).
		Collection(MissionsCollectionName).
		Doc(missionID).
		Get(ctx)
	if status.Code(err) == codes.NotFound {
		return MissionDocument{}, false, nil
	}
	if err != nil {
		return MissionDocument{}, false, fmt.Errorf("read mission: %w", err)
	}

	var mission MissionDocument
	if err := snapshot.DataTo(&mission); err != nil {
		return MissionDocument{}, false, fmt.Errorf("decode mission: %w", err)
	}
	if mission.ID == "" {
		mission.ID = snapshot.Ref.ID
	}

	return mission, true, nil
}

func (repository *Repository) List(
	ctx context.Context,
	classID string,
	limit int,
) ([]MissionDocument, error) {
	if limit <= 0 {
		limit = 10
	}

	iter := repository.client.Collection(teacherclass.CollectionName).
		Doc(classID).
		Collection(MissionsCollectionName).
		OrderBy("created_at", firestore.Desc).
		Limit(limit).
		Documents(ctx)
	defer iter.Stop()

	missions := make([]MissionDocument, 0)
	for {
		snapshot, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("iterate missions: %w", err)
		}

		var mission MissionDocument
		if err := snapshot.DataTo(&mission); err != nil {
			return nil, fmt.Errorf("decode mission %s: %w", snapshot.Ref.ID, err)
		}
		if mission.ID == "" {
			mission.ID = snapshot.Ref.ID
		}

		missions = append(missions, mission)
	}

	return missions, nil
}

func (repository *Repository) Publish(
	ctx context.Context,
	classID string,
	missionID string,
	teacherID string,
	timestamp time.Time,
) (MissionDocument, error) {
	ref := repository.client.Collection(teacherclass.CollectionName).
		Doc(classID).
		Collection(MissionsCollectionName).
		Doc(missionID)

	var mission MissionDocument
	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snapshot, err := tx.Get(ref)
		if status.Code(err) == codes.NotFound {
			return ErrMissionNotFound
		}
		if err != nil {
			return fmt.Errorf("read mission: %w", err)
		}
		if err := snapshot.DataTo(&mission); err != nil {
			return fmt.Errorf("decode mission: %w", err)
		}
		if mission.CreatedBy.ProviderUserID != teacherID {
			return teacherclass.ErrClassOwnedByAnotherTeacher
		}
		if mission.ID == "" {
			mission.ID = snapshot.Ref.ID
		}

		mission.Status = StatusPublished
		if mission.PublishedAt.IsZero() {
			mission.PublishedAt = timestamp
		}
		mission.UpdatedAt = timestamp

		if err := tx.Set(ref, map[string]any{
			"status":       mission.Status,
			"published_at": mission.PublishedAt,
			"updated_at":   mission.UpdatedAt,
		}, firestore.MergeAll); err != nil {
			return err
		}

		if mission.MissionCode == "" {
			return nil
		}

		codeRef := repository.client.Collection(MissionCodesCollectionName).
			Doc(mission.MissionCode)
		return tx.Set(codeRef, map[string]any{
			"status":     mission.Status,
			"updated_at": mission.UpdatedAt,
		}, firestore.MergeAll)
	})
	if err != nil {
		return MissionDocument{}, fmt.Errorf("publish mission: %w", err)
	}

	return mission, nil
}

type missionCodeDocument struct {
	MissionID string `firestore:"mission_id"`
	ClassID   string `firestore:"class_id"`
}

func buildMissionDocument(id string, input CreateMissionInput) MissionDocument {
	blueprint := input.Blueprint
	status := input.Status
	if status == "" {
		status = StatusPreview
	}

	return MissionDocument{
		ID:                       id,
		MissionCode:              input.MissionCode,
		ClassID:                  input.ClassID,
		ClassCode:                input.ClassCode,
		ClassName:                input.ClassName,
		MissionName:              input.MissionName,
		Title:                    blueprint.Title,
		Summary:                  blueprint.Summary,
		Subject:                  blueprint.Subject,
		GradeLevel:               blueprint.GradeLevel,
		LearningGoal:             blueprint.LearningGoal,
		TeacherPrompt:            input.TeacherPrompt,
		AudienceType:             input.AudienceType,
		TargetStudentIDs:         input.TargetStudentIDs,
		Attachments:              input.Attachments,
		PreviewQuestions:         blueprint.PreviewQuestions,
		SuggestedDurationMinutes: blueprint.SuggestedDurationMinutes,
		Stages:                   blueprint.Stages,
		Suggestions:              blueprint.Suggestions,
		PositiveSignals:          blueprint.PositiveSignals,
		ImprovementSignals:       blueprint.ImprovementSignals,
		Orchestration: MissionOrchestration{
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

func (mission MissionDocument) firestoreMap() map[string]any {
	return map[string]any{
		"id":                         mission.ID,
		"mission_code":               mission.MissionCode,
		"class_id":                   mission.ClassID,
		"class_code":                 mission.ClassCode,
		"class_name":                 mission.ClassName,
		"mission_name":               mission.MissionName,
		"title":                      mission.Title,
		"summary":                    mission.Summary,
		"subject":                    mission.Subject,
		"grade_level":                mission.GradeLevel,
		"learning_goal":              mission.LearningGoal,
		"teacher_prompt":             mission.TeacherPrompt,
		"audience_type":              mission.AudienceType,
		"target_student_ids":         mission.TargetStudentIDs,
		"attachments":                mission.Attachments,
		"preview_questions":          mission.PreviewQuestions,
		"suggested_duration_minutes": mission.SuggestedDurationMinutes,
		"stages":                     mission.Stages,
		"suggestions":                mission.Suggestions,
		"positive_signals":           mission.PositiveSignals,
		"improvement_signals":        mission.ImprovementSignals,
		"orchestration": map[string]any{
			"provider":               mission.Orchestration.Provider,
			"model":                  mission.Orchestration.Model,
			"model_version":          mission.Orchestration.ModelVersion,
			"generated_by_ai":        mission.Orchestration.GeneratedByAI,
			"generated_by_mock":      mission.Orchestration.GeneratedByMock,
			"fallback_reason":        mission.Orchestration.FallbackReason,
			"prompt_token_count":     mission.Orchestration.PromptTokenCount,
			"candidates_token_count": mission.Orchestration.CandidatesTokenCount,
			"thoughts_token_count":   mission.Orchestration.ThoughtsTokenCount,
			"total_token_count":      mission.Orchestration.TotalTokenCount,
		},
		"status":       mission.Status,
		"created_by":   mission.CreatedBy,
		"updated_by":   mission.UpdatedBy,
		"published_at": mission.PublishedAt,
		"created_at":   mission.CreatedAt,
		"updated_at":   mission.UpdatedAt,
	}
}
