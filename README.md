# ClassGame

**ClassGame is the optional homework that takes notes for the teacher.**

A teacher types what the class covered today. An AI tutor — **Emily** — turns it into a short 3D review mission. Students play it on their phones for ten minutes: Emily leads them question by question, asks *why* they picked a wrong answer, writes down how each student thinks, explains in the style that works for that student, and changes course when she spots a gap from an earlier topic. The next morning the teacher opens Emily's **class notebook** and sees the patterns — not scores, reasoning.

Built for the **All Things Agentic Hackathon**, category **The Collaborative Partner**.

Hackathon page: [All Things Agentic Hackathon](https://allthingsagentichackathon.devpost.com/)

---

## Why this shape

The first plan was a generic "algebra observatory" with hand-written questions. Two things were wrong with it: nobody could answer *where the next lesson comes from*, and the agent's notes only ever reached the student. Both are fixed by putting the teacher at the two ends of the loop:

```txt
Teacher                     Emily (agent)                     Student
──────────                  ─────────────                     ───────
"Today: two-step            generates the mission             plays 10 min on a phone
 equations. Many            (questions, traps, explanations)  → answers → "why?" → notes
 slipped on fractions."     ──────────────────────────────►   → feedback → Emily adapts
                            aggregates the notebook
 reads the class notebook   ◄──────────────────────────────
 "7 students add fractions
  straight across."
```

This is the *Collaborative Partner* brief twice over: Emily leads the way and takes notes for the student, and those notes are what the teacher gets back.

## Collaborative Partner Alignment

> Build an agent that leads the way and takes notes. It should ask clarifying questions, guide the user step-by-step, and have a clear way to capture feedback, so it constantly adapts to the user's unique way of thinking.

| Brief | Where it shows in the product |
|---|---|
| Leads the way | Emily picks every question and every next step; the student never chooses "what to study". |
| Asks clarifying questions | After a wrong answer she does **not** reveal the answer. She asks *"Why did you pick 6/3?"* with reasons written in the student's voice, plus free text. |
| Guides step-by-step | Explanations come in 2–3 short steps, one at a time; equations are solved by picking the next move. |
| Takes notes | Every "why" becomes a note in Emily's notebook: *"Simplifies numerator and denominator by different numbers"*, with evidence and a count. |
| Captures feedback | Four buttons after each explanation: helpful / confusing / too easy / too hard. Students can also strike a note: *"That's not how I think."* |
| Adapts | Feedback changes explanation style and difficulty; a fraction slip inside algebra reopens Fractions for a two-question review, then returns to the exact equation that stopped the student. Every decision states its **why**. |

The teacher side adds the second collaborator: the same notebook, aggregated per class.

## The core loop (this is the product)

```txt
1. Emily writes a question on the board           ← leads the way
2. Student answers (multiple choice, or "pick the next move" for equations)
3. Wrong? Emily asks "Why did you pick that?"     ← clarifying question
4. Student picks a reason (or writes one)
5. Emily writes a note in her notebook             ← takes notes
6. Emily explains in short steps, or draws it      ← step-by-step
7. Student taps helpful / confusing / easy / hard  ← feedback
8. Emily decides the next step and says why        ← adapts
   "You marked 'confusing' → I'll draw the next one."
   "That slip was fractions, not algebra → quick review first."
→ back to 1, until the mission is complete
```

## What exists today

The game loop still uses a mocked tutor agent, but student entry and live game presence now use the real API and Firestore.

- **3D classroom** (Three.js, low-poly GLB). The merged mesh is split into connected islands at load time, the room shell is stretched 2× and the furniture spread apart so it's walkable; the whiteboard is recoloured to match the lesson board (`scene/classroom-layout.ts`).
- **Third-person camera**: drag to orbit, returns behind the avatar while walking, slides along walls instead of clipping.
- **Collision** with walls and furniture; joystick on phones, WASD + mouse on desktop; tap the glowing desk to walk to it.
- **Characters**: six chibi avatars (from Unshatter's chibi-band set). The student picks one from the top bar; **Emily** is the teacher, standing at the whiteboard.
- **Student entry**: `/home` blocks the game with a centered modal for a six-digit `mission_code` and `student_name`; the web validates the mission code before signing in anonymously with Firebase Auth and posting to the API.
- **Teacher login and dashboard**: `/dashboard` and `/dashboard/classes` are protected by Firebase Google sign-in; unauthenticated or anonymous users go to `/login`. Teachers can create classes, build missions with optional files, process them with Emily, review and approve a student-facing preview, inspect reusable learning charts, and see the 10 most recently active players with live presence.
- **One desk**: the student sits at the desk in front of the teacher's; the whole mission happens there.
- **Chalkboard lesson UI** (Bully: Scholarship Edition style, no timer): multiple choice for fractions, "pick the next move" for equations, the *why* card, step/visual explanations (fraction bars, equation chains), feedback pills, decision card with its *why*.
- **Emily's notebook**: notes (type, skill, evidence, count) with "That's not how I think", adaptation state, decision log, reset.
- **Persistent memory** in `localStorage` (mirrors the Firestore document): close the tab, come back, *"Welcome back — last time you were on Fractions."*
- **Student user records and presence** in Firestore: `POST /users/student-session` verifies the anonymous Firebase token and upserts `users/{firebase_uid}`. While the game is visible, `POST /users/student-presence` updates the nested `activity.current_game` every 15 seconds so the dashboard can show subject, stage, status, and online state. All fields use `snake_case`.
- **Teacher class records** in Firestore: `POST /teacher-classes` verifies a Google Firebase token and upserts `teacher_classes/{class_id}` with nested `teacher`, `active_mission_id`, `mission_count`, status and timestamps.
- **Teacher mission lifecycle** in Firestore: `POST /teacher-classes/{class_id}/missions/preview` creates or updates a revisioned draft on the same mission document. Approval promotes that exact draft revision while the previous published snapshot stays live; deletion is soft and preserves the revision history.
- **Uploadcare file input** in the dashboard: the web uploads up to five optional files of 20 MiB each as temporary Uploadcare files. After approval, Cloud Tasks copies them asynchronously into Firebase Storage under the class, mission, and published revision.
- **Student mission memory model** in `api/internal/modules/teacher-class-student`: future tutor turns can write per-class student thinking summaries, mission progress, feedback counts and notebook notes under `teacher_classes/{class_id}/students/{student_id}`.
- **Demo content**: the Algebra Mission — Fractions → Simple equations → Two-step equations, 12 questions whose wrong options are tagged with named misconceptions (`content/algebra-mission.ts`). This becomes the few-shot example for generated missions.

The in-game student tutor is still deterministic behind the exact interface the real Gemini implementation will use. The teacher mission builder now has a real GenAI integration with local fallback.

Not built yet: real tutor turns, playable mission loading from Firestore, persisted attempts/progress, aggregated class notebook from real answers.

## Current progress

Status on **August 28, 2026**:

- GitHub repository is connected: `https://github.com/velrino/allthingsagentichackathon`.
- Cloud Build triggers are active for both services:
  - `classgame-web-main` builds and deploys `apps/web`.
  - `classgame-api-main` builds and deploys `apps/api`.
- Cloud Run services are deployed in `us-east1`:
  - Web: `https://classgame-web-mzkj6f7g3a-ue.a.run.app/home`
  - API: `https://classgame-api-2057331207.us-east1.run.app`
- Production web is configured to call the production API through `NEXT_PUBLIC_CLASSGAME_API_BASE_URL`.
- The student entry flow is live in the frontend: `/home` opens the required mission-code/student-name modal, signs in anonymously with Firebase Auth, and calls the API.
- The API route `POST /users/student-session` is live and returns `401` without a valid Firebase token, confirming the route exists and auth is enforced.
- Firestore student users are created under `users/{firebase_uid}` with nested `identity`, `profile`, `student`, and `activity.current_game` objects.
- Teacher dashboard work is implemented and validated locally: `/login`, `/dashboard`, `/dashboard/classes`, `GET /dashboard/overview`, `POST /teacher-classes`, `GET /teacher-classes/{class_id}`, `GET /teacher-classes/{class_id}/missions`, `POST /teacher-classes/{class_id}/missions/preview`, `POST /teacher-classes/{class_id}/missions/{mission_id}/approve`, and soft-delete through `DELETE /teacher-classes/{class_id}/missions/{mission_id}`. Deployment of this dashboard pass is still pending.
- The game sends a best-effort presence heartbeat every 15 seconds; the dashboard refreshes in the background every 8 seconds and computes online state from a 45-second server-side window.
- The API now includes a reusable Google GenAI adapter in `api/internal/shared/google/genai` and an orchestrator module in `api/internal/modules/orchestrator`.
- Redis is enabled for the API health/cache path without TLS.

## Pedagogical goal of the demo mission

> A 12–14-year-old solves `2x/3 + 1 = 5` on their own.

| Stage | Learns to… | Mechanic | Done when |
|---|---|---|---|
| Fractions | simplify, compare, add | multiple choice | 3 clean answers |
| Simple equations | isolate x in one move | pick the next move | 2 clean answers |
| Two-step equations | two moves in the right order | pick the next move | 2 clean answers |

Fractions were chosen because their mistakes have *names* (adds across, simplifies parts separately, bigger denominator = bigger, divides to clear a denominator…). Named mistakes are what make the notebook specific instead of "struggles with math".

## Architecture (decided)

One repository, two deployable services, one database.

```txt
apps/
  web/   Next.js + React + Three.js — the game, the teacher form, the class notebook
  api/   Go — teacher mission orchestration, future tutor agent, Google GenAI SDK, Firestore, Redis
```

- **Gemini 3.5 or newer** uses the Google GenAI Go SDK with structured JSON output:
  1. `buildMission(teacherInput) → MissionBlueprint` — title, summary, stages, suggested questions, positive signals, improvement signals.
  2. `tutorTurn(memory, lesson, event) → { note, explanationStyle, decision, why }` — next step after the teacher mission flow, replacing `agent/mock-tutor.ts` one function at a time.
- **Firestore** is the only database. Student memory, missions, notes and decisions live there. Firebase project: `allthingsagentichackatho-ee359`.
- **Cloud Run** hosts `classgame-web` and `classgame-api`.
- **Redis** protects GenAI preview generation with a distributed teacher rate limit. Mission file persistence runs asynchronously through Cloud Tasks after approval.
- **Cut from the MVP** (on purpose): multiple rooms, grades, deadlines, roster import and high-stakes scoring. The demo should show the teacher setting the learning goal, Emily generating the mission plan, and students reviewing it in the classroom.

### Data model (Firestore)

```txt
missions/{code}                         # 4-letter code the teacher shares
  topic, teacherNotes, subject, createdAt
  stages[]: { id, label, tagline, required }
  questions[]: Question                 # same shape as content/algebra-mission.ts
  misconceptions[]: { id, skill, reasoning, note, kind }

missions/{code}/students/{studentId}    # Emily's memory of one student
  avatarPresetId
  notes[]:       { id, misconceptionId, text, kind, skill, evidence[], count, createdAt }
  preferences:   { explanationStyle: "steps" | "visual", difficultyBias: -1 | 0 | 1 }
  progress{}:    stageId → { status, queue[], pool[], correct, required }
  decisions[]:   { at, action, message, why }
  redirected, returnTo, lastStage

missions/{code}/students/{studentId}/attempts/{attemptId}
  questionId, answer, correct, reasoning, feedback, at

users/{firebase_uid}
  identity: { provider, provider_user_id, auth_method, sign_in_provider, token }
  profile:  { display_name, email, email_verified, photo_url }
  student:  { class_id, mission_id, mission_code, student_name }
  activity: { first_seen_at, last_seen_at, login_count }
  activity.current_game: { mission_id, published_revision, subject, stage_id, stage_name, status, started_at, last_heartbeat_at }
  roles, is_guest, created_at, updated_at

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
  draft, published, draft_revision, published_revision, has_unpublished_changes
  created_by, updated_by, status, published_at, deleted_at, deleted_by, created_at, updated_at

teacher_classes/{class_id}/missions/{mission_id}/published_revisions/{revision}
  immutable published snapshot, attachment transfer state, published_by, published_at

mission_codes/{mission_code}
  mission_code, mission_id, class_id, status, created_at, updated_at

teacher_classes/{class_id}/students/{student_id}
  student_id, student_name, current_mission_id
  thinking_summary: { preferred_explanation_style, reasoning_patterns[], strengths[], improvement_areas[] }
  mission_summaries: mission_id → { status, completed_questions, total_questions, correct_answers, last_decision, last_feedback }
  notebook_notes[]: { mission_id, skill, kind, text, evidence[], count }
  feedback_summary: { helpful_count, confusing_count, too_easy_count, too_hard_count }
```

The class notebook is a read over `missions/{code}/students/*`: notes grouped by misconception, counts, who needed a review, what Emily changed.

Current MVP identity rule: a returning student is matched by Firebase anonymous UID, so the same browser/device remains the same student even if the display name changes from `denis` to `Denis M`. Future classroom rosters should add a teacher-issued `student_code` for cross-device matching and dashboard merge tools.

### API

```txt
GET  /
POST /users/student-session/validate six-digit mission code → published mission check before anonymous sign-in
POST /users/student-session          anonymous Firebase token + six-digit mission code/student name → Firestore user
POST /users/student-presence         anonymous Firebase token + current game state → presence heartbeat
GET  /dashboard/overview             Google Firebase token + class_id → teacher dashboard data
POST /teacher-classes                Google Firebase token + class metadata → Firestore teacher class
GET  /teacher-classes/{class_id}      Google Firebase token → one teacher class
GET  /teacher-classes/{class_id}/missions
POST /teacher-classes/{class_id}/missions/preview
POST /teacher-classes/{class_id}/missions/{mission_id}/approve
DELETE /teacher-classes/{class_id}/missions/{mission_id}
POST /missions                       teacher input → generated mission + code
GET  /missions/{code}                mission content for the game
POST /missions/{code}/students/{id}/turn     one tutor turn (answer / why / feedback)
GET  /missions/{code}/students/{id}          student memory (resume)
GET  /missions/{code}/notebook       aggregated class notebook for the teacher
```

### Agent contract

The frontend already treats `agent/mock-tutor.ts` as the boundary. The real agent must return the same shapes:

```json
{
  "note": { "misconceptionId": "add-across", "text": "Adds numerators and denominators straight across", "kind": "misconception", "skill": "fractions" },
  "explanationStyle": "visual",
  "decision": {
    "action": "redirect",
    "target": "fractions",
    "message": "That slip wasn't algebra — it was fractions. Let's fix that first.",
    "why": "Spotted: divides instead of multiplying to clear a denominator. Reopening Fractions for a short review."
  }
}
```

`decision.action ∈ next | complete | redirect | mission-complete`. The game only executes; Gemini 3.5+ decides.

## Plan

Day 1 (done): 3D classroom, camera, collision, characters, chalkboard loop, notebook, mock agent, local memory.

Day 2 foundation (done): Go API, Firebase Admin/Firestore, anonymous student session endpoint, frontend student entry modal, Cloud Run services, GitHub Cloud Build triggers.

Day 2 dashboard pass (done locally, deployment pending): Firebase Google login for teachers, `/dashboard`, `/dashboard/classes`, Firestore `teacher_classes/{class_id}`, mission subcollection, Uploadcare optional file input, process/preview/approve flow, reusable analytics, live recent-player presence, student metrics, and Emily's GenAI-backed suggestions with local fallback.

**Day 2 — make Emily real**
- `POST /teacher-classes/{class_id}/missions/preview`: Gemini 3.5+ structured output from teacher text and optional file URLs; Firestore preview write. **Done locally.**
- `POST /teacher-classes/{class_id}/missions/{mission_id}/approve`: publish the approved preview and activate its unique mission code. **Done locally.**
- `POST /missions`: convert the active teacher mission into playable mission content; Firestore write.
- `POST …/turn`: replace `decideAfterFeedback`, `noteFromReasoning`, `buildWhyOptions` with Gemini 3.5+; keep the reducer.
- Frontend: fetch mission by code; student memory to Firestore instead of `localStorage`.

**Day 3 — close the loop with the teacher**
- Teacher pages: connect the implemented dashboard and class management UI to real attempt-driven notebook aggregation.
- Student entry `/home`: class code + character + classroom mission.
- API: aggregate real notebook notes from student attempts instead of mock progress.
- Deploy both services to Cloud Run; verify Firestore in the console.

**Day 4 — submission**
- Demo video (< 4 min), architecture diagram, Devpost text, README testing instructions.
- Polish only if the video is already recordable: completion celebration, sounds, Emily gestures.

## Demo script

1. **Teacher** opens `/dashboard`, types: *"Today: solving two-step equations. Several students slipped on fractions."* → Emily generates the mission and keeps the class code visible.
2. **Student** opens `/home` on a phone, enters the same class code, picks a character, walks to the desk, sits.
3. Gets `2x/3 = 4` wrong by dividing by 3. Emily asks why; the student picks *"To get rid of the /3 I divided by 3."*
4. A note appears pinned under the board. Emily explains; the student taps **confusing** → Emily switches to drawing.
5. Emily: *"That slip wasn't algebra — it was fractions."* Two fraction questions, then back to the same equation. Solved.
6. **Teacher** reopens `/dashboard`: the class notebook — *"3 students divide instead of multiply to clear a denominator"*, who got a review, what Emily changed and why.
7. Show Firestore documents and the two Cloud Run services.

## Success criteria

- A teacher's sentence becomes a playable mission with named traps (Gemini 3.5+, live).
- Emily asks why, takes a note, explains step by step, captures feedback, and changes course — visibly, with a stated reason.
- The notes reach the teacher as one readable page.
- Memory persists across sessions (Firestore).
- Runs on a phone; deployed on Cloud Run.

## Mobile-first requirements

Playable in a mobile browser with one thumb: floating joystick, swipe to look, tap the desk to walk. Lesson board and controls fit a 390-px-wide portrait screen without overlapping; desktop enhances (WASD, wider board), never defines the layout.

## Repository layout

```txt
apps/
  README.md                 this plan
  assets/3d/avatars/        chibi-band source (.blend, .obj, .fbx) + build notes
  web/                      Next.js game (see web/README.md for structure and controls)
  api/                      Go API with Firebase Auth, Firestore, Redis, GET /, and student session creation
```

## Deployment

Production uses one public GitHub repository and two Cloud Run services:

- Repository: `velrino/allthingsagentichackathon`
- Web service: `classgame-web`, built from `web/infra/cloud-run/production/cloudbuild.yaml`, triggered by changes under `web/**`.
- API service: `classgame-api`, built from `api/infra/cloud-run/production/cloudbuild.yaml`, triggered by changes under `api/**`.

Cloud Build runs from the monorepo root (`apps/`), so both build configs use an `_APP_DIR` substitution (`web` or `api`) for Dockerfile paths and build context.

After the GitHub repository is connected to Cloud Build in the Google Cloud Console, create the two triggers from the repo root:

```bash
./scripts/create-cloud-build-triggers.sh
```

## Credits

- **Low Poly ClassRoom** by **Mumladze28** — [Sketchfab](https://sketchfab.com/3d-models/low-poly-classroom-8b1bf103c90349d981c9c2ae1c0596e5), [ArtStation](https://www.artstation.com/artwork/N5dg5q).
- **Chibi band avatars** — generated set from the Unshatter project; base mesh, hair and cap licensing in `apps/assets/3d/avatars/chibi-band/README.md`.
- Board interaction inspired by the classroom minigames in *Bully: Scholarship Edition* (minus the timer).

## Short pitch

**ClassGame turns tonight's review into a game the teacher can read tomorrow. Emily, a Gemini 3.5+ tutor, builds the mission from what the teacher taught, leads each student through it, asks why they got things wrong, writes down how they think, and adapts — then hands the teacher the notebook.**
