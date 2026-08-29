package mission

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	validation "github.com/go-ozzo/ozzo-validation/v4"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	teacherclass "classgame-api/internal/modules/teacher-class"
	sharedfirebase "classgame-api/internal/shared/google/firebase"
	sharedratelimit "classgame-api/internal/shared/ratelimit"
)

const (
	defaultMissionTimeout          = 45 * time.Second
	defaultMissionRateLimitRate    = 0.2
	defaultMissionRateLimitBurst   = 8
	defaultMissionRateLimitExpires = 5 * time.Minute
	maxMissionAttachments          = 5
	maxMissionAttachmentSizeBytes  = 20 * 1024 * 1024
)

var classIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$`)

type Authenticator interface {
	AuthenticateBearerToken(context.Context, string) (sharedfirebase.Identity, error)
}

type GenerationLimiter interface {
	Allow(context.Context, string) (sharedratelimit.Decision, error)
}

type MissionService interface {
	Approve(context.Context, sharedfirebase.Identity, string, string, int64) (MissionDocument, error)
	Delete(context.Context, sharedfirebase.Identity, string, string) error
	List(context.Context, sharedfirebase.Identity, string) ([]MissionDocument, error)
	Preview(context.Context, sharedfirebase.Identity, CreateMissionInput) (MissionDocument, error)
}

type HandlerOptions struct {
	Authenticator           Authenticator
	GenerationLimiter       GenerationLimiter
	MissionTimeout          time.Duration
	MissionRateLimitRate    float64
	MissionRateLimitBurst   int
	MissionRateLimitExpires time.Duration
	MissionService          MissionService
}

type Handler struct {
	missionService    MissionService
	missionTimeout    time.Duration
	authenticator     Authenticator
	generationLimiter GenerationLimiter
}

type CreateMissionRequest struct {
	MissionID             string                     `json:"mission_id"`
	ExpectedDraftRevision int64                      `json:"expected_draft_revision"`
	ClassName             string                     `json:"class_name"`
	MissionName           string                     `json:"mission_name"`
	Subject               string                     `json:"subject"`
	GradeLevel            string                     `json:"grade_level"`
	LearningGoal          string                     `json:"learning_goal"`
	TeacherPrompt         string                     `json:"teacher_prompt"`
	AudienceType          string                     `json:"audience_type"`
	TargetStudentIDs      []string                   `json:"target_student_ids"`
	Attachments           []MissionAttachmentRequest `json:"attachments"`
}

type ApproveMissionRequest struct {
	ExpectedDraftRevision int64 `json:"expected_draft_revision"`
}

type MissionAttachmentRequest struct {
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
		missionService:    options.MissionService,
		missionTimeout:    resolveMissionTimeout(options.MissionTimeout),
		authenticator:     options.Authenticator,
		generationLimiter: options.GenerationLimiter,
	}

	group := server.Group("/teacher-classes/:class_id/missions")
	generationRateLimiter := missionRateLimiter(options)
	group.GET("", handler.ListMissions)
	group.POST("/preview", handler.PostMissionPreview, generationRateLimiter)
	group.POST("/:mission_id/approve", handler.PostMissionApprove)
	group.DELETE("/:mission_id", handler.DeleteMission)
}

func (handler *Handler) PostMissionPreview(ctx *echo.Context) error {
	return handler.createMission(ctx)
}

func (handler *Handler) PostMissionApprove(ctx *echo.Context) error {
	if handler.authenticator == nil || handler.missionService == nil {
		slog.Error("teacher mission dependencies are not configured")
		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Teacher missions are not configured.")
	}

	classID := ctx.Param("class_id")
	if err := validateClassID(classID); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	missionID := ctx.Param("mission_id")
	if err := validateMissionID(missionID); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	var request ApproveMissionRequest
	if ctx.Request().Body != nil && ctx.Request().ContentLength != 0 {
		if err := ctx.Bind(&request); err != nil {
			return jsonError(ctx, http.StatusBadRequest, "bad_request", "Invalid JSON body.")
		}
	}
	if request.ExpectedDraftRevision <= 0 {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", "expected_draft_revision must be greater than zero")
	}

	requestContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.missionTimeout)
	defer cancel()

	identity, ok, err := handler.authenticate(requestContext, ctx)
	if err != nil || !ok {
		return err
	}

	mission, err := handler.missionService.Approve(
		requestContext,
		identity,
		classID,
		missionID,
		request.ExpectedDraftRevision,
	)
	if err != nil {
		return handler.serviceError(ctx, err)
	}

	return ctx.JSON(http.StatusOK, map[string]any{
		"mission": ToResponse(mission),
	})
}

func (handler *Handler) DeleteMission(ctx *echo.Context) error {
	if handler.authenticator == nil || handler.missionService == nil {
		slog.Error("teacher mission dependencies are not configured")
		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Teacher missions are not configured.")
	}

	classID := ctx.Param("class_id")
	if err := validateClassID(classID); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}
	missionID := ctx.Param("mission_id")
	if err := validateMissionID(missionID); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	requestContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.missionTimeout)
	defer cancel()

	identity, ok, err := handler.authenticate(requestContext, ctx)
	if err != nil || !ok {
		return err
	}
	if err := handler.missionService.Delete(requestContext, identity, classID, missionID); err != nil {
		return handler.serviceError(ctx, err)
	}

	return ctx.NoContent(http.StatusNoContent)
}

func (handler *Handler) ListMissions(ctx *echo.Context) error {
	if handler.authenticator == nil || handler.missionService == nil {
		slog.Error("teacher mission dependencies are not configured")
		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Teacher missions are not configured.")
	}

	classID := ctx.Param("class_id")
	if err := validateClassID(classID); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	requestContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.missionTimeout)
	defer cancel()

	identity, ok, err := handler.authenticate(requestContext, ctx)
	if err != nil || !ok {
		return err
	}

	missions, err := handler.missionService.List(requestContext, identity, classID)
	if err != nil {
		return handler.serviceError(ctx, err)
	}

	return ctx.JSON(http.StatusOK, map[string]any{
		"missions": ToResponses(missions),
	})
}

func (handler *Handler) createMission(ctx *echo.Context) error {
	if handler.authenticator == nil || handler.missionService == nil {
		slog.Error("teacher mission dependencies are not configured")
		return jsonError(ctx, http.StatusInternalServerError, "not_configured", "Teacher missions are not configured.")
	}

	classID := ctx.Param("class_id")
	if err := validateClassID(classID); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	var request CreateMissionRequest
	if err := ctx.Bind(&request); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "bad_request", "Invalid JSON body.")
	}
	if err := request.Validate(); err != nil {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", err.Error())
	}

	requestContext, cancel := context.WithTimeout(ctx.Request().Context(), handler.missionTimeout)
	defer cancel()

	identity, ok, err := handler.authenticate(requestContext, ctx)
	if err != nil || !ok {
		return err
	}
	if err := handler.limitGeneration(requestContext, ctx, identity); err != nil {
		return err
	}

	input := CreateMissionInput{
		MissionID:             request.MissionID,
		ExpectedDraftRevision: request.ExpectedDraftRevision,
		ClassID:               classID,
		ClassName:             request.ClassName,
		MissionName:           request.MissionName,
		Subject:               request.Subject,
		GradeLevel:            request.GradeLevel,
		LearningGoal:          request.LearningGoal,
		TeacherPrompt:         request.TeacherPrompt,
		AudienceType:          request.AudienceType,
		TargetStudentIDs:      request.TargetStudentIDs,
		Attachments:           toMissionAttachments(request.Attachments),
		Status:                StatusDraft,
	}

	mission, err := handler.missionService.Preview(requestContext, identity, input)
	if err != nil {
		return handler.serviceError(ctx, err)
	}

	return ctx.JSON(http.StatusOK, map[string]any{
		"mission": ToResponse(mission),
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

	slog.Warn("teacher mission auth failed", "error", err)
	return sharedfirebase.Identity{}, false, jsonError(echoCtx, http.StatusUnauthorized, "unauthorized", "Invalid Firebase ID token.")
}

func (handler *Handler) serviceError(ctx *echo.Context, err error) error {
	if errors.Is(err, teacherclass.ErrTeacherRequiresGoogleAuth) {
		return jsonError(ctx, http.StatusForbidden, "forbidden", "Teacher missions require Google sign in.")
	}
	if errors.Is(err, teacherclass.ErrClassOwnedByAnotherTeacher) {
		return jsonError(ctx, http.StatusForbidden, "forbidden", "This class code already belongs to another teacher.")
	}
	if errors.Is(err, teacherclass.ErrClassNotFound) || errors.Is(err, ErrMissionNotFound) {
		return jsonError(ctx, http.StatusNotFound, "not_found", "Teacher mission not found.")
	}
	if errors.Is(err, ErrMissionDraftConflict) {
		return jsonError(ctx, http.StatusConflict, "draft_conflict", "The mission draft changed. Generate the preview again before approving.")
	}
	if errors.Is(err, ErrMissionDeleted) {
		return jsonError(ctx, http.StatusGone, "mission_deleted", "This mission was deleted.")
	}
	if errors.Is(err, ErrMissionDraftRevisionRequired) {
		return jsonError(ctx, http.StatusBadRequest, "validation_failed", "expected_draft_revision must be greater than zero")
	}
	if errors.Is(err, ErrMissionAttachmentQueue) {
		return jsonError(ctx, http.StatusServiceUnavailable, "attachment_queue_unavailable", "Mission file storage is temporarily unavailable. Try publishing again.")
	}

	slog.Error("teacher mission request failed", "error", err)
	return jsonError(ctx, http.StatusInternalServerError, "teacher_mission_failed", "Could not process teacher mission.")
}

func (handler *Handler) limitGeneration(
	ctx context.Context,
	echoCtx *echo.Context,
	identity sharedfirebase.Identity,
) error {
	if handler.generationLimiter == nil {
		return nil
	}

	decision, err := handler.generationLimiter.Allow(ctx, string(identity.Provider)+":"+identity.ProviderUserID)
	if err != nil {
		slog.Error("teacher mission generation rate limiter failed", "error", err)
		return jsonError(echoCtx, http.StatusServiceUnavailable, "rate_limit_unavailable", "Mission generation is temporarily unavailable.")
	}

	echoCtx.Response().Header().Set("X-RateLimit-Limit", strconv.FormatInt(decision.Limit, 10))
	echoCtx.Response().Header().Set("X-RateLimit-Remaining", strconv.FormatInt(decision.Remaining, 10))
	if decision.Allowed {
		return nil
	}

	retryAfterSeconds := int64((decision.RetryAfter + time.Second - 1) / time.Second)
	if retryAfterSeconds < 1 {
		retryAfterSeconds = 1
	}
	echoCtx.Response().Header().Set("Retry-After", strconv.FormatInt(retryAfterSeconds, 10))

	return jsonError(echoCtx, http.StatusTooManyRequests, "generation_rate_limited", "Too many mission previews. Wait a moment and try again.")
}

func (request CreateMissionRequest) Validate() error {
	if err := validation.ValidateStruct(&request,
		validation.Field(&request.MissionID,
			validation.Length(0, 120),
			validation.By(validateOptionalMissionID),
		),
		validation.Field(&request.ExpectedDraftRevision,
			validation.Min(int64(0)),
		),
		validation.Field(&request.ClassName,
			validation.Length(0, 120),
		),
		validation.Field(&request.MissionName,
			validation.Required,
			validation.Length(2, 120),
		),
		validation.Field(&request.Subject,
			validation.Length(0, 80),
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
		validation.Field(&request.AudienceType,
			validation.In("", AudienceAll, AudienceSelected),
		),
		validation.Field(&request.TargetStudentIDs,
			validation.By(validateTargetStudentIDs),
		),
		validation.Field(&request.Attachments,
			validation.By(validateAttachments),
		),
	); err != nil {
		return err
	}

	if request.AudienceType == AudienceSelected && len(request.TargetStudentIDs) == 0 {
		return errors.New("target_student_ids is required when audience_type is selected")
	}
	if request.MissionID == "" && request.ExpectedDraftRevision > 0 {
		return errors.New("mission_id is required with expected_draft_revision")
	}
	if request.MissionID != "" && request.ExpectedDraftRevision <= 0 {
		return errors.New("expected_draft_revision must be greater than zero when mission_id is provided")
	}

	return nil
}

func validateOptionalMissionID(value any) error {
	missionID, ok := value.(string)
	if !ok || missionID == "" {
		return nil
	}

	return validateMissionID(missionID)
}

func validateTargetStudentIDs(value any) error {
	studentIDs, ok := value.([]string)
	if !ok {
		return nil
	}
	if len(studentIDs) > 100 {
		return errors.New("target_student_ids cannot contain more than 100 students")
	}

	for _, studentID := range studentIDs {
		if err := validation.Validate(studentID, validation.Required, validation.Length(1, 128)); err != nil {
			return errors.New("target_student_ids contains an invalid student id")
		}
	}

	return nil
}

func validateAttachments(value any) error {
	attachments, ok := value.([]MissionAttachmentRequest)
	if !ok {
		return nil
	}
	if len(attachments) > maxMissionAttachments {
		return errors.New("attachments cannot contain more than 5 files")
	}

	seen := make(map[string]struct{}, len(attachments))
	for _, attachment := range attachments {
		attachmentUUID := strings.TrimSpace(attachment.UploadcareUUID)
		if attachment.SizeBytes < 0 || attachment.SizeBytes > maxMissionAttachmentSizeBytes {
			return errors.New("each attachment must be 20 MB or smaller")
		}
		if attachmentUUID == "" || strings.TrimSpace(attachment.CDNURL) == "" {
			return errors.New("each attachment requires uploadcare_uuid and cdn_url")
		}
		if _, exists := seen[attachmentUUID]; exists {
			return errors.New("attachments cannot contain duplicate uploadcare_uuid values")
		}
		seen[attachmentUUID] = struct{}{}
		if err := validateMissionUploadcareURL(attachment.CDNURL, attachmentUUID); err != nil {
			return err
		}
		if err := validation.Validate(attachment.FileName, validation.Required, validation.Length(1, 255)); err != nil {
			return errors.New("each attachment requires a valid file_name")
		}
		if err := validation.Validate(attachment.MimeType, validation.Length(0, 160)); err != nil {
			return errors.New("each attachment requires a valid mime_type")
		}
	}

	return nil
}

func validateMissionUploadcareURL(rawURL string, uploadcareUUID string) error {
	parsedURL, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsedURL.Scheme != "https" || parsedURL.User != nil {
		return errors.New("each attachment requires a valid Uploadcare HTTPS URL")
	}
	if port := parsedURL.Port(); port != "" && port != "443" {
		return errors.New("each attachment requires a valid Uploadcare HTTPS URL")
	}

	host := strings.ToLower(strings.TrimSuffix(parsedURL.Hostname(), "."))
	if host != "ucarecdn.com" && !strings.HasSuffix(host, ".ucarecdn.com") {
		return errors.New("each attachment URL must use Uploadcare CDN")
	}
	path := "/" + strings.Trim(parsedURL.EscapedPath(), "/") + "/"
	if !strings.Contains(path, "/"+url.PathEscape(uploadcareUUID)+"/") {
		return errors.New("attachment uploadcare_uuid does not match its CDN URL")
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

func validateMissionID(value string) error {
	return validation.Validate(value,
		validation.Required,
		validation.Length(4, 120),
	)
}

func toMissionAttachments(input []MissionAttachmentRequest) []MissionAttachment {
	attachments := make([]MissionAttachment, 0, len(input))
	for _, attachment := range input {
		attachments = append(attachments, MissionAttachment{
			UploadcareUUID: attachment.UploadcareUUID,
			CDNURL:         attachment.CDNURL,
			FileName:       attachment.FileName,
			MimeType:       attachment.MimeType,
			SizeBytes:      attachment.SizeBytes,
		})
	}

	return attachments
}

func missionRateLimiter(options HandlerOptions) echo.MiddlewareFunc {
	return middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(middleware.RateLimiterMemoryStoreConfig{
			Rate:      resolveMissionRateLimitRate(options.MissionRateLimitRate),
			Burst:     resolveMissionRateLimitBurst(options.MissionRateLimitBurst),
			ExpiresIn: resolveMissionRateLimitExpires(options.MissionRateLimitExpires),
		}),
		IdentifierExtractor: func(ctx *echo.Context) (string, error) {
			return "teacher_mission:" + ctx.RealIP(), nil
		},
		DenyHandler: func(ctx *echo.Context, _ string, _ error) error {
			return jsonError(ctx, http.StatusTooManyRequests, "rate_limited", "Too many teacher mission requests.")
		},
	})
}

func resolveMissionTimeout(value time.Duration) time.Duration {
	if value <= 0 {
		return defaultMissionTimeout
	}

	return value
}

func resolveMissionRateLimitRate(value float64) float64 {
	if value <= 0 {
		return defaultMissionRateLimitRate
	}

	return value
}

func resolveMissionRateLimitBurst(value int) int {
	if value <= 0 {
		return defaultMissionRateLimitBurst
	}

	return value
}

func resolveMissionRateLimitExpires(value time.Duration) time.Duration {
	if value <= 0 {
		return defaultMissionRateLimitExpires
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
