package users

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v5"

	sharedfirebase "classgame-api/internal/shared/google/firebase"
	sharedratelimit "classgame-api/internal/shared/ratelimit"
)

func TestStudentSessionRequestAcceptsNumericMissionCode(t *testing.T) {
	request := StudentSessionRequest{
		MissionCode: "123456",
		StudentName: "Alex",
	}

	if err := request.Validate(); err != nil {
		t.Fatalf("validate mission code: %v", err)
	}
}

func TestStudentSessionRequestRejectsAlphanumericMissionCode(t *testing.T) {
	request := StudentSessionRequest{
		MissionCode: "ABC234",
		StudentName: "Alex",
	}

	if err := request.Validate(); err == nil {
		t.Fatal("expected alphanumeric mission code to fail validation")
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
	}, `{"mission_code":"123456"}`)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d; body = %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	if service.validatedMissionCode != "123456" {
		t.Fatalf("validated mission code = %q, want %q", service.validatedMissionCode, "123456")
	}
	if service.upsertCalled {
		t.Fatal("student validation should not create or update a user")
	}
}

func TestPostStudentSessionValidationReturnsMissionNotFound(t *testing.T) {
	recorder := postStudentSessionValidation(t, &Handler{
		usersService: &fakeUsersService{validateErr: ErrMissionCodeNotFound},
	}, `{"mission_code":"123456"}`)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status code = %d, want %d; body = %s", recorder.Code, http.StatusNotFound, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"mission_not_found"`) {
		t.Fatalf("expected mission_not_found response, got %s", recorder.Body.String())
	}
}

func TestPostStudentTutorTurnRejectsDistributedRateLimit(t *testing.T) {
	limiter := &fakeTutorRateLimiter{decision: sharedratelimit.Decision{
		Allowed:    false,
		Limit:      12,
		Remaining:  0,
		RetryAfter: 42 * time.Second,
	}}
	service := &fakeStudentTutorService{}
	recorder := postStudentTutorTurn(t, &Handler{
		authenticator:          fakeStudentAuthenticator{},
		studentLearningTimeout: time.Second,
		studentTutorService:    service,
		tutorRateLimiters: TutorRateLimiters{
			PerStudentMinute: limiter,
		},
	})

	if recorder.Code != http.StatusTooManyRequests {
		t.Fatalf("status code = %d, want %d; body = %s", recorder.Code, http.StatusTooManyRequests, recorder.Body.String())
	}
	if service.called {
		t.Fatal("rate-limited request should not call the tutor service")
	}
	if got := recorder.Header().Get("Retry-After"); got != "42" {
		t.Fatalf("Retry-After = %q, want %q", got, "42")
	}
	if !strings.Contains(recorder.Body.String(), `"code":"tutor_rate_limited"`) {
		t.Fatalf("expected tutor_rate_limited response, got %s", recorder.Body.String())
	}
}

func TestPostStudentTutorTurnChecksStudentAndIPQuotas(t *testing.T) {
	studentMinute := allowTutorRateLimiter()
	studentHour := allowTutorRateLimiter()
	ipMinute := allowTutorRateLimiter()
	ipHour := allowTutorRateLimiter()
	service := &fakeStudentTutorService{}
	recorder := postStudentTutorTurn(t, &Handler{
		authenticator:          fakeStudentAuthenticator{},
		studentLearningTimeout: time.Second,
		studentTutorService:    service,
		tutorRateLimiters: TutorRateLimiters{
			PerIPHour:        ipHour,
			PerIPMinute:      ipMinute,
			PerStudentHour:   studentHour,
			PerStudentMinute: studentMinute,
		},
	})

	if recorder.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d; body = %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	if !service.called {
		t.Fatal("allowed request should call the tutor service")
	}
	for _, limiter := range []*fakeTutorRateLimiter{studentMinute, studentHour} {
		if len(limiter.identifiers) != 1 || limiter.identifiers[0] != "student:firebase:student-1" {
			t.Fatalf("student limiter identifiers = %#v", limiter.identifiers)
		}
	}
	for _, limiter := range []*fakeTutorRateLimiter{ipMinute, ipHour} {
		if len(limiter.identifiers) != 1 || limiter.identifiers[0] != "ip:192.0.2.1" {
			t.Fatalf("IP limiter identifiers = %#v", limiter.identifiers)
		}
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

func postStudentTutorTurn(t *testing.T, handler *Handler) *httptest.ResponseRecorder {
	t.Helper()

	server := echo.New()
	request := httptest.NewRequest(
		http.MethodPost,
		"/users/student-tutor-turn",
		strings.NewReader(`{"mission_id":"mission-1","event_id":"event-1","type":"answer","stage_id":"stage-1","question_id":"question-1","prompt":"What is the answer?","student_response":"A","expected_answer":"A","outcome":"correct"}`),
	)
	request.Header.Set(echo.HeaderAuthorization, "Bearer student-token")
	request.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	request.RemoteAddr = "192.0.2.1:4242"
	recorder := httptest.NewRecorder()
	ctx := server.NewContext(request, recorder)

	if err := handler.PostStudentTutorTurn(ctx); err != nil {
		t.Fatalf("post student tutor turn: %v", err)
	}

	return recorder
}

func allowTutorRateLimiter() *fakeTutorRateLimiter {
	return &fakeTutorRateLimiter{decision: sharedratelimit.Decision{
		Allowed:   true,
		Limit:     12,
		Remaining: 11,
	}}
}

type fakeStudentAuthenticator struct{}

func (fakeStudentAuthenticator) AuthenticateBearerToken(
	context.Context,
	string,
) (sharedfirebase.Identity, error) {
	return sharedfirebase.Identity{
		Provider:       sharedfirebase.IdentityProviderFirebase,
		ProviderUserID: "student-1",
		AuthMethod:     sharedfirebase.AuthMethodAnonymous,
	}, nil
}

type fakeTutorRateLimiter struct {
	decision    sharedratelimit.Decision
	err         error
	identifiers []string
}

func (limiter *fakeTutorRateLimiter) Allow(
	_ context.Context,
	identifier string,
) (sharedratelimit.Decision, error) {
	limiter.identifiers = append(limiter.identifiers, identifier)
	return limiter.decision, limiter.err
}

type fakeStudentTutorService struct {
	called bool
}

func (service *fakeStudentTutorService) SaveStudentTutorTurn(
	context.Context,
	sharedfirebase.Identity,
	SaveStudentTutorTurnInput,
) (StudentTutorTurn, error) {
	service.called = true
	return StudentTutorTurn{}, nil
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
