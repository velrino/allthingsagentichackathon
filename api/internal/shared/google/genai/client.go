package genai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/auth"
	"cloud.google.com/go/auth/credentials"
	googlegenai "google.golang.org/genai"
)

const (
	ProviderGeminiAPI = "google_genai_gemini_api"
	ProviderVertexAI  = "google_genai_vertex_ai"
)

var (
	ErrDisabled      = errors.New("genai is disabled")
	ErrEmptyResponse = errors.New("genai returned an empty response")
)

type Options struct {
	Enabled         bool
	Backend         string
	Model           string
	APIKey          string
	ProjectID       string
	Location        string
	CredentialsFile string
	CredentialsJSON string
	RequestTimeout  time.Duration
	MaxOutputTokens int32
}

type Client struct {
	client  *googlegenai.Client
	options Options
}

type StructuredRequest struct {
	SystemInstruction  string
	Prompt             string
	FileParts          []FilePart
	ResponseJSONSchema any
	Temperature        float32
	MaxOutputTokens    int32
	Model              string
	Labels             map[string]string
}

type FilePart struct {
	Data     []byte
	MIMEType string
}

type StructuredResult struct {
	Model                string
	ModelVersion         string
	Provider             string
	PromptTokenCount     int32
	CandidatesTokenCount int32
	ThoughtsTokenCount   int32
	TotalTokenCount      int32
	RawText              string
}

func Connect(ctx context.Context, input Options) (*Client, error) {
	options := resolveOptions(input)
	if !options.Enabled {
		return &Client{options: options}, nil
	}

	clientConfig := &googlegenai.ClientConfig{
		APIKey:   options.APIKey,
		Backend:  resolveBackend(options.Backend),
		Project:  options.ProjectID,
		Location: options.Location,
		HTTPOptions: googlegenai.HTTPOptions{
			Timeout: &options.RequestTimeout,
		},
	}

	credentials, err := loadCredentials(options)
	if err != nil {
		return nil, err
	}
	clientConfig.Credentials = credentials

	client, err := googlegenai.NewClient(ctx, clientConfig)
	if err != nil {
		return nil, fmt.Errorf("create genai client: %w", err)
	}

	return &Client{
		client:  client,
		options: options,
	}, nil
}

func (client *Client) IsEnabled() bool {
	return client != nil && client.options.Enabled && client.client != nil
}

func (client *Client) Provider() string {
	if client == nil || client.options.Backend == "gemini_api" {
		return ProviderGeminiAPI
	}

	return ProviderVertexAI
}

func (client *Client) DefaultModel() string {
	if client == nil {
		return ""
	}

	return client.options.Model
}

func (client *Client) GenerateStructured(
	ctx context.Context,
	request StructuredRequest,
	target any,
) (StructuredResult, error) {
	if !client.IsEnabled() {
		return StructuredResult{}, ErrDisabled
	}
	if target == nil {
		return StructuredResult{}, errors.New("target is required")
	}

	model := strings.TrimSpace(request.Model)
	if model == "" {
		model = client.options.Model
	}
	maxOutputTokens := request.MaxOutputTokens
	if maxOutputTokens <= 0 {
		maxOutputTokens = client.options.MaxOutputTokens
	}
	temperature := request.Temperature

	config := &googlegenai.GenerateContentConfig{
		MaxOutputTokens:    maxOutputTokens,
		ResponseMIMEType:   "application/json",
		ResponseJsonSchema: request.ResponseJSONSchema,
		Temperature:        &temperature,
		Labels:             request.Labels,
		HTTPOptions: &googlegenai.HTTPOptions{
			Timeout: &client.options.RequestTimeout,
		},
		SystemInstruction: googlegenai.NewContentFromText(request.SystemInstruction, googlegenai.RoleUser),
	}

	response, err := client.client.Models.GenerateContent(
		ctx,
		model,
		buildUserContents(request),
		config,
	)
	if err != nil {
		return StructuredResult{}, fmt.Errorf("generate content: %w", err)
	}

	text := normalizeJSONText(response.Text())
	if text == "" {
		return StructuredResult{}, ErrEmptyResponse
	}

	if err := json.Unmarshal([]byte(text), target); err != nil {
		return StructuredResult{
			Model:        model,
			ModelVersion: response.ModelVersion,
			Provider:     client.Provider(),
			RawText:      text,
		}, fmt.Errorf("decode structured genai response: %w", err)
	}

	return buildStructuredResult(model, client.Provider(), text, response), nil
}

