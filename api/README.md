# ClassGame API

Go API for ClassGame, following the same module-oriented shape used by the Unshatter API.

## Development

```bash
cp .env.example .env
go mod download
go run ./cmd/api
```

With hot reload:

```bash
air
```

Health check:

```bash
curl http://localhost:4004/
```

## Runtime

- `GET /` returns the health check and service dependency status.
- `POST /users/student-session` resolves a published mission code, verifies an anonymous Firebase ID token, and upserts `users/{firebase_uid}` in Firestore.
- `POST /users/student-presence` verifies the same anonymous token and updates the student's current game heartbeat.
- `GET /dashboard/overview` verifies a Google Firebase ID token and returns teacher dashboard data for one `class_id`.
- `POST /teacher-classes` verifies a Google Firebase ID token and creates or updates a class. New classes receive a unique, six-character sharing code from the API.
- `GET /teacher-classes/:class_id` returns one teacher-owned class.
- `GET /teacher-classes/:class_id/missions` lists the latest missions for that class.
- `POST /teacher-classes/:class_id/missions/preview` creates a preview mission with a unique six-character code and an optional recommended student audience.
- `POST /teacher-classes/:class_id/missions` creates and publishes a mission in one call.
- `POST /teacher-classes/:class_id/missions/:mission_id/approve` publishes an existing preview and marks it active on the class.
- `internal/shared/google/genai` wraps the Google GenAI SDK so other modules can request structured output without coupling to SDK details.
- `internal/modules/orchestrator` turns a teacher request into a mission blueprint and falls back locally if GenAI is disabled or unavailable.
- `internal/modules/teacher-class-student` defines the per-class student thinking summary that future tutor turns will write.
- Firebase Admin connects to project `allthingsagentichackatho-ee359`.
- Firestore is the durable database.
- Redis uses the same Secret Manager value as Unshatter for now.

## Users

Student records are stored in Firestore under `users/{firebase_uid}`. Payloads and document fields use `snake_case`:

```json
{
  "identity": { "provider_user_id": "firebase_uid", "auth_method": "anonymous" },
  "profile": { "display_name": "Student Name" },
  "student": { "class_id": "ALG-2026-A", "mission_id": "mission-id", "mission_code": "ABC234", "student_name": "Student Name" },
  "mission": {
    "first_seen_at": "...",
    "last_seen_at": "...",
    "login_count": 1,
    "current_game": {
      "mission_id": "algebra-mission",
      "subject": "Mathematics",
      "stage_id": "fractions",
      "stage_name": "Fractions",
      "status": "learning",
      "started_at": "...",
      "last_heartbeat_at": "..."
    }
  },
  "roles": ["student"],
  "is_guest": true
}
```

The web client reports presence every 15 seconds while the game tab is visible. Dashboard responses mark a student online when the latest heartbeat is no more than 45 seconds old.

## Teacher Classes And Missions

Teacher-created classroom content is stored under a class document, then mission documents inside that class:

```txt
teachers/{firebase_uid}
  identity, profile, roles, activity, created_at, updated_at

teacher_classes/{class_id}
  class_id, class_code, class_name, subject, grade_level, teacher_id
  teacher, active_mission_id, mission_count, status, created_at, updated_at

teacher_classes/{class_id}/missions/{mission_id}
  mission_code, mission_name, title, summary, subject, grade_level, learning_goal, teacher_prompt
  audience_type, target_student_ids[]
  attachments[], preview_questions[], stages[], suggestions[], positive_signals[], improvement_signals[]
  orchestration: { provider, model, model_version, generated_by_ai, generated_by_mock, token_counts }
  created_by, updated_by, status, published_at, created_at, updated_at

mission_codes/{mission_code}
  mission_code, mission_id, class_id, status, created_at, updated_at

teacher_classes/{class_id}/students/{student_id}
  student_id, student_name, current_mission_id
  thinking_summary: { preferred_explanation_style, reasoning_patterns[], strengths[], improvement_areas[] }
  mission_summaries: mission_id → { status, completed_questions, total_questions, correct_answers, last_decision, last_feedback }
  notebook_notes[]: { mission_id, skill, kind, text, evidence[], count }
  feedback_summary: { helpful_count, confusing_count, too_easy_count, too_hard_count }
```

