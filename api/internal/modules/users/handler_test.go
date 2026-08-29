package users

import "testing"

func TestStudentSessionRequestAcceptsMissionCode(t *testing.T) {
	request := StudentSessionRequest{
		MissionCode: "ABC234",
		StudentName: "Alex",
	}

	if err := request.Validate(); err != nil {
		t.Fatalf("validate mission code: %v", err)
	}
}

func TestStudentSessionRequestRejectsClassStyleID(t *testing.T) {
	request := StudentSessionRequest{
		MissionCode: "class-with-long-id",
		StudentName: "Alex",
	}

	if err := request.Validate(); err == nil {
		t.Fatal("expected class-style id to fail mission code validation")
	}
}
