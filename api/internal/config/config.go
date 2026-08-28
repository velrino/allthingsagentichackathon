package config

import (
	"errors"
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Host                       string
	Port                       string
	AppEnv                     string
	FirebaseProjectID          string
	FirebaseCredentialsFile    string
	FirebaseCredentialsJSON    string
	FirebasePingTimeoutSeconds int
	AuthGoogleWebClientID      string
	AuthTeacherProviders       string
	AuthStudentProviders       string
	RedisURL                   string
	RedisCACertPath            string
	RedisCACertPEM             string
	RedisPingTimeoutSeconds    int
}

func Load() (Config, error) {
	if err := loadDotEnv(); err != nil {
		return Config{}, err
	}

	reader := envReader{}
	config := Config{
		Host:                       reader.getString("HOST", "0.0.0.0"),
		Port:                       reader.getString("PORT", "4004"),
		AppEnv:                     reader.getString("APP_ENV", "development"),
		FirebaseProjectID:          reader.getString("FIREBASE_PROJECT_ID", "allthingsagentichackatho-ee359"),
		FirebaseCredentialsFile:    reader.getString("FIREBASE_CREDENTIALS_FILE", ""),
		FirebaseCredentialsJSON:    reader.getString("FIREBASE_CREDENTIALS_JSON", ""),
		FirebasePingTimeoutSeconds: reader.getInt("FIREBASE_PING_TIMEOUT_SECONDS", 5),
		AuthGoogleWebClientID:      reader.getString("AUTH_GOOGLE_WEB_CLIENT_ID", "245584783597-t05j7fj2iucesiad4jpu4mlh72kgcs12.apps.googleusercontent.com"),
		AuthTeacherProviders:       reader.getString("AUTH_TEACHER_PROVIDERS", "google"),
		AuthStudentProviders:       reader.getString("AUTH_STUDENT_PROVIDERS", "anonymous"),
		RedisURL:                   reader.getString("REDIS_URL", ""),
		RedisCACertPath:            reader.getString("REDIS_CA_CERT_PATH", ""),
		RedisCACertPEM:             reader.getString("REDIS_CA_CERT_PEM", ""),
		RedisPingTimeoutSeconds:    reader.getInt("REDIS_PING_TIMEOUT_SECONDS", 5),
	}

	if err := reader.validate(); err != nil {
		return Config{}, err
	}
	if err := config.Validate(); err != nil {
		return Config{}, err
	}

	return config, nil
}

func (config Config) Address() string {
	return fmt.Sprintf("%s:%s", config.Host, config.Port)
}

func loadDotEnv() error {
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("load .env: %w", err)
	}

	return nil
}
