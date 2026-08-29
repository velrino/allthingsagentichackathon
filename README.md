# ClassGame

**ClassGame is the optional homework that takes notes for the teacher.**

A teacher types what the class covered today (and optionally attaches the worksheet). **Emily**, a Gemini tutor, turns it into a short 3D review mission. Students play it on their phones for ten minutes: Emily leads them question by question, asks *why* they picked a wrong answer, explains in the style that works for that student, and keeps a memory of each student that survives the tab, the session and the mission. The teacher opens the class page and sees — live — where every student is, what Emily observed, which patterns repeat across the class, and what to teach tomorrow.

Built for the **All Things Agentic Hackathon**, category **The Collaborative Partner — in depth**.

> **The focus:** stateful, multi-turn dialogue with real-time context retrieval (RAG) and persistent memory, so your agent adapts and personalizes based on past interactions instead of starting over each time.
>
> **Example:** an expert guide that helps you understand a dense document, quizzes you as you go, learns which concepts you struggle with, and adapts future explanations.

ClassGame is that example, with a classroom around it: the "dense document" is the teacher's lesson and worksheet, the quiz is the mission, the concepts you struggle with are named misconceptions, and the adaptation is visible on the chalkboard and in the teacher's dashboard.

- Hosted: https://classgame-web-mzkj6f7g3a-ue.a.run.app/home (students) · https://classgame-web-mzkj6f7g3a-ue.a.run.app/dashboard (teachers)
- API: https://classgame-api-2057331207.us-east1.run.app/
- Hackathon page: https://allthingsagentichackathon.devpost.com/

---

## Why this shape

Homework tells you *who* got it wrong, never *why*. And most tutoring apps talk only to the student — the teacher never hears back. ClassGame puts the teacher at both ends of the loop and the agent's memory in the middle:

```txt
Teacher                          Emily (agent)                          Student
──────────                       ─────────────                          ───────
"Today: two-step equations.      generates the mission                  plays 10 min on a phone
 Several slipped on fractions."  (questions, traps, knowledge chunks)   → answers → "why?" → feedback
 + worksheet PDF                 ───────────────────────────────────►   → Emily adapts, turn by turn
                                 remembers each student
                                 (attempt, checkpoint, memory)          closes the tab, comes back
                                 writes a learning trace                → resumes at the exact step
 reads the class page live       ◄───────────────────────────────────
 "7 students add fractions       clusters the class
  straight across."              "next adaptation: ..."
 "Build tomorrow's mission"
```

Two people collaborate with Emily. The **student** gets a tutor who never starts over. The **teacher** gets an assistant who plans from evidence instead of guesses.

## Collaborative Partner alignment

| Brief | Where it lives in the product | Code |
|---|---|---|
| **Stateful, multi-turn dialogue** | Every answer, explicit "why" and feedback tap is one Gemini turn on the same attempt. Each turn receives the last 24 observable events and the last 12 tutor turns of that attempt, so "you marked *confusing* two questions ago" is real context, not a canned line. The teacher's loop is multi-turn too: prompt → preview → revise → approve, all on one mission document with numbered revisions. | `api/internal/modules/users/service.go` (`SaveStudentTutorTurn`), `api/internal/modules/mission` |
| **Real-time context retrieval (RAG)** | At mission generation Gemini distils the teacher prompt and attachments into 3–12 **knowledge chunks** stored in the published revision. On every student turn the API retrieves the top 5 chunks for *this* question and *this* student response, plus the student's memory, the attempt history and the class-level patterns, and puts them in the prompt. The chunk ids Gemini actually used are stored with the turn and shown to the teacher as `RAG · chunk-id` chips. | `retrieveMissionKnowledge`, `orchestrator.BuildTutorTurn` |
| **Persistent memory** | Three layers in Firestore: the **attempt** (`student_mission_attempts`: progress, notes, decisions, events, exact checkpoint, tutor turns, trace), the **student** (`users/{uid}.student.learning_memory`: strengths, improvement areas, preferred explanation, *next adaptation* — carried into the next mission), and the **class** (`class_learning_summaries/{class_id}`: clustered strengths and needs across students). | `api/internal/modules/users/repository.go` |
| **Adapts from past interactions** | Explanation style (steps ↔ visual), difficulty bias and the next action change from feedback and repeated slips, and Emily says why. A returning student is put back at the exact question, phase and step. When a mission ends (or is abandoned), Gemini writes a learning trace whose `next_adaptation` tells the *next* turn what to retrieve and how to adapt. The teacher's "Build tomorrow's mission" button turns the class patterns into the next prompt. | `session-reducer.ts` (`restoreLesson`, `apply-tutor-turn`), `finalizeStudentAttempt` |

