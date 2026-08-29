# Devpost Submission Draft

This file is a draft for the **All Things Agentic Hackathon** Devpost form. Last synced with the code on **August 29, 2026**.

Hackathon page: https://allthingsagentichackathon.devpost.com/

Category brief (The Collaborative Partner — in depth):

> **The focus:** Stateful, multi-turn dialogue with real-time context retrieval (RAG) and persistent memory, so your agent adapts and personalizes based on past interactions instead of starting over each time.
>
> **Examples:** An expert guide that helps you understand a dense legal document, quizzes you as you go, learns which concepts you struggle with, and adapts future explanations. A UI/UX helper for non-designers that turns a vague idea into a wireframe and learns your brand preferences from your corrections.

## Project Overview

### Project Name

ClassGame

### Elevator Pitch

The optional homework that takes notes for the teacher: Emily, a Gemini tutor, turns today's lesson into a 3D review mission, asks students why they got things wrong, remembers how each one thinks across sessions, and hands the teacher the evidence — live.

## Project Details

### About The Project

## Inspiration

Working alongside teachers, one thing keeps coming up: homework tells you *who* got it wrong, never *why*. A stack of wrong answers is a pile of question marks the teacher has to guess through.

Meanwhile most educational apps treat learning as a fixed path — every student gets the same lesson, the same quiz, the same next step — and the app never talks back to the teacher. Every session starts from zero.

The category brief describes "an expert guide that quizzes you as you go, learns which concepts you struggle with, and adapts future explanations". That is what a good tutor does at the kitchen table. **ClassGame** puts that tutor on a student's phone, gives her a memory that survives the tab and the mission, and — this is the part we cared about most — makes what she learns about each student useful to the teacher the next morning.

## What It Does

**For the teacher**: sign in, create a class, describe what the class covered and what you noticed, and optionally attach the worksheet (PDF, images, text). Emily turns that into a **mission**: 3–4 stages, questions whose wrong options are traps for named misconceptions, step-by-step explanations, a mission flow graph, suggestions for the next lesson — and a set of **knowledge chunks** distilled from your material that she will retrieve from while tutoring. Review the preview, adjust the prompt and regenerate; every revision stays on the same mission with its history. Approve, and it appears instantly in that class's realtime mission list.

**For the student**: enter the class's six-digit numeric code and your name, pick a character, and enter a low-poly 3D classroom. The glowing desk appears as soon as the teacher publishes a mission; walk over, tap **START**, and choose one you have not completed. Emily runs it on the chalkboard:

- She asks every question and decides every next step.
- When you're wrong she doesn't reveal the answer. She asks *why you picked it*, with reasons written in your voice — and the question she asks is generated for *your* answer.
- She explains in short steps, or draws it, depending on what has worked for you before.
- You rate each explanation: helpful, confusing, too easy, too hard. She adapts and says why: *"You marked 'confusing' → I'll draw the next one."*
- Close the tab, come back tomorrow: *"Welcome back — last time you were on Fractions."* You are back at the exact question, in the exact step.

**For the teacher, during and after**: one page per class, updating live from Firestore. Who has not started, who is at the desk with Emily right now, who is in a review, who left early, who finished. Then what Emily observed: for each student, a summary, strengths, areas to revisit, a **learning flow** graph of the path they took, and the **evidence** behind it — every answer, every explicit reason, every feedback tap, and every tutor turn with Emily's reply, her **teacher-only observation** and the **retrieved chunk ids** she used. Across the class: clustered strengths and needs, and a tiered next-lesson plan. One button — **Build tomorrow's mission** — turns those patterns into the next prompt.

## How It Maps To The Collaborative Partner

Two people collaborate with Emily: the teacher who plans, and the student who plays. Both loops are live end to end.

