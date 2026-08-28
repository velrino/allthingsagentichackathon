package teacherclassactivity

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

	teacherclass "classgame-api/internal/modules/teacher-class"
	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

const (
	defaultActivityTimeout          = 45 * time.Second
	defaultActivityRateLimitRate    = 0.2
	defaultActivityRateLimitBurst   = 8
	defaultActivityRateLimitExpires = 5 * time.Minute
	maxActivityAttachments          = 5
	maxActivityAttachmentSizeBytes  = 20 * 1024 * 1024
)

var classIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$`)

type Authenticator interface {
	AuthenticateBearerToken(context.Context, string) (sharedfirebase.Identity, error)
}

type ActivityService interface {
	Approve(context.Context, sharedfirebase.Identity, string, string) (ActivityDocument, error)
	Create(context.Context, sharedfirebase.Identity, CreateActivityInput) (ActivityDocument, error)
	List(context.Context, sharedfirebase.Identity, string) ([]ActivityDocument, error)
	Preview(context.Context, sharedfirebase.Identity, CreateActivityInput) (ActivityDocument, error)
}

type HandlerOptions struct {
	Authenticator            Authenticator
	ActivityTimeout          time.Duration
	ActivityRateLimitRate    float64
	ActivityRateLimitBurst   int
	ActivityRateLimitExpires time.Duration
	ActivityService          ActivityService
}

type Handler struct {
	activityService ActivityService
	activityTimeout time.Duration
	authenticator   Authenticator
}

type CreateActivityRequest struct {
	ClassName     string                      `json:"class_name"`
	ActivityName  string                      `json:"activity_name"`
	Subject       string                      `json:"subject"`
	GradeLevel    string                      `json:"grade_level"`
	LearningGoal  string                      `json:"learning_goal"`
	TeacherPrompt string                      `json:"teacher_prompt"`
	Attachments   []ActivityAttachmentRequest `json:"attachments"`
}

type ActivityAttachmentRequest struct {
	UploadcareUUID string `json:"uploadcare_uuid"`
	CDNURL         string `json:"cdn_url"`
	FileName       string `json:"file_name"`
	MimeType       string `json:"mime_type"`
	SizeBytes      int64  `json:"size_bytes"`
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
		activityService: options.ActivityService,
		activityTimeout: resolveActivityTimeout(options.ActivityTimeout),
		authenticator:   options.Authenticator,
	}

	group := server.Group("/teacher-classes/:class_id/activities", activityRateLimiter(options))
	group.GET("", handler.ListActivities)
	group.POST("", handler.PostActivity)
	group.POST("/preview", handler.PostActivityPreview)
	group.POST("/:activity_id/approve", handler.PostActivityApprove)
}

func (handler *Handler) PostActivityPreview(ctx *echo.Context) error {
	return handler.createActivity(ctx, StatusPreview)
}

func (handler *Handler) PostActivity(ctx *echo.Context) error {
	return handler.createActivity(ctx, StatusPublished)
}

func (handler *Handler) PostActivityApprove(ctx *echo.Context) error {
	if handler.authenticator == nil || handler.activityService == nil {
		slog.Error("teacher activity dependencies are not configured")
		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Teacher activities are not configured.")
	}

	classID := ctx.Param("class_id")
	if err := validateClassID(classID); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	activityID := ctx.Param("activity_id")
	if err := validateActivityID(activityID); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	requestContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.activityTimeout)
	defer cancel()

	identity, ok, err := handler.authenticate(requestContext, ctx)
	if err != nil || !ok {
		return err
	}

	activity, err := handler.activityService.Approve(requestContext, identity, classID, activityID)
	if err != nil {
		return handler.serviceError(ctx, err)
	}

	return ctx.JSON(http.StatusOK, map[string]any{
		"activity": ToResponse(activity),
	})
}

func (handler *Handler) ListActivities(ctx *echo.Context) error {
	if handler.authenticator == nil || handler.activityService == nil {
		slog.Error("teacher activity dependencies are not configured")
		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Teacher activities are not configured.")
	}

	classID := ctx.Param("class_id")
	if err := validateClassID(classID); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	requestContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.activityTimeout)
	defer cancel()

	identity, ok, err := handler.authenticate(requestContext, ctx)
	if err != nil || !ok {
		return err
	}

	activities, err := handler.activityService.List(requestContext, identity, classID)
	if err != nil {
		return handler.serviceError(ctx, err)
	}

	return ctx.JSON(http.StatusOK, map[string]any{
		"activities": ToResponses(activities),
	})
}

func (handler *Handler) createActivity(ctx *echo.Context, status string) error {
	if handler.authenticator == nil || handler.activityService == nil {
		slog.Error("teacher activity dependencies are not configured")
		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Teacher activities are not configured.")
	}

	classID := ctx.Param("class_id")
	if err := validateClassID(classID); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	var request CreateActivityRequest
	if err := ctx.Bind(&request); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "bad_request", "Invalid JSON body.")
	}
	if err := request.Validate(); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	requestContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.activityTimeout)
	defer cancel()

	identity, ok, err := handler.authenticate(requestContext, ctx)
	if err != nil || !ok {
		return err
	}

	input := CreateActivityInput{
		ClassID:       classID,
		ClassName:     request.ClassName,
		ActivityName:  request.ActivityName,
		Subject:       request.Subject,
		GradeLevel:    request.GradeLevel,
		LearningGoal:  request.LearningGoal,
		TeacherPrompt: request.TeacherPrompt,
		Attachments:   toActivityAttachments(request.Attachments),
		Status:        status,
	}

	var activity ActivityDocument
	if status == StatusPublished {
		activity, err = handler.activityService.Create(requestContext, identity, input)
	} else {
		activity, err = handler.activityService.Preview(requestContext, identity, input)
	}
	if err != nil {
		return handler.serviceError(ctx, err)
	}

	return ctx.JSON(http.StatusOK, map[string]any{
		"activity": ToResponse(activity),
	})
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

	if errors.Is(err, sharedfirebase.ErrMissingBearerToken) ||
		errors.Is(err, sharedfirebase.ErrInvalidBearerToken) {
		return sharedfirebase.Identity{}, false, jsonError(echoCtx, http.StatusUnauthorized, "unauthorized", "Invalid Firebase ID token.")
	}

	slog.Warn("teacher activity auth failed", "error", err)
	return sharedfirebase.Identity{}, false, jsonError(echoCtx, http.StatusUnauthorized, "unauthorized", "Invalid Firebase ID token.")
}

func (handler *Handler) serviceError(ctx *echo.Context, err error) error {
	if errors.Is(err, teacherclass.ErrTeacherRequiresGoogleAuth) {
		return jsonError(ctx, http.StatusForbidden, "forbidden", "Teacher activities require Google sign in.")
	}
	if errors.Is(err, teacherclass.ErrClassOwnedByAnotherTeacher) {
		return jsonError(ctx, http.StatusForbidden, "forbidden", "This class code already belongs to another teacher.")
	}
	if errors.Is(err, teacherclass.ErrClassNotFound) || errors.Is(err, ErrActivityNotFound) {
		return jsonError(ctx, http.StatusNotFound, "not_found", "Teacher activity not found.")
	}

	slog.Error("teacher activity request failed", "error", err)
	return jsonError(ctx, http.StatusInternalServerError, "teacher_activity_failed", "Could not process teacher activity.")
}

func (request CreateActivityRequest) Validate() error {
	return validation.ValidateStruct(&request,
		validation.Field(&request.ClassName,
			validation.Length(0, 120),
		),
		validation.Field(&request.ActivityName,
			validation.Required,
			validation.Length(2, 120),
		),
		validation.Field(&request.Subject,
			validation.Required,
			validation.Length(2, 80),
		),
		validation.Field(&request.GradeLevel,
			validation.Length(0, 80),
		),
		validation.Field(&request.LearningGoal,
			validation.Required,
			validation.Length(6, 240),
		),
		validation.Field(&request.TeacherPrompt,
			validation.Required,
			validation.Length(10, 4000),
		),
		validation.Field(&request.Attachments,
			validation.By(validateAttachments),
		),
	)
}

func validateAttachments(value any) error {
	attachments, ok := value.([]ActivityAttachmentRequest)
	if !ok {
		return nil
	}
	if len(attachments) > maxActivityAttachments {
		return errors.New("attachments cannot contain more than 5 files")
	}

	for _, attachment := range attachments {
		if attachment.SizeBytes > maxActivityAttachmentSizeBytes {
			return errors.New("each attachment must be 20 MB or smaller")
		}
		if attachment.UploadcareUUID == "" && attachment.CDNURL == "" {
			return errors.New("each attachment requires uploadcare_uuid or cdn_url")
		}
	}

	return nil
}

func validateClassID(value string) error {
	return validation.Validate(value,
		validation.Required,
		validation.Length(2, 40),
		validation.Match(classIDPattern),
	)
}

func validateActivityID(value string) error {
	return validation.Validate(value,
		validation.Required,
		validation.Length(4, 120),
	)
}

func toActivityAttachments(input []ActivityAttachmentRequest) []ActivityAttachment {
	attachments := make([]ActivityAttachment, 0, len(input))
	for _, attachment := range input {
		attachments = append(attachments, ActivityAttachment{
			UploadcareUUID: attachment.UploadcareUUID,
			CDNURL:         attachment.CDNURL,
			FileName:       attachment.FileName,
			MimeType:       attachment.MimeType,
			SizeBytes:      attachment.SizeBytes,
		})
	}

	return attachments
}

func activityRateLimiter(options HandlerOptions) echo.MiddlewareFunc {
	return middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      resolveActivityRateLimitRate(options.ActivityRateLimitRate),
			Burst:     resolveActivityRateLimitBurst(options.ActivityRateLimitBurst),
			ExpiresIn: resolveActivityRateLimitExpires(options.ActivityRateLimitExpires),
		}),
		IdentifierExtractor: func(ctx *echo.Context) (string, error) {
			return "teacher_activity:" + ctx.RealIP(), nil
		},
		DenyHandler: func(ctx *echo.Context, _ string, _ error) error {
			return jsonError(ctx, http.StatusTooManyRequests, "rate_limited", "Too many teacher activity requests.")
		},
	})
}

func resolveActivityTimeout(value time.Duration) time.Duration {
	if value <= 0 {
		return defaultActivityTimeout
	}

	return value
}

func resolveActivityRateLimitRate(value float64) float64 {
	if value <= 0 {
		return defaultActivityRateLimitRate
	}

	return value
}

func resolveActivityRateLimitBurst(value int) int {
	if value <= 0 {
		return defaultActivityRateLimitBurst
	}

	return value
}

func resolveActivityRateLimitExpires(value time.Duration) time.Duration {
	if value <= 0 {
		return defaultActivityRateLimitExpires
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
