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
	"classgame-api/internal/modules/missionattachment"
	"classgame-api/internal/modules/orchestrator"
	teacherclass "classgame-api/internal/modules/teacher-class"
	"classgame-api/internal/modules/users"
	"classgame-api/internal/shared/cloudtasksqueue"
	sharedgoogle "classgame-api/internal/shared/google"
	sharedfirebase "classgame-api/internal/shared/google/firebase"
	sharedgenai "classgame-api/internal/shared/google/genai"
	"classgame-api/internal/shared/google/objectstorage"
	sharedratelimit "classgame-api/internal/shared/ratelimit"
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
	usersService := users.NewService(usersRepository, missionRepository, orchestratorService)

	generationLimiter, err := sharedratelimit.NewRedisFixedWindow(
		redisConnection.Client(),
		sharedratelimit.FixedWindowOptions{
			Limit:  6,
			Prefix: "classgame:mission_generation",
			Window: time.Minute,
		},
	)
	if err != nil {
		return fmt.Errorf("initialize mission generation rate limiter: %w", err)
	}

	missionServiceOptions := make([]mission.ServiceOption, 0, 1)
	var missionAttachmentHandler http.Handler
	var studentLearningTaskHandler http.Handler
	if cfg.CloudTasksEnabled {
		storageConnection, err := objectstorage.Connect(context.Background(), objectstorage.Options{
			BucketName:      cfg.FirebaseStorageBucket,
			CredentialsFile: cfg.FirebaseCredentialsFile,
			CredentialsJSON: cfg.FirebaseCredentialsJSON,
		})
		if err != nil {
			return fmt.Errorf("initialize mission attachment storage: %w", err)
		}
		defer func() {
			if err := storageConnection.Close(); err != nil {
				slog.Error("mission attachment storage disconnect failed", "error", err)
			}
		}()

		storageCopier, err := missionattachment.NewStorageCopier(missionattachment.StorageCopierOptions{
			BucketName: storageConnection.BucketName(),
			Bucket:     storageConnection.Bucket(),
		})
		if err != nil {
			return fmt.Errorf("initialize mission attachment copier: %w", err)
		}

		taskQueue, err := cloudtasksqueue.Connect(context.Background(), cloudtasksqueue.Options{
			ProjectID:          cfg.CloudTasksProjectID,
			Location:           cfg.CloudTasksLocation,
			Queue:              cfg.CloudTasksQueue,
			TargetURL:          cfg.CloudTasksTargetURL,
			OIDCServiceAccount: cfg.CloudTasksServiceAccount,
			OIDCAudience:       cfg.CloudTasksOIDCAudience,
			DispatchDeadline:   290 * time.Second,
		})
		if err != nil {
			return fmt.Errorf("initialize mission attachment task queue: %w", err)
		}
		defer func() {
			if err := taskQueue.Close(); err != nil {
				slog.Error("mission attachment task queue disconnect failed", "error", err)
			}
		}()

		learningTaskQueue, err := cloudtasksqueue.Connect(context.Background(), cloudtasksqueue.Options{
			ProjectID:          cfg.CloudTasksProjectID,
			Location:           cfg.CloudTasksLocation,
			Queue:              cfg.CloudTasksQueue,
			TargetURL:          cfg.CloudTasksLearningTargetURL,
			OIDCServiceAccount: cfg.CloudTasksServiceAccount,
			OIDCAudience:       cfg.CloudTasksOIDCAudience,
			DispatchDeadline:   290 * time.Second,
		})
		if err != nil {
			return fmt.Errorf("initialize student learning task queue: %w", err)
		}
		defer func() {
			if err := learningTaskQueue.Close(); err != nil {
				slog.Error("student learning task queue disconnect failed", "error", err)
			}
		}()
		usersService.ConfigureLearningTasks(
			users.NewCloudLearningTaskEnqueuer(
				learningTaskQueue,
				time.Duration(cfg.StudentAbandonmentSeconds)*time.Second,
			),
			time.Duration(cfg.StudentAbandonmentSeconds)*time.Second,
		)

		attachmentEnqueuer := missionattachment.NewCloudTaskEnqueuer(taskQueue, 2*time.Second)
		missionServiceOptions = append(
			missionServiceOptions,
			mission.WithAttachmentEnqueuer(attachmentEnqueuer),
		)

		attachmentProcessor, err := missionattachment.NewProcessor(missionRepository, storageCopier)
		if err != nil {
			return fmt.Errorf("initialize mission attachment processor: %w", err)
		}
		attachmentAuthenticator, err := missionattachment.NewOIDCAuthenticator(
			context.Background(),
			cfg.CloudTasksOIDCAudience,
			cfg.CloudTasksServiceAccount,
		)
		if err != nil {
			return fmt.Errorf("initialize mission attachment task authentication: %w", err)
		}
		missionAttachmentHandler, err = missionattachment.NewHTTPHandler(
			attachmentAuthenticator,
			attachmentProcessor,
		)
		if err != nil {
			return fmt.Errorf("initialize mission attachment task handler: %w", err)
		}
		studentLearningTaskHandler, err = users.NewLearningTaskHTTPHandler(
			attachmentAuthenticator,
			usersService,
		)
		if err != nil {
			return fmt.Errorf("initialize student learning task handler: %w", err)
		}
	}

	missionService := mission.NewService(
		missionRepository,
		teacherClassService,
		orchestratorService,
		missionServiceOptions...,
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
			Authenticator:     authenticator,
			GenerationLimiter: generationLimiter,
			MissionService:    missionService,
		},
		MissionAttachment:   missionAttachmentHandler,
		StudentLearningTask: studentLearningTaskHandler,
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
		"cloud_tasks_enabled", cfg.CloudTasksEnabled,
		"firebase_storage_bucket", cfg.FirebaseStorageBucket,
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
