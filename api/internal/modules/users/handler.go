package users

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	validation "github.com/go-ozzo/ozzo-validation/v4"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

const (
	defaultStudentSessionTimeout          = 8 * time.Second
	defaultStudentSessionRateLimitRate    = 0.5
	defaultStudentSessionRateLimitBurst   = 10
	defaultStudentSessionRateLimitExpires = 5 * time.Minute
	defaultStudentLearningTimeout         = 40 * time.Second
)

var missionCodePattern = regexp.MustCompile(`^[0-9]{6}$`)

type Authenticator interface {
	AuthenticateBearerToken(context.Context, string) (sharedfirebase.Identity, error)
}

type UsersService interface {
	UpsertStudent(
		context.Context,
		sharedfirebase.Identity,
		string,
		string,
	) (UserDocument, error)
	ValidateStudentMissionCode(
		context.Context,
		string,
	) error
	UpdateStudentPresence(
		context.Context,
		sharedfirebase.Identity,
		string,
		string,
		string,
		string,
		string,
	) (UserDocument, error)
}

type StudentLearningService interface {
	SaveStudentLearningSnapshot(
		context.Context,
		sharedfirebase.Identity,
		string,
		string,
		StudentLearningSnapshot,
	) (StudentMissionAttemptDocument, error)
	GetCurrentStudentLearningAttempt(
		context.Context,
		sharedfirebase.Identity,
		string,
	) (StudentMissionAttemptDocument, bool, error)
}

type HandlerOptions struct {
	Authenticator                  Authenticator
	StudentSessionTimeout          time.Duration
	StudentSessionRateLimitRate    float64
	StudentSessionRateLimitBurst   int
	StudentSessionRateLimitExpires time.Duration
	StudentLearningTimeout         time.Duration
	StudentLearningService         StudentLearningService
	UsersService                   UsersService
}

type Handler struct {
	authenticator          Authenticator
	studentSessionTimeout  time.Duration
	studentLearningTimeout time.Duration
	studentLearningService StudentLearningService
	usersService           UsersService
}

type StudentSessionRequest struct {
	MissionCode string `json:"mission_code"`
	StudentName string `json:"student_name"`
}

type StudentMissionCodeRequest struct {
	MissionCode string `json:"mission_code"`
}

type StudentMissionCodeResponse struct {
	Valid bool `json:"valid"`
}

type StudentSessionResponse struct {
	User UserResponse `json:"user"`
}

type StudentPresenceRequest struct {
	MissionID string `json:"mission_id"`
	Subject   string `json:"subject"`
	StageID   string `json:"stage_id"`
	StageName string `json:"stage_name"`
	Status    string `json:"status"`
}

type StudentLearningSnapshotRequest struct {
	MissionID string                  `json:"mission_id"`
	Status    string                  `json:"status"`
	Snapshot  StudentLearningSnapshot `json:"snapshot"`
}

type StudentLearningResponse struct {
	Attempt *StudentMissionAttemptDocument `json:"attempt"`
}

type ErrorResponse struct {
	Error ErrorResponseBody `json:"error"`
}

type ErrorResponseBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func RegisterRoutes(server *echo.Echo, options HandlerOptions) {
	studentLearningService := options.StudentLearningService
	if studentLearningService == nil {
		studentLearningService, _ = options.UsersService.(StudentLearningService)
	}
	handler := &Handler{
		authenticator:          options.Authenticator,
		studentSessionTimeout:  resolveStudentSessionTimeout(options.StudentSessionTimeout),
		studentLearningTimeout: resolveStudentLearningTimeout(options.StudentLearningTimeout),
		studentLearningService: studentLearningService,
		usersService:           options.UsersService,
	}

	sessionRateLimiter := studentSessionRateLimiter(options)
	server.POST(
		"/users/student-session/validate",
		handler.PostStudentSessionValidation,
		sessionRateLimiter,
	)
	server.POST(
		"/users/student-session",
		handler.PostStudentSession,
		sessionRateLimiter,
	)
	server.POST(
		"/users/student-presence",
		handler.PostStudentPresence,
		studentPresenceRateLimiter(),
	)
	server.GET(
		"/users/student-learning",
		handler.GetStudentLearning,
		studentLearningRateLimiter(),
	)
	server.POST(
		"/users/student-learning",
		handler.PostStudentLearning,
		studentLearningRateLimiter(),
	)
}

