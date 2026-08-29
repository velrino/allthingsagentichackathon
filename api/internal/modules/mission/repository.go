package mission

import (
	"context"
	"errors"
	"fmt"
	"strconv"
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
		if mission.Published != nil {
			revisionRef := missionRef.Collection(MissionRevisionsCollectionName).
				Doc(strconv.FormatInt(mission.PublishedRevision, 10))
			if err := tx.Create(revisionRef, publishedRevisionMap(mission, input.Teacher)); err != nil {
				return fmt.Errorf("create published mission revision: %w", err)
			}
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

	mission, exists, err := repository.Get(ctx, code.ClassID, code.MissionID)
	if err != nil || !exists {
		return mission, exists, err
	}

	published, exists := publishedView(mission)
	return published, exists, nil
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
	hydrateMissionLifecycle(&mission)

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
		hydrateMissionLifecycle(&mission)
		if mission.Status == StatusDeleted {
			continue
		}

		missions = append(missions, mission)
	}

	return missions, nil
}

func (repository *Repository) UpdateDraft(
	ctx context.Context,
	input CreateMissionInput,
) (MissionDocument, error) {
	if input.ExpectedDraftRevision <= 0 {
		return MissionDocument{}, ErrMissionDraftRevisionRequired
	}

	ref := repository.client.Collection(teacherclass.CollectionName).
		Doc(input.ClassID).
		Collection(MissionsCollectionName).
		Doc(input.MissionID)

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
		if mission.ID == "" {
			mission.ID = snapshot.Ref.ID
		}
		hydrateMissionLifecycle(&mission)
		if mission.CreatedBy.ProviderUserID != input.Teacher.ProviderUserID {
			return teacherclass.ErrClassOwnedByAnotherTeacher
		}
		if mission.Status == StatusDeleted {
			return ErrMissionDeleted
		}
		if input.ExpectedDraftRevision > 0 && mission.DraftRevision != input.ExpectedDraftRevision {
			return ErrMissionDraftConflict
		}

		nextRevision := mission.DraftRevision + 1
		input.Attachments = inheritStoredAttachments(input.Attachments, mission)
		draft := newSnapshotFromInput(input, nextRevision)
		mission.Draft = &draft
		mission.DraftRevision = nextRevision
		mission.HasUnpublishedChanges = mission.Published == nil ||
			mission.PublishedRevision != nextRevision
		mission.ClassName = input.ClassName
		mission.applySnapshot(draft)
		mission.Status = StatusDraft

		return tx.Set(ref, mission.firestoreMap())
	})
	if err != nil {
		return MissionDocument{}, fmt.Errorf("update mission draft: %w", err)
	}

	return mission, nil
}