## The core loop (this is the product)

```txt
1. Emily writes a question on the board                       ← leads
2. Student answers
3. Wrong? Emily asks "Why did you pick that?"                 ← clarifying question (why_prompt from Gemini)
4. Student picks a reason written in their voice, or types one
5. API grounds the turn, retrieves chunks + memory, calls Gemini
6. Emily explains in short steps or with a drawing            ← adapts style
7. Student taps helpful / confusing / too easy / too hard     ← feedback
8. Emily decides the next step and says why                   ← "You marked 'confusing' → I'll draw the next one."
   Teacher-only: a one-line observation + the chunk ids used  ← notes (never shown to the student)
→ back to 1, until the mission is complete
→ close the tab: the checkpoint is saved; reopen: "Welcome back — last time you were on Fractions."
→ mission complete or abandoned: Gemini writes the learning trace; the class summary is re-clustered
```

## One tutor turn, in depth

This is the part the category is about, so here is exactly what happens when a student taps an answer (`POST /users/student-tutor-turn`):

1. **The game dispatches locally first** — the chalkboard moves on instantly with a deterministic tutor (`web/src/modules/game/agent/mock-tutor.ts`), so the lesson never waits on the network. The API turn then overwrites Emily's message, the "why" prompt, the explanation steps and the style/difficulty preferences when it lands. If Gemini is offline the deterministic copy simply stays.
2. **Grounding** — the server ignores the client's idea of the question. It loads the pinned published revision of the mission and overwrites `prompt`, `expected_answer` and `stage_id` from the real question; correctness is decided server-side. Unknown `question_id` → 400.
3. **Retrieval** (`retrieveMissionKnowledge`) — a query is built from subject + learning goal + stage + question prompt + the student's response + their explicit reasoning, and scored against every `knowledge_chunk` of the published revision (title, content, keywords) by token overlap, with a boost when the chunk belongs to the current stage. Top 5 go into the prompt. This is lexical retrieval over model-distilled chunks — no vector store — which is deliberate: every chunk is traceable to the teacher's material and the teacher can read exactly what was retrieved.
4. **Memory** — from `users/{uid}`: `learning_memory` (strengths, improvement areas, preferred explanation, next adaptation from the previous mission). From `student_mission_attempts/{attempt_id}`: progress per stage, the last 24 observable events, the last 12 tutor turns. From the class: the four most frequent strengths and needs across the latest finalized attempts of every classmate (`class_context`).
5. **Gemini** (`orchestrator.BuildTutorTurn`, structured output, temperature 0.25) returns: `message`, `why_prompt`, `explanation_steps` (≤6), `explanation_style` (`steps|visual`), `difficulty_bias` (−1..1), `next_action` (`continue|ask_reasoning|explain|retry|complete`), `teacher_observation`, `retrieved_chunk_ids`, `evidence_event_ids`. The system instruction forbids revealing teacher-only memory, class patterns or other students, forbids claiming to read hidden chain-of-thought, and only allows adaptation — never labelling, ranking or grading.
6. **Leak guard** — the student-facing text is scanned for private context ("teacher-only", "other students", any long verbatim memory string…). If it leaks, the whole model output is dropped and the deterministic fallback is used, with `fallback_reason` recorded.
7. **Persist** — the turn (with `teacher_observation`, provenance, model, token usage, chunk ids) is appended to the attempt (idempotent by `event_id`, capped at 80). The student receives only the safe fields.