func (handler *Handler) PostStudentSessionValidation(ctx *echo.Context) error {
	var request StudentMissionCodeRequest
	if err := ctx.Bind(&request); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "bad_request", "Invalid JSON body.")
	}
	request.MissionCode = strings.ToUpper(strings.TrimSpace(request.MissionCode))
	if err := request.Validate(); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	if handler.usersService == nil {
		err := errors.New("users student session dependencies are not configured")
		slog.Error("users student session validation not configured", "error", err)

		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Users are not configured.")
	}

	sessionContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.studentSessionTimeout)
	defer cancel()

	if err := handler.usersService.ValidateStudentMissionCode(sessionContext, request.MissionCode); err != nil {
		if errors.Is(err, ErrMissionCodeNotFound) {
			return jsonError(ctx, http.StatusNotFound, "mission_not_found", "Published mission code not found.")
		}

		slog.Error("student session validation failed", "error", err)
		return jsonError(ctx, http.StatusInternalServerError, "session_validation_failed", "Could not validate mission code.")
	}

	return ctx.JSON(http.StatusOK, StudentMissionCodeResponse{Valid: true})
}

func (handler *Handler) PostStudentSession(ctx *echo.Context) error {
	var request StudentSessionRequest
	if err := ctx.Bind(&request); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "bad_request", "Invalid JSON body.")
	}
	request.MissionCode = strings.ToUpper(strings.TrimSpace(request.MissionCode))
	if err := request.Validate(); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	if handler.authenticator == nil || handler.usersService == nil {
		err := errors.New("users student session dependencies are not configured")
		slog.Error("users student session not configured", "error", err)

		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Users are not configured.")
	}

	sessionContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.studentSessionTimeout)
	defer cancel()

	identity, ok, err := handler.authenticate(sessionContext, ctx)
	if err != nil || !ok {
		return err
	}

	user, err := handler.usersService.UpsertStudent(
		sessionContext,
		identity,
		request.MissionCode,
		request.StudentName,
	)
	if err != nil {
		if errors.Is(err, ErrStudentRequiresAnonymousAuth) {
			return jsonError(ctx, http.StatusForbidden, "forbidden", "Student sessions require anonymous Firebase auth.")
		}
		if errors.Is(err, ErrMissionCodeNotFound) {
			return jsonError(ctx, http.StatusNotFound, "mission_not_found", "Published mission code not found.")
		}

		slog.Error("student session upsert failed", "error", err, "auth_method", identity.AuthMethod)
		return jsonError(ctx, http.StatusInternalServerError, "session_failed", "Could not create student session.")
	}

	return ctx.JSON(http.StatusOK, StudentSessionResponse{
		User: ToResponse(user),
	})
}

func (handler *Handler) PostStudentPresence(ctx *echo.Context) error {
	var request StudentPresenceRequest
	if err := ctx.Bind(&request); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "bad_request", "Invalid JSON body.")
	}
	if err := request.Validate(); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}
	if handler.authenticator == nil || handler.usersService == nil {
		slog.Error("student presence dependencies are not configured")
		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Users are not configured.")
	}

	requestContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.studentSessionTimeout)
	defer cancel()

	identity, ok, err := handler.authenticate(requestContext, ctx)
	if err != nil || !ok {
		return err
	}

	user, err := handler.usersService.UpdateStudentPresence(
		requestContext,
		identity,
		request.MissionID,
		request.Subject,
		request.StageID,
		request.StageName,
		request.Status,
	)
	if err != nil {
		switch {
		case errors.Is(err, ErrStudentRequiresAnonymousAuth):
			return jsonError(ctx, http.StatusForbidden, "forbidden", "Student presence requires anonymous Firebase auth.")
		case errors.Is(err, ErrStudentNotFound):
			return jsonError(ctx, http.StatusNotFound, "student_not_found", "Start a student session before entering the game.")
		case errors.Is(err, ErrStudentMissionMismatch):
			return jsonError(ctx, http.StatusConflict, "mission_mismatch", "Presence does not match the active student mission.")
		default:
			slog.Error("student presence update failed", "error", err)
			return jsonError(ctx, http.StatusInternalServerError, "presence_failed", "Could not update student presence.")
		}
	}

	return ctx.JSON(http.StatusOK, StudentSessionResponse{User: ToResponse(user)})
}

