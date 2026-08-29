package users

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"classgame-api/internal/modules/orchestrator"
)

const (
	usersCollectionName           = "users"
	studentAttemptsCollectionName = "student_mission_attempts"
)

type Repository struct {
	client *firestore.Client
}

func NewRepository(client *firestore.Client) *Repository {
	return &Repository{
		client: client,
	}
}

func (repository *Repository) UpsertStudent(
	ctx context.Context,
	input UpsertStudentInput,
) (UserDocument, error) {
	ref := repository.client.Collection(usersCollectionName).Doc(input.Identity.ProviderUserID)

	var user UserDocument
	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		now := input.Timestamp
		createdAt := now
		firstSeenAt := now
		loginCount := int64(1)
		currentGame := StudentGameSession{}
		learningMemory := StudentLearningMemory{}

		snapshot, err := tx.Get(ref)
		switch {
		case err == nil:
			var existing UserDocument
			if err := snapshot.DataTo(&existing); err != nil {
				return fmt.Errorf("decode existing user: %w", err)
			}

			if !existing.CreatedAt.IsZero() {
				createdAt = existing.CreatedAt
			}
			if !existing.Activity.FirstSeenAt.IsZero() {
				firstSeenAt = existing.Activity.FirstSeenAt
			}
			loginCount = existing.Activity.LoginCount + 1
			currentGame = existing.Activity.CurrentGame
			learningMemory = existing.Student.LearningMemory
		case status.Code(err) != codes.NotFound:
			return fmt.Errorf("read user: %w", err)
		}

		revisionChanged := currentGame.PublishedRevision > 0 &&
			currentGame.PublishedRevision != input.MissionPublishedRevision
		startNewRevision := currentGame.MissionID == input.MissionID &&
			revisionChanged && currentGame.Status == "completed"
		if currentGame.MissionID == input.MissionID && !startNewRevision {
			if currentGame.AttemptID == "" {
				currentGame.AttemptID = learningAttemptID(ref.ID, input.MissionID, input.MissionPublishedRevision)
			}
			if currentGame.PublishedRevision <= 0 {
				currentGame.PublishedRevision = input.MissionPublishedRevision
			}
			currentGame.LastHeartbeatAt = now
			if currentGame.Status == "" {
				currentGame.Status = "exploring"
			}
		} else {
			currentGame = StudentGameSession{
				AttemptID:         learningAttemptID(ref.ID, input.MissionID, input.MissionPublishedRevision),
				MissionID:         input.MissionID,
				PublishedRevision: input.MissionPublishedRevision,
				Subject:           input.MissionSubject,
				Status:            "exploring",
				StartedAt:         now,
				LastHeartbeatAt:   now,
			}
		}

		user = buildStudentUserDocument(buildStudentUserDocumentInput{
			ID:             ref.ID,
			Input:          input,
			CreatedAt:      createdAt,
			FirstSeenAt:    firstSeenAt,
			LoginCount:     loginCount,
			CurrentGame:    currentGame,
			LearningMemory: learningMemory,
		})

		if err := tx.Set(ref, user.firestoreMap(), firestore.MergeAll); err != nil {
			return fmt.Errorf("write user: %w", err)
		}

		return nil
	})
	if err != nil {
		return UserDocument{}, fmt.Errorf("upsert student user: %w", err)
	}

	return user, nil
}

