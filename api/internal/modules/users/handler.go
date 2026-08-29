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

type HandlerOptions struct {
	Authenticator                  Authenticator
	StudentSessionTimeout          time.Duration
	StudentSessionRateLimitRate    float64
	StudentSessionRateLimitBurst   int
	StudentSessionRateLimitExpires time.Duration
	UsersService                   UsersService
}

type Handler struct {
	authenticator         Authenticator
	studentSessionTimeout time.Duration
	usersService          UsersService
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

type ErrorResponse struct {
	Error ErrorResponseBody `json:"error"`
}

type ErrorResponseBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func RegisterRoutes(server *echo.Echo, options HandlerOptions) {
	handler := &Handler{
		authenticator:         options.Authenticator,
		studentSessionTimeout: resolveStudentSessionTimeout(options.StudentSessionTimeout),
		usersService:          options.UsersService,
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
		default:
			slog.Error("student presence update failed", "error", err)
			return jsonError(ctx, http.StatusInternalServerError, "presence_failed", "Could not update student presence.")
		}
	}

	return ctx.JSON(http.StatusOK, StudentSessionResponse{User: ToResponse(user)})
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

func resolveStudentSessionTimeout(value time.Duration) time.Duration {
	if value <= 0 {
		return defaultStudentSessionTimeout
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
