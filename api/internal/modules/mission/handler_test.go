package mission

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

func TestMissionPreviewStopsBeforeGenerationWhenRedisQuotaIsExceeded(t *testing.T) {
	service := &fakeMissionService{}
	server := echo.New()
	RegisterRoutes(server, HandlerOptions{
		Authenticator: fakeMissionAuthenticator{},
		GenerationRateLimiters: GenerationRateLimiters{
			PerTeacherMinute: fakeMissionGenerationLimiter{decision: sharedratelimit.Decision{
				Allowed:    false,
				Limit:      6,
				Remaining:  0,
				RetryAfter: 30 * time.Second,
			}},
		},
		MissionService: service,
	})
	request := httptest.NewRequest(
		http.MethodPost,
		"/teacher-classes/AB/missions/preview",
		strings.NewReader(`{"mission_name":"Fractions review","subject":"Mathematics","learning_goal":"Review fraction operations","teacher_prompt":"Help students explain each fraction step."}`),
	)
	request.Header.Set(echo.HeaderAuthorization, "Bearer teacher-token")
	request.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	recorder := httptest.NewRecorder()

	server.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusTooManyRequests {
		t.Fatalf("status code = %d, want %d; body = %s", recorder.Code, http.StatusTooManyRequests, recorder.Body.String())
	}
	if service.previewCalled {
		t.Fatal("rate-limited request should not generate a mission preview")
	}
	if got := recorder.Header().Get("Retry-After"); got != "30" {
		t.Fatalf("Retry-After = %q, want %q", got, "30")
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

type fakeMissionAuthenticator struct{}

func (fakeMissionAuthenticator) AuthenticateBearerToken(
	context.Context,
	string,
) (sharedfirebase.Identity, error) {
	return sharedfirebase.Identity{
		Provider:       sharedfirebase.IdentityProviderFirebase,
		ProviderUserID: "teacher-1",
		AuthMethod:     sharedfirebase.AuthMethodGoogle,
	}, nil
}

type fakeMissionGenerationLimiter struct {
	decision sharedratelimit.Decision
}

func (limiter fakeMissionGenerationLimiter) Allow(
	context.Context,
	string,
) (sharedratelimit.Decision, error) {
	return limiter.decision, nil
}

type fakeMissionService struct {
	previewCalled bool
}

func (*fakeMissionService) Approve(
	context.Context,
	sharedfirebase.Identity,
	string,
	string,
	ApproveMissionInput,
) (MissionDocument, error) {
	return MissionDocument{}, nil
}

func (*fakeMissionService) Delete(
	context.Context,
	sharedfirebase.Identity,
	string,
	string,
) error {
	return nil
}

func (*fakeMissionService) List(
	context.Context,
	sharedfirebase.Identity,
	string,
) ([]MissionDocument, error) {
	return nil, nil
}

func (service *fakeMissionService) Preview(
	context.Context,
	sharedfirebase.Identity,
	CreateMissionInput,
) (MissionDocument, error) {
	service.previewCalled = true
	return MissionDocument{}, nil
}