func (repository *Repository) UpdateStudentPresence(
	ctx context.Context,
	input UpdateStudentPresenceInput,
) (UserDocument, error) {
	ref := repository.client.Collection(usersCollectionName).Doc(input.Identity.ProviderUserID)
	var user UserDocument

	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snapshot, err := tx.Get(ref)
		if status.Code(err) == codes.NotFound {
			return ErrStudentNotFound
		}
		if err != nil {
			return fmt.Errorf("read student user: %w", err)
		}
		if err := snapshot.DataTo(&user); err != nil {
			return fmt.Errorf("decode student user: %w", err)
		}
		if user.ID == "" {
			user.ID = ref.ID
		}
		if user.Activity.CurrentGame.MissionID != input.MissionID || user.Student.MissionID != input.MissionID {
			return ErrStudentMissionMismatch
		}

		startedAt := input.Timestamp
		publishedRevision := int64(0)
		publishedRevision = user.Activity.CurrentGame.PublishedRevision
		attemptID := user.Activity.CurrentGame.AttemptID
		if attemptID == "" {
			attemptID = learningAttemptID(user.ID, input.MissionID, publishedRevision)
		}
		if !user.Activity.CurrentGame.StartedAt.IsZero() {
			startedAt = user.Activity.CurrentGame.StartedAt
		}

		user.Activity.LastSeenAt = input.Timestamp
		user.Activity.CurrentGame = StudentGameSession{
			AttemptID:         attemptID,
			MissionID:         input.MissionID,
			PublishedRevision: publishedRevision,
			Subject:           input.Subject,
			StageID:           input.StageID,
			StageName:         input.StageName,
			Status:            input.Status,
			StartedAt:         startedAt,
			LastHeartbeatAt:   input.Timestamp,
		}
		user.UpdatedAt = input.Timestamp

		return tx.Set(ref, map[string]any{
			"activity": map[string]any{
				"last_seen_at": user.Activity.LastSeenAt,
				"current_game": user.Activity.CurrentGame.firestoreMap(),
			},
			"updated_at": user.UpdatedAt,
		}, firestore.MergeAll)
	})
	if err != nil {
		return UserDocument{}, fmt.Errorf("update student presence: %w", err)
	}

	return user, nil
}

func (repository *Repository) SaveStudentLearningSnapshot(
	ctx context.Context,
	input SaveStudentLearningSnapshotInput,
) (StudentMissionAttemptDocument, UserDocument, error) {
	userRef := repository.client.Collection(usersCollectionName).Doc(input.Identity.ProviderUserID)
	var attempt StudentMissionAttemptDocument
	var user UserDocument

	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		userSnapshot, err := tx.Get(userRef)
		if status.Code(err) == codes.NotFound {
			return ErrStudentNotFound
		}
		if err != nil {
			return fmt.Errorf("read student user: %w", err)
		}
		if err := userSnapshot.DataTo(&user); err != nil {
			return fmt.Errorf("decode student user: %w", err)
		}
		if user.ID == "" {
			user.ID = userRef.ID
		}
		if user.Activity.CurrentGame.MissionID != input.MissionID || user.Student.MissionID != input.MissionID {
			return ErrStudentMissionMismatch
		}

		attemptID := user.Activity.CurrentGame.AttemptID
		if attemptID == "" {
			attemptID = learningAttemptID(user.ID, input.MissionID, user.Activity.CurrentGame.PublishedRevision)
		}
		attemptRef := repository.client.Collection(studentAttemptsCollectionName).Doc(attemptID)
		createdAt := input.Timestamp
		startedAt := user.Activity.CurrentGame.StartedAt
		if startedAt.IsZero() {
			startedAt = input.Timestamp
		}
		completedAt := time.Time{}
		trace := input.Trace

		existingSnapshot, err := tx.Get(attemptRef)
		switch {
		case err == nil:
			var existing StudentMissionAttemptDocument
			if err := existingSnapshot.DataTo(&existing); err != nil {
				return fmt.Errorf("decode learning attempt: %w", err)
			}
			if !existing.CreatedAt.IsZero() {
				createdAt = existing.CreatedAt
			}
			if !existing.StartedAt.IsZero() {
				startedAt = existing.StartedAt
			}
			completedAt = existing.CompletedAt
			if existing.Trace.Finalized && existing.Trace.EventCount == len(input.Snapshot.Events) {
				trace = existing.Trace
			}
		case status.Code(err) != codes.NotFound:
			return fmt.Errorf("read learning attempt: %w", err)
		}

		if input.Status == "completed" && completedAt.IsZero() {
			completedAt = input.Timestamp
		}
		attempt = StudentMissionAttemptDocument{
			ID:                attemptID,
			StudentID:         user.ID,
			StudentName:       user.Student.StudentName,
			ClassID:           user.Student.ClassID,
			MissionID:         input.MissionID,
			MissionCode:       user.Student.MissionCode,
			PublishedRevision: user.Activity.CurrentGame.PublishedRevision,
			Subject:           user.Activity.CurrentGame.Subject,
			Status:            input.Status,
			Snapshot:          input.Snapshot,
			Trace:             trace,
			StartedAt:         startedAt,
			LastActivityAt:    input.Timestamp,
			CompletedAt:       completedAt,
			CreatedAt:         createdAt,
			UpdatedAt:         input.Timestamp,
		}

		user.Activity.LastSeenAt = input.Timestamp
		user.Activity.CurrentGame.AttemptID = attemptID
		user.Activity.CurrentGame.Status = input.Status
		user.Activity.CurrentGame.LastHeartbeatAt = input.Timestamp
		user.UpdatedAt = input.Timestamp

		if err := tx.Set(attemptRef, learningAttemptFirestoreMap(attempt), firestore.MergeAll); err != nil {
			return fmt.Errorf("write learning attempt: %w", err)
		}
		return tx.Set(userRef, map[string]any{
			"activity": map[string]any{
				"last_seen_at": user.Activity.LastSeenAt,
				"current_game": user.Activity.CurrentGame.firestoreMap(),
			},
			"updated_at": user.UpdatedAt,
		}, firestore.MergeAll)
	})
	if err != nil {
		return StudentMissionAttemptDocument{}, UserDocument{}, fmt.Errorf("save student learning snapshot: %w", err)
	}

	return attempt, user, nil
}

