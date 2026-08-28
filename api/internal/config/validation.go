package config

import (
	"fmt"
	"strconv"
	"strings"

	validation "github.com/go-ozzo/ozzo-validation/v4"
)

func (config Config) Validate() error {
	return validation.Errors{
		"HOST": validation.Validate(config.Host,
			validation.Required,
		),
		"PORT": validation.Validate(config.Port,
			validation.Required,
			validation.By(validatePort),
		),
		"APP_ENV": validation.Validate(config.AppEnv,
			validation.Required,
			validation.In("development", "production"),
		),
		"FIREBASE_PROJECT_ID": validation.Validate(config.FirebaseProjectID,
			validation.Required,
		),
		"FIREBASE_CREDENTIALS_FILE": validation.Validate(config.FirebaseCredentialsFile,
			validation.By(validateFirebaseCredentials(config.FirebaseCredentialsJSON)),
		),
		"FIREBASE_CREDENTIALS_JSON": validation.Validate(config.FirebaseCredentialsJSON,
			validation.By(validateFirebaseCredentials(config.FirebaseCredentialsFile)),
		),
		"FIREBASE_PING_TIMEOUT_SECONDS": validation.Validate(config.FirebasePingTimeoutSeconds,
			validation.Required,
			validation.Min(1),
		),
		"AUTH_GOOGLE_WEB_CLIENT_ID": validation.Validate(config.AuthGoogleWebClientID,
			validation.Required,
		),
		"AUTH_TEACHER_PROVIDERS": validation.Validate(config.AuthTeacherProviders,
			validation.Required,
		),
		"AUTH_STUDENT_PROVIDERS": validation.Validate(config.AuthStudentProviders,
			validation.Required,
		),
		"REDIS_URL": validation.Validate(config.RedisURL,
			validation.Required,
			validation.By(validateRedisURL),
		),
		"REDIS_CA_CERT_PATH": validation.Validate(config.RedisCACertPath,
			validation.By(validateRedisCACert(config.RedisCACertPEM)),
		),
		"REDIS_CA_CERT_PEM": validation.Validate(config.RedisCACertPEM,
			validation.By(validateRedisCACert(config.RedisCACertPath)),
		),
		"REDIS_PING_TIMEOUT_SECONDS": validation.Validate(config.RedisPingTimeoutSeconds,
			validation.Required,
			validation.Min(1),
		),
	}.Filter()
}

func validatePort(value any) error {
	port, ok := value.(string)
	if !ok {
		return fmt.Errorf("must be a string")
	}

	parsedPort, err := strconv.Atoi(port)
	if err != nil || parsedPort < 1 || parsedPort > 65535 {
		return fmt.Errorf("must be a valid TCP port between 1 and 65535")
	}

	return nil
}

func validateFirebaseCredentials(otherValue string) validation.RuleFunc {
	return func(value any) error {
		credentialsValue, ok := value.(string)
		if !ok {
			return fmt.Errorf("must be a string")
		}

		credentialsValue = strings.TrimSpace(credentialsValue)
		otherValue = strings.TrimSpace(otherValue)
		if credentialsValue == "" && otherValue == "" {
			return fmt.Errorf("must configure FIREBASE_CREDENTIALS_FILE or FIREBASE_CREDENTIALS_JSON")
		}
		if credentialsValue != "" && otherValue != "" {
			return fmt.Errorf("must configure either FIREBASE_CREDENTIALS_FILE or FIREBASE_CREDENTIALS_JSON, not both")
		}

		return nil
	}
}

func validateRedisURL(value any) error {
	redisURL, ok := value.(string)
	if !ok {
		return fmt.Errorf("must be a string")
	}

	if strings.TrimSpace(redisURL) == "" {
		return nil
	}
	if hasPlaceholder(redisURL) {
		return fmt.Errorf("must replace placeholders with the real Redis connection string")
	}
	if !strings.HasPrefix(redisURL, "redis://") && !strings.HasPrefix(redisURL, "rediss://") {
		return fmt.Errorf("must start with redis:// or rediss://")
	}

	return nil
}

func validateRedisCACert(otherValue string) validation.RuleFunc {
	return func(value any) error {
		certValue, ok := value.(string)
		if !ok {
			return fmt.Errorf("must be a string")
		}

		certValue = strings.TrimSpace(certValue)
		if certValue == "" {
			return nil
		}
		if strings.TrimSpace(otherValue) != "" {
			return fmt.Errorf("must configure either REDIS_CA_CERT_PATH or REDIS_CA_CERT_PEM, not both")
		}

		return nil
	}
}

func hasPlaceholder(value string) bool {
	return strings.Contains(value, "<") || strings.Contains(value, ">")
}