| Brief | Student ↔ Emily | Teacher ↔ Emily |
|---|---|---|
| **Stateful, multi-turn dialogue** | Every answer, explicit "why" and feedback tap is one structured Gemini turn on the same attempt. Each turn carries the last 24 observable events and the last 12 tutor turns, so Emily's reply builds on what just happened, not on a blank slate. | Prompt → preview → revise → approve on one mission document with numbered revisions; the published version stays live while the next draft is edited. |
| **Real-time context retrieval (RAG)** | Before each turn the API grounds the request against the published question, retrieves the top 5 knowledge chunks for *this question and this response* from the mission's chunk set, and loads the student's memory, the attempt history and the class-level patterns. Gemini reports which chunk ids it used; they are stored with the turn and shown to the teacher. | Attachments are downloaded and passed to Gemini inline at generation time, and distilled into the knowledge chunks the tutor retrieves from later. The dashboard reads the server-authorized overview and refreshes on Firestore realtime events. |
| **Persistent memory** | Three layers in Firestore: the **attempt** (progress, events, decisions, exact checkpoint, tutor turns, trace), the **student** (`learning_memory`: strengths, improvement areas, preferred explanation, next adaptation — carried into the next mission), and the **class** (clustered strengths and needs across students). | Classes, missions, revisions, published snapshots, a student-safe realtime catalog, attachments in Cloud Storage. |
| **Adapts from past interactions** | Explanation style, difficulty bias and next action change from feedback and repeated slips, with a stated reason. A returning student resumes at the exact phase and step. When the mission ends — or is abandoned — Gemini writes a learning trace whose `next_adaptation` tells the *next* turn how to adapt. | The class patterns pre-write tomorrow's mission prompt, so the next lesson starts from today's evidence. |

## How We Built It

One repository, two Cloud Run services, one database.

- **Agent**: Go with the **Google GenAI SDK** (Vertex AI backend, `gemini-3.7-flash`), structured JSON output for four generators in one orchestrator module: `BuildMission` (blueprint with traps, knowledge chunks, guardrail and flow graph), `BuildTutorTurn` (one live student turn), `BuildLearningTrace` (teacher-facing summary and flow after a completed or abandoned attempt) and `BuildClassLearningSynthesis` (clusters across the class). Every generator has a deterministic fallback, so no endpoint ever fails because of the model, and every output records provider, model, `generated_by_ai`, `fallback_reason` and token usage.
- **One tutor turn**: the game dispatches a deterministic tutor locally so the chalkboard never waits; the API turn then overwrites Emily's message, the "why" prompt, the explanation steps and the style/difficulty. Server-side: ground the turn against the pinned published revision → lexical retrieval over the mission's knowledge chunks → load student memory, attempt history and class context → Gemini → a **leak guard** that discards any output mentioning teacher-only or class context → persist the turn (idempotent by event id) → return only the student-safe fields.
- **Memory and state**: Firestore for everything durable. The game writes a monotonic snapshot with the exact checkpoint (stage, question, phase, step, lines on the board, pending decision) 450 ms after every state change, every 30 s while visible, and on `pagehide`. **Cloud Tasks** runs the finalization when a mission completes and an **abandonment watchdog** (120 s) that marks a left-early attempt and still writes a partial trace; the same queue copies Uploadcare attachments into **Cloud Storage** after approval. **Redis** rate-limits mission generation per teacher. Firebase Auth: Google (or the pre-filled demo account) for teachers, anonymous for students on a separate Firebase app instance.
- **Business-ready tenancy**: every durable classroom record carries `organization_id`, `district_id` and `school_id`. The demo currently maps every teacher to one default tenant, but missions, teachers, classes, attempts and class summaries are already queryable by school or district.
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind, Three.js. The classroom is a single merged GLB split into connected islands at load time to stretch the room, spread the desks and derive colliders; classmates are the six chibi characters repainted per instance by rewriting vertex colours. The dashboard uses Firestore realtime listeners on attempts and class summaries, React Flow for the mission and learning graphs, Uploadcare for uploads with previews.
- **3D pipeline**: **Blender** generates the avatars headless (one shared rig, vertex colours, Draco). We drove **Blender through its MCP server** from Claude Code to inspect and iterate on the models, and measured desk groups and chair seats with Node scripts against the GLB.
- **Safety**: Firestore rules are read-only for browsers — teachers read only their own classes, attempts and summaries; students read only their class, student-safe published metadata and a minimal completion projection (`mission_id`, revision, status). Full attempts, mission content and resume state come through the API, which strips notes, observations and traces. Mission generation has a deterministic pre-model gate and a post-model `education_guardrail`; blocked missions cannot be published. Both tutor and trace prompts reason only from observable answers and are forbidden from claiming to read hidden chain-of-thought.

