package users

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
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

var turmaIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$`)

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
	TurmaID     string `json:"turma_id"`
	StudentName string `json:"student_name"`
}

type StudentSessionResponse struct {
	User UserResponse `json:"user"`
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

	server.POST(
		"/users/student-session",
		handler.PostStudentSession,
		studentSessionRateLimiter(options),
	)
}

func (handler *Handler) PostStudentSession(ctx *echo.Context) error {
	var request StudentSessionRequest
	if err := ctx.Bind(&request); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "bad_request", "Invalid JSON body.")
	}
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

	identity, err := handler.authenticator.AuthenticateBearerToken(
		sessionContext,
		ctx.Request().Header.Get(echo.HeaderAuthorization),
	)
	if err != nil {
		if errors.Is(err, sharedfirebase.ErrMissingBearerToken) ||
			errors.Is(err, sharedfirebase.ErrInvalidBearerToken) {
			return jsonError(ctx, http.StatusUnauthorized, "unauthorized", "Invalid Firebase ID token.")
		}

		slog.Warn("student session auth failed", "error", err)
		return jsonError(ctx, http.StatusUnauthorized, "unauthorized", "Invalid Firebase ID token.")
	}

	user, err := handler.usersService.UpsertStudent(
		sessionContext,
		identity,
		request.TurmaID,
		request.StudentName,
	)
	if err != nil {
		if errors.Is(err, ErrStudentRequiresAnonymousAuth) {
			return jsonError(ctx, http.StatusForbidden, "forbidden", "Student sessions require anonymous Firebase auth.")
		}

		slog.Error("student session upsert failed", "error", err, "auth_method", identity.AuthMethod)
		return jsonError(ctx, http.StatusInternalServerError, "session_failed", "Could not create student session.")
	}

	return ctx.JSON(http.StatusOK, StudentSessionResponse{
		User: ToResponse(user),
	})
}

func (request StudentSessionRequest) Validate() error {
	return validation.ValidateStruct(&request,
		validation.Field(&request.TurmaID,
			validation.Required,
			validation.Length(2, 40),
			validation.Match(turmaIDPattern),
		),
		validation.Field(&request.StudentName,
			validation.Required,
			validation.Length(2, 80),
		),
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
