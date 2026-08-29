package users

import (
	"context"
	"errors"
	"testing"

	mission "classgame-api/internal/modules/mission"
	sharedratelimit "classgame-api/internal/shared/ratelimit"
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

func TestExistingStudentTutorTurnMakesEventIDIdempotent(t *testing.T) {
	existing := StudentTutorTurn{
		ID:       tutorTurnID("event-1"),
		Sequence: 7,
	}

	turn, exists := existingStudentTutorTurn([]StudentTutorTurn{existing}, "event-1")
	if !exists {
		t.Fatal("expected existing tutor turn")
	}
	if turn.Sequence != existing.Sequence {
		t.Fatalf("sequence = %d, want %d", turn.Sequence, existing.Sequence)
	}
}

func TestStudentTutorTurnLimitMatchesThreeQuestionMissionBudget(t *testing.T) {
	turns := make([]StudentTutorTurn, maxGeneratedTutorTurnsPerAttempt)
	if !studentTutorTurnLimitReached(turns) {
		t.Fatalf("expected %d tutor turns to reach the attempt limit", maxGeneratedTutorTurnsPerAttempt)
	}
	if studentTutorTurnLimitReached(turns[:len(turns)-1]) {
		t.Fatalf("expected fewer than %d tutor turns to remain allowed", maxGeneratedTutorTurnsPerAttempt)
	}
}

func TestLearningGenerationQuotaFailsClosedByClass(t *testing.T) {
	limiter := &fakeLearningGenerationLimiter{
		decision: sharedratelimit.Decision{Allowed: false},
	}
	service := &Service{learningGenerationLimiter: limiter}

	if service.allowLearningGeneration(context.Background(), "class-1") {
		t.Fatal("expected denied class quota to disable GenAI generation")
	}
	if len(limiter.identifiers) != 1 || limiter.identifiers[0] != "class:class-1" {
		t.Fatalf("limiter identifiers = %#v", limiter.identifiers)
	}
}

func TestLearningGenerationQuotaFailsClosedWhenRedisIsUnavailable(t *testing.T) {
	service := &Service{learningGenerationLimiter: &fakeLearningGenerationLimiter{
		err: errors.New("redis unavailable"),
	}}

	if service.allowLearningGeneration(context.Background(), "class-1") {
		t.Fatal("expected Redis failure to disable GenAI generation")
	}
}

type fakeMissionReader struct {
	code    string
	err     error
	exists  bool
	mission mission.MissionDocument
}

type fakeLearningGenerationLimiter struct {
	decision    sharedratelimit.Decision
	err         error
	identifiers []string
}

func (limiter *fakeLearningGenerationLimiter) Allow(
	_ context.Context,
	identifier string,
) (sharedratelimit.Decision, error) {
	limiter.identifiers = append(limiter.identifiers, identifier)
	return limiter.decision, limiter.err
}

func (reader *fakeMissionReader) GetByCode(
	_ context.Context,
	missionCode string,
) (mission.MissionDocument, bool, error) {
	reader.code = missionCode
	return reader.mission, reader.exists, reader.err
}
