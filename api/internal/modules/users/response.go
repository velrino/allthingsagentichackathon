package users

import "time"

type UserResponse struct {
	ID        string                 `json:"id"`
	Identity  UserIdentityResponse   `json:"identity"`
	Profile   UserProfileResponse    `json:"profile"`
	Student   StudentProfileResponse `json:"student"`
	Activity  UserActivityResponse   `json:"activity"`
	Roles     []UserRole             `json:"roles"`
	IsGuest   bool                   `json:"is_guest"`
	DeletedAt *string                `json:"deleted_at"`
	CreatedAt string                 `json:"created_at"`
	UpdatedAt string                 `json:"updated_at"`
}

type UserIdentityResponse struct {
	Provider       string `json:"provider"`
	ProviderUserID string `json:"provider_user_id"`
	AuthMethod     string `json:"auth_method"`
	SignInProvider string `json:"sign_in_provider"`
}

type UserProfileResponse struct {
	DisplayName   string `json:"display_name"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	PhotoURL      string `json:"photo_url"`
}

type StudentProfileResponse struct {
	ClassID     string `json:"class_id"`
	MissionID   string `json:"mission_id"`
	MissionCode string `json:"mission_code"`
	StudentName string `json:"student_name"`
}

type UserActivityResponse struct {
	FirstSeenAt string                     `json:"first_seen_at"`
	LastSeenAt  string                     `json:"last_seen_at"`
	LoginCount  int64                      `json:"login_count"`
	CurrentGame StudentGameSessionResponse `json:"current_game"`
}

type StudentGameSessionResponse struct {
	MissionID       string `json:"mission_id"`
	Subject         string `json:"subject"`
	StageID         string `json:"stage_id"`
	StageName       string `json:"stage_name"`
	Status          string `json:"status"`
	StartedAt       string `json:"started_at"`
	LastHeartbeatAt string `json:"last_heartbeat_at"`
}

func ToResponse(user UserDocument) UserResponse {
	return UserResponse{
		ID: user.ID,
		Identity: UserIdentityResponse{
			Provider:       string(user.Identity.Provider),
			ProviderUserID: user.Identity.ProviderUserID,
			AuthMethod:     string(user.Identity.AuthMethod),
			SignInProvider: user.Identity.SignInProvider,
		},
		Profile: UserProfileResponse{
			DisplayName:   user.Profile.DisplayName,
			Email:         user.Profile.Email,
			EmailVerified: user.Profile.EmailVerified,
			PhotoURL:      user.Profile.PhotoURL,
		},
		Student: StudentProfileResponse{
			ClassID:     user.Student.ClassID,
			MissionID:   user.Student.MissionID,
			MissionCode: user.Student.MissionCode,
			StudentName: user.Student.StudentName,
		},
		Activity: UserActivityResponse{
			FirstSeenAt: formatTime(user.Activity.FirstSeenAt),
			LastSeenAt:  formatTime(user.Activity.LastSeenAt),
			LoginCount:  user.Activity.LoginCount,
			CurrentGame: StudentGameSessionResponse{
				MissionID:       user.Activity.CurrentGame.MissionID,
				Subject:         user.Activity.CurrentGame.Subject,
				StageID:         user.Activity.CurrentGame.StageID,
				StageName:       user.Activity.CurrentGame.StageName,
				Status:          user.Activity.CurrentGame.Status,
				StartedAt:       formatTime(user.Activity.CurrentGame.StartedAt),
				LastHeartbeatAt: formatTime(user.Activity.CurrentGame.LastHeartbeatAt),
			},
		},
		Roles:     user.Roles,
		IsGuest:   user.IsGuest,
		DeletedAt: optionalTime(user.DeletedAt),
		CreatedAt: formatTime(user.CreatedAt),
		UpdatedAt: formatTime(user.UpdatedAt),
	}
}

func optionalTime(value *time.Time) *string {
	if value == nil {
		return nil
	}

	formatted := formatTime(*value)
	return &formatted
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}

	return value.UTC().Format(time.RFC3339Nano)
}