func (repository *Repository) Publish(
	ctx context.Context,
	classID string,
	missionID string,
	teacher teacherclass.TeacherSummary,
	expectedDraftRevision int64,
	timestamp time.Time,
) (MissionDocument, error) {
	if expectedDraftRevision <= 0 {
		return MissionDocument{}, ErrMissionDraftRevisionRequired
	}

	classRef := repository.client.Collection(teacherclass.CollectionName).Doc(classID)
	ref := classRef.Collection(MissionsCollectionName).Doc(missionID)

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
		if mission.CreatedBy.ProviderUserID != teacher.ProviderUserID {
			return teacherclass.ErrClassOwnedByAnotherTeacher
		}
		if mission.ID == "" {
			mission.ID = snapshot.Ref.ID
		}
		hydrateMissionLifecycle(&mission)
		if mission.Status == StatusDeleted {
			return ErrMissionDeleted
		}
		if mission.Draft == nil {
			return ErrMissionDraftNotFound
		}
		if expectedDraftRevision > 0 && mission.DraftRevision != expectedDraftRevision {
			return ErrMissionDraftConflict
		}

		classSnapshot, err := tx.Get(classRef)
		if status.Code(err) == codes.NotFound {
			return teacherclass.ErrClassNotFound
		}
		if err != nil {
			return fmt.Errorf("read teacher class: %w", err)
		}
		var teacherClass teacherclass.TeacherClassDocument
		if err := classSnapshot.DataTo(&teacherClass); err != nil {
			return fmt.Errorf("decode teacher class: %w", err)
		}
		if teacherClass.TeacherID != teacher.ProviderUserID {
			return teacherclass.ErrClassOwnedByAnotherTeacher
		}

		firstPublication := mission.Published == nil
		alreadyPublished := mission.Published != nil &&
			mission.PublishedRevision == mission.DraftRevision &&
			!mission.HasUnpublishedChanges
		if alreadyPublished {
			if err := tx.Set(classRef, map[string]any{
				"active_mission_id": mission.ID,
				"updated_at":        timestamp,
			}, firestore.MergeAll); err != nil {
				return fmt.Errorf("activate published mission: %w", err)
			}

			return nil
		}

		publishedAt := timestamp

		published := *mission.Draft
		prepareAttachmentsForPublish(published.Attachments, timestamp)
		mission.Published = &published
		mission.PublishedRevision = published.Revision
		mission.HasUnpublishedChanges = false
		mission.Status = StatusPublished
		mission.PublishedAt = publishedAt
		mission.applySnapshot(published)
		mission.UpdatedBy = teacher
		mission.UpdatedAt = timestamp

		revisionRef := ref.Collection(MissionRevisionsCollectionName).
			Doc(strconv.FormatInt(mission.PublishedRevision, 10))
		if err := tx.Set(revisionRef, publishedRevisionMap(mission, teacher)); err != nil {
			return fmt.Errorf("write published mission revision: %w", err)
		}

		if err := tx.Set(ref, mission.firestoreMap()); err != nil {
			return err
		}

		classUpdate := map[string]any{
			"active_mission_id": mission.ID,
			"updated_at":        timestamp,
		}
		if firstPublication {
			classUpdate["mission_count"] = firestore.Increment(1)
		}
		if err := tx.Set(classRef, classUpdate, firestore.MergeAll); err != nil {
			return fmt.Errorf("activate published mission: %w", err)
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

func (repository *Repository) GetPublishedRevision(
	ctx context.Context,
	classID string,
	missionID string,
	revision int64,
) (MissionPublishedRevisionDocument, bool, error) {
	if revision <= 0 {
		return MissionPublishedRevisionDocument{}, false, nil
	}

	snapshot, err := repository.client.Collection(teacherclass.CollectionName).
		Doc(classID).
		Collection(MissionsCollectionName).
		Doc(missionID).
		Collection(MissionRevisionsCollectionName).
		Doc(strconv.FormatInt(revision, 10)).
		Get(ctx)
	if status.Code(err) == codes.NotFound {
		return MissionPublishedRevisionDocument{}, false, nil
	}
	if err != nil {
		return MissionPublishedRevisionDocument{}, false, fmt.Errorf("read published mission revision: %w", err)
	}

	var publishedRevision MissionPublishedRevisionDocument
	if err := snapshot.DataTo(&publishedRevision); err != nil {
		return MissionPublishedRevisionDocument{}, false, fmt.Errorf("decode published mission revision: %w", err)
	}

	return publishedRevision, true, nil
}

func (repository *Repository) SoftDelete(
	ctx context.Context,
	classID string,
	missionID string,
	teacher teacherclass.TeacherSummary,
	timestamp time.Time,
) (MissionDocument, error) {
	classRef := repository.client.Collection(teacherclass.CollectionName).Doc(classID)
	missionRef := classRef.Collection(MissionsCollectionName).Doc(missionID)

	var mission MissionDocument
	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		missionSnapshot, err := tx.Get(missionRef)
		if status.Code(err) == codes.NotFound {
			return ErrMissionNotFound
		}
		if err != nil {
			return fmt.Errorf("read mission: %w", err)
		}
		if err := missionSnapshot.DataTo(&mission); err != nil {
			return fmt.Errorf("decode mission: %w", err)
		}
		if mission.ID == "" {
			mission.ID = missionSnapshot.Ref.ID
		}
		hydrateMissionLifecycle(&mission)
		if mission.CreatedBy.ProviderUserID != teacher.ProviderUserID {
			return teacherclass.ErrClassOwnedByAnotherTeacher
		}

		var teacherClass teacherclass.TeacherClassDocument
		classSnapshot, classErr := tx.Get(classRef)
		if classErr == nil {
			if err := classSnapshot.DataTo(&teacherClass); err != nil {
				return fmt.Errorf("decode teacher class: %w", err)
			}
		} else if status.Code(classErr) != codes.NotFound {
			return fmt.Errorf("read teacher class: %w", classErr)
		}

		if mission.Status != StatusDeleted {
			mission.StatusBeforeDelete = mission.Status
			mission.DeletedAt = timestamp
			mission.DeletedBy = teacher
		}
		mission.Status = StatusDeleted
		mission.UpdatedAt = timestamp
		mission.UpdatedBy = teacher

		if err := tx.Set(missionRef, mission.firestoreMap()); err != nil {
			return fmt.Errorf("soft delete mission: %w", err)
		}
		if teacherClass.ActiveMissionID == mission.ID {
			if err := tx.Set(classRef, map[string]any{
				"active_mission_id": "",
				"updated_at":        timestamp,
			}, firestore.MergeAll); err != nil {
				return fmt.Errorf("clear active mission: %w", err)
			}
		}
		if mission.MissionCode != "" {
			codeRef := repository.client.Collection(MissionCodesCollectionName).Doc(mission.MissionCode)
			if err := tx.Set(codeRef, map[string]any{
				"status":     StatusDeleted,
				"updated_at": timestamp,
			}, firestore.MergeAll); err != nil {
				return fmt.Errorf("disable mission code: %w", err)
			}
		}

		return nil
	})
	if err != nil {
		return MissionDocument{}, fmt.Errorf("delete mission: %w", err)
	}

	return mission, nil
}

