package mission

import "time"

const initialMissionRevision int64 = 1

func snapshotFromMission(mission MissionDocument, revision int64) MissionSnapshot {
	return MissionSnapshot{
		Revision:                 revision,
		MissionName:              mission.MissionName,
		Title:                    mission.Title,
		Summary:                  mission.Summary,
		Subject:                  mission.Subject,
		GradeLevel:               mission.GradeLevel,
		LearningGoal:             mission.LearningGoal,
		TeacherPrompt:            mission.TeacherPrompt,
		AudienceType:             mission.AudienceType,
		TargetStudentIDs:         mission.TargetStudentIDs,
		Attachments:              mission.Attachments,
		PreviewQuestions:         mission.PreviewQuestions,
		SuggestedDurationMinutes: mission.SuggestedDurationMinutes,
		Stages:                   mission.Stages,
		Suggestions:              mission.Suggestions,
		PositiveSignals:          mission.PositiveSignals,
		ImprovementSignals:       mission.ImprovementSignals,
		Orchestration:            mission.Orchestration,
		UpdatedBy:                mission.UpdatedBy,
		UpdatedAt:                mission.UpdatedAt,
	}
}

func (mission *MissionDocument) applySnapshot(snapshot MissionSnapshot) {
	mission.MissionName = snapshot.MissionName
	mission.Title = snapshot.Title
	mission.Summary = snapshot.Summary
	mission.Subject = snapshot.Subject
	mission.GradeLevel = snapshot.GradeLevel
	mission.LearningGoal = snapshot.LearningGoal
	mission.TeacherPrompt = snapshot.TeacherPrompt
	mission.AudienceType = snapshot.AudienceType
	mission.TargetStudentIDs = snapshot.TargetStudentIDs
	mission.Attachments = snapshot.Attachments
	mission.PreviewQuestions = snapshot.PreviewQuestions
	mission.SuggestedDurationMinutes = snapshot.SuggestedDurationMinutes
	mission.Stages = snapshot.Stages
	mission.Suggestions = snapshot.Suggestions
	mission.PositiveSignals = snapshot.PositiveSignals
	mission.ImprovementSignals = snapshot.ImprovementSignals
	mission.Orchestration = snapshot.Orchestration
	mission.UpdatedBy = snapshot.UpdatedBy
	mission.UpdatedAt = snapshot.UpdatedAt
}

func hydrateMissionLifecycle(mission *MissionDocument) {
	if mission.Draft == nil {
		revision := mission.DraftRevision
		if revision <= 0 {
			revision = initialMissionRevision
		}

		draft := snapshotFromMission(*mission, revision)
		mission.Draft = &draft
		mission.DraftRevision = revision
	}

	wasPublished := mission.Status == StatusPublished ||
		mission.StatusBeforeDelete == StatusPublished ||
		!mission.PublishedAt.IsZero()
	if mission.Published == nil && wasPublished {
		revision := mission.PublishedRevision
		if revision <= 0 {
			revision = mission.Draft.Revision
		}

		published := snapshotFromMission(*mission, revision)
		mission.Published = &published
		mission.PublishedRevision = revision
	}

	if mission.DraftRevision <= 0 {
		mission.DraftRevision = mission.Draft.Revision
	}
	if mission.Published != nil && mission.PublishedRevision <= 0 {
		mission.PublishedRevision = mission.Published.Revision
	}

	mission.HasUnpublishedChanges = mission.Published == nil ||
		mission.DraftRevision != mission.PublishedRevision
}

func draftView(mission MissionDocument) MissionDocument {
	hydrateMissionLifecycle(&mission)
	if mission.Draft != nil {
		mission.applySnapshot(*mission.Draft)
	}
	if mission.Status != StatusDeleted {
		if mission.Published != nil && mission.DraftRevision == mission.PublishedRevision {
			mission.Status = StatusPublished
		} else {
			mission.Status = StatusDraft
		}
	}

	return mission
}

func publishedView(mission MissionDocument) (MissionDocument, bool) {
	hydrateMissionLifecycle(&mission)
	if mission.Status == StatusDeleted || mission.Published == nil {
		return MissionDocument{}, false
	}

	mission.applySnapshot(*mission.Published)
	mission.Status = StatusPublished
	mission.HasUnpublishedChanges = mission.DraftRevision != mission.PublishedRevision

	return mission, true
}

func newSnapshotFromInput(input CreateMissionInput, revision int64) MissionSnapshot {
	mission := buildMissionDocumentFields(input)
	mission.UpdatedBy = input.Teacher
	mission.UpdatedAt = input.Timestamp

	return snapshotFromMission(mission, revision)
}

func nonZeroTime(value time.Time, fallback time.Time) time.Time {
	if value.IsZero() {
		return fallback
	}

	return value
}
