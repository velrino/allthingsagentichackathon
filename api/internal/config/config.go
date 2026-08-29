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
	FirebaseStorageBucket      string
	CloudTasksEnabled          bool
	CloudTasksProjectID        string
	CloudTasksLocation         string
	CloudTasksQueue            string
	CloudTasksTargetURL        string
	CloudTasksServiceAccount   string
	CloudTasksOIDCAudience     string
	AuthGoogleWebClientID      string
	AuthTeacherProviders       string
	AuthStudentProviders       string
	GenAIEnabled               bool
	GenAIBackend               string
	GenAIModel                 string
	GenAIAPIKey                string
	GenAIProjectID             string
	GenAILocation              string
	GenAICredentialsFile       string
	GenAICredentialsJSON       string
	GenAIRequestTimeoutSeconds int
	GenAIMaxOutputTokens       int
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
	googleApplicationCredentials := reader.getString("GOOGLE_APPLICATION_CREDENTIALS", "")
	googleCloudProject := reader.getString("GOOGLE_CLOUD_PROJECT", "rare-tape-466414-f4")
	googleCloudLocation := reader.getString("GOOGLE_CLOUD_LOCATION", "global")
	firebaseProjectID := reader.getString("FIREBASE_PROJECT_ID", "allthingsagentichackatho-ee359")
	config := Config{
		Host:                       reader.getString("HOST", "0.0.0.0"),
		Port:                       reader.getString("PORT", "4004"),
		AppEnv:                     reader.getString("APP_ENV", "development"),
		FirebaseProjectID:          firebaseProjectID,
		FirebaseCredentialsFile:    reader.getString("FIREBASE_CREDENTIALS_FILE", ""),
		FirebaseCredentialsJSON:    reader.getString("FIREBASE_CREDENTIALS_JSON", ""),
		FirebasePingTimeoutSeconds: reader.getInt("FIREBASE_PING_TIMEOUT_SECONDS", 5),
		FirebaseStorageBucket:      reader.getString("FIREBASE_STORAGE_BUCKET", "allthingsagentichackatho-ee359.firebasestorage.app"),
		CloudTasksEnabled:          reader.getBool("CLOUD_TASKS_ENABLED", false),
		CloudTasksProjectID:        reader.getString("CLOUD_TASKS_PROJECT_ID", googleCloudProject),
		CloudTasksLocation:         reader.getString("CLOUD_TASKS_LOCATION", "us-east1"),
		CloudTasksQueue:            reader.getString("CLOUD_TASKS_QUEUE", "mission-attachment-copy"),
		CloudTasksTargetURL:        reader.getString("CLOUD_TASKS_TARGET_URL", ""),
		CloudTasksServiceAccount:   reader.getString("CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL", ""),
		CloudTasksOIDCAudience:     reader.getString("CLOUD_TASKS_OIDC_AUDIENCE", ""),
		AuthGoogleWebClientID:      reader.getString("AUTH_GOOGLE_WEB_CLIENT_ID", "245584783597-t05j7fj2iucesiad4jpu4mlh72kgcs12.apps.googleusercontent.com"),
		AuthTeacherProviders:       reader.getString("AUTH_TEACHER_PROVIDERS", "google"),
		AuthStudentProviders:       reader.getString("AUTH_STUDENT_PROVIDERS", "anonymous"),
		GenAIEnabled:               reader.getBool("GENAI_ENABLED", true),
		GenAIBackend:               reader.getString("GENAI_BACKEND", "vertex"),
		GenAIModel:                 reader.getString("GENAI_MODEL", "gemini-3.7-flash"),
		GenAIAPIKey:                reader.getString("GENAI_API_KEY", reader.getString("GEMINI_API_KEY", reader.getString("GOOGLE_API_KEY", ""))),
		GenAIProjectID:             reader.getString("GENAI_PROJECT_ID", googleCloudProject),
		GenAILocation:              reader.getString("GENAI_LOCATION", googleCloudLocation),
		GenAICredentialsFile:       reader.getString("GENAI_CREDENTIALS_FILE", googleApplicationCredentials),
		GenAICredentialsJSON:       reader.getString("GENAI_CREDENTIALS_JSON", ""),
		GenAIRequestTimeoutSeconds: reader.getInt("GENAI_REQUEST_TIMEOUT_SECONDS", 30),
		GenAIMaxOutputTokens:       reader.getInt("GENAI_MAX_OUTPUT_TOKENS", 4096),
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