Runtime flow:

```txt
Teacher dashboard (Next.js on Cloud Run)
  -> POST /teacher-classes
  -> POST /teacher-classes/{class_id}/missions/preview
       -> Redis rate limit -> orchestrator.BuildMission -> Gemini (attachments inline)
       -> Firestore missions/{mission_id} draft revision n (tenant-scoped knowledge_chunks, guardrail, flow)
  -> POST /teacher-classes/{class_id}/missions/{mission_id}/approve
       -> published_revisions/{n} + student_class_missions/{class_id}/missions/{mission_id}
       -> Cloud Tasks -> Cloud Storage
  -> GET /dashboard/overview?class_id=…  + Firestore realtime listeners

Student game (Three.js, Next.js on Cloud Run)
  -> POST /users/student-session/validate -> anonymous Firebase Auth -> POST /users/student-session
       -> users/{uid} + class lobby
  -> Firestore realtime catalog + own completion records
  -> POST /users/student-mission -> chosen published mission (pinned revision)
  -> POST /users/student-tutor-turn on every answer / why / feedback
       -> ground -> retrieve chunks + memory + history + class context -> Gemini -> leak guard
       -> student_mission_attempts/{attempt_id}.tutor_turns[]
  -> POST /users/student-learning  snapshot + exact checkpoint
       -> completed -> Cloud Tasks finalize | idle 120 s -> watchdog -> abandoned
       -> orchestrator.BuildLearningTrace -> trace + users/{uid}.student.learning_memory
       -> orchestrator.BuildClassLearningSynthesis -> class_learning_summaries/{class_id}
  -> GET /users/student-learning?mission_id=…  exact resume
```

## What Makes It Agentic

Emily is not a chatbot in a game. She:

- Chooses the next question and the next step; the student never picks "what to study".
- Asks a clarifying question before explaining anything — and writes that question for the specific wrong answer.
- Retrieves from the teacher's material and from her own memory of the student before every reply, and records what she retrieved.
- Changes explanation style and difficulty from explicit feedback and states the reason for every decision.
- Keeps a memory that survives the tab, the session and the mission, and puts a returning student back exactly where they stopped.
- Writes a learning trace when a student finishes — or gives up — and tells her future self how to adapt next time.
- Turns everything she observed into something the teacher can act on, including the first draft of tomorrow's mission.

This fits **The Collaborative Partner** twice: she adapts to the student from past interactions, and what she learns is what the teacher gets back and builds on.

## Challenges We Faced

**Keeping the student's screen honest.** The first version showed Emily's notebook to the student — notes, decisions, everything. It felt agentic, but it was wrong: a 12-year-old should not read "student confuses numerator and denominator" about themselves, and the model should never be tempted to say it. We moved all observations to the teacher side, made the API return only a student-safe projection, wrote Firestore rules that deny anonymous reads outright, and added a leak guard that throws away any tutor message mentioning teacher-only or class context.

**Never starting over — without lying about it.** "Persistent memory" is easy to fake with `localStorage`. Real persistence meant a monotonic snapshot protocol (revision numbers, server-side merge, optimistic concurrency), an exact checkpoint that includes the lines on the board and the pending decision, revision pinning so a teacher's republish cannot change questions under a running attempt, and a watchdog that finalizes what a student left behind.

**Making the tutor fast and grounded at the same time.** A Gemini call per tap would make the chalkboard feel slow. The game runs a deterministic tutor locally and lets the model's structured turn overwrite it when it arrives; if Gemini is offline the lesson still works. Grounding every turn against the published question on the server, not the client, closed the door on a student's browser inventing "expected answers".

