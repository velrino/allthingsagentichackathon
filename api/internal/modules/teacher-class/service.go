package teacherclass

import (
	"context"
	"errors"
	"strings"
	"time"

	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

var ErrTeacherRequiresGoogleAuth = errors.New("teacher classes require google auth")

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

func (service *Service) Get(
	ctx context.Context,
	identity sharedfirebase.Identity,
	classID string,
) (TeacherClassDocument, bool, error) {
	teacher, err := service.teacher(identity)
	if err != nil {
		return TeacherClassDocument{}, false, err
	}

	teacherClass, exists, err := service.repository.Get(ctx, normalizeClassID(classID))
	if err != nil || !exists {
		return teacherClass, exists, err
	}
	if teacherClass.TeacherID != teacher.ProviderUserID {
		return TeacherClassDocument{}, true, ErrClassOwnedByAnotherTeacher
	}

	return teacherClass, true, nil
}

func (service *Service) List(
	ctx context.Context,
	identity sharedfirebase.Identity,
) ([]TeacherClassDocument, error) {
	teacher, err := service.teacher(identity)
	if err != nil {
		return nil, err
	}

	return service.repository.ListByTeacherID(ctx, teacher.ProviderUserID)
}

func (service *Service) Upsert(
	ctx context.Context,
	identity sharedfirebase.Identity,
	input UpsertTeacherClassInput,
) (TeacherClassDocument, error) {
	teacher, err := service.teacher(identity)
	if err != nil {
		return TeacherClassDocument{}, err
	}

	input.Teacher = teacher
	input.ClassID = normalizeClassID(input.ClassID)
	input.ClassName = normalizeText(input.ClassName)
	input.Subject = normalizeText(input.Subject)
	input.GradeLevel = normalizeText(input.GradeLevel)
	input.Timestamp = time.Now()

	if input.ClassName == "" {
		input.ClassName = input.ClassID
	}
	if input.Subject == "" {
		input.Subject = "Mathematics"
	}
	if input.GradeLevel == "" {
		input.GradeLevel = "7th grade"
	}

	return service.repository.Upsert(ctx, input)
}

func (service *Service) SetActiveActivity(
	ctx context.Context,
	identity sharedfirebase.Identity,
	classID string,
	activityID string,
) error {
	teacher, err := service.teacher(identity)
	if err != nil {
		return err
	}

	return service.repository.SetActiveActivity(
		ctx,
		normalizeClassID(classID),
		teacher.ProviderUserID,
		activityID,
		time.Now(),
	)
}

func (service *Service) TeacherFromIdentity(identity sharedfirebase.Identity) (TeacherSummary, error) {
	return service.teacher(identity)
}

func (service *Service) teacher(identity sharedfirebase.Identity) (TeacherSummary, error) {
	if identity.AuthMethod != sharedfirebase.AuthMethodGoogle {
		return TeacherSummary{}, ErrTeacherRequiresGoogleAuth
	}

	displayName := strings.TrimSpace(identity.DisplayName)
	if displayName == "" {
		displayName = strings.TrimSpace(identity.Email)
	}

	return TeacherSummary{
		ProviderUserID: identity.ProviderUserID,
		DisplayName:    displayName,
		Email:          strings.TrimSpace(identity.Email),
		PhotoURL:       strings.TrimSpace(identity.PhotoURL),
	}, nil
}

func normalizeClassID(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizeText(value string) string {
	return strings.Join(strings.Fields(value), " ")
}