func (repository *Repository) GetCurrentStudentLearningAttempt(
	ctx context.Context,
	identityProviderUserID string,
	missionID string,
) (StudentMissionAttemptDocument, UserDocument, bool, error) {
	userRef := repository.client.Collection(usersCollectionName).Doc(identityProviderUserID)
	userSnapshot, err := userRef.Get(ctx)
	if status.Code(err) == codes.NotFound {
		return StudentMissionAttemptDocument{}, UserDocument{}, false, ErrStudentNotFound
	}
	if err != nil {
		return StudentMissionAttemptDocument{}, UserDocument{}, false, fmt.Errorf("read student user: %w", err)
	}

	var user UserDocument
	if err := userSnapshot.DataTo(&user); err != nil {
		return StudentMissionAttemptDocument{}, UserDocument{}, false, fmt.Errorf("decode student user: %w", err)
	}
	if user.ID == "" {
		user.ID = userRef.ID
	}
	if user.Activity.CurrentGame.MissionID != missionID || user.Student.MissionID != missionID {
		return StudentMissionAttemptDocument{}, user, false, ErrStudentMissionMismatch
	}

	attemptID := user.Activity.CurrentGame.AttemptID
	if attemptID == "" {
		attemptID = learningAttemptID(user.ID, missionID, user.Activity.CurrentGame.PublishedRevision)
	}
	attemptSnapshot, err := repository.client.Collection(studentAttemptsCollectionName).Doc(attemptID).Get(ctx)
	if status.Code(err) == codes.NotFound {
		return StudentMissionAttemptDocument{}, user, false, nil
	}
	if err != nil {
		return StudentMissionAttemptDocument{}, user, false, fmt.Errorf("read learning attempt: %w", err)
	}

	var attempt StudentMissionAttemptDocument
	if err := attemptSnapshot.DataTo(&attempt); err != nil {
		return StudentMissionAttemptDocument{}, user, false, fmt.Errorf("decode learning attempt: %w", err)
	}
	if attempt.ID == "" {
		attempt.ID = attemptSnapshot.Ref.ID
	}
	if attempt.StudentID != user.ID {
		return StudentMissionAttemptDocument{}, user, false, ErrStudentMissionMismatch
	}

	return attempt, user, true, nil
}

