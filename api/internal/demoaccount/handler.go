package demoaccount

import (
	"net/http"

	"github.com/labstack/echo/v5"
)

type HandlerOptions struct {
	Enabled  bool
	Email    string
	Password string
}

type Handler struct {
	credentials Credentials
	enabled     bool
}

func RegisterRoutes(server *echo.Echo, options HandlerOptions) {
	handler := &Handler{
		enabled: options.Enabled,
		credentials: Credentials{
			Email:    options.Email,
			Password: options.Password,
		},
	}

	server.GET("/demo-account", handler.GetDemoAccount)
}

func (handler *Handler) GetDemoAccount(ctx *echo.Context) error {
	ctx.Response().Header().Set("Cache-Control", "no-store")
	if !handler.enabled {
		return ctx.JSON(http.StatusNotFound, map[string]any{
			"error": map[string]string{
				"code":    "demo_account_disabled",
				"message": "The demo account is not enabled.",
			},
		})
	}

	return ctx.JSON(http.StatusOK, handler.credentials)
}
