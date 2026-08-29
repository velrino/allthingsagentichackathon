package mission

import "testing"

func TestCreateMissionRequestAllowsEveryoneAudience(t *testing.T) {
	request := validCreateMissionRequest()
	request.AudienceType = AudienceAll

	if err := request.Validate(); err != nil {
		t.Fatalf("validate everyone audience: %v", err)
	}
}

func TestCreateMissionRequestRequiresSelectedStudents(t *testing.T) {
	request := validCreateMissionRequest()
	request.AudienceType = AudienceSelected

	if err := request.Validate(); err == nil {
		t.Fatal("expected selected audience without students to fail validation")
	}
}

func validCreateMissionRequest() CreateMissionRequest {
	return CreateMissionRequest{
		MissionName:   "Fractions review",
		Subject:       "Mathematics",
		LearningGoal:  "Review fraction operations",
		TeacherPrompt: "Help students explain each fraction step.",
	}
}