func (repository *Repository) FinalizeStudentLearningTrace(
	ctx context.Context,
	studentID string,
	attemptID string,
	trace orchestrator.LearningTraceBlueprint,
	memory StudentLearningMemory,
	timestamp time.Time,
) (StudentMissionAttemptDocument, error) {
	userRef := repository.client.Collection(usersCollectionName).Doc(studentID)
	attemptRef := repository.client.Collection(studentAttemptsCollectionName).Doc(attemptID)
	var attempt StudentMissionAttemptDocument

	err := repository.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		userSnapshot, err := tx.Get(userRef)
		if status.Code(err) == codes.NotFound {
			return ErrStudentNotFound
		}
		if err != nil {
			return fmt.Errorf("read student user: %w", err)
		}
		var user UserDocument
		if err := userSnapshot.DataTo(&user); err != nil {
			return fmt.Errorf("decode student user: %w", err)
		}

		attemptSnapshot, err := tx.Get(attemptRef)
		if status.Code(err) == codes.NotFound {
			return ErrStudentAttemptNotFound
		}
		if err != nil {
			return fmt.Errorf("read learning attempt: %w", err)
		}
		if err := attemptSnapshot.DataTo(&attempt); err != nil {
			return fmt.Errorf("decode learning attempt: %w", err)
		}
		if attempt.StudentID != studentID {
			return ErrStudentMissionMismatch
		}

		attempt.Trace = trace
		attempt.UpdatedAt = timestamp
		memory.UpdatedAt = timestamp

		if err := tx.Set(attemptRef, map[string]any{
			"trace":      trace,
			"updated_at": timestamp,
		}, firestore.MergeAll); err != nil {
			return fmt.Errorf("write learning trace: %w", err)
		}
		return tx.Set(userRef, map[string]any{
			"student": map[string]any{
				"learning_memory": memory,
			},
			"updated_at": timestamp,
		}, firestore.MergeAll)
	})
	if err != nil {
		return StudentMissionAttemptDocument{}, fmt.Errorf("finalize student learning trace: %w", err)
	}

	return attempt, nil
}

type buildStudentUserDocumentInput struct {
	ID             string
	Input          UpsertStudentInput
	CreatedAt      time.Time
	FirstSeenAt    time.Time
	LoginCount     int64
	CurrentGame    StudentGameSession
	LearningMemory StudentLearningMemory
}

func buildStudentUserDocument(input buildStudentUserDocumentInput) UserDocument {
	identity := input.Input.Identity
	now := input.Input.Timestamp

	return UserDocument{
		ID: input.ID,
		Identity: UserIdentity{
			Provider:       identity.Provider,
			ProviderUserID: identity.ProviderUserID,
			AuthMethod:     identity.AuthMethod,
			ProviderIDs:    identity.ProviderIDs,
			SignInProvider: identity.SignInProvider,
			CustomClaims:   identity.CustomClaims,
			Token: IdentityToken{
				AuthTime:  identity.TokenAuthTime,
				ExpiresAt: identity.TokenExpiresAt,
				IssuedAt:  identity.TokenIssuedAt,
				Issuer:    identity.TokenIssuer,
				Audience:  identity.TokenAudience,
			},
		},
		Profile: UserProfile{
			DisplayName:   input.Input.StudentName,
			Email:         identity.Email,
			EmailVerified: identity.EmailVerified,
			PhotoURL:      identity.PhotoURL,
		},
		Student: StudentProfile{
			ClassID:        input.Input.ClassID,
			MissionID:      input.Input.MissionID,
			MissionCode:    input.Input.MissionCode,
			StudentName:    input.Input.StudentName,
			LearningMemory: input.LearningMemory,
		},
		Activity: UserActivity{
			FirstSeenAt: input.FirstSeenAt,
			LastSeenAt:  now,
			LoginCount:  input.LoginCount,
			CurrentGame: input.CurrentGame,
		},
		Roles:     []UserRole{UserRoleStudent},
		IsGuest:   true,
		CreatedAt: input.CreatedAt,
		UpdatedAt: now,
	}
}

