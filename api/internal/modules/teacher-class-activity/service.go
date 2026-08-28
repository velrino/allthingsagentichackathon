package teacherclassactivity

import (
	"context"
	"errors"
	"strings"
	"time"

	"classgame-api/internal/modules/orchestrator"
	teacherclass "classgame-api/internal/modules/teacher-class"
	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

var ErrActivityNotFound = errors.New("teacher class activity not found")

type Orchestrator interface {
	BuildClassActivity(context.Context, orchestrator.BuildClassActivityInput) (orchestrator.ActivityBlueprint, error)
}

type TeacherClassService interface {
	Get(context.Context, sharedfirebase.Identity, string) (teacherclass.TeacherClassDocument, bool, error)
	SetActiveActivity(context.Context, sharedfirebase.Identity, string, string) error
	TeacherFromIdentity(sharedfirebase.Identity) (teacherclass.TeacherSummary, error)
	Upsert(context.Context, sharedfirebase.Identity, teacherclass.UpsertTeacherClassInput) (teacherclass.TeacherClassDocument, error)
}

type Service struct {
	orchestrator        Orchestrator
	repository          *Repository
	teacherClassService TeacherClassService
}

func NewService(
	repository *Repository,
	teacherClassService TeacherClassService,
	orchestrator Orchestrator,
) *Service {
	return &Service{
		orchestrator:        orchestrator,
		repository:          repository,
		teacherClassService: teacherClassService,
	}
}

func (service *Service) Preview(
	ctx context.Context,
	identity sharedfirebase.Identity,
	input CreateActivityInput,
) (ActivityDocument, error) {
	return service.createWithStatus(ctx, identity, input, StatusPreview)
}

func (service *Service) Create(
	ctx context.Context,
	identity sharedfirebase.Identity,
	input CreateActivityInput,
) (ActivityDocument, error) {
	activity, err := service.createWithStatus(ctx, identity, input, StatusPublished)
	if err != nil {
		return ActivityDocument{}, err
	}
	if err := service.teacherClassService.SetActiveActivity(ctx, identity, activity.ClassID, activity.ID); err != nil {
		return ActivityDocument{}, err
	}

	return activity, nil
}

func (service *Service) Approve(
	ctx context.Context,
	identity sharedfirebase.Identity,
	classID string,
	activityID string,
) (ActivityDocument, error) {
	if service.repository == nil || service.teacherClassService == nil {
		return ActivityDocument{}, errors.New("teacher class activity dependencies are not configured")
	}

	teacherClass, exists, err := service.teacherClassService.Get(ctx, identity, classID)
	if err != nil {
		return ActivityDocument{}, err
	}
	if !exists {
		return ActivityDocument{}, teacherclass.ErrClassNotFound
	}

	teacher, err := service.teacherClassService.TeacherFromIdentity(identity)
	if err != nil {
		return ActivityDocument{}, err
	}

	activity, err := service.repository.Publish(
		ctx,
		teacherClass.ClassID,
		strings.TrimSpace(activityID),
		teacher.ProviderUserID,
		time.Now(),
	)
	if err != nil {
		return ActivityDocument{}, err
	}
	if err := service.teacherClassService.SetActiveActivity(ctx, identity, teacherClass.ClassID, activity.ID); err != nil {
		return ActivityDocument{}, err
	}

	return activity, nil
}

func (service *Service) GetActive(
	ctx context.Context,
	identity sharedfirebase.Identity,
	classID string,
) (ActivityDocument, bool, error) {
	teacherClass, exists, err := service.teacherClassService.Get(ctx, identity, classID)
	if err != nil || !exists || teacherClass.ActiveActivityID == "" {
		return ActivityDocument{}, false, err
	}

	return service.repository.Get(ctx, teacherClass.ClassID, teacherClass.ActiveActivityID)
}

func (service *Service) List(
	ctx context.Context,
	identity sharedfirebase.Identity,
	classID string,
) ([]ActivityDocument, error) {
	teacherClass, exists, err := service.teacherClassService.Get(ctx, identity, classID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return []ActivityDocument{}, nil
	}

	return service.repository.List(ctx, teacherClass.ClassID, 10)
}

func (service *Service) createWithStatus(
	ctx context.Context,
	identity sharedfirebase.Identity,
	input CreateActivityInput,
	status string,
) (ActivityDocument, error) {
	if service.orchestrator == nil || service.repository == nil || service.teacherClassService == nil {
		return ActivityDocument{}, errors.New("teacher class activity dependencies are not configured")
	}

	input = normalizeInput(input)
	teacherClass, err := service.teacherClassService.Upsert(ctx, identity, teacherclass.UpsertTeacherClassInput{
		ClassID:    input.ClassID,
		ClassName:  input.ClassName,
		Subject:    input.Subject,
		GradeLevel: input.GradeLevel,
	})
	if err != nil {
		return ActivityDocument{}, err
	}

	teacher, err := service.teacherClassService.TeacherFromIdentity(identity)
	if err != nil {
		return ActivityDocument{}, err
	}

	blueprint, err := service.orchestrator.BuildClassActivity(ctx, orchestrator.BuildClassActivityInput{
		ClassID:       teacherClass.ClassID,
		ClassName:     teacherClass.ClassName,
		ActivityName:  input.ActivityName,
		Subject:       input.Subject,
		GradeLevel:    input.GradeLevel,
		LearningGoal:  input.LearningGoal,
		TeacherPrompt: input.TeacherPrompt,
		Attachments:   toOrchestratorAttachments(input.Attachments),
	})
	if err != nil {
		return ActivityDocument{}, err
	}

	timestamp := time.Now()
	publishedAt := time.Time{}
	if status == StatusPublished {
		publishedAt = timestamp
	}

	input.ClassID = teacherClass.ClassID
	input.ClassName = teacherClass.ClassName
	input.Teacher = teacher
	input.Blueprint = blueprint
	input.Status = status
	input.PublishedAt = publishedAt
	input.Timestamp = timestamp

	return service.repository.Create(ctx, input)
}

func normalizeInput(input CreateActivityInput) CreateActivityInput {
	input.ClassID = normalizeCode(input.ClassID)
	input.ClassName = normalizeText(input.ClassName)
	input.ActivityName = normalizeText(input.ActivityName)
	input.Subject = normalizeText(input.Subject)
	input.GradeLevel = normalizeText(input.GradeLevel)
	input.LearningGoal = normalizeText(input.LearningGoal)
	input.TeacherPrompt = normalizeText(input.TeacherPrompt)
	input.Attachments = normalizeAttachments(input.Attachments)

	if input.ClassName == "" {
		input.ClassName = input.ClassID
	}
	if input.ActivityName == "" {
		input.ActivityName = "Class review"
	}
	if input.Subject == "" {
		input.Subject = "Mathematics"
	}
	if input.GradeLevel == "" {
		input.GradeLevel = "7th grade"
	}

	return input
}

func normalizeAttachments(attachments []ActivityAttachment) []ActivityAttachment {
	normalized := make([]ActivityAttachment, 0, len(attachments))
	for _, attachment := range attachments {
		fileName := normalizeText(attachment.FileName)
		cdnURL := strings.TrimSpace(attachment.CDNURL)
		if attachment.UploadcareUUID == "" && fileName == "" && cdnURL == "" {
			continue
		}

		normalized = append(normalized, ActivityAttachment{
			UploadcareUUID: strings.TrimSpace(attachment.UploadcareUUID),
			CDNURL:         cdnURL,
			FileName:       fileName,
			MimeType:       normalizeText(attachment.MimeType),
			SizeBytes:      attachment.SizeBytes,
		})
	}

	return normalized
}

func toOrchestratorAttachments(attachments []ActivityAttachment) []orchestrator.AttachmentInput {
	output := make([]orchestrator.AttachmentInput, 0, len(attachments))
	for _, attachment := range attachments {
		output = append(output, orchestrator.AttachmentInput{
			FileName: attachment.FileName,
			MimeType: attachment.MimeType,
			CDNURL:   attachment.CDNURL,
		})
	}

	return output
}

func normalizeText(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func normalizeCode(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}
