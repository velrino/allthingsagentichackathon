package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	validation "github.com/go-ozzo/ozzo-validation/v4"
)

type envReader struct {
	errors validation.Errors
}

func (reader *envReader) getString(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}

func (reader *envReader) getInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsedValue, err := strconv.Atoi(value)
	if err != nil {
		reader.addError(key, "must be an integer")
		return fallback
	}

	return parsedValue
}

func (reader *envReader) getBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsedValue, err := strconv.ParseBool(value)
	if err != nil {
		reader.addError(key, "must be a boolean")
		return fallback
	}

	return parsedValue
}

func (reader *envReader) addError(key string, message string) {
	if reader.errors == nil {
		reader.errors = validation.Errors{}
	}

	reader.errors[key] = fmt.Errorf("%s", message)
}

func (reader *envReader) validate() error {
	if len(reader.errors) == 0 {
		return nil
	}

	return fmt.Errorf("invalid env values: %s", strings.TrimPrefix(reader.errors.Error(), "validation errors: "))
}
