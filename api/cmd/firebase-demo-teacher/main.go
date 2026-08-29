// Command firebase-demo-teacher makes sure the shared demo teacher exists in
// Firebase Auth with the password the login page pre-fills. Run it after a
// reset, or whenever the account drifts:
//
//	go run ./cmd/firebase-demo-teacher --project allthingsagentichackatho-ee359 \
//	  --credentials-file /path/to/service-account.json --password '...'
//
// It creates the user if missing, otherwise sets the password on the existing
// account (keeping any Google sign-in already linked to it).
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	firebaseadmin "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

const (
	expectedProjectID = "allthingsagentichackatho-ee359"
	defaultEmail      = "velrino@gmail.com"
	defaultName       = "Demo Teacher"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	var credentialsFile string
	var displayName string
	var email string
	var password string
	var projectID string

	flag.StringVar(&projectID, "project", "", "Firebase project ID")
	flag.StringVar(&credentialsFile, "credentials-file", "", "Firebase service account JSON path (default: Application Default Credentials)")
	flag.StringVar(&email, "email", defaultEmail, "Demo teacher email")
	flag.StringVar(&password, "password", os.Getenv("DEMO_TEACHER_PASSWORD"), "Password to set (or DEMO_TEACHER_PASSWORD)")
	flag.StringVar(&displayName, "display-name", defaultName, "Display name")
	flag.Parse()

	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return errors.New("missing --project")
	}
	if projectID != expectedProjectID && os.Getenv("ALLOW_OTHER_FIREBASE_PROJECT") != "1" {
		return fmt.Errorf("refusing to touch project %q; expected %q", projectID, expectedProjectID)
	}
	if len(password) < 6 {
		return errors.New("--password must be at least 6 characters (Firebase minimum)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	opts := []option.ClientOption{}
	if strings.TrimSpace(credentialsFile) != "" {
		opts = append(opts, option.WithCredentialsFile(credentialsFile))
	}
	app, err := firebaseadmin.NewApp(ctx, &firebaseadmin.Config{ProjectID: projectID}, opts...)
	if err != nil {
		return fmt.Errorf("create Firebase app: %w", err)
	}
	client, err := app.Auth(ctx)
	if err != nil {
		return fmt.Errorf("create Firebase Auth client: %w", err)
	}

	existing, err := client.GetUserByEmail(ctx, email)
	switch {
	case err == nil:
		params := (&auth.UserToUpdate{}).Password(password).DisplayName(displayName).EmailVerified(true).Disabled(false)
		user, err := client.UpdateUser(ctx, existing.UID, params)
		if err != nil {
			return fmt.Errorf("update demo teacher: %w", err)
		}
		fmt.Printf("Updated %s (uid %s); providers: %s\n", user.Email, user.UID, providerList(user))
	case auth.IsUserNotFound(err):
		params := (&auth.UserToCreate{}).Email(email).Password(password).DisplayName(displayName).EmailVerified(true)
		user, err := client.CreateUser(ctx, params)
		if err != nil {
			return fmt.Errorf("create demo teacher: %w", err)
		}
		fmt.Printf("Created %s (uid %s)\n", user.Email, user.UID)
	default:
		return fmt.Errorf("look up demo teacher: %w", err)
	}

	return nil
}

func providerList(user *auth.UserRecord) string {
	ids := make([]string, 0, len(user.ProviderUserInfo))
	for _, info := range user.ProviderUserInfo {
		if info != nil {
			ids = append(ids, info.ProviderID)
		}
	}
	return strings.Join(ids, ",")
}
