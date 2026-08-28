package users

import (
	"context"
	"errors"
	"strings"
	"time"

	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

var ErrStudentRequiresAnonymousAuth = errors.New("student session requires anonymous auth")
var ErrStudentNotFound = errors.New("student user not found")

type Service struct {
	repository *Repository
}

func NewService(repository *Repository) *Service {
	return &Service{
		repository: repository,
	}
}

func (service *Service) UpsertStudent(
	ctx context.Context,
	identity sharedfirebase.Identity,
	classID string,
	studentName string,
) (UserDocument, error) {
	if identity.AuthMethod != sharedfirebase.AuthMethodAnonymous {
		return UserDocument{}, ErrStudentRequiresAnonymousAuth
	}

	return service.repository.UpsertStudent(ctx, UpsertStudentInput{
		Identity:    identity,
		ClassID:     normalizeClassID(classID),
		StudentName: normalizeStudentName(studentName),
		Timestamp:   time.Now(),
	})
}

func (service *Service) UpdateStudentPresence(
	ctx context.Context,
	identity sharedfirebase.Identity,
	activityID string,
	subject string,
	stageID string,
	stageName string,
	status string,
) (UserDocument, error) {
	if identity.AuthMethod != sharedfirebase.AuthMethodAnonymous {
		return UserDocument{}, ErrStudentRequiresAnonymousAuth
	}

	return service.repository.UpdateStudentPresence(ctx, UpdateStudentPresenceInput{
		Identity:   identity,
		ActivityID: normalizeText(activityID),
		Subject:    normalizeText(subject),
		StageID:    normalizeText(stageID),
		StageName:  normalizeText(stageName),
		Status:     normalizeText(status),
		Timestamp:  time.Now(),
	})
}

func normalizeClassID(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizeStudentName(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func normalizeText(value string) string {
	return strings.Join(strings.Fields(value), " ")
}