Between turns the game writes a **monotonic snapshot** (`POST /users/student-learning`) 450 ms after every state change, every 30 s while visible, and a `paused` keepalive on `pagehide`. The snapshot carries the exact **checkpoint**: `stage_id, question_id, phase, step_index, explain_index, lines[], wrong_choice, decision_*, tutor_message, why_prompt, seated`. On return, `GET /users/student-learning?mission_id=…` restores it and the reducer puts the student back at the desk in that phase. `localStorage` keeps only a stripped copy of the position (no notes, no decisions, no events) for offline recovery; Firestore is the source of truth.

When the snapshot says `completed`, or when no checkpoint arrives for `STUDENT_ABANDONMENT_SECONDS` (120 s in production — a Cloud Tasks watchdog), the attempt is finalized: Gemini (`BuildLearningTrace`) writes `summary`, `strengths`, `improvement_areas`, `next_adaptation` and a `flow` graph of the observable path (start → question → misconception → feedback → adaptation → mastery → complete, each node pointing at evidence event ids). The trace updates `users/{uid}.student.learning_memory`, and the class summary is re-clustered (`BuildClassLearningSynthesis`) into `class_learning_summaries/{class_id}`. The dashboard listens to both collections with Firestore realtime listeners.

## What exists today

Status on **August 29, 2026**. Everything below is deployed on Cloud Run unless marked.

**Student game (`/home`)**
- Enter a six-digit mission code and a name. The code is validated (`POST /users/student-session/validate`), the browser signs in anonymously with a **student-only Firebase app instance** (so a teacher signed in on the same browser is untouched), and `POST /users/student-session` returns the **published mission**: stages, questions, expected answers, explanation steps and misconception traps.
- The published mission is converted into chalkboard questions (`content/game-mission.ts`): every non-expected option becomes a named trap that feeds the "why" card. Each game is **pinned to the published revision** it joined — the teacher can publish a new draft without changing a running attempt.
- 3D classroom (Three.js): one desk for the student, Emily at the whiteboard, classmates seated at the other desks, joystick on phones, WASD on desktop, tap the glowing desk to walk. Six chibi avatars generated headless in Blender.
- Chalkboard lesson UI (inspired by the classroom minigames in *Bully: Scholarship Edition*, without the timer): multiple choice, the "why" card, step or visual explanations, feedback pills, a decision card with its **why**, and a "thinking" pulse while Emily decides.
- Live Gemini tutor turns (`POST /users/student-tutor-turn`) on every answer, explicit reasoning and feedback; exact resume; presence heartbeat every 15 s (`POST /users/student-presence`).
- The student never sees Emily's notes, observations or the class memory — those are teacher-only by design (see *Safety*).

