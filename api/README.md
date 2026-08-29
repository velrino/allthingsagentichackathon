# ClassGame API

Go API for ClassGame, following the same module-oriented shape used by the Unshatter API.

## Development

```bash
cp .env.example .env
go mod download
go run ./cmd/api
```

Tenant env vars are optional for local development. If unset, the API uses
`default-org`, `default-district` and `default-school` via
`DEFAULT_ORGANIZATION_ID`, `DEFAULT_DISTRICT_ID` and `DEFAULT_SCHOOL_ID`.

On every startup, the API idempotently ensures the configured tenant hierarchy
exists in Firestore and that the public hackathon demo teacher exists in
Firebase Auth. Existing records and accounts are left untouched. Configure this
with `FIREBASE_BOOTSTRAP_ENABLED`, `DEMO_TEACHER_*`, and the `DEFAULT_*` IDs and
names from `.env.example`. Disable the bootstrap for a non-demo deployment.

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
- `GET /demo-account` returns the intentionally public demo teacher credentials used by the login page, with caching disabled. A failed request lets `/login` report that the API is unavailable.
- `POST /users/student-session/validate` resolves an active, six-digit numeric class code before anonymous Firebase sign-in.
- `POST /users/student-session` verifies an anonymous Firebase ID token, joins that class, and upserts `users/{firebase_uid}` in Firestore without selecting a mission.
- `POST /users/student-mission` verifies that a chosen mission is currently published in the joined class and returns its pinned student-safe payload.
- `POST /users/student-presence` verifies the same anonymous token and updates the student's current game heartbeat.
- `GET /users/student-learning?mission_id=...` restores the anonymous student's current persisted attempt.
- `POST /users/student-learning` saves bounded observable events and memory; completing the mission asks Gemini for an evidence-based learning flow.
- `GET /dashboard/overview` verifies a Google Firebase ID token and returns teacher dashboard data for one `class_id`.
- `POST /teacher-classes` verifies a Google Firebase ID token and creates or updates a class. New classes receive a unique, six-digit numeric sharing code from the API.
- `GET /teacher-classes/:class_id` returns one teacher-owned class.
- `GET /teacher-classes/:class_id/missions` lists the latest missions for that class.
- `POST /teacher-classes/:class_id/missions/preview` creates a draft or regenerates an existing draft when `mission_id` and `expected_draft_revision` are provided.
- `POST /teacher-classes/:class_id/missions/:mission_id/approve` atomically promotes the expected draft revision, records an immutable published revision, marks the mission active, and updates the student-safe realtime catalog.
- `DELETE /teacher-classes/:class_id/missions/:mission_id` soft-deletes a mission, removes it from the realtime catalog, and preserves its published history.
- `internal/shared/google/genai` wraps the Google GenAI SDK so other modules can request structured output without coupling to SDK details.
- `internal/modules/orchestrator` turns a teacher request into a mission blueprint and falls back locally if GenAI is disabled or unavailable.
- `internal/modules/teacher-class-student` defines the per-class student thinking summary that future tutor turns will write.
- `internal/modules/tenant` centralizes the current tenant scope. Today every teacher defaults to one configured organization/district/school, while stored records already carry those IDs for future school or district reporting.
- `internal/bootstrap` recreates the minimum tenant, district, school, and demo Firebase Auth account after an empty-database startup without overwriting existing data.
- Firebase Admin connects to project `allthingsagentichackatho-ee359`.
- Firestore is the durable database.
- Redis uses the same Secret Manager value as Unshatter for now.

## Users

Student records are stored in Firestore under `users/{firebase_uid}`. Payloads and document fields use `snake_case`:

```json
{
  "identity": { "provider_user_id": "firebase_uid", "auth_method": "anonymous" },
  "profile": { "display_name": "Student Name" },
  "student": {
    "organization_id": "default-org",
    "district_id": "default-district",
    "school_id": "default-school",
    "class_id": "123456",
    "class_code": "123456",
    "mission_id": "mission-id",
    "student_name": "Student Name"
  },
  "activity": {
    "first_seen_at": "...",
    "last_seen_at": "...",
    "login_count": 1,
    "current_game": {
      "mission_id": "algebra-mission",
      "published_revision": 1,
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

The web client listens to `student_class_missions/{class_id}/missions` and `student_mission_completions/{student_id}/missions` in realtime. The latter is a minimal student-readable projection; full attempts remain teacher/API-only. The client reports presence every 15 seconds only while a mission is active and debounces learning snapshots as answers, explicit explanations, feedback and tutor adaptations occur. Each active game is pinned to the published revision that the student chose, so a teacher can publish a newer draft without changing an in-progress session. Dashboard responses mark a student online when the latest heartbeat is no more than 45 seconds old.

Learning evidence is stored separately so every mission revision remains available to the teacher:

```txt
student_mission_attempts/{attempt_id}
  organization_id, district_id, school_id
  student_id, student_name, class_id, mission_id, published_revision, status
  snapshot: { progress[], notes[], preferences, decisions[], events[], redirected, return_to, last_pod }
  trace: { summary, strengths[], improvement_areas[], next_adaptation, flow, provenance }
  started_at, last_activity_at, completed_at, created_at, updated_at

