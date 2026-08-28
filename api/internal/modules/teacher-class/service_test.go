package teacherclass

import (
	"regexp"
	"testing"
)

func TestGenerateClassCodeUsesReadableCharacters(t *testing.T) {
	pattern := regexp.MustCompile(`^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$`)

	for index := 0; index < 100; index++ {
		code, err := generateClassCode()
		if err != nil {
			t.Fatalf("generate class code: %v", err)
		}
		if !pattern.MatchString(code) {
			t.Fatalf("generated code %q is not readable", code)
		}
	}
}

func TestUpsertTeacherClassRequestAllowsGeneratedClassID(t *testing.T) {
	request := UpsertTeacherClassRequest{
		ClassName:  "Algebra Lab",
		Subject:    "Mathematics",
		GradeLevel: "7th grade",
	}

	if err := request.Validate(); err != nil {
		t.Fatalf("validate request without class id: %v", err)
	}
}

func TestUpsertTeacherClassRequestRejectsInvalidExistingClassID(t *testing.T) {
	request := UpsertTeacherClassRequest{
		ClassID:   "code with spaces",
		ClassName: "Algebra Lab",
		Subject:   "Mathematics",
	}

	if err := request.Validate(); err == nil {
		t.Fatal("expected invalid existing class id to fail validation")
	}
}