**Making misconceptions nameable.** The notebook is only useful if a wrong answer maps to a specific way of thinking, so every generated wrong option is a deliberate trap tied to a named misconception, and the mission generation prompt is explicit about it.

**Furnishing a room from one merged mesh.** Seating a classmate in every chair meant splitting the classroom GLB into connected islands, recognising chairs and desk tops by their dimensions, and measuring the rig's leg pivot so characters sit *on* the seat. Repainting characters hit 8-bit colour quantisation — near-black hair and near-black shoes became the same colour — solved by matching vertices only against parts that can exist at their height.

## What We Learned

The strongest tutoring agent is not the one that generates the most content; it's the one that turns small signals — a chosen reason, a "confusing" tap, a repeated slip, a tab closed mid-question — into a decision it can explain and a memory it can act on later. Retrieval did not need embeddings to be useful: chunks distilled from the teacher's own material, retrieved lexically and shown to the teacher by id, were more trustworthy than a black-box vector search would have been in a classroom. And provenance matters as much as the answer: labelling every block as Gemini, fallback or example is what lets a teacher — or a judge — trust what they see.

## What's Next

- Semantic retrieval over knowledge chunks (embeddings) alongside the traceable lexical pass.
- Multi-week memory surfaced to the teacher across missions, not only inside one.
- "Pick the next move" equation questions for generated missions (today they are played as multiple choice).
- Signed uploads through the API so production traffic cannot abuse the public Uploadcare key.
- Voice for Emily.

## Built With

Suggested Devpost tags:

- Gemini
- Gemini 3.7 Flash
- Google GenAI SDK
- Vertex AI
- Google Cloud
- Cloud Run
- Firestore
- Cloud Tasks
- Cloud Storage
- Firebase Auth
- Cloud Build
- Go
- Next.js
- React
- TypeScript
- Three.js
- React Flow
- Redis
- Blender
- Blender MCP
- Model Context Protocol (MCP)
- Node.js
- Education
- AI Agents
- Generative AI
- RAG
- Game-Based Learning
- Adaptive Learning
- Personalized Learning
- WebGL
- Serverless

## Try It Out Links

### Hosted Project URL

```txt
https://classgame-web-mzkj6f7g3a-ue.a.run.app/home
```

Teacher side: `https://classgame-web-mzkj6f7g3a-ue.a.run.app/login` (demo account pre-filled).

### Code Repository

```txt
https://github.com/velrino/allthingsagentichackathon
```

### Demo Video Link

TODO: Add public YouTube or Vimeo demo video URL (under 4 minutes, English or English subtitles, shows Cloud Run).

```txt
https://www.youtube.com/watch?v=<video-id>
```

## Additional Info For Judges

### Sponsor / Special Prizes

Do not select **Startup Excellence** unless submitting through an incorporated organization with a corporate email address.

```txt
No Startup Excellence opt-in.
```

### Submitter Type

```txt
Individual/Hobbyist
```

### Submitter Country Of Residence

TODO: Confirm before submission.

```txt
Brazil
```

### Category

```txt
The Collaborative Partner
```

### Organization Name

```txt
N/A
```

### Project Start Date

First commit in the repository: August 27, 2026.

```txt
08-27-26
```

### Public Or Private Code Repo URL

```txt
https://github.com/velrino/allthingsagentichackathon
```

If private, share access with:

```txt
testing@devpost.com
cloudhackathons@google.com
```

### Reproducible Testing Instructions Added To README

```txt
Yes
```

`apps/README.md` → *Run it locally* and *Testing instructions (hosted)*.

### Hosted Project URL If Available

```txt
https://classgame-web-mzkj6f7g3a-ue.a.run.app/home
```

### Testing Instructions

Smoke tests on the deployed services:

```bash
curl -I https://classgame-web-mzkj6f7g3a-ue.a.run.app/home
curl https://classgame-api-2057331207.us-east1.run.app/
curl -X POST https://classgame-api-2057331207.us-east1.run.app/users/student-session/validate \
  -H 'Content-Type: application/json' --data '{"class_code":"000000"}'   # 404 class_not_found
```

