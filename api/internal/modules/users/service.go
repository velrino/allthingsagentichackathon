package users

import (
	"context"
	"errors"
	"strings"
	"time"

	mission "classgame-api/internal/modules/mission"
	"classgame-api/internal/modules/orchestrator"
	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

var ErrStudentRequiresAnonymousAuth = errors.New("student session requires anonymous auth")
var ErrStudentNotFound = errors.New("student user not found")
var ErrMissionCodeNotFound = errors.New("published mission code not found")
var ErrStudentMissionMismatch = errors.New("student mission does not match current session")
var ErrStudentAttemptNotFound = errors.New("student learning attempt not found")

type MissionReader interface {
	GetByCode(context.Context, string) (mission.MissionDocument, bool, error)
}

type LearningTraceGenerator interface {
	BuildLearningTrace(context.Context, orchestrator.BuildLearningTraceInput) (orchestrator.LearningTraceBlueprint, error)
}

type Service struct {
	learningTraceGenerator LearningTraceGenerator
	missionReader          MissionReader
	repository             *Repository
}

func NewService(
	repository *Repository,
	missionReader MissionReader,
	learningTraceGenerators ...LearningTraceGenerator,
) *Service {
	service := &Service{
		missionReader: missionReader,
		repository:    repository,
	}
	if len(learningTraceGenerators) > 0 {
		service.learningTraceGenerator = learningTraceGenerators[0]
	}

	return service
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

	missionDocument, err := service.publishedMissionByCode(ctx, missionCode)
	if err != nil {
		return UserDocument{}, err
	}

	return service.repository.UpsertStudent(ctx, UpsertStudentInput{
		Identity:                 identity,
		ClassID:                  missionDocument.ClassID,
		MissionID:                missionDocument.ID,
		MissionCode:              missionDocument.MissionCode,
		MissionPublishedRevision: missionDocument.PublishedRevision,
		MissionSubject:           missionDocument.Subject,
		StudentName:              normalizeStudentName(studentName),
		Timestamp:                time.Now(),
	})
}

func (service *Service) ValidateStudentMissionCode(
	ctx context.Context,
	missionCode string,
) error {
	_, err := service.publishedMissionByCode(ctx, missionCode)
	return err
}

func (service *Service) publishedMissionByCode(
	ctx context.Context,
	missionCode string,
) (mission.MissionDocument, error) {
	if service.missionReader == nil {
		return mission.MissionDocument{}, errors.New("student mission reader is not configured")
	}

	missionDocument, exists, err := service.missionReader.GetByCode(ctx, normalizeMissionCode(missionCode))
	if err != nil {
		return mission.MissionDocument{}, err
	}
	if !exists || missionDocument.Status != mission.StatusPublished {
		return mission.MissionDocument{}, ErrMissionCodeNotFound
	}

	return missionDocument, nil
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

func (service *Service) SaveStudentLearningSnapshot(
	ctx context.Context,
	identity sharedfirebase.Identity,
	missionID string,
	status string,
	snapshot StudentLearningSnapshot,
) (StudentMissionAttemptDocument, error) {
	if identity.AuthMethod != sharedfirebase.AuthMethodAnonymous {
		return StudentMissionAttemptDocument{}, ErrStudentRequiresAnonymousAuth
	}
	if service.repository == nil {
		return StudentMissionAttemptDocument{}, errors.New("student learning repository is not configured")
	}

	normalizedStatus := strings.ToLower(normalizeText(status))
	normalizedSnapshot := normalizeLearningSnapshot(snapshot)
	liveInput := toLearningTraceInput(mission.MissionDocument{
		ID:      normalizeText(missionID),
		Subject: "Classroom learning",
	}, normalizedSnapshot, normalizedStatus, StudentLearningMemory{})
	liveInput.Snapshot.Status = "in_progress"
	liveTrace := orchestrator.BuildObservedLearningTrace(liveInput, "")
	liveTrace.Finalized = false

	attempt, user, err := service.repository.SaveStudentLearningSnapshot(ctx, SaveStudentLearningSnapshotInput{
		Identity:  identity,
		MissionID: normalizeText(missionID),
		Status:    normalizedStatus,
		Snapshot:  normalizedSnapshot,
		Trace:     liveTrace,
		Timestamp: time.Now(),
	})
	if err != nil {
		return StudentMissionAttemptDocument{}, err
	}
	if normalizedStatus != "completed" || attempt.Trace.Finalized {
		return attempt, nil
	}

	missionDocument, err := service.publishedMissionByCode(ctx, user.Student.MissionCode)
	if err != nil {
		return StudentMissionAttemptDocument{}, err
	}
	traceInput := toLearningTraceInput(
		missionDocument,
		normalizedSnapshot,
		"completed",
		user.Student.LearningMemory,
	)
	trace := orchestrator.BuildObservedLearningTrace(traceInput, "learning trace generator is not configured")
	if service.learningTraceGenerator != nil {
		trace, err = service.learningTraceGenerator.BuildLearningTrace(ctx, traceInput)
		if err != nil {
			return StudentMissionAttemptDocument{}, err
		}
	}
	trace.Finalized = true
	trace.EventCount = len(normalizedSnapshot.Events)

	memory := StudentLearningMemory{
		Strengths:            trace.Strengths,
		ImprovementAreas:     trace.ImprovementAreas,
		PreferredExplanation: normalizedSnapshot.Preferences.ExplanationStyle,
		NextAdaptation:       trace.NextAdaptation,
		LastMissionID:        missionDocument.ID,
	}

	return service.repository.FinalizeStudentLearningTrace(
		ctx,
		user.ID,
		attempt.ID,
		trace,
		memory,
		time.Now(),
	)
}

func (service *Service) GetCurrentStudentLearningAttempt(
	ctx context.Context,
	identity sharedfirebase.Identity,
	missionID string,
) (StudentMissionAttemptDocument, bool, error) {
	if identity.AuthMethod != sharedfirebase.AuthMethodAnonymous {
		return StudentMissionAttemptDocument{}, false, ErrStudentRequiresAnonymousAuth
	}
	if service.repository == nil {
		return StudentMissionAttemptDocument{}, false, errors.New("student learning repository is not configured")
	}

	attempt, _, exists, err := service.repository.GetCurrentStudentLearningAttempt(
		ctx,
		identity.ProviderUserID,
		normalizeText(missionID),
	)
	return attempt, exists, err
}

func toLearningTraceInput(
	missionDocument mission.MissionDocument,
	snapshot StudentLearningSnapshot,
	status string,
	memory StudentLearningMemory,
) orchestrator.BuildLearningTraceInput {
	progress := make([]orchestrator.LearningTraceStageProgress, 0, len(snapshot.Progress))
	for _, stage := range snapshot.Progress {
		progress = append(progress, orchestrator.LearningTraceStageProgress{
			StageID:  stage.StageID,
			Status:   stage.Status,
			Correct:  stage.Correct,
			Required: stage.Required,
		})
	}
	notes := make([]orchestrator.LearningTraceNote, 0, len(snapshot.Notes))
	for _, note := range snapshot.Notes {
		notes = append(notes, orchestrator.LearningTraceNote{
			Kind:     note.Kind,
			Skill:    note.Skill,
			Text:     note.Text,
			Evidence: note.Evidence,
			Count:    note.Count,
		})
	}
	decisions := make([]orchestrator.LearningTraceDecision, 0, len(snapshot.Decisions))
	for _, decision := range snapshot.Decisions {
		decisions = append(decisions, orchestrator.LearningTraceDecision{
			Action:  decision.Action,
			Message: decision.Message,
			Why:     decision.Why,
		})
	}
	events := make([]orchestrator.LearningTraceEvent, 0, len(snapshot.Events))
	for _, event := range snapshot.Events {
		events = append(events, orchestrator.LearningTraceEvent{
			ID:         event.ID,
			Sequence:   event.Sequence,
			Type:       event.Type,
			StageID:    event.StageID,
			QuestionID: event.QuestionID,
			Title:      event.Title,
			Detail:     event.Detail,
			Outcome:    event.Outcome,
			OccurredAt: event.OccurredAt,
		})
	}

	return orchestrator.BuildLearningTraceInput{
		Mission: orchestrator.LearningTraceMission{
			Title:        missionDocument.Title,
			Subject:      missionDocument.Subject,
			GradeLevel:   missionDocument.GradeLevel,
			LearningGoal: missionDocument.LearningGoal,
		},
		Snapshot: orchestrator.LearningTraceSnapshot{
			Status:     strings.ToLower(normalizeText(status)),
			Progress:   progress,
			Notes:      notes,
			Redirected: snapshot.Redirected,
			ReturnTo:   snapshot.ReturnTo,
			LastPod:    snapshot.LastPod,
			Preferences: orchestrator.LearningTracePreferences{
				ExplanationStyle: snapshot.Preferences.ExplanationStyle,
				DifficultyBias:   snapshot.Preferences.DifficultyBias,
			},
			Decisions: decisions,
			Events:    events,
		},
		PreviousMemory: orchestrator.LearningTracePreviousMemory{
			Strengths:            memory.Strengths,
			ImprovementAreas:     memory.ImprovementAreas,
			PreferredExplanation: memory.PreferredExplanation,
			NextAdaptation:       memory.NextAdaptation,
		},
	}
}

func normalizeLearningSnapshot(snapshot StudentLearningSnapshot) StudentLearningSnapshot {
	snapshot.ReturnTo = normalizeText(snapshot.ReturnTo)
	snapshot.LastPod = normalizeText(snapshot.LastPod)
	for index := range snapshot.Progress {
		progress := &snapshot.Progress[index]
		progress.StageID = normalizeText(progress.StageID)
		progress.Status = strings.ToLower(normalizeText(progress.Status))
	}
	for index := range snapshot.Notes {
		note := &snapshot.Notes[index]
		note.ID = normalizeText(note.ID)
		note.MisconceptionID = normalizeText(note.MisconceptionID)
		note.Text = normalizeText(note.Text)
		note.Kind = strings.ToLower(normalizeText(note.Kind))
		note.Skill = normalizeText(note.Skill)
	}
	for index := range snapshot.Decisions {
		decision := &snapshot.Decisions[index]
		decision.ID = normalizeText(decision.ID)
		decision.Action = strings.ToLower(normalizeText(decision.Action))
		decision.Message = normalizeText(decision.Message)
		decision.Why = normalizeText(decision.Why)
	}
	for index := range snapshot.Events {
		event := &snapshot.Events[index]
		event.ID = normalizeText(event.ID)
		event.Type = strings.ToLower(normalizeText(event.Type))
		event.StageID = normalizeText(event.StageID)
		event.QuestionID = normalizeText(event.QuestionID)
		event.Title = normalizeText(event.Title)
		event.Detail = normalizeText(event.Detail)
		event.Outcome = strings.ToLower(normalizeText(event.Outcome))
	}
	snapshot.Preferences.ExplanationStyle = strings.ToLower(normalizeText(snapshot.Preferences.ExplanationStyle))

	return snapshot
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