type missionCodeDocument struct {
	MissionID string `firestore:"mission_id"`
	ClassID   string `firestore:"class_id"`
}

func buildMissionDocument(id string, input CreateMissionInput) MissionDocument {
	status := input.Status
	if status == "" || status == StatusPreview {
		status = StatusDraft
	}

	mission := buildMissionDocumentFields(input)
	mission.ID = id
	mission.MissionCode = input.MissionCode
	mission.ClassID = input.ClassID
	mission.ClassCode = input.ClassCode
	mission.ClassName = input.ClassName
	mission.Status = status
	mission.CreatedBy = input.Teacher
	mission.UpdatedBy = input.Teacher
	mission.PublishedAt = input.PublishedAt
	mission.CreatedAt = input.Timestamp
	mission.UpdatedAt = input.Timestamp
	mission.DraftRevision = initialMissionRevision
	draft := snapshotFromMission(mission, mission.DraftRevision)
	mission.Draft = &draft
	mission.HasUnpublishedChanges = true

	if status == StatusPublished {
		published := draft
		mission.Published = &published
		mission.PublishedRevision = published.Revision
		mission.HasUnpublishedChanges = false
		mission.PublishedAt = nonZeroTime(input.PublishedAt, input.Timestamp)
	}

	return mission
}

func buildMissionDocumentFields(input CreateMissionInput) MissionDocument {
	blueprint := input.Blueprint

	return MissionDocument{
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
		"draft":                   mission.Draft,
		"published":               mission.Published,
		"draft_revision":          mission.DraftRevision,
		"published_revision":      mission.PublishedRevision,
		"has_unpublished_changes": mission.HasUnpublishedChanges,
		"status":                  mission.Status,
		"status_before_delete":    mission.StatusBeforeDelete,
		"created_by":              mission.CreatedBy,
		"updated_by":              mission.UpdatedBy,
		"deleted_by":              mission.DeletedBy,
		"published_at":            mission.PublishedAt,
		"deleted_at":              mission.DeletedAt,
		"created_at":              mission.CreatedAt,
		"updated_at":              mission.UpdatedAt,
	}
}

func publishedRevisionMap(
	mission MissionDocument,
	publishedBy teacherclass.TeacherSummary,
) map[string]any {
	transferStatus := "complete"
	if attachmentsNeedTransfer(mission.Published.Attachments) {
		transferStatus = AttachmentStoragePending
	}

	return map[string]any{
		"class_id":                   mission.ClassID,
		"mission_id":                 mission.ID,
		"revision":                   mission.PublishedRevision,
		"snapshot":                   mission.Published,
		"attachment_transfer_status": transferStatus,
		"attachment_transfer_at":     mission.PublishedAt,
		"published_by":               publishedBy,
		"published_at":               mission.PublishedAt,
	}
}

func inheritStoredAttachments(
	attachments []MissionAttachment,
	mission MissionDocument,
) []MissionAttachment {
	storedByUUID := make(map[string]*MissionAttachmentStorage)
	collectStored := func(values []MissionAttachment) {
		for _, attachment := range values {
			if attachment.UploadcareUUID == "" || attachment.Storage == nil ||
				attachment.Storage.Status != AttachmentStorageStored || attachment.Storage.GSURI == "" {
				continue
			}

			storage := *attachment.Storage
			storedByUUID[attachment.UploadcareUUID] = &storage
		}
	}
	if mission.Published != nil {
		collectStored(mission.Published.Attachments)
	}
	if mission.Draft != nil {
		collectStored(mission.Draft.Attachments)
	}

	output := make([]MissionAttachment, len(attachments))
	copy(output, attachments)
	for index := range output {
		if stored, exists := storedByUUID[output[index].UploadcareUUID]; exists {
			storage := *stored
			output[index].Storage = &storage
		}
	}

	return output
}

func prepareAttachmentsForPublish(attachments []MissionAttachment, timestamp time.Time) {
	for index := range attachments {
		storage := attachments[index].Storage
		if storage != nil && storage.Status == AttachmentStorageStored && storage.GSURI != "" {
			continue
		}

		attachments[index].Storage = &MissionAttachmentStorage{
			Status:    AttachmentStoragePending,
			Retryable: true,
			UpdatedAt: timestamp,
		}
	}
}

func attachmentsNeedTransfer(attachments []MissionAttachment) bool {
	for _, attachment := range attachments {
		if attachment.Storage == nil || attachment.Storage.Status != AttachmentStorageStored || attachment.Storage.GSURI == "" {
			return true
		}
	}

	return false
}