**Teacher dashboard (`/login`, `/dashboard`, `/dashboard/class/{classId}`)**
- Sign in with Google (Google Identity Services) or with the **pre-filled demo teacher account** on the login page — the jury can walk straight in.
- `/dashboard`: class cards with code, mission count and readiness. Create/edit classes (name, subject, grade); the six-character class code is generated by the API.
- `/dashboard/class/{classId}` — four tabs:
  - **Overview**: class at a glance (not started / playing now / in a review / left early / completed), where the class is in the mission (funnel with names), strengths and areas for growth across the class, a tiered next-lesson plan (reteaching / whole class / enrichment) with **"Build tomorrow's mission"**, recent players with online state, and the current class plan with a **Gemini** or **Fallback** provenance badge.
  - **Missions**: the mission builder — mission name, learning goal, teacher prompt, audience (whole class or selected students), up to 5 files (PDF/PNG/JPEG/DOCX/TXT, 20 MB each) with previews. *Generate preview* → Gemini; review questions, traps, the mission flow graph and the education guardrail; *Update preview* keeps every revision on the same mission; *Approve and assign* publishes and activates the six-digit mission code.
  - **Students**: per-student progress, strengths, improvement areas, evidence counters, and a detail dialog with **Summary**, **Learning flow** (React Flow graph of the trace), **Evidence** (observable events + every tutor turn with Emily's reply, the teacher-only observation and the `RAG · chunk-id` chips) and **Memory** (next adaptive turn, provenance: "Generated by gemini-3.7-flash from 23 observable events" or "Built directly from events · reason").
  - **Notebook**: class notebook (current focus, positive signal, who needs follow-up) and next-lesson notes.
- Realtime: Firestore listeners on `student_mission_attempts` (this class) and `class_learning_summaries/{classId}` trigger a debounced refresh of the server-authorized overview; a 60 s poll and a refresh on tab focus are the fallback.

**API (Go on Cloud Run)** — see [API](#api) below. Gemini through the Google GenAI SDK (Vertex AI backend, `gemini-3.7-flash`), structured output everywhere, deterministic fallbacks everywhere, Firestore as the only database, Cloud Tasks for attachment copies and learning jobs, Cloud Storage for attachments, and Redis for distributed GenAI quotas and health.

**Content**: `apps/assets/grade/` holds Grade 5 worksheets (K5 Learning) with ready-to-copy mission setups — mission name, learning goal and teacher prompt for each file — so a mission can be generated from real classroom material in a minute.

## Safety and honesty by design

- **Firestore rules are read-only for browsers.** Teachers can read only the classes they own, their students' attempts and the class summary. Anonymous students can read nothing; their resume state comes only through the API, which strips notes, decisions, events, tutor observations and traces.
- **Two guardrails on mission generation.** A deterministic pre-model gate (blocked phrases + required education signals) and a post-model `education_guardrail` from Gemini. Unsafe or off-topic requests get a harmless remediation preview; the mission module refuses to publish it (422). Teacher text and attachments are treated as untrusted material; instructions inside them are ignored.
- **No hidden chain-of-thought.** Both the tutor and the learning-trace prompts reason only from observable answers, explicit explanations and feedback, and are forbidden from claiming otherwise. The student detail dialog says so on screen.
- **Bounded GenAI spend.** Echo absorbs local bursts; Redis enforces per-teacher, per-student, per-class and per-IP quotas across Cloud Run replicas. Tutor event ids are idempotent, each three-question attempt has a 12-turn model budget, completed attempts cannot be regenerated, and Redis failures fall closed to deterministic learning traces.
- **Provenance everywhere.** Every mission, turn and trace records `provider`, `model`, `generated_by_ai`, `fallback_reason` and token counts. The dashboard labels every block by source: **Live class data**, **Based on class signals** (levels computed client-side), **Example data** (only when a class has no students yet), plus **Gemini** / **Fallback** badges.
- **Never a dead end.** Mission preview, tutor turn, learning trace and class synthesis all have deterministic fallbacks; the endpoints never fail because of the model.

## Architecture

One repository, two Cloud Run services, one database.

```txt
apps/
  web/   Next.js 16 + React 19 + TypeScript + Tailwind + Three.js — the game and the teacher dashboard
  api/   Go (Echo) — Google GenAI SDK (Vertex AI), Firestore, Cloud Tasks, Cloud Storage, Redis
```

```txt
Teacher dashboard (Next.js on Cloud Run)
  -> Firebase Auth (Google Identity Services or demo password account)
  -> Uploadcare temporary upload for optional files
  -> Go API
       POST /teacher-classes                                     Firestore teacher_classes/{class_id}
       POST /teacher-classes/{class_id}/missions/preview
            -> Redis quotas (6/min + 30/hour/teacher; 120/hour/IP)
            -> orchestrator.BuildMission -> Gemini structured output
               (attachments downloaded from Uploadcare and sent inline)
            -> Firestore missions/{mission_id} (draft revision n, tenant-scoped)
       POST /teacher-classes/{class_id}/missions/{mission_id}/approve
            -> published snapshot, published_revisions/{n}, mission_codes/{code}
            -> Cloud Tasks -> POST /internal/tasks/mission-attachments -> Cloud Storage
       GET  /dashboard/overview?class_id=…   class, active mission, students, attempts, class learning
  -> Firestore realtime listeners: student_mission_attempts, class_learning_summaries

Student game (Three.js, Next.js on Cloud Run)
  -> POST /users/student-session/validate     code check before sign-in
  -> Firebase Auth (anonymous, separate app) -> POST /users/student-session -> users/{uid} + published mission
  -> POST /users/student-presence             every 15 s
  -> POST /users/student-tutor-turn           every answer / why / feedback
            -> Redis quotas (12/min + 60/hour/student; IP ceilings; 12 turns/attempt)
            -> ground against published revision
            -> retrieve knowledge chunks + student memory + attempt history + class context
            -> orchestrator.BuildTutorTurn -> Gemini structured output -> leak guard
            -> student_mission_attempts/{attempt_id}.tutor_turns[]
  -> POST /users/student-learning             snapshot + exact checkpoint (450 ms debounce, 30 s heartbeat, pagehide)
            -> completed  -> Cloud Tasks -> POST /internal/tasks/student-learning (finalize)
            -> otherwise  -> Cloud Tasks watchdog (120 s) -> abandoned + partial trace
                 -> Redis class budget (180 GenAI calls/hour; local fallback when exhausted)
                 -> orchestrator.BuildLearningTrace -> trace + users/{uid}.student.learning_memory
                 -> orchestrator.BuildClassLearningSynthesis -> class_learning_summaries/{class_id}
  -> GET  /users/student-learning?mission_id=… exact resume
```

**3D pipeline**: the classroom is a Sketchfab GLB split into connected islands at load time (room stretched, furniture spread, whiteboard recoloured, colliders derived). Avatars are generated headless in **Blender** (`scripts/assets/3d/generate-chibi-band-avatar.py`, vertex colours, Draco). During development we drove **Blender through its MCP server** from Claude Code to inspect the models, and measured desk groups, chair seats and the rig's leg pivot with Node scripts before writing scene code. Classmates are the same six characters repainted per instance by rewriting vertex colours.

### Data model (Firestore)

Durable classroom records are tenant-scoped with `organization_id`, `district_id`
and `school_id`. For the hackathon/demo all teachers default to one configured
tenant (`DEFAULT_ORGANIZATION_ID`, `DEFAULT_DISTRICT_ID`,
`DEFAULT_SCHOOL_ID`), but the records are already shaped so a future school or
district sale can query by organization/school without moving data.

```txt
users/{firebase_uid}                                    # anonymous student
  identity, profile, roles ["student"], is_guest
  student: { organization_id, district_id, school_id,
             class_id, mission_id, mission_code, student_name,
             learning_memory: { strengths[], improvement_areas[], preferred_explanation,
                                next_adaptation, last_mission_id, evidence_at, updated_at } }
  activity: { first_seen_at, last_seen_at, login_count,
              current_game: { attempt_id, mission_id, published_revision, subject,
                              stage_id, stage_name, status, started_at, last_heartbeat_at } }

student_mission_attempts/{attempt_id}                   # one student × one mission × one revision
  organization_id, district_id, school_id
  student_id, student_name, class_id, mission_id, mission_code, published_revision, subject, status
  snapshot: { revision, progress[], notes[], preferences, decisions[], events[],
              redirected, return_to, last_pod, checkpoint{ stage_id, question_id, phase, step_index, … } }
  tutor_turns[]: { id, sequence, type, stage_id, question_id, prompt, student_response, expected_answer,
                   outcome, explicit_reasoning, feedback,
                   tutor: { message, why_prompt, explanation_steps[], explanation_style, difficulty_bias,
                            next_action, teacher_observation, retrieved_chunk_ids[], evidence_event_ids[],
                            provider, model, generated_by_ai, fallback_reason, usage } }
  trace: { summary, strengths[], improvement_areas[], next_adaptation, flow{nodes[], edges[]},
           finalized, event_count, generated_by_ai, provider, model, fallback_reason, usage }
  trace_state (live | pending | processing | ready | failed)
  started_at, last_activity_at, completed_at, abandoned_at

class_learning_summaries/{class_id}
  organization_id, district_id, school_id
  synthesis: { common_strengths[{label, student_ids[], evidence_labels[]}], common_needs[…],
               next_adaptation, generated_by_ai, provider, model }
  attempt_count, evidence_updated_at

teachers/{firebase_uid}
  organization_id, district_id, school_id
  identity, profile, roles, activity, created_at, updated_at

teacher_classes/{class_id}
  organization_id, district_id, school_id
  class_code, class_name, subject, grade_level, teacher_id, teacher, active_mission_id, mission_count, status

missions/{mission_id}
  organization_id, district_id, school_id, teacher_id
  class_id, class_code, class_name
  mission_code, mission_name, title, summary, learning_goal, teacher_prompt, audience_type, target_student_ids[]
  attachments[], preview_questions[], knowledge_chunks[], stages[], suggestions[],
  positive_signals[], improvement_signals[], education_guardrail, mission_flow, orchestration
  draft, published, draft_revision, published_revision, has_unpublished_changes, status
missions/{mission_id}/published_revisions/{revision}   # immutable

mission_codes/{six_digit_code} -> { mission_id, class_id, organization_id, district_id, school_id, teacher_id, status }
```

All payloads and fields are `snake_case`. A returning student is matched by the anonymous Firebase UID; the attempt id is deterministic from `student × mission × revision`. The API still reads legacy missions from `teacher_classes/{class_id}/missions/{mission_id}` so existing demo data keeps working, but new writes go to top-level `missions`.

### API

```txt
GET    /                                                        health (Firebase, Redis, uptime)
POST   /users/student-session/validate                          { mission_code } -> { valid }
POST   /users/student-session                anonymous token    { mission_code, student_name } -> { user, mission }
POST   /users/student-presence               anonymous token    heartbeat -> activity.current_game
GET    /users/student-learning?mission_id=   anonymous token    exact resume checkpoint (student-safe projection)
POST   /users/student-learning               anonymous token    snapshot + checkpoint; enqueues finalize / watchdog
POST   /users/student-tutor-turn             anonymous token    one grounded Gemini tutor turn
GET    /dashboard/overview?class_id=         teacher token      class, mission, students, attempts, class learning
GET    /teacher-classes                      teacher token
POST   /teacher-classes                      teacher token      create / update class (code generated server-side)
GET    /teacher-classes/{class_id}           teacher token
GET    /teacher-classes/{class_id}/missions  teacher token
POST   /teacher-classes/{class_id}/missions/preview               Gemini blueprint -> draft revision (Redis-limited)
POST   /teacher-classes/{class_id}/missions/{mission_id}/approve  publish revision, activate code, enqueue copy
DELETE /teacher-classes/{class_id}/missions/{mission_id}          soft delete, disable code
POST   /internal/tasks/mission-attachments   Cloud Tasks OIDC   Uploadcare -> Cloud Storage
POST   /internal/tasks/student-learning      Cloud Tasks OIDC   finalize trace / abandonment watchdog
```

Teacher token = Firebase ID token from Google sign-in or the demo password account. Anonymous token = Firebase anonymous ID token from the student app instance.

### Agent contracts (Gemini structured output)

Four generators live in `api/internal/modules/orchestrator`; each has a deterministic fallback.

```jsonc
// BuildMission — teacher prompt + inline attachments -> mission blueprint
{ "title", "summary", "subject", "grade_level", "learning_goal", "suggested_duration_minutes",
  "stages": [{ "id", "title", "goal", "checks": [], "unlocks_when" }],                       // 3–4
  "preview_questions": [{ "id", "stage_id", "prompt", "answer_type", "options": [],
                          "expected_answer", "explanation_steps": [], "misconception_traps": [] }], // 3–6
  "knowledge_chunks": [{ "id", "source", "title", "content", "keywords": [] }],              // 3–12, the RAG corpus
  "suggestions": [{ "id", "title", "reason", "activity", "questions": [], "focus_skills": [] }],
  "positive_signals": [], "improvement_signals": [],
  "education_guardrail": { "allowed", "reason", "used_attachments", "attachment_notes" },
  "mission_flow": { "nodes": [], "edges": [] } }

// BuildTutorTurn — one student turn -> student-safe reply + teacher-only observation
{ "message", "why_prompt", "explanation_steps": [], "explanation_style": "steps|visual",
  "difficulty_bias": -1, "next_action": "continue|ask_reasoning|explain|retry|complete",
  "teacher_observation", "retrieved_chunk_ids": [], "evidence_event_ids": [] }

// BuildLearningTrace — completed or abandoned attempt -> teacher-facing trace + next adaptation
{ "summary", "strengths": [], "improvement_areas": [], "next_adaptation",
  "flow": { "nodes": [{ "id", "kind", "label", "evidence_event_ids": [] }], "edges": [] } }

// BuildClassLearningSynthesis — latest finalized traces of a class -> clusters
{ "common_strengths": [{ "label", "student_ids": [], "evidence_labels": [] }],
  "common_needs": [ … ], "next_adaptation" }
```

## Run it locally

Prerequisites: Go 1.27, Node 24, a Firebase service account for project `allthingsagentichackatho-ee359` (or your own project with Firestore + Auth), Vertex AI access (or a Gemini API key with `GENAI_BACKEND=gemini_api`), and a Redis URL (the API refuses to boot without one).

```bash
# API
cd apps/api
cp .env.example .env        # set FIREBASE_CREDENTIALS_FILE, REDIS_URL, GENAI_* (GENAI_ENABLED=false works with fallbacks)
go mod download
go run ./cmd/api            # http://localhost:4004/

# Web
cd ../web
cp .env.example .env.local  # Firebase web config + NEXT_PUBLIC_CLASSGAME_API_BASE_URL=http://localhost:4004
npm install                 # postinstall copies the Draco decoder into public/vendor/draco
npm run dev                 # http://localhost:3000
```

`CLOUD_TASKS_ENABLED=false` locally: approvals still publish, but attachment copies and the learning finalization run only where Cloud Tasks is configured (finalization falls back to an inline synchronous run when the enqueue fails). Tenant env vars are optional locally; unset values use `default-org`, `default-district` and `default-school`. Deploy the Firestore rules with `firebase deploy --only firestore:rules` from `apps/`.

Useful commands:

```bash
cd apps/web && npx tsc --noEmit && npm run lint && npm run build
cd apps/api && go build ./... && go vet ./...
apps/scripts/reset-firebase-test-data.sh --dry-run      # wipe demo data (keeps the demo teacher); --yes to run
cd apps/api && go run ./cmd/firebase-demo-teacher --project allthingsagentichackatho-ee359 --password '…'
```

## Testing instructions (hosted)

No paid account is needed. Two browser windows (or a laptop and a phone) work best.

**Teacher**
1. Open https://classgame-web-mzkj6f7g3a-ue.a.run.app/login. The demo teacher account is pre-filled — click *Sign in* (or use your own Google account).
2. Create a class (name, subject, grade) or open an existing one.
3. In the **Missions** tab, fill in mission name, learning goal and the teacher prompt. Optional: attach one of the Grade 5 worksheets from `apps/assets/grade/5th/` — `apps/assets/grade/README.md` has ready-to-copy prompts. Click **Generate preview**.
4. Read the preview: questions with expected answers and misconception traps, the mission flow graph, the education guardrail, and the **Gemini** / **Fallback** badge. Edit the prompt and click **Update preview** if you like — revisions stay on the same mission.
5. Click **Approve and assign to class**. Note the six-digit **mission code**.

**Student** (phone recommended)
6. Open https://classgame-web-mzkj6f7g3a-ue.a.run.app/home, enter the mission code and a name, tap *Start mission*, pick a character, walk to the glowing desk and sit.
7. Answer the first question wrong on purpose. Emily asks *why* — pick a reason. Watch the explanation, then tap **Confusing**: Emily switches to a drawing and the decision card states why.
8. Answer a few more. Close the tab, reopen the same URL in the same browser: *"Welcome back — last time you were on …"*, and you are back at the exact question and step.
9. Finish the mission (or just walk away for two minutes: the watchdog marks the attempt as left early and still writes a partial trace).

**Teacher again**
10. Back on the class page, the **Overview** updates live: the student moves through the funnel, appears in *Recent players* with online state, and the class strengths / areas for growth refresh when the trace lands.
11. Open the student in the **Students** tab: *Summary* (Gemini's summary, strengths, areas to revisit), *Learning flow* (graph of the path), *Evidence* (every event and every tutor turn — Emily's reply, the teacher-only observation and the retrieved chunk ids), *Memory* (the next adaptive turn and provenance).
12. Click **Build tomorrow's mission**: the class patterns are pre-written into the next prompt in the mission builder.

Smoke checks:

```bash
curl -I https://classgame-web-mzkj6f7g3a-ue.a.run.app/home
curl https://classgame-api-2057331207.us-east1.run.app/
curl -X POST https://classgame-api-2057331207.us-east1.run.app/users/student-session/validate \
  -H 'Content-Type: application/json' --data '{"mission_code":"000000"}'   # -> 404 mission_not_found
```

## Deployment

- Repository: `velrino/allthingsagentichackathon` (GitHub). Cloud Build triggers `classgame-web-main` (`web/**`) and `classgame-api-main` (`api/**`) build from `apps/` with an `_APP_DIR` substitution and deploy to Cloud Run in `us-east1`.
- Production API env (from `api/infra/cloud-run/production/cloudbuild.yaml`): `GENAI_BACKEND=vertex`, `GENAI_MODEL=gemini-3.7-flash`, `GENAI_LOCATION=global`, `CLOUD_TASKS_ENABLED=true`, queue `mission-attachment-copy` (serves attachment copies and learning jobs), `STUDENT_ABANDONMENT_SECONDS=120`.
- Secrets: Firebase service account and Redis URL from Secret Manager. Uploadcare uses a public key on the web side only.
- One-time setup for the queue, OIDC identity and IAM is documented in `api/README.md`.

## Demo script (video)

1. **Teacher** signs in with the pre-filled demo account, opens a class, attaches a worksheet, types *"Today: solving two-step equations. Several students slipped on fractions."* → Emily generates the mission; show the traps, the knowledge chunks behind the flow graph, the guardrail and the mission code.
2. **Student** on a phone enters the code, picks a character, walks to the desk.
3. Gets a question wrong; Emily asks why; the student picks a reason; taps **confusing** → Emily draws it and explains why she changed.
4. Close the tab, reopen → *"Welcome back"*, same question, same step.
5. Finish. **Teacher** page updates live: funnel, recent players, class patterns.
6. Open the student: Gemini's summary, the learning flow, the evidence timeline with `RAG · chunk` chips and teacher-only observations, the next adaptation.
7. **Build tomorrow's mission** → the next prompt is pre-written. Show Firestore documents and the two Cloud Run services.

## Known limits and what's next

- Retrieval is lexical token overlap over Gemini-distilled chunks — traceable and cheap, but no semantic embeddings yet.
- Published missions are played as multiple choice; the "pick the next move" equation mechanic exists only in the built-in algebra content.
- The "why" reasons offered to the student are built locally from the mission's misconception traps; Gemini writes the *question* (`why_prompt`), the message and the explanation steps. The decision card's `why` line is deterministic.
- Before a student's first checkpoint the dashboard shows placeholder progress; blocks with no data are labelled **Example data**.
- Next: semantic retrieval, cross-mission memory surfaced to the teacher over weeks, signed uploads through the API, voice for Emily.

## Repository layout

```txt
apps/
  README.md                       this document
  DEVPOST_SUBMISSION_DRAFT.md     Devpost form draft
  firebase.json, firestore.rules  read-only browser rules (deploy from apps/)
  assets/3d/avatars/              chibi-band source (.blend, .obj, .fbx) + build notes
  assets/grade/                   Grade 5 worksheets + ready-to-copy mission prompts
  scripts/                        Cloud Build triggers, Firebase test-data reset
  web/                            Next.js game + dashboard (see web/README.md)
  api/                            Go API (see api/README.md for routes, Cloud Tasks and GenAI setup)
```

## Credits

- **Low Poly ClassRoom** by **Mumladze28** — [Sketchfab](https://sketchfab.com/3d-models/low-poly-classroom-8b1bf103c90349d981c9c2ae1c0596e5), adapted at load time.
- **Chibi band avatars** — generated set from the author's Unshatter project; base mesh, hair and cap licensing in `apps/assets/3d/avatars/chibi-band/README.md`.
- Grade 5 worksheets from [K5 Learning](https://www.k5learning.com/) (free printables), used as test material.
- Board interaction inspired by the classroom minigames in *Bully: Scholarship Edition* (minus the timer).
- shadcn/ui components; dashboard shell adapted from the open-source shadcn-admin template.
- **Blender** (headless avatar generator) and the **Blender MCP server**, used from Claude Code during development.

## Short pitch

**ClassGame turns tonight's review into a game the teacher can read tomorrow. Emily, a Gemini tutor, builds the mission from what the teacher taught, leads each student through it, asks why they got things wrong, remembers how each one thinks across sessions, adapts every turn from retrieved lesson material and past interactions — and hands the teacher the evidence, live.**