All JSON payloads and Firestore fields use `snake_case`.

Create a mission preview:

```bash
curl http://localhost:4004/teacher-classes/ALG-2026-A/missions/preview \
  -H "Authorization: Bearer $FIREBASE_GOOGLE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "class_name": "Algebra Lab",
    "mission_name": "Fractions in equations review",
    "subject": "Mathematics",
    "grade_level": "7th grade",
    "learning_goal": "Review fractions inside two-step equations.",
    "teacher_prompt": "Students studied two-step equations today and several got stuck when fractions appeared.",
    "audience_type": "all",
    "target_student_ids": [],
    "attachments": []
  }'
```

Approve the preview:

```bash
curl -X POST http://localhost:4004/teacher-classes/ALG-2026-A/missions/$ACTIVITY_ID/approve \
  -H "Authorization: Bearer $FIREBASE_GOOGLE_ID_TOKEN"
```

## GenAI

Local development can use Vertex AI credentials from a local file, or an API key if `GENAI_BACKEND=gemini_api`.

```env
GENAI_ENABLED=true
GENAI_BACKEND=vertex
GENAI_MODEL=gemini-3.7-flash
GENAI_PROJECT_ID=rare-tape-466414-f4
GENAI_LOCATION=global
GENAI_CREDENTIALS_FILE=/path/to/google-credentials.json
GENAI_REQUEST_TIMEOUT_SECONDS=30
GENAI_MAX_OUTPUT_TOKENS=4096
```

For Cloud Run, prefer the service account identity and grant it Vertex AI permissions instead of uploading a second GenAI key.

Mission preview generation sends teacher text plus attachment metadata to Gemini. For `https://ucarecdn.com/...` files with supported MIME types (`application/pdf`, images, text, markdown and CSV), the API also downloads the file with a 20 MB limit and includes it as inline GenAI content. Other attachments remain metadata-only so the generation can still proceed.

The Uploadcare public key belongs in the web environment. The Uploadcare secret key must stay out of the repo; only add it to Secret Manager if signed uploads are implemented.

## Secrets

Cloud Run expects:

- `FIREBASE_CREDENTIALS_JSON` from Secret Manager secret `allthingsagentichackathon-api-firebase-credentials-json`.
- `REDIS_URL` from existing Secret Manager secret `unshatter-api-redis-url`.

For local development, keep the Firebase service-account JSON outside git and point `FIREBASE_CREDENTIALS_FILE` at it from `.env`.

Create/update the Firebase secret after `gcloud auth login` by passing the local JSON path:

```bash
gcloud secrets create allthingsagentichackathon-api-firebase-credentials-json \
  --replication-policy=automatic \
  --data-file=/path/to/classgame-firebase-adminsdk.json

# If the secret already exists:
gcloud secrets versions add allthingsagentichackathon-api-firebase-credentials-json \
  --data-file=/path/to/classgame-firebase-adminsdk.json
```

## Deploy To Google Cloud Run

Run the deploy from the monorepo root, `apps/`, not from `apps/api/`.

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

gcloud artifacts repositories create classgame \
  --repository-format=docker \
  --location=us-east1 \
  --description="ClassGame containers"

gcloud builds submit \
  --config api/infra/cloud-run/production/cloudbuild.yaml \
  .
```

If the Artifact Registry repository already exists, skip the `create` command.

### GitHub deploy trigger

The production trigger watches only `api/**` in the monorepo:

- Trigger name: `classgame-api-main`
- Repository: `velrino/allthingsagentichackathon`
- Branch: `master`
- Build config: `api/infra/cloud-run/production/cloudbuild.yaml`
