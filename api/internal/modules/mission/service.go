package mission

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"classgame-api/internal/modules/orchestrator"
	teacherclass "classgame-api/internal/modules/teacher-class"
	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

var (
	ErrMissionNotFound        = errors.New("teacher class mission not found")
	ErrMissionCodeUnavailable = errors.New("teacher class mission code is unavailable")
	ErrMissionCodeGeneration  = errors.New("could not generate a unique mission code")
)

const (
	missionCodeAlphabet       = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
	missionCodeLength         = 6
	missionCodeCreateAttempts = 12
	missionListLimit          = 100
)

type Orchestrator interface {
	BuildMission(context.Context, orchestrator.BuildMissionInput) (orchestrator.MissionBlueprint, error)
}

type TeacherClassService interface {
	Get(context.Context, sharedfirebase.Identity, string) (teacherclass.TeacherClassDocument, bool, error)
	SetActiveMission(context.Context, sharedfirebase.Identity, string, string) error
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
	input CreateMissionInput,
) (MissionDocument, error) {
	return service.createWithStatus(ctx, identity, input, StatusPreview)
}

func (service *Service) Create(
	ctx context.Context,
	identity sharedfirebase.Identity,
	input CreateMissionInput,
) (MissionDocument, error) {
	mission, err := service.createWithStatus(ctx, identity, input, StatusPublished)
	if err != nil {
		return MissionDocument{}, err
	}
	if err := service.teacherClassService.SetActiveMission(ctx, identity, mission.ClassID, mission.ID); err != nil {
		return MissionDocument{}, err
	}

	return mission, nil
}

func (service *Service) Approve(
	ctx context.Context,
	identity sharedfirebase.Identity,
	classID string,
	missionID string,
) (MissionDocument, error) {
	if service.repository == nil || service.teacherClassService == nil {
		return MissionDocument{}, errors.New("teacher class mission dependencies are not configured")
	}

	teacherClass, exists, err := service.teacherClassService.Get(ctx, identity, classID)
	if err != nil {
		return MissionDocument{}, err
	}
	if !exists {
		return MissionDocument{}, teacherclass.ErrClassNotFound
	}

	teacher, err := service.teacherClassService.TeacherFromIdentity(identity)
	if err != nil {
		return MissionDocument{}, err
	}

	mission, err := service.repository.Publish(
		ctx,
		teacherClass.ClassID,
		strings.TrimSpace(missionID),
		teacher.ProviderUserID,
		time.Now(),
	)
	if err != nil {
		return MissionDocument{}, err
	}
	if err := service.teacherClassService.SetActiveMission(ctx, identity, teacherClass.ClassID, mission.ID); err != nil {
		return MissionDocument{}, err
	}

	return mission, nil
}

func (service *Service) GetActive(
	ctx context.Context,
	identity sharedfirebase.Identity,
	classID string,
) (MissionDocument, bool, error) {
	teacherClass, exists, err := service.teacherClassService.Get(ctx, identity, classID)
	if err != nil || !exists || teacherClass.ActiveMissionID == "" {
		return MissionDocument{}, false, err
	}

	return service.repository.Get(ctx, teacherClass.ClassID, teacherClass.ActiveMissionID)
}

func (service *Service) List(
	ctx context.Context,
	identity sharedfirebase.Identity,
	classID string,
) ([]MissionDocument, error) {
	teacherClass, exists, err := service.teacherClassService.Get(ctx, identity, classID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return []MissionDocument{}, nil
	}

	return service.repository.List(ctx, teacherClass.ClassID, missionListLimit)
}