func (user UserDocument) firestoreMap() map[string]any {
	return map[string]any{
		"id": user.ID,
		"identity": map[string]any{
			"provider":         user.Identity.Provider,
			"provider_user_id": user.Identity.ProviderUserID,
			"auth_method":      user.Identity.AuthMethod,
			"provider_ids":     user.Identity.ProviderIDs,
			"sign_in_provider": user.Identity.SignInProvider,
			"custom_claims":    user.Identity.CustomClaims,
			"token": map[string]any{
				"auth_time":  user.Identity.Token.AuthTime,
				"expires_at": user.Identity.Token.ExpiresAt,
				"issued_at":  user.Identity.Token.IssuedAt,
				"issuer":     user.Identity.Token.Issuer,
				"audience":   user.Identity.Token.Audience,
			},
		},
		"profile": map[string]any{
			"display_name":   user.Profile.DisplayName,
			"email":          user.Profile.Email,
			"email_verified": user.Profile.EmailVerified,
			"photo_url":      user.Profile.PhotoURL,
		},
		"student": map[string]any{
			"class_id":        user.Student.ClassID,
			"mission_id":      user.Student.MissionID,
			"mission_code":    user.Student.MissionCode,
			"student_name":    user.Student.StudentName,
			"learning_memory": user.Student.LearningMemory,
		},
		"activity": map[string]any{
			"first_seen_at": user.Activity.FirstSeenAt,
			"last_seen_at":  user.Activity.LastSeenAt,
			"login_count":   user.Activity.LoginCount,
			"current_game":  user.Activity.CurrentGame.firestoreMap(),
		},
		"roles":      user.Roles,
		"is_guest":   user.IsGuest,
		"deleted_at": user.DeletedAt,
		"created_at": user.CreatedAt,
		"updated_at": user.UpdatedAt,
	}
}

func (session StudentGameSession) firestoreMap() map[string]any {
	return map[string]any{
		"attempt_id":         session.AttemptID,
		"mission_id":         session.MissionID,
		"published_revision": session.PublishedRevision,
		"subject":            session.Subject,
		"stage_id":           session.StageID,
		"stage_name":         session.StageName,
		"status":             session.Status,
		"started_at":         session.StartedAt,
		"last_heartbeat_at":  session.LastHeartbeatAt,
	}
}

func learningAttemptID(studentID string, missionID string, revision int64) string {
	digest := sha256.Sum256([]byte(fmt.Sprintf("%s:%s:%d", studentID, missionID, revision)))

	return fmt.Sprintf("attempt-%x", digest[:12])
}

func learningAttemptFirestoreMap(attempt StudentMissionAttemptDocument) map[string]any {
	return map[string]any{
		"id":                 attempt.ID,
		"student_id":         attempt.StudentID,
		"student_name":       attempt.StudentName,
		"class_id":           attempt.ClassID,
		"mission_id":         attempt.MissionID,
		"mission_code":       attempt.MissionCode,
		"published_revision": attempt.PublishedRevision,
		"subject":            attempt.Subject,
		"status":             attempt.Status,
		"snapshot":           attempt.Snapshot,
		"trace":              attempt.Trace,
		"started_at":         attempt.StartedAt,
		"last_activity_at":   attempt.LastActivityAt,
		"completed_at":       attempt.CompletedAt,
		"created_at":         attempt.CreatedAt,
		"updated_at":         attempt.UpdatedAt,
	}
}
