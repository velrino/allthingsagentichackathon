package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v5"

	"classgame-api/internal/app"
	"classgame-api/internal/config"
	"classgame-api/internal/modules/dashboard"
	healthcheck "classgame-api/internal/modules/health-check"
	mission "classgame-api/internal/modules/mission"
	"classgame-api/internal/modules/orchestrator"
	teacherclass "classgame-api/internal/modules/teacher-class"
	"classgame-api/internal/modules/users"
	sharedgoogle "classgame-api/internal/shared/google"
	sharedfirebase "classgame-api/internal/shared/google/firebase"
	sharedgenai "classgame-api/internal/shared/google/genai"
	sharedredis "classgame-api/internal/shared/redis"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server failed", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	startedAt := time.Now()

	firebaseConnection, err := sharedgoogle.Connect(context.Background(), sharedgoogle.Options{
		ProjectID:       cfg.FirebaseProjectID,
		CredentialsFile: cfg.FirebaseCredentialsFile,
		CredentialsJSON: cfg.FirebaseCredentialsJSON,
		PingTimeout:     time.Duration(cfg.FirebasePingTimeoutSeconds) * time.Second,
	})
	if err != nil {
		return fmt.Errorf("initialize firebase: %w", err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := firebaseConnection.Disconnect(ctx); err != nil {
			slog.Error("firebase disconnect failed", "error", err)
		}
	}()

	redisConnection, err := sharedredis.Connect(context.Background(), sharedredis.Options{
		URL:         cfg.RedisURL,
		CACertPath:  cfg.RedisCACertPath,
		CACertPEM:   cfg.RedisCACertPEM,
		PingTimeout: time.Duration(cfg.RedisPingTimeoutSeconds) * time.Second,
	})
	if err != nil {
		return fmt.Errorf("initialize redis: %w", err)
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := redisConnection.Disconnect(ctx); err != nil {
			slog.Error("redis disconnect failed", "error", err)
		}
	}()

	usersRepository := users.NewRepository(firebaseConnection.FirestoreClient())
	genAIClient, err := sharedgenai.Connect(context.Background(), sharedgenai.Options{
		Enabled:         cfg.GenAIEnabled,
		Backend:         cfg.GenAIBackend,
		Model:           cfg.GenAIModel,
		APIKey:          cfg.GenAIAPIKey,
		ProjectID:       cfg.GenAIProjectID,
		Location:        cfg.GenAILocation,
		CredentialsFile: cfg.GenAICredentialsFile,
		CredentialsJSON: cfg.GenAICredentialsJSON,
		RequestTimeout:  time.Duration(cfg.GenAIRequestTimeoutSeconds) * time.Second,
		MaxOutputTokens: int32(cfg.GenAIMaxOutputTokens),
	})
	if err != nil {
		return fmt.Errorf("initialize genai: %w", err)
	}

	orchestratorService := orchestrator.NewService(genAIClient)
	teacherClassRepository := teacherclass.NewRepository(firebaseConnection.FirestoreClient())
	teacherClassService := teacherclass.NewService(teacherClassRepository)
	missionRepository := mission.NewRepository(firebaseConnection.FirestoreClient())
	usersService := users.NewService(usersRepository, missionRepository)
	missionService := mission.NewService(
		missionRepository,
		teacherClassService,
		orchestratorService,
	)
	dashboardRepository := dashboard.NewRepository(firebaseConnection.FirestoreClient())
	dashboardService := dashboard.NewService(dashboardRepository, teacherClassService, missionService)
	authenticator := sharedfirebase.NewFirebaseAuthenticator(firebaseConnection.AuthClient())

	server := app.New(app.Options{
		Config: cfg,
		Dashboard: dashboard.HandlerOptions{
			Authenticator:    authenticator,
			DashboardService: dashboardService,
		},
		TeacherClass: teacherclass.HandlerOptions{
			Authenticator:       authenticator,
			TeacherClassService: teacherClassService,
		},
		Mission: mission.HandlerOptions{
			Authenticator:  authenticator,
			MissionService: missionService,
		},
		HealthChecks: []healthcheck.Check{
			{
				Name:    healthcheck.HealthCheckServiceFirebase,
				Run:     firebaseConnection.Ping,
				Timeout: time.Duration(cfg.FirebasePingTimeoutSeconds) * time.Second,
			},
			{
				Name:    healthcheck.HealthCheckServiceRedis,
				Run:     redisConnection.Ping,
				Timeout: time.Duration(cfg.RedisPingTimeoutSeconds) * time.Second,
			},
		},
		StartedAt: startedAt,
		Users: users.HandlerOptions{
			Authenticator: authenticator,
			UsersService:  usersService,
		},
	})

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	slog.Info("server started",
		"host", cfg.Host,
		"port", cfg.Port,
		"app_env", cfg.AppEnv,
		"firebase_enabled", firebaseConnection.IsEnabled(),
		"firebase_project_id", firebaseConnection.ProjectID(),
		"genai_enabled", genAIClient.IsEnabled(),
		"genai_backend", cfg.GenAIBackend,
		"genai_model", cfg.GenAIModel,
		"redis_enabled", redisConnection.IsEnabled(),
		"last_deploy", startedAt.Format(time.RFC3339Nano),
	)

	startConfig := echo.StartConfig{
		Address:         cfg.Address(),
		HideBanner:      true,
		HidePort:        true,
		GracefulTimeout: 10 * time.Second,
		OnShutdownError: func(err error) {
			slog.Error("server shutdown failed", "error", err)
		},
	}

	if err := startConfig.Start(ctx, server); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("start server: %w", err)
	}

	slog.Info("server stopped")

	return nil
}