func (service *Service) createWithStatus(
	ctx context.Context,
	identity sharedfirebase.Identity,
	input CreateMissionInput,
	status string,
) (MissionDocument, error) {
	if service.orchestrator == nil || service.repository == nil || service.teacherClassService == nil {
		return MissionDocument{}, errors.New("teacher class mission dependencies are not configured")
	}

	input = normalizeInput(input)
	teacherClass, err := service.teacherClassService.Upsert(ctx, identity, teacherclass.UpsertTeacherClassInput{
		ClassID:    input.ClassID,
		ClassName:  input.ClassName,
		Subject:    input.Subject,
		GradeLevel: input.GradeLevel,
	})
	if err != nil {
		return MissionDocument{}, err
	}

	teacher, err := service.teacherClassService.TeacherFromIdentity(identity)
	if err != nil {
		return MissionDocument{}, err
	}

	blueprint, err := service.orchestrator.BuildMission(ctx, orchestrator.BuildMissionInput{
		ClassID:       teacherClass.ClassID,
		ClassName:     teacherClass.ClassName,
		MissionName:   input.MissionName,
		Subject:       input.Subject,
		GradeLevel:    input.GradeLevel,
		LearningGoal:  input.LearningGoal,
		TeacherPrompt: input.TeacherPrompt,
		Attachments:   toOrchestratorAttachments(input.Attachments),
	})
	if err != nil {
		return MissionDocument{}, err
	}

	timestamp := time.Now()
	publishedAt := time.Time{}
	if status == StatusPublished {
		publishedAt = timestamp
	}

	input.ClassID = teacherClass.ClassID
	input.ClassCode = teacherClass.ClassCode
	input.ClassName = teacherClass.ClassName
	input.Teacher = teacher
	input.Blueprint = blueprint
	input.Status = status
	input.PublishedAt = publishedAt
	input.Timestamp = timestamp

	return service.createWithGeneratedCode(ctx, input)
}

func (service *Service) createWithGeneratedCode(
	ctx context.Context,
	input CreateMissionInput,
) (MissionDocument, error) {
	for attempt := 0; attempt < missionCodeCreateAttempts; attempt++ {
		missionCode, err := generateMissionCode()
		if err != nil {
			return MissionDocument{}, fmt.Errorf("generate mission code: %w", err)
		}

		input.MissionCode = missionCode
		mission, err := service.repository.Create(ctx, input)
		if errors.Is(err, ErrMissionCodeUnavailable) {
			continue
		}

		return mission, err
	}

	return MissionDocument{}, ErrMissionCodeGeneration
}

func normalizeInput(input CreateMissionInput) CreateMissionInput {
	input.ClassID = normalizeCode(input.ClassID)
	input.ClassName = normalizeText(input.ClassName)
	input.MissionName = normalizeText(input.MissionName)
	input.Subject = normalizeText(input.Subject)
	input.GradeLevel = normalizeText(input.GradeLevel)
	input.LearningGoal = normalizeText(input.LearningGoal)
	input.TeacherPrompt = normalizeText(input.TeacherPrompt)
	input.AudienceType = strings.ToLower(strings.TrimSpace(input.AudienceType))
	input.TargetStudentIDs = normalizeStudentIDs(input.TargetStudentIDs)
	input.Attachments = normalizeAttachments(input.Attachments)

	if input.ClassName == "" {
		input.ClassName = input.ClassID
	}
	if input.MissionName == "" {
		input.MissionName = "Class review"
	}
	if input.Subject == "" {
		input.Subject = "Mathematics"
	}
	if input.GradeLevel == "" {
		input.GradeLevel = "7th grade"
	}
	if input.AudienceType != AudienceSelected || len(input.TargetStudentIDs) == 0 {
		input.AudienceType = AudienceAll
		input.TargetStudentIDs = []string{}
	}

	return input
}

func normalizeStudentIDs(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		studentID := strings.TrimSpace(value)
		if studentID == "" {
			continue
		}
		if _, exists := seen[studentID]; exists {
			continue
		}

		seen[studentID] = struct{}{}
		normalized = append(normalized, studentID)
	}

	return normalized
}

func normalizeAttachments(attachments []MissionAttachment) []MissionAttachment {
	normalized := make([]MissionAttachment, 0, len(attachments))
	for _, attachment := range attachments {
		fileName := normalizeText(attachment.FileName)
		cdnURL := strings.TrimSpace(attachment.CDNURL)
		if attachment.UploadcareUUID == "" && fileName == "" && cdnURL == "" {
			continue
		}

		normalized = append(normalized, MissionAttachment{
			UploadcareUUID: strings.TrimSpace(attachment.UploadcareUUID),
			CDNURL:         cdnURL,
			FileName:       fileName,
			MimeType:       normalizeText(attachment.MimeType),
			SizeBytes:      attachment.SizeBytes,
		})
	}

	return normalized
}

func toOrchestratorAttachments(attachments []MissionAttachment) []orchestrator.AttachmentInput {
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

func generateMissionCode() (string, error) {
	code := make([]byte, missionCodeLength)
	alphabetLength := big.NewInt(int64(len(missionCodeAlphabet)))

	for index := range code {
		characterIndex, err := rand.Int(rand.Reader, alphabetLength)
		if err != nil {
			return "", err
		}
		code[index] = missionCodeAlphabet[characterIndex.Int64()]
	}

	return string(code), nil
}