users/{firebase_uid}.student.learning_memory
  strengths[], improvement_areas[], preferred_explanation
  next_adaptation, last_mission_id, updated_at
```

The current attempt is restored when the student rejoins. For a new mission, ClassGame retrieves the persistent explanation preference and pending improvement areas before initializing the tutor, so the interaction does not start from zero.

## Teacher Classes And Missions

Teacher-created classroom content is tenant-scoped. Classes stay in
`teacher_classes`; missions are top-level documents so future reporting can list
all missions for one school, district or organization without scanning class
subcollections. The repository still reads legacy mission subcollections for
existing demo data, but new writes go to `/missions/{mission_id}`.

```txt
tenants/{organization_id}
  tenant_id, organization_id, name, status, created_at, updated_at

districts/{district_id}
  tenant_id, organization_id, district_id, name, status, created_at, updated_at

schools/{school_id}
  tenant_id, organization_id, district_id, school_id, name, status, created_at, updated_at

teachers/{firebase_uid}
  organization_id, district_id, school_id
  identity, profile, roles, activity, created_at, updated_at

teacher_classes/{class_id}
  organization_id, district_id, school_id
  class_id, class_code, class_name, subject, grade_level, teacher_id
  teacher, active_mission_id, mission_count, status, created_at, updated_at

missions/{mission_id}
  organization_id, district_id, school_id, teacher_id
  class_id, class_code, class_name
  mission_code, status, draft_revision, published_revision, has_unpublished_changes
  draft: { mission content, attachments[], orchestration, revision, updated_by, updated_at }
  published: { mission content, attachments[], orchestration, revision, updated_by, updated_at }
  created_by, updated_by, published_at, deleted_at, deleted_by, created_at, updated_at

missions/{mission_id}/published_revisions/{revision}
  immutable published snapshot
  attachment_transfer_status, attachment_transfer_at, published_by, published_at

mission_codes/{mission_code}
  mission_code, mission_id, class_id
  organization_id, district_id, school_id, teacher_id
  status, created_at, updated_at
  # reserved for future selected-student sharing; whole-class missions leave mission_code empty

student_class_missions/{class_id}/missions/{mission_id}
  student-safe metadata for published whole-class missions
  title, summary, subject, grade_level, learning_goal, suggested_duration_minutes
  published_revision, status, published_at, updated_at

student_mission_completions/{student_id}/missions/{attempt_id}
  student_id, class_id, mission_id, published_revision
  status, completed_at, updated_at

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
curl -X POST http://localhost:4004/teacher-classes/ALG-2026-A/missions/$MISSION_ID/approve \
  -H "Authorization: Bearer $FIREBASE_GOOGLE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"expected_draft_revision": 1}'
```

Preview generation is limited in Redis to 6 requests/minute and 30/hour per authenticated teacher, plus 120/hour per IP. A stale `expected_draft_revision` returns `409` instead of overwriting a draft generated in another tab.

## Cloud Tasks workers

Uploadcare files remain temporary while the teacher reviews a draft. Approval first creates a revision-specific Cloud Task, then publishes the draft. The task calls an application handler protected by a Google-signed OIDC token, streams each file to Firebase Storage with a real 20 MiB limit, and stores its canonical `gs://` location in the published revision. Once that immutable revision exists, its task remains valid even after a newer publication or a mission soft delete, preserving the attachment history.

Objects are organized under:

```txt
classes/{class_id}/missions/{mission_id}/revisions/{revision}/{uploadcare_uuid}/{safe_filename}
```

Production uses queue `mission-attachment-copy` in `rare-tape-466414-f4`. Provision it and the task identity once before enabling the deploy:

```bash
gcloud services enable cloudtasks.googleapis.com --project=rare-tape-466414-f4

gcloud tasks queues create mission-attachment-copy \
  --location=us-east1 \
  --project=rare-tape-466414-f4

RUNTIME_SA=2057331207-compute@developer.gserviceaccount.com
CLOUD_TASKS_AGENT=service-2057331207@gcp-sa-cloudtasks.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding rare-tape-466414-f4 \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role=roles/cloudtasks.enqueuer

gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --project=rare-tape-466414-f4 \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role=roles/iam.serviceAccountUser

gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --project=rare-tape-466414-f4 \
  --member="serviceAccount:${CLOUD_TASKS_AGENT}" \
  --role=roles/iam.serviceAccountUser
```

