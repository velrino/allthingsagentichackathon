package app

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	"classgame-api/internal/config"
	healthcheck "classgame-api/internal/modules/health-check"
)

type Options struct {
	Config       config.Config
	HealthChecks []healthcheck.Check
	StartedAt    time.Time
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

	return server
}