func (handler *Handler) GetStudentLearning(ctx *echo.Context) error {
	missionID := strings.TrimSpace(ctx.QueryParam("mission_id"))
	if err := validation.Validate(missionID, validation.Required, validation.Length(1, 120)); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", "mission_id: "+err.Error())
	}
	if handler.authenticator == nil || handler.studentLearningService == nil {
		slog.Error("student learning dependencies are not configured")
		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Student learning is not configured.")
	}

	requestContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.studentLearningTimeout)
	defer cancel()
	identity, ok, err := handler.authenticate(requestContext, ctx)
	if err != nil || !ok {
		return err
	}

	attempt, exists, err := handler.studentLearningService.GetCurrentStudentLearningAttempt(requestContext, identity, missionID)
	if err != nil {
		return handler.studentLearningError(ctx, err)
	}
	if !exists {
		return ctx.JSON(http.StatusOK, StudentLearningResponse{Attempt: nil})
	}

	return ctx.JSON(http.StatusOK, StudentLearningResponse{Attempt: &attempt})
}

func (handler *Handler) PostStudentLearning(ctx *echo.Context) error {
	var request StudentLearningSnapshotRequest
	if err := ctx.Bind(&request); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "bad_request", "Invalid JSON body.")
	}
	if err := request.Validate(); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}
	if handler.authenticator == nil || handler.studentLearningService == nil {
		slog.Error("student learning dependencies are not configured")
		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Student learning is not configured.")
	}

	requestContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.studentLearningTimeout)
	defer cancel()
	identity, ok, err := handler.authenticate(requestContext, ctx)
	if err != nil || !ok {
		return err
	}

	attempt, err := handler.studentLearningService.SaveStudentLearningSnapshot(
		requestContext,
		identity,
		request.MissionID,
		request.Status,
		request.Snapshot,
	)
	if err != nil {
		return handler.studentLearningError(ctx, err)
	}

	return ctx.JSON(http.StatusOK, StudentLearningResponse{Attempt: &attempt})
}

func (handler *Handler) studentLearningError(ctx *echo.Context, err error) error {
	switch {
	case errors.Is(err, ErrStudentRequiresAnonymousAuth):
		return jsonError(ctx, http.StatusForbidden, "forbidden", "Student learning requires anonymous Firebase auth.")
	case errors.Is(err, ErrStudentNotFound):
		return jsonError(ctx, http.StatusNotFound, "student_not_found", "Start a student session before entering the game.")
	case errors.Is(err, ErrStudentMissionMismatch):
		return jsonError(ctx, http.StatusConflict, "mission_mismatch", "The learning snapshot does not match the active student mission.")
	case errors.Is(err, ErrStudentAttemptNotFound):
		return jsonError(ctx, http.StatusNotFound, "attempt_not_found", "The student learning attempt was not found.")
	default:
		slog.Error("student learning request failed", "error", err)
		return jsonError(ctx, http.StatusInternalServerError, "student_learning_failed", "Could not save student learning.")
	}
}

func (handler *Handler) authenticate(
	ctx context.Context,
	echoCtx *echo.Context,
) (sharedfirebase.Identity, bool, error) {
	identity, err := handler.authenticator.AuthenticateBearerToken(
		ctx,
		echoCtx.Request().Header.Get(echo.HeaderAuthorization),
	)
	if err == nil {
		return identity, true, nil
	}

	if !errors.Is(err, sharedfirebase.ErrMissingBearerToken) &&
		!errors.Is(err, sharedfirebase.ErrInvalidBearerToken) {
		slog.Warn("student auth failed", "error", err)
	}

	return sharedfirebase.Identity{}, false, jsonError(
		echoCtx,
		http.StatusUnauthorized,
		"unauthorized",
		"Invalid Firebase ID token.",
	)
}

func (request StudentSessionRequest) Validate() error {
	return validation.ValidateStruct(&request,
		validation.Field(&request.MissionCode,
			validation.By(validateMissionCode),
		),
		validation.Field(&request.StudentName,
			validation.Required,
			validation.Length(2, 80),
		),
	)
}

func (request StudentMissionCodeRequest) Validate() error {
	return validation.ValidateStruct(&request,
		validation.Field(&request.MissionCode,
			validation.By(validateMissionCode),
		),
	)
}

func (request StudentPresenceRequest) Validate() error {
	return validation.ValidateStruct(&request,
		validation.Field(&request.MissionID, validation.Required, validation.Length(1, 120)),
		validation.Field(&request.Subject, validation.Required, validation.Length(2, 80)),
		validation.Field(&request.StageID, validation.Required, validation.Length(1, 80)),
		validation.Field(&request.StageName, validation.Required, validation.Length(1, 120)),
		validation.Field(&request.Status,
			validation.Required,
			validation.In("exploring", "learning", "thinking", "reviewing", "completed"),
		),
	)
}

