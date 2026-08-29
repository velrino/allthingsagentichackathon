package users

import (
	"context"
	"errors"
	"testing"

	mission "classgame-api/internal/modules/mission"
)

func TestValidateStudentMissionCodeAcceptsPublishedMission(t *testing.T) {
	reader := &fakeMissionReader{
		mission: mission.MissionDocument{
			ID:          "mission-1",
			MissionCode: "123456",
			Status:      mission.StatusPublished,
		},
		exists: true,
	}
	service := NewService(nil, reader)

	if err := service.ValidateStudentMissionCode(context.Background(), " 123456 "); err != nil {
		t.Fatalf("validate student mission code: %v", err)
	}
	if reader.code != "123456" {
		t.Fatalf("mission code = %q, want %q", reader.code, "123456")
	}
}

func TestValidateStudentMissionCodeRejectsMissingMission(t *testing.T) {
	service := NewService(nil, &fakeMissionReader{})

	err := service.ValidateStudentMissionCode(context.Background(), "123456")
	if !errors.Is(err, ErrMissionCodeNotFound) {
		t.Fatalf("error = %v, want %v", err, ErrMissionCodeNotFound)
	}
}

func TestValidateStudentMissionCodeRejectsUnpublishedMission(t *testing.T) {
	service := NewService(nil, &fakeMissionReader{
		mission: mission.MissionDocument{
			ID:          "mission-1",
			MissionCode: "123456",
			Status:      mission.StatusDraft,
		},
		exists: true,
	})

	err := service.ValidateStudentMissionCode(context.Background(), "123456")
	if !errors.Is(err, ErrMissionCodeNotFound) {
		t.Fatalf("error = %v, want %v", err, ErrMissionCodeNotFound)
	}
}

type fakeMissionReader struct {
	code    string
	err     error
	exists  bool
	mission mission.MissionDocument
}

func (reader *fakeMissionReader) GetByCode(
	_ context.Context,
	missionCode string,
) (mission.MissionDocument, bool, error) {
	reader.code = missionCode
	return reader.mission, reader.exists, reader.err
}