The first service-account binding lets the API specify the OIDC identity when it creates a task. The second lets the Cloud Tasks primary service agent mint that identity's token when dispatching it. Enabling the API normally grants the primary service agent its project-level `roles/cloudtasks.serviceAgent` role automatically.

The Firebase service-account secret used by the storage worker needs `roles/storage.objectAdmin` on `gs://allthingsagentichackatho-ee359.firebasestorage.app`. Cloud Tasks uses the Cloud Run service identity through ADC; Firebase Storage uses the configured Firebase credentials.

The same queue also dispatches student-learning jobs to
`/internal/tasks/student-learning`. A browser checkpoint schedules an
idempotent inactivity watchdog. If no newer checkpoint arrives within
`STUDENT_ABANDONMENT_SECONDS` (120 seconds in production), the API marks the
attempt `abandoned`, preserves its exact question/phase/step, and finalizes a
partial teacher-facing learning trace. Completing a mission queues the same
trace workflow immediately. Both handlers require a Cloud Tasks header and a
valid OIDC token for the configured service account.

The web client writes a monotonic snapshot after every game transition,
heartbeats while the tab is active, and sends a `paused` keepalive snapshot on
`visibilitychange`/`pagehide`. A later visit reuses the anonymous Firebase
session and restores the newest local or Firestore checkpoint. Server-side
snapshot merging keeps prior evidence even though notes and model observations
are never returned to the student.

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

Mission preview generation sends teacher text plus attachment metadata to Gemini. For files hosted on Uploadcare CDN (`ucarecdn.com` or project `ucarecd.net` hosts) with supported MIME types (`application/pdf`, images, text, markdown and CSV), the API also downloads the file with a 20 MB limit and includes it as inline GenAI content. Other attachments remain metadata-only so the generation can still proceed.

Generated previews include `education_guardrail` and `mission_flow`. The guardrail tells the dashboard whether the model used the attachments and whether the request stayed inside age-appropriate classroom learning scope. The flow is a small React Flow-ready graph (`nodes[]` and `edges[]`) used by the teacher dashboard to visualize the mission path. If uploaded material is empty, unrelated, unsafe or tries prompt injection, Mia must ignore it and keep the output educational; clearly unsafe requests receive a harmless remediation preview instead of student-facing exercises.

Each student answer, explicit explanation and feedback item can also invoke a
structured Gemini tutor turn. Retrieval selects only chunks grounded in the
published mission and combines them with that student's prior memory, recent
observable turns and aggregated class patterns. The student receives the tutor
message, explanation steps and safe adaptation controls; the teacher-only
observation and retrieval provenance remain in Firestore. Untrusted student or
attachment text cannot override the education scope, request another student's
data, expose teacher memory or solicit hidden chain-of-thought.

Tutor generation uses the local Echo limiter for bursts and Redis across every
Cloud Run instance: 12 requests/minute and 60/hour per anonymous student, plus
180/minute and 900/hour per IP so one classroom network still has headroom.
Each three-question attempt can generate at most 12 tutor turns. Replaying an
existing `event_id` returns its stored turn before invoking Gemini.

Completed or abandoned student attempts use a separate structured Gemini
workflow. Gemini receives the mission context, previous persistent memory and
only observable interaction evidence. It produces a teacher-facing
`trace.flow`, summary, strengths, improvement areas and the next adaptation to
retrieve on a future turn. Student text is treated as untrusted data, and the
model is explicitly forbidden from inventing or claiming to reveal private
chain-of-thought, diagnoses, grades, rankings or sensitive traits. If Gemini is
unavailable, the API builds a truthful flow directly from the recorded events.
Trace and class-synthesis generation share a Redis budget of 180 model calls
per class/hour; when the quota or Redis is unavailable, the observable local
trace is finalized without spending model tokens. Completed attempts are
immutable, preventing revised snapshots from repeatedly regenerating insights.

Class-level synthesis clusters the latest finalized traces across every student
in the class. The dashboard listens to `student_mission_attempts` and
`class_learning_summaries` with Firestore realtime listeners, then refreshes
the server-authorized projection. Deploy the read-only teacher rules from the
repository root before enabling realtime in production:

```bash
firebase deploy --only firestore:rules \
  --project=allthingsagentichackatho-ee359
```

Those rules permit a teacher to read only classes they own and deny every
browser write. Anonymous students therefore cannot inspect tutor observations,
notes, class memory or any full attempt; they can read only their minimal
completion projection, while safe resume state is available only through the
API.

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
