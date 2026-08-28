package users

import (
	"time"

	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

type UserRole string

const (
	UserRoleStudent UserRole = "student"
	UserRoleTeacher UserRole = "teacher"
)

type UserDocument struct {
	ID        string         `firestore:"id" json:"id"`
	Identity  UserIdentity   `firestore:"identity" json:"identity"`
	Profile   UserProfile    `firestore:"profile" json:"profile"`
	Student   StudentProfile `firestore:"student" json:"student"`
	Activity  UserActivity   `firestore:"activity" json:"activity"`
	Roles     []UserRole     `firestore:"roles" json:"roles"`
	IsGuest   bool           `firestore:"is_guest" json:"is_guest"`
	DeletedAt *time.Time     `firestore:"deleted_at" json:"deleted_at"`
	CreatedAt time.Time      `firestore:"created_at" json:"created_at"`
	UpdatedAt time.Time      `firestore:"updated_at" json:"updated_at"`
}

type UserIdentity struct {
	Provider       sharedfirebase.IdentityProvider `firestore:"provider" json:"provider"`
	ProviderUserID string                          `firestore:"provider_user_id" json:"provider_user_id"`
	AuthMethod     sharedfirebase.AuthMethod       `firestore:"auth_method" json:"auth_method"`
	ProviderIDs    []string                        `firestore:"provider_ids" json:"provider_ids"`
	SignInProvider string                          `firestore:"sign_in_provider" json:"sign_in_provider"`
	CustomClaims   map[string]interface{}          `firestore:"custom_claims" json:"custom_claims"`
	Token          IdentityToken                   `firestore:"token" json:"token"`
}

type IdentityToken struct {
	AuthTime  int64  `firestore:"auth_time" json:"auth_time"`
	ExpiresAt int64  `firestore:"expires_at" json:"expires_at"`
	IssuedAt  int64  `firestore:"issued_at" json:"issued_at"`
	Issuer    string `firestore:"issuer" json:"issuer"`
	Audience  string `firestore:"audience" json:"audience"`
}

type UserProfile struct {
	DisplayName   string `firestore:"display_name" json:"display_name"`
	Email         string `firestore:"email" json:"email"`
	EmailVerified bool   `firestore:"email_verified" json:"email_verified"`
	PhotoURL      string `firestore:"photo_url" json:"photo_url"`
}

type StudentProfile struct {
	TurmaID     string `firestore:"turma_id" json:"turma_id"`
	StudentName string `firestore:"student_name" json:"student_name"`
}

type UserActivity struct {
	FirstSeenAt time.Time `firestore:"first_seen_at" json:"first_seen_at"`
	LastSeenAt  time.Time `firestore:"last_seen_at" json:"last_seen_at"`
	LoginCount  int64     `firestore:"login_count" json:"login_count"`
}

type UpsertStudentInput struct {
	Identity    sharedfirebase.Identity
	TurmaID     string
	StudentName string
	Timestamp   time.Time
}