func (request StudentLearningSnapshotRequest) Validate() error {
	if err := validation.ValidateStruct(&request,
		validation.Field(&request.MissionID, validation.Required, validation.Length(1, 120)),
		validation.Field(&request.Status,
			validation.Required,
			validation.In("exploring", "learning", "thinking", "reviewing", "completed"),
		),
	); err != nil {
		return err
	}
	if len(request.Snapshot.Progress) == 0 || len(request.Snapshot.Progress) > 12 {
		return errors.New("snapshot.progress must contain between 1 and 12 stages")
	}
	if len(request.Snapshot.Notes) > 40 {
		return errors.New("snapshot.notes cannot contain more than 40 notes")
	}
	if len(request.Snapshot.Decisions) > 40 {
		return errors.New("snapshot.decisions cannot contain more than 40 decisions")
	}
	if len(request.Snapshot.Events) > 160 {
		return errors.New("snapshot.events cannot contain more than 160 events")
	}
	if request.Snapshot.Preferences.DifficultyBias < -1 || request.Snapshot.Preferences.DifficultyBias > 1 {
		return errors.New("snapshot.preferences.difficulty_bias must be -1, 0, or 1")
	}
	if err := validation.Validate(
		request.Snapshot.Preferences.ExplanationStyle,
		validation.Required,
		validation.In("steps", "visual"),
	); err != nil {
		return fmt.Errorf("snapshot.preferences.explanation_style: %w", err)
	}
	if err := validation.Validate(request.Snapshot.ReturnTo, validation.Length(0, 80)); err != nil {
		return fmt.Errorf("snapshot.return_to: %w", err)
	}
	if err := validation.Validate(request.Snapshot.LastPod, validation.Length(0, 80)); err != nil {
		return fmt.Errorf("snapshot.last_pod: %w", err)
	}

	seenStages := make(map[string]struct{}, len(request.Snapshot.Progress))
	for index, stage := range request.Snapshot.Progress {
		if err := validation.Validate(stage.StageID, validation.Required, validation.Length(1, 80)); err != nil {
			return fmt.Errorf("snapshot.progress[%d].stage_id: %w", index, err)
		}
		if _, exists := seenStages[stage.StageID]; exists {
			return fmt.Errorf("snapshot.progress[%d].stage_id is duplicated", index)
		}
		seenStages[stage.StageID] = struct{}{}
		if err := validation.Validate(stage.Status, validation.Required, validation.In("locked", "ready", "review", "complete")); err != nil {
			return fmt.Errorf("snapshot.progress[%d].status: %w", index, err)
		}
		if stage.Correct < 0 || stage.Correct > 100 || stage.Required < 0 || stage.Required > 100 {
			return fmt.Errorf("snapshot.progress[%d] counts are outside the allowed range", index)
		}
		if len(stage.Queue) > 40 || len(stage.Pool) > 40 {
			return fmt.Errorf("snapshot.progress[%d] contains too many queued questions", index)
		}
	}

	for index, note := range request.Snapshot.Notes {
		if err := validation.Validate(note.ID, validation.Required, validation.Length(1, 100)); err != nil {
			return fmt.Errorf("snapshot.notes[%d].id: %w", index, err)
		}
		if err := validation.Validate(note.Text, validation.Required, validation.Length(1, 320)); err != nil {
			return fmt.Errorf("snapshot.notes[%d].text: %w", index, err)
		}
		if err := validation.Validate(note.Kind, validation.Required, validation.In("misconception", "habit")); err != nil {
			return fmt.Errorf("snapshot.notes[%d].kind: %w", index, err)
		}
		if len(note.Evidence) > 12 {
			return fmt.Errorf("snapshot.notes[%d].evidence contains too many items", index)
		}
	}

	for index, decision := range request.Snapshot.Decisions {
		if err := validation.Validate(decision.ID, validation.Required, validation.Length(1, 100)); err != nil {
			return fmt.Errorf("snapshot.decisions[%d].id: %w", index, err)
		}
		if err := validation.Validate(decision.Action, validation.Required, validation.In("next", "complete", "redirect", "mission-complete", "erase-note")); err != nil {
			return fmt.Errorf("snapshot.decisions[%d].action: %w", index, err)
		}
		if len([]rune(decision.Message)) > 240 || len([]rune(decision.Why)) > 320 {
			return fmt.Errorf("snapshot.decisions[%d] text is too long", index)
		}
	}

	allowedEventTypes := map[string]struct{}{
		"question":   {},
		"answer":     {},
		"reasoning":  {},
		"feedback":   {},
		"adaptation": {},
		"mastery":    {},
	}
	allowedOutcomes := map[string]struct{}{
		"neutral":   {},
		"correct":   {},
		"incorrect": {},
		"support":   {},
		"complete":  {},
	}
	seenEvents := make(map[string]struct{}, len(request.Snapshot.Events))
	for index, event := range request.Snapshot.Events {
		if err := validation.Validate(event.ID, validation.Required, validation.Length(1, 100)); err != nil {
			return fmt.Errorf("snapshot.events[%d].id: %w", index, err)
		}
		if _, exists := seenEvents[event.ID]; exists {
			return fmt.Errorf("snapshot.events[%d].id is duplicated", index)
		}
		seenEvents[event.ID] = struct{}{}
		if _, allowed := allowedEventTypes[event.Type]; !allowed {
			return fmt.Errorf("snapshot.events[%d].type is invalid", index)
		}
		if _, allowed := allowedOutcomes[event.Outcome]; !allowed {
			return fmt.Errorf("snapshot.events[%d].outcome is invalid", index)
		}
		if event.Sequence < 1 || event.Sequence > 10000 {
			return fmt.Errorf("snapshot.events[%d].sequence is outside the allowed range", index)
		}
		if len([]rune(event.Title)) > 160 || len([]rune(event.Detail)) > 420 {
			return fmt.Errorf("snapshot.events[%d] text is too long", index)
		}
	}

	return nil
}