func buildUserContents(request StructuredRequest) []*googlegenai.Content {
	parts := []*googlegenai.Part{googlegenai.NewPartFromText(request.Prompt)}
	for _, filePart := range request.FileParts {
		if len(filePart.Data) == 0 || strings.TrimSpace(filePart.MIMEType) == "" {
			continue
		}

		parts = append(parts, googlegenai.NewPartFromBytes(filePart.Data, strings.TrimSpace(filePart.MIMEType)))
	}

	return []*googlegenai.Content{
		googlegenai.NewContentFromParts(parts, googlegenai.RoleUser),
	}
}

func resolveOptions(input Options) Options {
	input.Backend = strings.TrimSpace(input.Backend)
	input.Model = strings.TrimSpace(input.Model)
	input.APIKey = strings.TrimSpace(input.APIKey)
	input.ProjectID = strings.TrimSpace(input.ProjectID)
	input.Location = strings.TrimSpace(input.Location)
	input.CredentialsFile = strings.TrimSpace(input.CredentialsFile)
	input.CredentialsJSON = strings.TrimSpace(input.CredentialsJSON)

	if input.Backend == "" {
		input.Backend = "vertex"
	}
	if input.Location == "" {
		input.Location = "global"
	}
	if input.RequestTimeout <= 0 {
		input.RequestTimeout = 30 * time.Second
	}
	if input.MaxOutputTokens <= 0 {
		input.MaxOutputTokens = 4096
	}

	return input
}

func resolveBackend(value string) googlegenai.Backend {
	if value == "gemini_api" {
		return googlegenai.BackendGeminiAPI
	}

	return googlegenai.BackendVertexAI
}

func loadCredentials(options Options) (*auth.Credentials, error) {
	if options.CredentialsFile == "" && options.CredentialsJSON == "" {
		return nil, nil
	}
	if options.CredentialsFile != "" && options.CredentialsJSON != "" {
		return nil, errors.New("configure either genai credentials file or JSON, not both")
	}

	var raw []byte
	var err error
	if options.CredentialsFile != "" {
		raw, err = os.ReadFile(options.CredentialsFile)
		if err != nil {
			return nil, fmt.Errorf("read genai credentials file: %w", err)
		}
	} else {
		raw = []byte(options.CredentialsJSON)
	}

	credentialType, err := detectCredentialType(raw)
	if err != nil {
		return nil, err
	}

	return credentials.NewCredentialsFromJSON(credentialType, raw, &credentials.DetectOptions{
		Scopes: []string{"https://www.googleapis.com/auth/cloud-platform"},
	})
}

func detectCredentialType(raw []byte) (credentials.CredType, error) {
	var body struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		return "", fmt.Errorf("decode genai credentials header: %w", err)
	}

	switch credentials.CredType(body.Type) {
	case credentials.ServiceAccount:
		return credentials.ServiceAccount, nil
	case credentials.AuthorizedUser:
		return credentials.AuthorizedUser, nil
	default:
		return "", fmt.Errorf("unsupported genai credentials type %q", body.Type)
	}
}

func normalizeJSONText(value string) string {
	text := strings.TrimSpace(value)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")

	return strings.TrimSpace(text)
}

func buildStructuredResult(
	model string,
	provider string,
	text string,
	response *googlegenai.GenerateContentResponse,
) StructuredResult {
	result := StructuredResult{
		Model:        model,
		ModelVersion: response.ModelVersion,
		Provider:     provider,
		RawText:      text,
	}

	if response.UsageMetadata != nil {
		result.PromptTokenCount = response.UsageMetadata.PromptTokenCount
		result.CandidatesTokenCount = response.UsageMetadata.CandidatesTokenCount
		result.ThoughtsTokenCount = response.UsageMetadata.ThoughtsTokenCount
		result.TotalTokenCount = response.UsageMetadata.TotalTokenCount
	}

	return result
}
