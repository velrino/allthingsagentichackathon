package users

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const usersCollectionName = "users"

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
		case status.Code(err) != codes.NotFound:
			return fmt.Errorf("read user: %w", err)
		}

		if currentGame.MissionID == input.MissionID {
			currentGame.LastHeartbeatAt = now
			if currentGame.Status == "" {
				currentGame.Status = "exploring"
			}
		} else {
			currentGame = StudentGameSession{
				MissionID:       input.MissionID,
				Subject:         input.MissionSubject,
				Status:          "exploring",
				StartedAt:       now,
				LastHeartbeatAt: now,
			}
		}

		user = buildStudentUserDocument(buildStudentUserDocumentInput{
			ID:          ref.ID,
			Input:       input,
			CreatedAt:   createdAt,
			FirstSeenAt: firstSeenAt,
			LoginCount:  loginCount,
			CurrentGame: currentGame,
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

		startedAt := input.Timestamp
		if user.Activity.CurrentGame.MissionID == input.MissionID && !user.Activity.CurrentGame.StartedAt.IsZero() {
			startedAt = user.Activity.CurrentGame.StartedAt
		}

		user.Activity.LastSeenAt = input.Timestamp
		user.Activity.CurrentGame = StudentGameSession{
			MissionID:       input.MissionID,
			Subject:         input.Subject,
			StageID:         input.StageID,
			StageName:       input.StageName,
			Status:          input.Status,
			StartedAt:       startedAt,
			LastHeartbeatAt: input.Timestamp,
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

type buildStudentUserDocumentInput struct {
	ID          string
	Input       UpsertStudentInput
	CreatedAt   time.Time
	FirstSeenAt time.Time
	LoginCount  int64
	CurrentGame StudentGameSession
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
			ClassID:     input.Input.ClassID,
			MissionID:   input.Input.MissionID,
			MissionCode: input.Input.MissionCode,
			StudentName: input.Input.StudentName,
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
			"class_id":     user.Student.ClassID,
			"mission_id":   user.Student.MissionID,
			"mission_code": user.Student.MissionCode,
			"student_name": user.Student.StudentName,
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
		"mission_id":        session.MissionID,
		"subject":           session.Subject,
		"stage_id":          session.StageID,
		"stage_name":        session.StageName,
		"status":            session.Status,
		"started_at":        session.StartedAt,
		"last_heartbeat_at": session.LastHeartbeatAt,
	}
}
