package dashboard

import (
	"context"
	"errors"
	"math"
	"sort"
	"strings"
	"time"

	"classgame-api/internal/modules/orchestrator"
	teacherclass "classgame-api/internal/modules/teacher-class"
	teacherclassactivity "classgame-api/internal/modules/teacher-class-activity"
	sharedfirebase "classgame-api/internal/shared/google/firebase"
)

var ErrTeacherRequiresGoogleAuth = errors.New("dashboard requires google auth")

const studentOnlineWindow = 45 * time.Second

type TeacherClassReader interface {
	Get(context.Context, sharedfirebase.Identity, string) (teacherclass.TeacherClassDocument, bool, error)
}

type ActivityReader interface {
	GetActive(context.Context, sharedfirebase.Identity, string) (teacherclassactivity.ActivityDocument, bool, error)
}

type Service struct {
	activityReader     ActivityReader
	repository         *Repository
	teacherClassReader TeacherClassReader
}

func NewService(
	repository *Repository,
	teacherClassReader TeacherClassReader,
	activityReader ActivityReader,
) *Service {
	return &Service{
		activityReader:     activityReader,
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

	var activeActivity *teacherclassactivity.ActivityDocument
	if service.activityReader != nil {
		activity, exists, err := service.activityReader.GetActive(ctx, identity, normalizedClassID)
		if err != nil {
			return DashboardOverview{}, err
		}
		if exists {
			activeActivity = &activity
		}
	}

	studentDocuments, err := service.repository.ListStudentsByClassID(ctx, normalizedClassID)
	if err != nil {
		return DashboardOverview{}, err
	}
	students := buildStudentDashboardItems(studentDocuments, activeActivity, time.Now())

	suggestions := starterSuggestions()
	generatedByAI := false
	generatedByMock := true
	if activeActivity != nil {
		suggestions = activeActivity.Suggestions
		generatedByAI = activeActivity.Orchestration.GeneratedByAI
		generatedByMock = activeActivity.Orchestration.GeneratedByMock
	}

	classCode := normalizedClassID
	if teacherClass != nil && teacherClass.ClassCode != "" {
		classCode = teacherClass.ClassCode
	}

	return DashboardOverview{
		ClassID:         normalizedClassID,
		ClassCode:       classCode,
		TeacherClass:    teacherClass,
		ActiveActivity:  activeActivity,
		Metrics:         buildMetrics(students),
		Students:        students,
		Suggestions:     suggestions,
		GeneratedByAI:   generatedByAI,
		GeneratedByMock: generatedByMock,
		Teacher:         teacher,
	}, nil
}

func (service *Service) teacher(ctx context.Context, identity sharedfirebase.Identity) (TeacherSummary, error) {
	if identity.AuthMethod != sharedfirebase.AuthMethodGoogle {
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
	activeActivity *teacherclassactivity.ActivityDocument,
	now time.Time,
) []StudentDashboardItem {
	items := make([]StudentDashboardItem, 0, len(students))

	for _, student := range students {
		progress := buildMockProgress(student)
		session := buildStudentGameSession(student.Activity.CurrentGame, activeActivity, now)
		lastActivityAt := student.Activity.LastSeenAt
		if session.LastHeartbeatAt.After(lastActivityAt) {
			lastActivityAt = session.LastHeartbeatAt
		}
		items = append(items, StudentDashboardItem{
			ID:               student.ID,
			StudentName:      resolveStudentName(student),
			ClassID:          student.Student.ClassID,
			Progress:         progress,
			Strengths:        buildStrengths(activeActivity),
			ImprovementAreas: buildImprovementAreas(activeActivity, progress),
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
	activeActivity *teacherclassactivity.ActivityDocument,
	now time.Time,
) StudentGameSession {
	activityID := current.ActivityID
	subject := current.Subject
	if activeActivity != nil {
		if activityID == "" {
			activityID = activeActivity.ID
		}
		if subject == "" {
			subject = activeActivity.Subject
		}
	}

	isOnline := !current.LastHeartbeatAt.IsZero() &&
		now.Sub(current.LastHeartbeatAt) >= 0 &&
		now.Sub(current.LastHeartbeatAt) <= studentOnlineWindow

	return StudentGameSession{
		ActivityID:      activityID,
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

func buildStrengths(activeActivity *teacherclassactivity.ActivityDocument) []string {
	if activeActivity != nil && len(activeActivity.PositiveSignals) > 0 {
		return limitSignals(activeActivity.PositiveSignals, 2)
	}

	return []string{"Keeps trying after feedback", "Responds to Emily's prompts"}
}

func buildImprovementAreas(
	activeActivity *teacherclassactivity.ActivityDocument,
	progress StudentProgress,
) []string {
	if progress.Status == "needs_attention" {
		return []string{"Needs a shorter review loop", "Ask why before showing the answer"}
	}
	if activeActivity != nil && len(activeActivity.ImprovementSignals) > 0 {
		return limitSignals(activeActivity.ImprovementSignals, 2)
	}

	return []string{"Explain the reasoning in their own words"}
}

func starterSuggestions() []orchestrator.ActivitySuggestion {
	return []orchestrator.ActivitySuggestion{
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