func validateMissionCode(value any) error {
	return validation.Validate(value,
		validation.Required,
		validation.Length(6, 6),
		validation.Match(missionCodePattern),
	)
}

func studentSessionRateLimiter(options HandlerOptions) echo.MiddlewareFunc {
	return middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      resolveStudentSessionRateLimitRate(options.StudentSessionRateLimitRate),
			Burst:     resolveStudentSessionRateLimitBurst(options.StudentSessionRateLimitBurst),
			ExpiresIn: resolveStudentSessionRateLimitExpires(options.StudentSessionRateLimitExpires),
		}),
		IdentifierExtractor: func(ctx *echo.Context) (string, error) {
			return "student_session:" + ctx.RealIP(), nil
		},
		DenyHandler: func(ctx *echo.Context, _ string, _ error) error {
			return jsonError(ctx, http.StatusTooManyRequests, "rate_limited", "Too many student session attempts.")
		},
	})
}

func studentPresenceRateLimiter() echo.MiddlewareFunc {
	return middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      1,
			Burst:     12,
			ExpiresIn: 5 * time.Minute,
		}),
		IdentifierExtractor: func(ctx *echo.Context) (string, error) {
			tokenHash := sha256.Sum256([]byte(ctx.Request().Header.Get(echo.HeaderAuthorization)))
			return fmt.Sprintf("student_presence:%x", tokenHash[:8]), nil
		},
		DenyHandler: func(ctx *echo.Context, _ string, _ error) error {
			return jsonError(ctx, http.StatusTooManyRequests, "rate_limited", "Too many presence updates.")
		},
	})
}

func studentLearningRateLimiter() echo.MiddlewareFunc {
	return middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      2,
			Burst:     24,
			ExpiresIn: 5 * time.Minute,
		}),
		IdentifierExtractor: func(ctx *echo.Context) (string, error) {
			tokenHash := sha256.Sum256([]byte(ctx.Request().Header.Get(echo.HeaderAuthorization)))
			return fmt.Sprintf("student_learning:%x", tokenHash[:8]), nil
		},
		DenyHandler: func(ctx *echo.Context, _ string, _ error) error {
			return jsonError(ctx, http.StatusTooManyRequests, "rate_limited", "Too many student learning updates.")
		},
	})
}

func resolveStudentSessionTimeout(value time.Duration) time.Duration {
	if value <= 0 {
		return defaultStudentSessionTimeout
	}

	return value
}

func resolveStudentLearningTimeout(value time.Duration) time.Duration {
	if value <= 0 {
		return defaultStudentLearningTimeout
	}

	return value
}

func resolveStudentSessionRateLimitRate(value float64) float64 {
	if value <= 0 {
		return defaultStudentSessionRateLimitRate
	}

	return value
}

func resolveStudentSessionRateLimitBurst(value int) int {
	if value <= 0 {
		return defaultStudentSessionRateLimitBurst
	}

	return value
}

func resolveStudentSessionRateLimitExpires(value time.Duration) time.Duration {
	if value <= 0 {
		return defaultStudentSessionRateLimitExpires
	}

	return value
}

func jsonError(ctx *echo.Context, statusCode int, code string, message string) error {
	return ctx.JSON(statusCode, ErrorResponse{
		Error: ErrorResponseBody{
			Code:    code,
			Message: message,
		},
	})
}
