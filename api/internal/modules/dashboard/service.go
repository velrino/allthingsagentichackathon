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
	"classgame-api/internal/modules/users"
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
	attempts, err := service.repository.ListLearningAttemptsByClassID(ctx, normalizedClassID)
	if err != nil {
		return DashboardOverview{}, err
	}
	students := buildStudentDashboardItems(studentDocuments, attempts, activeMission, time.Now())
	classLearning := buildClassLearningSummary(students)
	if synthesis, exists, err := service.repository.GetClassLearningSynthesis(ctx, normalizedClassID); err != nil {
		return DashboardOverview{}, err
	} else if exists {
		classLearning = applySemanticClassLearningSynthesis(classLearning, synthesis.Synthesis, students)
	}

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
		ClassLearning:   classLearning,
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
	attempts []users.StudentMissionAttemptDocument,
	activeMission *mission.MissionDocument,
	now time.Time,
) []StudentDashboardItem {
	items := make([]StudentDashboardItem, 0, len(students))
	attemptsByStudent := make(map[string][]users.StudentMissionAttemptDocument)
	for _, attempt := range attempts {
		attemptsByStudent[attempt.StudentID] = append(attemptsByStudent[attempt.StudentID], attempt)
	}

	for _, student := range students {
		studentAttempts := attemptsByStudent[student.ID]
		sort.SliceStable(studentAttempts, func(left int, right int) bool {
			return studentAttempts[left].LastActivityAt.After(studentAttempts[right].LastActivityAt)
		})
		latestAttempt := latestStudentAttempt(studentAttempts, activeMission)
		progress := buildStudentProgress(student, latestAttempt)
		session := buildStudentGameSession(student.Activity.CurrentGame, activeMission, now)
		lastActivityAt := student.Activity.LastSeenAt
		if session.LastHeartbeatAt.After(lastActivityAt) {
			lastActivityAt = session.LastHeartbeatAt
		}
		strengths := buildStrengths(activeMission)
		improvementAreas := buildImprovementAreas(activeMission, progress)
		notebookNotes := int64(math.Max(1, float64(student.Activity.LoginCount)))
		if latestAttempt != nil {
			if len(latestAttempt.Trace.Strengths) > 0 {
				strengths = latestAttempt.Trace.Strengths
			}
			if len(latestAttempt.Trace.ImprovementAreas) > 0 {
				improvementAreas = latestAttempt.Trace.ImprovementAreas
			}
			notebookNotes = int64(len(latestAttempt.Snapshot.Notes))
		}
		items = append(items, StudentDashboardItem{
			ID:               student.ID,
			StudentName:      resolveStudentName(student),
			ClassID:          student.Student.ClassID,
			Progress:         progress,
			Strengths:        strengths,
			ImprovementAreas: improvementAreas,
			LastActivityAt:   lastActivityAt,
			NotebookNotes:    notebookNotes,
			Session:          session,
			Attempts:         studentAttempts,
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
		now.Sub(current.LastHeartbeatAt) <= studentOnlineWindow &&
		current.Status != "paused" &&
		current.Status != "abandoned"

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
	abandonedStudents := 0
	notebookNotes := int64(0)

	for _, student := range students {
		totalProgress += student.Progress.Percentage
		notebookNotes += student.NotebookNotes

		if student.Progress.Status == "completed" {
			completedStudents++
		}
		if student.Progress.Status == "needs_attention" || student.Progress.Status == "abandoned" {
			needsAttention++
		}
		if student.Progress.Status == "abandoned" {
			abandonedStudents++
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
		AbandonedStudents: abandonedStudents,
		NotebookNotes:     notebookNotes,
	}
}

func buildStudentProgress(
	student studentUserDocument,
	attempt *users.StudentMissionAttemptDocument,
) StudentProgress {
	if attempt != nil {
		totalQuestions := 0
		completedQuestions := 0
		for _, stage := range attempt.Snapshot.Progress {
			required := max(stage.Required, 0)
			correct := max(stage.Correct, 0)
			if correct > required && required > 0 {
				correct = required
			}
			totalQuestions += required
			completedQuestions += correct
		}
		if totalQuestions == 0 {
			for _, event := range attempt.Snapshot.Events {
				if event.Type == "answer" {
					totalQuestions++
					if event.Outcome == "correct" || event.Outcome == "complete" {
						completedQuestions++
					}
				}
			}
		}
		percentage := 0
		if totalQuestions > 0 {
			percentage = int(math.Round(float64(completedQuestions) / float64(totalQuestions) * 100))
		}
		status := "in_progress"
		if attempt.Status == "completed" {
			status = "completed"
			percentage = 100
		} else if attempt.Status == "abandoned" {
			status = "abandoned"
		} else if percentage < 45 && len(attempt.Snapshot.Events) > 0 {
			status = "needs_attention"
		}

		return StudentProgress{
			CompletedQuestions: completedQuestions,
			TotalQuestions:     totalQuestions,
			Percentage:         percentage,
			Status:             status,
		}
	}

	return buildMockProgress(student)
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

func latestStudentAttempt(
	attempts []users.StudentMissionAttemptDocument,
	activeMission *mission.MissionDocument,
) *users.StudentMissionAttemptDocument {
	if activeMission != nil {
		for index := range attempts {
			if attempts[index].MissionID == activeMission.ID {
				return &attempts[index]
			}
		}
	}
	if len(attempts) == 0 {
		return nil
	}

	return &attempts[0]
}

func buildClassLearningSummary(students []StudentDashboardItem) ClassLearningSummary {
	summary := ClassLearningSummary{}
	strengthPatterns := make(map[string]*ClassLearningPattern)
	needPatterns := make(map[string]*ClassLearningPattern)

	for _, student := range students {
		if len(student.Attempts) > 0 {
			summary.StudentsWithEvidence++
		}
		for _, attempt := range student.Attempts {
			summary.TotalAttempts++
			if attempt.Status == "completed" {
				summary.CompletedAttempts++
			} else if attempt.Status == "abandoned" {
				summary.AbandonedAttempts++
			}
		}
		latest := latestStudentAttempt(student.Attempts, nil)
		if latest == nil {
			continue
		}
		addClassLearningPatterns(strengthPatterns, latest.Trace.Strengths, student)
		addClassLearningPatterns(needPatterns, latest.Trace.ImprovementAreas, student)
	}

	summary.CommonStrengths = sortedClassLearningPatterns(strengthPatterns, 4)
	summary.CommonNeeds = sortedClassLearningPatterns(needPatterns, 4)
	if len(summary.CommonNeeds) > 0 {
		summary.NextAdaptation = "Retrieve the class evidence and begin the next mission with a short check on: " + summary.CommonNeeds[0].Label
	} else {
		summary.NextAdaptation = "Collect completed attempts before choosing the next whole-class adaptation."
	}

	return summary
}

func applySemanticClassLearningSynthesis(
	summary ClassLearningSummary,
	synthesis orchestrator.ClassLearningSynthesis,
	students []StudentDashboardItem,
) ClassLearningSummary {
	studentNames := make(map[string]string, len(students))
	for _, student := range students {
		studentNames[student.ID] = student.StudentName
	}
	toPatterns := func(clusters []orchestrator.ClassLearningCluster) []ClassLearningPattern {
		patterns := make([]ClassLearningPattern, 0, len(clusters))
		for _, cluster := range clusters {
			ids := make([]string, 0, len(cluster.StudentIDs))
			names := make([]string, 0, len(cluster.StudentIDs))
			seen := make(map[string]struct{}, len(cluster.StudentIDs))
			for _, studentID := range cluster.StudentIDs {
				name, exists := studentNames[studentID]
				if !exists {
					continue
				}
				if _, duplicate := seen[studentID]; duplicate {
					continue
				}
				seen[studentID] = struct{}{}
				ids = append(ids, studentID)
				names = append(names, name)
			}
			if len(ids) == 0 || strings.TrimSpace(cluster.Label) == "" {
				continue
			}
			patterns = append(patterns, ClassLearningPattern{
				Label:        cluster.Label,
				Count:        len(ids),
				StudentIDs:   ids,
				StudentNames: names,
			})
		}

		return patterns
	}
	if patterns := toPatterns(synthesis.CommonStrengths); len(patterns) > 0 {
		summary.CommonStrengths = patterns
	}
	if patterns := toPatterns(synthesis.CommonNeeds); len(patterns) > 0 {
		summary.CommonNeeds = patterns
	}
	if strings.TrimSpace(synthesis.NextAdaptation) != "" {
		summary.NextAdaptation = synthesis.NextAdaptation
	}

	return summary
}

func addClassLearningPatterns(
	patterns map[string]*ClassLearningPattern,
	labels []string,
	student StudentDashboardItem,
) {
	seen := make(map[string]struct{}, len(labels))
	for _, label := range labels {
		label = strings.TrimSpace(label)
		key := strings.ToLower(label)
		if label == "" {
			continue
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		pattern := patterns[key]
		if pattern == nil {
			pattern = &ClassLearningPattern{Label: label}
			patterns[key] = pattern
		}
		pattern.Count++
		pattern.StudentIDs = append(pattern.StudentIDs, student.ID)
		pattern.StudentNames = append(pattern.StudentNames, student.StudentName)
	}
}

func sortedClassLearningPatterns(
	patterns map[string]*ClassLearningPattern,
	limit int,
) []ClassLearningPattern {
	result := make([]ClassLearningPattern, 0, len(patterns))
	for _, pattern := range patterns {
		result = append(result, *pattern)
	}
	sort.SliceStable(result, func(left int, right int) bool {
		if result[left].Count == result[right].Count {
			return result[left].Label < result[right].Label
		}

		return result[left].Count > result[right].Count
	})
	if len(result) > limit {
		result = result[:limit]
	}

	return result
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
