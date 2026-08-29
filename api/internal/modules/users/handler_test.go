package users

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"

	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

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

func TestPostStudentSessionValidationDoesNotRequireFirebaseAuth(t *testing.T) {
	service := &fakeUsersService{}
	recorder := postStudentSessionValidation(t, &Handler{
		usersService: service,
	}, `{"mission_code":"abc234"}`)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d; body = %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	if service.validatedMissionCode != "ABC234" {
		t.Fatalf("validated mission code = %q, want %q", service.validatedMissionCode, "ABC234")
	}
	if service.upsertCalled {
		t.Fatal("student validation should not create or update a user")
	}
}

func TestPostStudentSessionValidationReturnsMissionNotFound(t *testing.T) {
	recorder := postStudentSessionValidation(t, &Handler{
		usersService: &fakeUsersService{validateErr: ErrMissionCodeNotFound},
	}, `{"mission_code":"ABC234"}`)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status code = %d, want %d; body = %s", recorder.Code, http.StatusNotFound, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"mission_not_found"`) {
		t.Fatalf("expected mission_not_found response, got %s", recorder.Body.String())
	}
}

func postStudentSessionValidation(t *testing.T, handler *Handler, body string) *httptest.ResponseRecorder {
	t.Helper()

	server := echo.New()
	request := httptest.NewRequest(http.MethodPost, "/users/student-session/validate", strings.NewReader(body))
	request.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	recorder := httptest.NewRecorder()
	ctx := server.NewContext(request, recorder)

	if err := handler.PostStudentSessionValidation(ctx); err != nil {
		t.Fatalf("post student session validation: %v", err)
	}

	return recorder
}

type fakeUsersService struct {
	validateErr          error
	validatedMissionCode string
	upsertCalled         bool
}

func (service *fakeUsersService) UpsertStudent(
	context.Context,
	sharedfirebase.Identity,
	string,
	string,
) (UserDocument, error) {
	service.upsertCalled = true
	return UserDocument{}, nil
}

func (service *fakeUsersService) ValidateStudentMissionCode(
	_ context.Context,
	missionCode string,
) error {
	service.validatedMissionCode = missionCode
	return service.validateErr
}

func (service *fakeUsersService) UpdateStudentPresence(
	context.Context,
	sharedfirebase.Identity,
	string,
	string,
	string,
	string,
	string,
) (UserDocument, error) {
	return UserDocument{}, nil
}