Local run:

```bash
cd apps/api && cp .env.example .env && go run ./cmd/api      # :4004, needs Firebase creds + Redis; GENAI_ENABLED=false works with fallbacks
cd apps/web && cp .env.example .env.local && npm install && npm run dev   # :3000
```

Form text:

```txt
No paid account is needed. Two browser windows (or a laptop and a phone) work best.

Teacher:
1. Open https://classgame-web-mzkj6f7g3a-ue.a.run.app/login. The demo teacher account is pre-filled — click "Sign in" (or use any Google account).
2. Create a class (name, subject, grade) or open an existing one.
3. In the Missions tab, enter a mission name, a learning goal and a teacher prompt, e.g. "Today: solving two-step equations. Several students slipped on fractions." Optionally attach a worksheet PDF (apps/assets/grade/README.md has ready-to-copy prompts for the included Grade 5 worksheets). Click "Generate preview".
4. Review the preview: Gemini generates stages, questions with misconception traps, the mission flow graph and an education guardrail. Edit the prompt and click "Update preview" if you like — revisions stay on the same mission.
5. Click "Approve and assign to class" and keep the class's six-digit code visible.

Student (a phone works best):
6. Open https://classgame-web-mzkj6f7g3a-ue.a.run.app/home, enter the class code and a name, pick a character, walk to the glowing desk, tap "START", and choose the published mission.
7. Answer the first question wrong on purpose. Emily asks why — pick a reason. Read the explanation, then tap "Confusing": Emily switches to a drawing and the decision card states why.
8. Answer a few more questions. Close the tab and reopen the same URL in the same browser: "Welcome back — last time you were on …", and you are back at the exact question and step.
9. Finish the mission (or walk away for two minutes: the watchdog marks the attempt as left early and still writes a partial learning trace).

Teacher again:
10. The class Overview updates live: the student moves through the mission funnel, appears in Recent players with online state, and the class strengths / areas for growth refresh when the learning trace lands.
11. Open the student in the Students tab: Summary (Gemini's summary, strengths, areas to revisit), Learning flow (graph of the path), Evidence (every event and every tutor turn — Emily's reply, the teacher-only observation and the retrieved chunk ids), Memory (the next adaptive turn and provenance).
12. Click "Build tomorrow's mission": the class patterns are pre-written into the next prompt.

Teacher sign-in uses Google or the pre-filled demo account; students sign in anonymously.
```

### Which Google SDK Did You Use?

```txt
Google GenAI SDK (google-genai)
```

Go module `google.golang.org/genai`, Vertex AI backend.

### Which Google Cloud Services Did You Use?

```txt
Cloud Run
Firestore
Cloud Tasks
Cloud Storage
Vertex AI
Cloud Build
```

Firebase Auth is used for teacher (Google / password demo account) and student (anonymous) sign-in. Do not select Pub/Sub, Cloud SQL, GKE, Cloud Scheduler or Memorystore — not used.

### Architecture Diagram

TODO: Upload `architecture-diagram.png` or `architecture-diagram.pdf`.

Suggested diagram contents:

