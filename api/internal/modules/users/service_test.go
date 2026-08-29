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
			MissionCode: "ABC234",
			Status:      mission.StatusPublished,
		},
		exists: true,
	}
	service := NewService(nil, reader)

	if err := service.ValidateStudentMissionCode(context.Background(), " abc234 "); err != nil {
		t.Fatalf("validate student mission code: %v", err)
	}
	if reader.code != "ABC234" {
		t.Fatalf("mission code = %q, want %q", reader.code, "ABC234")
	}
}

func TestValidateStudentMissionCodeRejectsMissingMission(t *testing.T) {
	service := NewService(nil, &fakeMissionReader{})

	err := service.ValidateStudentMissionCode(context.Background(), "ABC234")
	if !errors.Is(err, ErrMissionCodeNotFound) {
		t.Fatalf("error = %v, want %v", err, ErrMissionCodeNotFound)
	}
}

func TestValidateStudentMissionCodeRejectsUnpublishedMission(t *testing.T) {
	service := NewService(nil, &fakeMissionReader{
		mission: mission.MissionDocument{
			ID:          "mission-1",
			MissionCode: "ABC234",
			Status:      mission.StatusDraft,
		},
		exists: true,
	})

	err := service.ValidateStudentMissionCode(context.Background(), "ABC234")
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
