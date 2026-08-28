package teacherclass

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var (
	ErrClassOwnedByAnotherTeacher = errors.New("teacher class belongs to another teacher")
	ErrClassCodeUnavailable       = errors.New("teacher class code is unavailable")
	ErrClassNotFound              = errors.New("teacher class not found")
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
) (TeacherClassDocument, bool, error) {
	snapshot, err := repository.client.Collection(CollectionName).Doc(classID).Get(ctx)
	if status.Code(err) == codes.NotFound {
		return TeacherClassDocument{}, false, nil
	}
	if err != nil {
		return TeacherClassDocument{}, false, fmt.Errorf("read teacher class: %w", err)
	}

	var teacherClass TeacherClassDocument
	if err := snapshot.DataTo(&teacherClass); err != nil {
		return TeacherClassDocument{}, false, fmt.Errorf("decode teacher class: %w", err)
	}
	if teacherClass.ID == "" {
		teacherClass.ID = snapshot.Ref.ID
	}

	return teacherClass, true, nil
}

func (repository *Repository) ListByTeacherID(
	ctx context.Context,
	teacherID string,
) ([]TeacherClassDocument, error) {
	iter := repository.client.Collection(CollectionName).
		Where("teacher_id", "==", teacherID).
		Documents(ctx)
	defer iter.Stop()

	teacherClasses := make([]TeacherClassDocument, 0)
	for {
		snapshot, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("iterate teacher classes: %w", err)
		}

		var teacherClass TeacherClassDocument
		if err := snapshot.DataTo(&teacherClass); err != nil {
			return nil, fmt.Errorf("decode teacher class %s: %w", snapshot.Ref.ID, err)
		}
		if teacherClass.ID == "" {
			teacherClass.ID = snapshot.Ref.ID
		}

		teacherClasses = append(teacherClasses, teacherClass)
	}

	sort.SliceStable(teacherClasses, func(leftIndex, rightIndex int) bool {
		return teacherClasses[leftIndex].UpdatedAt.After(teacherClasses[rightIndex].UpdatedAt)
	})

	return teacherClasses, nil
}

func (repository *Repository) Upsert(
	ctx context.Context,
	input UpsertTeacherClassInput,
) (TeacherClassDocument, error) {
	ref := repository.client.Collection(CollectionName).Doc(input.ClassID)

	var teacherClass TeacherClassDocument
	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		createdAt := input.Timestamp
		activityCount := int64(0)
		activeActivityID := ""

		snapshot, err := tx.Get(ref)
		switch {
		case err == nil:
			var existing TeacherClassDocument
			if err := snapshot.DataTo(&existing); err != nil {
				return fmt.Errorf("decode teacher class: %w", err)
			}
			if existing.TeacherID != "" && existing.TeacherID != input.Teacher.ProviderUserID {
				return ErrClassOwnedByAnotherTeacher
			}
			if !existing.CreatedAt.IsZero() {
				createdAt = existing.CreatedAt
			}
			activityCount = existing.ActivityCount
			activeActivityID = existing.ActiveActivityID
		case status.Code(err) != codes.NotFound:
			return fmt.Errorf("read teacher class: %w", err)
		}

		teacherClass = newTeacherClassDocument(input, createdAt, activeActivityID, activityCount)

		return tx.Set(ref, teacherClass.firestoreMap(), firestore.MergeAll)
	})
	if err != nil {
		return TeacherClassDocument{}, fmt.Errorf("upsert teacher class: %w", err)
	}

	return teacherClass, nil
}

func (repository *Repository) Create(
	ctx context.Context,
	input UpsertTeacherClassInput,
) (TeacherClassDocument, error) {
	ref := repository.client.Collection(CollectionName).Doc(input.ClassID)
	teacherClass := newTeacherClassDocument(input, input.Timestamp, "", 0)

	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		_, err := tx.Get(ref)
		switch {
		case err == nil:
			return ErrClassCodeUnavailable
		case status.Code(err) != codes.NotFound:
			return fmt.Errorf("check teacher class code: %w", err)
		}

		return tx.Create(ref, teacherClass.firestoreMap())
	})
	if err != nil {
		return TeacherClassDocument{}, fmt.Errorf("create teacher class: %w", err)
	}

	return teacherClass, nil
}

func (repository *Repository) SetActiveActivity(
	ctx context.Context,
	classID string,
	teacherID string,
	activityID string,
	timestamp time.Time,
) error {
	ref := repository.client.Collection(CollectionName).Doc(classID)

	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snapshot, err := tx.Get(ref)
		if status.Code(err) == codes.NotFound {
			return ErrClassNotFound
		}
		if err != nil {
			return fmt.Errorf("read teacher class: %w", err)
		}

		var teacherClass TeacherClassDocument
		if err := snapshot.DataTo(&teacherClass); err != nil {
			return fmt.Errorf("decode teacher class: %w", err)
		}
		if teacherClass.TeacherID != teacherID {
			return ErrClassOwnedByAnotherTeacher
		}

		update := map[string]any{
			"active_activity_id": activityID,
			"updated_at":         timestamp,
		}
		if teacherClass.ActiveActivityID != activityID {
			update["activity_count"] = firestore.Increment(1)
		}

		return tx.Set(ref, update, firestore.MergeAll)
	})
	if err != nil {
		return fmt.Errorf("set active activity: %w", err)
	}

	return nil
}

func (teacherClass TeacherClassDocument) firestoreMap() map[string]any {
	return map[string]any{
		"id":                 teacherClass.ID,
		"class_id":           teacherClass.ClassID,
		"class_code":         teacherClass.ClassCode,
		"class_name":         teacherClass.ClassName,
		"subject":            teacherClass.Subject,
		"grade_level":        teacherClass.GradeLevel,
		"teacher_id":         teacherClass.TeacherID,
		"teacher":            teacherClass.Teacher.firestoreMap(),
		"active_activity_id": teacherClass.ActiveActivityID,
		"activity_count":     teacherClass.ActivityCount,
		"status":             teacherClass.Status,
		"created_at":         teacherClass.CreatedAt,
		"updated_at":         teacherClass.UpdatedAt,
	}
}

func newTeacherClassDocument(
	input UpsertTeacherClassInput,
	createdAt time.Time,
	activeActivityID string,
	activityCount int64,
) TeacherClassDocument {
	return TeacherClassDocument{
		ID:               input.ClassID,
		ClassID:          input.ClassID,
		ClassCode:        input.ClassID,
		ClassName:        input.ClassName,
		Subject:          input.Subject,
		GradeLevel:       input.GradeLevel,
		TeacherID:        input.Teacher.ProviderUserID,
		Teacher:          input.Teacher,
		ActiveActivityID: activeActivityID,
		ActivityCount:    activityCount,
		Status:           "active",
		CreatedAt:        createdAt,
		UpdatedAt:        input.Timestamp,
	}
}

func (teacher TeacherSummary) firestoreMap() map[string]any {
	return map[string]any{
		"provider_user_id": teacher.ProviderUserID,
		"display_name":     teacher.DisplayName,
		"email":            teacher.Email,
		"photo_url":        teacher.PhotoURL,
	}
}
