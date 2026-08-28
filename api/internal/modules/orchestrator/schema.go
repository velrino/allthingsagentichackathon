package orchestrator

func activityBlueprintSchema() map[string]any {
	stringArray := map[string]any{
		"type":  "array",
		"items": map[string]any{"type": "string"},
	}

	return map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required": []string{
			"title",
			"summary",
			"subject",
			"grade_level",
			"learning_goal",
			"suggested_duration_minutes",
			"stages",
			"preview_questions",
			"suggestions",
			"positive_signals",
			"improvement_signals",
		},
		"properties": map[string]any{
			"title": map[string]any{
				"type":        "string",
				"description": "Short title shown to the teacher.",
			},
			"summary": map[string]any{
				"type":        "string",
				"description": "One or two sentences explaining the activity.",
			},
			"subject": map[string]any{"type": "string"},
			"grade_level": map[string]any{
				"type":        "string",
				"description": "Student grade level in teacher-friendly wording.",
			},
			"learning_goal": map[string]any{
				"type":        "string",
				"description": "What students should understand after the mission.",
			},
			"suggested_duration_minutes": map[string]any{
				"type":    "integer",
				"minimum": 6,
				"maximum": 20,
			},
			"stages": map[string]any{
				"type":     "array",
				"minItems": 3,
				"maxItems": 4,
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"id", "title", "goal", "checks", "unlocks_when"},
					"properties": map[string]any{
						"id":           map[string]any{"type": "string"},
						"title":        map[string]any{"type": "string"},
						"goal":         map[string]any{"type": "string"},
						"checks":       stringArray,
						"unlocks_when": map[string]any{"type": "string"},
					},
				},
			},
			"preview_questions": map[string]any{
				"type":     "array",
				"minItems": 3,
				"maxItems": 6,
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required": []string{
						"id",
						"prompt",
						"answer_type",
						"options",
						"expected_answer",
						"misconception_traps",
					},
					"properties": map[string]any{
						"id":                  map[string]any{"type": "string"},
						"prompt":              map[string]any{"type": "string"},
						"answer_type":         map[string]any{"type": "string", "enum": []string{"multiple_choice", "next_step", "short_text"}},
						"options":             stringArray,
						"expected_answer":     map[string]any{"type": "string"},
						"misconception_traps": stringArray,
					},
				},
			},
			"suggestions": map[string]any{
				"type":     "array",
				"minItems": 2,
				"maxItems": 4,
				"items": map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"id", "title", "reason", "activity", "questions", "focus_skills"},
					"properties": map[string]any{
						"id":           map[string]any{"type": "string"},
						"title":        map[string]any{"type": "string"},
						"reason":       map[string]any{"type": "string"},
						"activity":     map[string]any{"type": "string"},
						"questions":    stringArray,
						"focus_skills": stringArray,
					},
				},
			},
			"positive_signals":    stringArray,
			"improvement_signals": stringArray,
		},
	}
}
