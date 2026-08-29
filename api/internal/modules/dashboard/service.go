package dashboard

import (
	"context"
	"errors"
	"math"
	"sort"
	"strings"
	"time"

	mission "classgame-api/internal/modules/mission"
	"classgame-api/internal/modules/orchestrator"
	teacherclass "classgame-api/internal/modules/teacher-class"
	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

var ErrTeacherRequiresGoogleAuth = errors.New("dashboard requires google auth")

const studentOnlineWindow = 45 * time.Second

type TeacherClassReader interface {
	Get(context.Context, sharedfirebase.Identity, string) (teacherclass.TeacherClassDocument, bool, error)
}

type MissionReader interface {
	GetActive(context.Context, sharedfirebase.Identity, string) (mission.MissionDocument, bool, error)
}

type Service struct {
	missionReader      MissionReader
	repository         *Repository
	teacherClassReader TeacherClassReader
}

func NewService(
	repository *Repository,
	teacherClassReader TeacherClassReader,
	missionReader MissionReader,
) *Service {
	return &Service{
		missionReader:      missionReader,
		repository:         repository,
		teacherClassReader: teacherClassReader,
	}
}

func (service *Service) GetOverview(
	ctx context.Context,
	identity sharedfirebase.Identity,
	classID string,
) (DashboardOverview, error) {
	teacher, err := service.teacher(ctx, identity)
	if err != nil {
		return DashboardOverview{}, err
	}

	normalizedClassID := normalizeClassID(classID)
	if normalizedClassID == "" {
		return DashboardOverview{
			Teacher:         teacher,
			GeneratedByAI:   false,
			GeneratedByMock: true,
			Suggestions:     starterSuggestions(),
		}, nil
	}

	var teacherClass *teacherclass.TeacherClassDocument
	if service.teacherClassReader != nil {
		foundClass, exists, err := service.teacherClassReader.Get(ctx, identity, normalizedClassID)
		if err != nil {
			return DashboardOverview{}, err
		}
		if !exists {
			return DashboardOverview{
				ClassID:         normalizedClassID,
				ClassCode:       normalizedClassID,
				Teacher:         teacher,
				GeneratedByAI:   false,
				GeneratedByMock: true,
				Suggestions:     starterSuggestions(),
			}, nil
		}

		teacherClass = &foundClass
	}

	var activeMission *mission.MissionDocument
	if service.missionReader != nil {
		missionDocument, exists, err := service.missionReader.GetActive(ctx, identity, normalizedClassID)
		if err != nil {
			return DashboardOverview{}, err
		}
		if exists {
			activeMission = &missionDocument
		}
	}

	studentDocuments, err := service.repository.ListStudentsByClassID(ctx, normalizedClassID)
	if err != nil {
		return DashboardOverview{}, err
	}
	students := buildStudentDashboardItems(studentDocuments, activeMission, time.Now())

	suggestions := starterSuggestions()
	generatedByAI := false
	generatedByMock := true
	if activeMission != nil {
		suggestions = activeMission.Suggestions
		generatedByAI = activeMission.Orchestration.GeneratedByAI
		generatedByMock = activeMission.Orchestration.GeneratedByMock
	}

	classCode := normalizedClassID
	if teacherClass != nil && teacherClass.ClassCode != "" {
		classCode = teacherClass.ClassCode
	}

	return DashboardOverview{
		ClassID:         normalizedClassID,
		ClassCode:       classCode,
		TeacherClass:    teacherClass,
		ActiveMission:   activeMission,
		Metrics:         buildMetrics(students),
		Students:        students,
		Suggestions:     suggestions,
		GeneratedByAI:   generatedByAI,
		GeneratedByMock: generatedByMock,
		Teacher:         teacher,
	}, nil
}

func (service *Service) teacher(ctx context.Context, identity sharedfirebase.Identity) (TeacherSummary, error) {
	if !sharedfirebase.IsTeacherAuthMethod(identity.AuthMethod) {
		return TeacherSummary{}, ErrTeacherRequiresGoogleAuth
	}

	return service.repository.UpsertTeacher(ctx, TeacherIdentity{
		Provider:       identity.Provider,
		ProviderUserID: identity.ProviderUserID,
		AuthMethod:     identity.AuthMethod,
		Email:          identity.Email,
		EmailVerified:  identity.EmailVerified,
		DisplayName:    identity.DisplayName,
		PhotoURL:       identity.PhotoURL,
		ProviderIDs:    identity.ProviderIDs,
		SignInProvider: identity.SignInProvider,
	}, time.Now())
}

func buildStudentDashboardItems(
	students []studentUserDocument,
	activeMission *mission.MissionDocument,
	now time.Time,
) []StudentDashboardItem {
	items := make([]StudentDashboardItem, 0, len(students))

	for _, student := range students {
		progress := buildMockProgress(student)
		session := buildStudentGameSession(student.Activity.CurrentGame, activeMission, now)
		lastActivityAt := student.Activity.LastSeenAt
		if session.LastHeartbeatAt.After(lastActivityAt) {
			lastActivityAt = session.LastHeartbeatAt
		}
		items = append(items, StudentDashboardItem{
			ID:               student.ID,
			StudentName:      resolveStudentName(student),
			ClassID:          student.Student.ClassID,
			Progress:         progress,
			Strengths:        buildStrengths(activeMission),
			ImprovementAreas: buildImprovementAreas(activeMission, progress),
			LastActivityAt:   lastActivityAt,
			NotebookNotes:    int64(math.Max(1, float64(student.Activity.LoginCount))),
			Session:          session,
		})
	}

	sort.SliceStable(items, func(left int, right int) bool {
		return items[left].LastActivityAt.After(items[right].LastActivityAt)
	})

	return items
}

func buildStudentGameSession(
	current studentGameSession,
	activeMission *mission.MissionDocument,
	now time.Time,
) StudentGameSession {
	missionID := current.MissionID
	subject := current.Subject
	if activeMission != nil {
		if missionID == "" {
			missionID = activeMission.ID
		}
		if subject == "" {
			subject = activeMission.Subject
		}
	}

	isOnline := !current.LastHeartbeatAt.IsZero() &&
		now.Sub(current.LastHeartbeatAt) >= 0 &&
		now.Sub(current.LastHeartbeatAt) <= studentOnlineWindow

	return StudentGameSession{
		MissionID:       missionID,
		Subject:         subject,
		StageID:         current.StageID,
		StageName:       current.StageName,
		Status:          current.Status,
		IsOnline:        isOnline,
		StartedAt:       current.StartedAt,
		LastHeartbeatAt: current.LastHeartbeatAt,
	}
}

func buildMetrics(students []StudentDashboardItem) DashboardMetrics {
	if len(students) == 0 {
		return DashboardMetrics{}
	}

	totalProgress := 0
	activeStudents := 0
	completedStudents := 0
	needsAttention := 0
	notebookNotes := int64(0)

	for _, student := range students {
		totalProgress += student.Progress.Percentage
		notebookNotes += student.NotebookNotes

		if student.Progress.Status == "completed" {
			completedStudents++
		}
		if student.Progress.Status == "needs_attention" {
			needsAttention++
		}
		if student.Session.IsOnline {
			activeStudents++
		}
	}

	return DashboardMetrics{
		TotalStudents:     len(students),
		ActiveStudents:    activeStudents,
		CompletedStudents: completedStudents,
		AverageProgress:   int(math.Round(float64(totalProgress) / float64(len(students)))),
		NeedsAttention:    needsAttention,
		NotebookNotes:     notebookNotes,
	}
}

func buildMockProgress(student studentUserDocument) StudentProgress {
	totalQuestions := 12
	seed := int(student.Activity.LoginCount)*13 + len(resolveStudentName(student))*7
	completed := 3 + seed%10
	if completed > totalQuestions {
		completed = totalQuestions
	}

	percentage := int(math.Round(float64(completed) / float64(totalQuestions) * 100))
	status := "in_progress"
	if percentage >= 100 {
		status = "completed"
	} else if percentage < 45 {
		status = "needs_attention"
	}

	return StudentProgress{
		CompletedQuestions: completed,
		TotalQuestions:     totalQuestions,
		Percentage:         percentage,
		Status:             status,
	}
}

func buildStrengths(activeMission *mission.MissionDocument) []string {
	if activeMission != nil && len(activeMission.PositiveSignals) > 0 {
		return limitSignals(activeMission.PositiveSignals, 2)
	}

	return []string{"Keeps trying after feedback", "Responds to Emily's prompts"}
}

func buildImprovementAreas(
	activeMission *mission.MissionDocument,
	progress StudentProgress,
) []string {
	if progress.Status == "needs_attention" {
		return []string{"Needs a shorter review loop", "Ask why before showing the answer"}
	}
	if activeMission != nil && len(activeMission.ImprovementSignals) > 0 {
		return limitSignals(activeMission.ImprovementSignals, 2)
	}

	return []string{"Explain the reasoning in their own words"}
}

func starterSuggestions() []orchestrator.MissionSuggestion {
	return []orchestrator.MissionSuggestion{
		{
			ID:       "starter-diagnostic",
			Title:    "Start with a short diagnostic",
			Reason:   "Emily needs one visible misconception before adapting the path.",
			Activity: "Ask three warm-up questions, then branch into review or challenge.",
			Questions: []string{
				"What did students practice today?",
				"What mistake should Emily watch for?",
				"What would count as success after ten minutes?",
			},
			FocusSkills: []string{"diagnostic", "feedback"},
		},
	}
}

func limitSignals(values []string, limit int) []string {
	if len(values) <= limit {
		return values
	}

	return values[:limit]
}

func resolveStudentName(student studentUserDocument) string {
	if strings.TrimSpace(student.Student.StudentName) != "" {
		return strings.TrimSpace(student.Student.StudentName)
	}
	if strings.TrimSpace(student.Profile.DisplayName) != "" {
		return strings.TrimSpace(student.Profile.DisplayName)
	}

	return "Unnamed student"
}

func normalizeClassID(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}