```txt
Teacher dashboard (Next.js on Cloud Run) — /login, /dashboard, /dashboard/class/{classId}
  -> Firebase Auth (Google Identity Services / demo account)
  -> Uploadcare temporary upload for optional files
  -> Go API on Cloud Run
       POST /teacher-classes
       POST /teacher-classes/{class_id}/missions/preview
         -> Redis rate limit
         -> Google GenAI SDK -> Gemini 3.7 Flash structured output (attachments inline)
         -> Firestore missions/{mission_id} (tenant-scoped draft revisions, knowledge_chunks)
       POST /teacher-classes/{class_id}/missions/{mission_id}/approve
         -> Firestore missions/{mission_id}/published_revisions/{n}
         -> student_class_missions/{class_id}/missions/{mission_id} (student-safe realtime metadata)
         -> Cloud Tasks -> Cloud Storage (attachments per class / mission / revision)
       GET  /dashboard/overview?class_id=…
  -> Firestore realtime listeners (student_mission_attempts, class_learning_summaries)

Student game (Three.js, Next.js on Cloud Run) — /home
  -> POST /users/student-session/validate
  -> Firebase Auth (anonymous) -> POST /users/student-session -> users/{uid} + class lobby
  -> Firestore onSnapshot (class, published mission catalog, own completions)
  -> POST /users/student-mission -> selected pinned mission payload
  -> POST /users/student-presence every 15 s
  -> POST /users/student-tutor-turn per answer / why / feedback
       -> grounding + retrieval (knowledge chunks, student memory, attempt history, class context)
       -> Gemini 3.7 Flash structured output -> leak guard
       -> Firestore student_mission_attempts/{attempt_id}.tutor_turns[]
  -> POST /users/student-learning (snapshot + exact checkpoint)
       -> Cloud Tasks finalize / 120 s watchdog
       -> Gemini learning trace -> users/{uid}.student.learning_memory
       -> Gemini class synthesis -> class_learning_summaries/{class_id}
  -> GET /users/student-learning?mission_id=… (exact resume)
```

### Pre-existing Or Third-party Code And Assets

Disclose on the form:

```txt
- Low Poly ClassRoom 3D model by Mumladze28 (Sketchfab), adapted at load time.
- Chibi avatar set generated for the author's earlier Unshatter project (base mesh, hair and cap licensing in apps/assets/3d/avatars/chibi-band/README.md).
- Grade 5 worksheets from K5 Learning (free printables) used as test material for mission generation.
- shadcn/ui components; the dashboard shell layout was adapted from the open-source shadcn-admin template.
- Everything else — game, tutor loop, API, orchestrator, memory model, dashboard — was written during the hackathon.
```

### Startup Prize Organization Name

```txt
N/A
```

### Startup Prize Corporate Email

```txt
N/A
```

### Which Google AI Models Did You Use?

```txt
Gemini 3.7 Flash
```

Production sets `GENAI_MODEL=gemini-3.7-flash` in `api/infra/cloud-run/production/cloudbuild.yaml`. Only add Gemma, Veo or Lyria if actually integrated.

```txt
Optional bonus models: None
```

### Optional Bonus Content Link

TODO: Add public blog/video link if created. The content must include:

```txt
I created this piece of content for the purpose of entering the All Things Agentic Hackathon.
```

### Optional Social Media Post

TODO: Add public social media post link if created.

Suggested post:

```txt
Building ClassGame for the #AllThingsAgenticHackathon: the optional homework that takes notes for the teacher. Emily, a Gemini tutor, turns today's lesson into a 3D review mission, asks students why they got things wrong, remembers how each one thinks across sessions, and hands the teacher the evidence — live. Google GenAI SDK + Cloud Run + Firestore + Cloud Tasks.
```

## Final Submission Checklist

- [ ] Joined the hackathon on Devpost.
- [ ] Requested Google Cloud credits.
- [x] Built the project during the submission period (first commit August 27, 2026).
- [x] Used Gemini 3.5 or newer (`gemini-3.7-flash`).
- [x] Used Google GenAI SDK.
- [x] Used Cloud Run, Firestore, Cloud Tasks and Cloud Storage.
- [ ] Selected **The Collaborative Partner** category.
- [x] Public code repository.
- [x] Reproducible setup and testing instructions in `apps/README.md`.
- [ ] Uploaded architecture diagram.
- [ ] Uploaded public YouTube/Vimeo video under 4 minutes.
- [ ] Video is in English or has English subtitles.
- [ ] Video shows Cloud Run / Google Cloud proof.
- [x] Hosted demo URL works.
- [ ] Any private repo is shared with `testing@devpost.com` and `cloudhackathons@google.com` (not needed if public).
- [ ] Pre-existing and third-party code and assets disclosed (text above).
- [ ] Repo, video and linked materials are not changed after the deadline until winners are announced.
