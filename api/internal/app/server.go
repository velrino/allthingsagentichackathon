package app

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	"classgame-api/internal/config"
	"classgame-api/internal/modules/dashboard"
	healthcheck "classgame-api/internal/modules/health-check"
	teacherclass "classgame-api/internal/modules/teacher-class"
	teacherclassactivity "classgame-api/internal/modules/teacher-class-activity"
	"classgame-api/internal/modules/users"
)

type Options struct {
	Config               config.Config
	Dashboard            dashboard.HandlerOptions
	HealthChecks         []healthcheck.Check
	StartedAt            time.Time
	TeacherClass         teacherclass.HandlerOptions
	TeacherClassActivity teacherclassactivity.HandlerOptions
	Users                users.HandlerOptions
}

func New(options Options) *echo.Echo {
	server := echo.New()
	server.HTTPErrorHandler = httpErrorHandler

	server.Use(middleware.Recover())
	server.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowHeaders: []string{
			echo.HeaderAccept,
			echo.HeaderAuthorization,
			echo.HeaderContentType,
			echo.HeaderOrigin,
		},
		AllowMethods: []string{
			http.MethodGet,
			http.MethodOptions,
			http.MethodPost,
		},
		AllowOrigins: []string{"*"},
	}))

	healthcheck.RegisterRoutes(server, healthcheck.HandlerOptions{
		AppEnv:         options.Config.AppEnv,
		Checks:         options.HealthChecks,
		CheckCacheTTL:  time.Minute,
		ServiceTimeout: 3 * time.Second,
		StartedAt:      options.StartedAt,
	})

	users.RegisterRoutes(server, options.Users)
	dashboard.RegisterRoutes(server, options.Dashboard)
	teacherclass.RegisterRoutes(server, options.TeacherClass)
	teacherclassactivity.RegisterRoutes(server, options.TeacherClassActivity)

	return server
}
