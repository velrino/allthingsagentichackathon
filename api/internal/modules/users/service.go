package users

import (
	"context"
	"errors"
	"strings"
	"time"

	mission "classgame-api/internal/modules/mission"
	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

var ErrStudentRequiresAnonymousAuth = errors.New("student session requires anonymous auth")
var ErrStudentNotFound = errors.New("student user not found")
var ErrMissionCodeNotFound = errors.New("published mission code not found")

type MissionReader interface {
	GetByCode(context.Context, string) (mission.MissionDocument, bool, error)
}

type Service struct {
	missionReader MissionReader
	repository    *Repository
}

func NewService(repository *Repository, missionReader MissionReader) *Service {
	return &Service{
		missionReader: missionReader,
		repository:    repository,
	}
}

func (service *Service) UpsertStudent(
	ctx context.Context,
	identity sharedfirebase.Identity,
	missionCode string,
	studentName string,
) (UserDocument, error) {
	if identity.AuthMethod != sharedfirebase.AuthMethodAnonymous {
		return UserDocument{}, ErrStudentRequiresAnonymousAuth
	}

	if service.missionReader == nil {
		return UserDocument{}, errors.New("student mission reader is not configured")
	}

	missionDocument, exists, err := service.missionReader.GetByCode(ctx, normalizeMissionCode(missionCode))
	if err != nil {
		return UserDocument{}, err
	}
	if !exists || missionDocument.Status != mission.StatusPublished {
		return UserDocument{}, ErrMissionCodeNotFound
	}

	return service.repository.UpsertStudent(ctx, UpsertStudentInput{
		Identity:       identity,
		ClassID:        missionDocument.ClassID,
		MissionID:      missionDocument.ID,
		MissionCode:    missionDocument.MissionCode,
		MissionSubject: missionDocument.Subject,
		StudentName:    normalizeStudentName(studentName),
		Timestamp:      time.Now(),
	})
}

func (service *Service) UpdateStudentPresence(
	ctx context.Context,
	identity sharedfirebase.Identity,
	missionID string,
	subject string,
	stageID string,
	stageName string,
	status string,
) (UserDocument, error) {
	if identity.AuthMethod != sharedfirebase.AuthMethodAnonymous {
		return UserDocument{}, ErrStudentRequiresAnonymousAuth
	}

	return service.repository.UpdateStudentPresence(ctx, UpdateStudentPresenceInput{
		Identity:  identity,
		MissionID: normalizeText(missionID),
		Subject:   normalizeText(subject),
		StageID:   normalizeText(stageID),
		StageName: normalizeText(stageName),
		Status:    normalizeText(status),
		Timestamp: time.Now(),
	})
}

func normalizeMissionCode(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizeStudentName(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func normalizeText(value string) string {
	return strings.Join(strings.Fields(value), " ")
}
