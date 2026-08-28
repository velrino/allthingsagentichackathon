package users

import (
	"context"
	"errors"
	"strings"
	"time"

	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

var ErrStudentRequiresAnonymousAuth = errors.New("student session requires anonymous auth")

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
	turmaID string,
	studentName string,
) (UserDocument, error) {
	if identity.AuthMethod != sharedfirebase.AuthMethodAnonymous {
		return UserDocument{}, ErrStudentRequiresAnonymousAuth
	}

	return service.repository.UpsertStudent(ctx, UpsertStudentInput{
		Identity:    identity,
		TurmaID:     normalizeTurmaID(turmaID),
		StudentName: normalizeStudentName(studentName),
		Timestamp:   time.Now(),
	})
}

func normalizeTurmaID(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizeStudentName(value string) string {
	return strings.Join(strings.Fields(value), " ")
}
