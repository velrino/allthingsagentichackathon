package teacherclass

import "time"

type TeacherClassResponse struct {
	ID               string          `json:"id"`
	ClassID          string          `json:"class_id"`
	ClassCode        string          `json:"class_code"`
	ClassName        string          `json:"class_name"`
	Subject          string          `json:"subject"`
	GradeLevel       string          `json:"grade_level"`
	TeacherID        string          `json:"teacher_id"`
	Teacher          TeacherResponse `json:"teacher"`
	ActiveActivityID string          `json:"active_activity_id"`
	ActivityCount    int64           `json:"activity_count"`
	Status           string          `json:"status"`
	CreatedAt        string          `json:"created_at"`
	UpdatedAt        string          `json:"updated_at"`
}

type TeacherResponse struct {
	ProviderUserID string `json:"provider_user_id"`
	DisplayName    string `json:"display_name"`
	Email          string `json:"email"`
	PhotoURL       string `json:"photo_url"`
}

func ToResponse(teacherClass TeacherClassDocument) TeacherClassResponse {
	return TeacherClassResponse{
		ID:               teacherClass.ID,
		ClassID:          teacherClass.ClassID,
		ClassCode:        teacherClass.ClassCode,
		ClassName:        teacherClass.ClassName,
		Subject:          teacherClass.Subject,
		GradeLevel:       teacherClass.GradeLevel,
		TeacherID:        teacherClass.TeacherID,
		Teacher:          toTeacherResponse(teacherClass.Teacher),
		ActiveActivityID: teacherClass.ActiveActivityID,
		ActivityCount:    teacherClass.ActivityCount,
		Status:           teacherClass.Status,
		CreatedAt:        formatTime(teacherClass.CreatedAt),
		UpdatedAt:        formatTime(teacherClass.UpdatedAt),
	}
}

func ToResponses(teacherClasses []TeacherClassDocument) []TeacherClassResponse {
	responses := make([]TeacherClassResponse, 0, len(teacherClasses))
	for _, teacherClass := range teacherClasses {
		responses = append(responses, ToResponse(teacherClass))
	}

	return responses
}

func toTeacherResponse(teacher TeacherSummary) TeacherResponse {
	return TeacherResponse{
		ProviderUserID: teacher.ProviderUserID,
		DisplayName:    teacher.DisplayName,
		Email:          teacher.Email,
		PhotoURL:       teacher.PhotoURL,
	}
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}

	return value.UTC().Format(time.RFC3339Nano)
}
