package teacherclass

import (
	"time"

	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

const CollectionName = "teacher_classes"

type TeacherSummary struct {
	ProviderUserID string `firestore:"provider_user_id" json:"provider_user_id"`
	DisplayName    string `firestore:"display_name" json:"display_name"`
	Email          string `firestore:"email" json:"email"`
	PhotoURL       string `firestore:"photo_url" json:"photo_url"`
}

type TeacherClassDocument struct {
	ID               string         `firestore:"id" json:"id"`
	ClassID          string         `firestore:"class_id" json:"class_id"`
	ClassCode        string         `firestore:"class_code" json:"class_code"`
	ClassName        string         `firestore:"class_name" json:"class_name"`
	Subject          string         `firestore:"subject" json:"subject"`
	GradeLevel       string         `firestore:"grade_level" json:"grade_level"`
	TeacherID        string         `firestore:"teacher_id" json:"teacher_id"`
	Teacher          TeacherSummary `firestore:"teacher" json:"teacher"`
	ActiveActivityID string         `firestore:"active_activity_id" json:"active_activity_id"`
	ActivityCount    int64          `firestore:"activity_count" json:"activity_count"`
	Status           string         `firestore:"status" json:"status"`
	CreatedAt        time.Time      `firestore:"created_at" json:"created_at"`
	UpdatedAt        time.Time      `firestore:"updated_at" json:"updated_at"`
}

type UpsertTeacherClassInput struct {
	ClassID    string
	ClassName  string
	Subject    string
	GradeLevel string
	Teacher    TeacherSummary
	Timestamp  time.Time
}

type TeacherIdentity struct {
	Provider       sharedfirebase.IdentityProvider
	ProviderUserID string
	AuthMethod     sharedfirebase.AuthMethod
	Email          string
	EmailVerified  bool
	DisplayName    string
	PhotoURL       string
	ProviderIDs    []string
	SignInProvider string
}
