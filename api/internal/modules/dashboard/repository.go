package dashboard

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"classgame-api/internal/modules/users"
)

type Repository struct {
	client *firestore.Client
}

func NewRepository(client *firestore.Client) *Repository {
	return &Repository{
		client: client,
	}
}

func (repository *Repository) UpsertTeacher(
	ctx context.Context,
	identity TeacherIdentity,
	timestamp time.Time,
) (TeacherSummary, error) {
	ref := repository.client.Collection(teachersCollectionName).Doc(identity.ProviderUserID)
	summary := teacherSummaryFromIdentity(identity)

	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		createdAt := timestamp
		firstSeenAt := timestamp
		loginCount := int64(1)

		snapshot, err := tx.Get(ref)
		switch {
		case err == nil:
			var existing TeacherDocument
			if err := snapshot.DataTo(&existing); err != nil {
				return fmt.Errorf("decode teacher: %w", err)
			}

			if !existing.CreatedAt.IsZero() {
				createdAt = existing.CreatedAt
			}
			if !existing.Activity.FirstSeenAt.IsZero() {
				firstSeenAt = existing.Activity.FirstSeenAt
			}
			loginCount = existing.Activity.LoginCount + 1
		case status.Code(err) != codes.NotFound:
			return fmt.Errorf("read teacher: %w", err)
		}

		return tx.Set(ref, map[string]any{
			"id": ref.ID,
			"identity": map[string]any{
				"provider":         identity.Provider,
				"provider_user_id": identity.ProviderUserID,
				"auth_method":      identity.AuthMethod,
				"email":            identity.Email,
				"email_verified":   identity.EmailVerified,
				"display_name":     identity.DisplayName,
				"photo_url":        identity.PhotoURL,
				"provider_ids":     identity.ProviderIDs,
				"sign_in_provider": identity.SignInProvider,
			},
			"profile": summary.firestoreMap(),
			"roles":   []string{"teacher"},
			"activity": map[string]any{
				"first_seen_at": firstSeenAt,
				"last_seen_at":  timestamp,
				"login_count":   loginCount,
			},
			"created_at": createdAt,
			"updated_at": timestamp,
		}, firestore.MergeAll)
	})
	if err != nil {
		return TeacherSummary{}, fmt.Errorf("upsert teacher: %w", err)
	}

	return summary, nil
}

func (repository *Repository) ListStudentsByClassID(
	ctx context.Context,
	classID string,
) ([]studentUserDocument, error) {
	iter := repository.client.Collection(usersCollectionName).
		Where("student.class_id", "==", classID).
		Documents(ctx)
	defer iter.Stop()

	students := make([]studentUserDocument, 0)
	for {
		snapshot, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("iterate students: %w", err)
		}

		var user studentUserDocument
		if err := snapshot.DataTo(&user); err != nil {
			return nil, fmt.Errorf("decode student user %s: %w", snapshot.Ref.ID, err)
		}
		if user.ID == "" {
			user.ID = snapshot.Ref.ID
		}
		if !slices.Contains(user.Roles, "student") {
			continue
		}

		students = append(students, user)
	}

	return students, nil
}

func (repository *Repository) ListLearningAttemptsByClassID(
	ctx context.Context,
	classID string,
) ([]users.StudentMissionAttemptDocument, error) {
	iter := repository.client.Collection("student_mission_attempts").
		Where("class_id", "==", classID).
		Limit(500).
		Documents(ctx)
	defer iter.Stop()

	attempts := make([]users.StudentMissionAttemptDocument, 0)
	for {
		snapshot, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("iterate student learning attempts: %w", err)
		}

		var attempt users.StudentMissionAttemptDocument
		if err := snapshot.DataTo(&attempt); err != nil {
			return nil, fmt.Errorf("decode student learning attempt %s: %w", snapshot.Ref.ID, err)
		}
		if attempt.ID == "" {
			attempt.ID = snapshot.Ref.ID
		}
		attempts = append(attempts, attempt)
	}

	return attempts, nil
}

func (teacher TeacherSummary) firestoreMap() map[string]any {
	return map[string]any{
		"provider_user_id": teacher.ProviderUserID,
		"display_name":     teacher.DisplayName,
		"email":            teacher.Email,
		"photo_url":        teacher.PhotoURL,
	}
}

func teacherSummaryFromIdentity(identity TeacherIdentity) TeacherSummary {
	displayName := identity.DisplayName
	if displayName == "" {
		displayName = identity.Email
	}

	return TeacherSummary{
		ProviderUserID: identity.ProviderUserID,
		DisplayName:    displayName,
		Email:          identity.Email,
		PhotoURL:       identity.PhotoURL,
	}
}
