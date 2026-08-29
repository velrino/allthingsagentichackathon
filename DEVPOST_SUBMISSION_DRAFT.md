# Devpost Submission Draft

This file is a draft for the **All Things Agentic Hackathon** Devpost form.

Hackathon page: https://allthingsagentichackathon.devpost.com/

Category brief (The Collaborative Partner — in depth):

> Stateful, multi-turn dialogue with real-time context retrieval (RAG) and persistent memory, so your agent adapts and personalizes based on past interactions instead of starting over each time.

## Project Overview

### Project Name

ClassGame

### Elevator Pitch

The optional practice that takes notes for the teacher: a Gemini tutor turns today's lesson into a 3D review mission, asks students why they got things wrong, and hands the teacher a notebook of how the class thinks.

## Project Details

### About The Project

## Inspiration

Working alongside teachers, one thing keeps coming up: homework tells you *who* got it wrong, never *why*. A stack of wrong answers is not feedback — it's a pile of question marks the teacher has to guess through.

Meanwhile most educational apps treat learning as a fixed path: every student gets the same lesson, the same quiz, the same next step, and the app never talks back to the teacher.

**ClassGame** starts from the teacher's sentence — *"Today we did two-step equations, several slipped on fractions"* — and ends with the teacher reading what an AI tutor wrote down about each student's reasoning. In between, a student plays a ten-minute 3D review on their phone with a tutor who leads, asks, notes and adapts.

## What It Does

**For the teacher**: create a class, then describe what the class covered and what you noticed, with optional worksheets or photos. Emily, the Gemini-powered tutor, turns that into a **mission**: questions whose wrong options are traps for named misconceptions, stages, what to watch for, and suggestions for the next lesson. You review the preview, adjust the prompt and process again — every revision is kept on the same mission with its history, and the version students are playing stays live while you edit the next one — pick who it is for (the whole class or selected students), and **assign** it. Students get a six-character **mission code**.

**For the student**: enter the mission code and your name, pick a character, walk to your desk in a low-poly classroom and sit down. Emily runs the lesson on the chalkboard:

- She picks every question and every next step.
- When you're wrong she doesn't reveal the answer. She asks *why you picked it*, with reasons written in your voice.
- Your reason becomes a note in her notebook — *"Adds numerators and denominators straight across"*.
- She explains in short steps, or draws it, depending on what has worked for you.
- You rate each explanation: helpful, confusing, too easy, too hard. You can also strike a note: *"That's not how I think."*
- She adapts and says why: switches to drawings, changes difficulty, or — when a fraction slip shows up inside an equation — reopens fractions for a quick review and brings you back to the exact equation that stopped you.
- Close the tab and come back: *"Welcome back — last time you were on Fractions."*

**For the teacher, during and after**: one page per class. Who has not started, who is at the desk with Emily right now, who is in a review, who finished — live from the game. Then the patterns Emily noticed across the class, who shows each one, and her suggestions for tomorrow: what to reteach, what to do with everyone, how to stretch the students who are ahead. One button turns those notes into the prompt for tomorrow's mission.

## How It Maps To The Collaborative Partner

Two people collaborate with Emily: the teacher who plans, and the student who plays. The teacher loop is live end to end; the student loop runs on a deterministic tutor today, behind the exact contract the Gemini tutor turn will use.

| Brief | Teacher ↔ Emily (live) | Student ↔ Emily (next) |
|---|---|---|
| **Stateful, multi-turn dialogue** | Prompt → preview → revise → approve, all on one mission document with a numbered revision history and a published snapshot that stays live while the next draft is edited. | One Gemini turn per answer, "why" and feedback tap, carrying the student's memory document. |
| **Real-time context retrieval** | Teacher attachments (PDF, images, text) are fetched and passed to Gemini as inline content at generation time, together with class, grade and learning goal. | Before each turn: the student's notes and preferences, the mission content, and class-level patterns, read from Firestore. |
| **Persistent memory** | Classes, missions, revisions, published snapshots, students and live presence in Firestore. | Per-student thinking summary, notebook notes with evidence and counts, feedback counts — the `teacher_classes/{class_id}/students/{student_id}` model already exists in the API. Today the student's memory lives in the browser (`localStorage`) as a mirror of that document. |
| **Adapts from past interactions** | The class notebook pre-writes the next mission prompt from the patterns Emily observed, so tomorrow's mission starts from today's evidence. | Explanation style, difficulty and redirects change from earlier feedback and repeated slips; every decision states its reason. |

## How We Built It

One repository, two Cloud Run services, one database.

- **Frontend**: Next.js, React, TypeScript, Tailwind, Three.js. The classroom is a single merged GLB that we split into connected islands at load time to stretch the room, spread the desks and recolour the whiteboard; furniture colliders are derived from the same pass. Third-person camera with wall handling, a floating joystick, six chibi characters (Emily is the teacher).
- **Lesson UI**: a chalkboard, inspired by the classroom minigames in *Bully: Scholarship Edition* — without the timer. Multiple choice for fractions; "pick the next move" for equations, so every wrong move has a name.
- **Agent**: Go with the Google GenAI SDK calling Gemini with **structured output**. The orchestrator turns the teacher's request and any readable attachments into a mission blueprint — preview questions with misconception traps, stages, suggestions, positive and improvement signals — and falls back to a deterministic local blueprint if GenAI is unavailable, so the teacher never gets a dead end. The in-game tutor is deterministic today behind the JSON contract planned for Gemini tutor turns.
- **Memory and state**: Firestore for everything durable — teacher profiles, classes, missions with revision history and published snapshots, a `mission_codes` index for student entry, student users, and live game presence (a heartbeat every 15 seconds; the dashboard derives online state server-side). Attachments are uploaded through Uploadcare as temporary files and, after approval, copied by **Cloud Tasks** into **Cloud Storage** under the class, mission and published revision. Redis handles health/cache.

Runtime flow:

```txt
Teacher dashboard (Next.js on Cloud Run)
  -> POST /teacher-classes                                  Firestore teacher_classes/{class_id}
  -> POST /teacher-classes/{class_id}/missions/preview      Uploadcare temp files
       -> orchestrator -> Google GenAI SDK -> Gemini structured output
       -> Firestore teacher_classes/{class_id}/missions/{mission_id}  (new draft revision)
  -> POST /teacher-classes/{class_id}/missions/{mission_id}/approve
       -> published snapshot + mission_codes/{mission_code}
       -> Cloud Tasks -> copy attachments into Cloud Storage

Student game (Three.js, Next.js on Cloud Run)
  -> POST /users/student-session/validate   mission code check before sign-in
  -> POST /users/student-session            anonymous Firebase Auth -> users/{uid}
  -> POST /users/student-presence           every 15 s while playing
  -> answer / why / feedback -> deterministic tutor today
  -> next: POST .../missions/{mission_id}/students/{student_id}/turn
       -> Gemini decides: note, explanation style, next action + why
       -> Firestore student memory

Teacher again
  -> GET /dashboard/overview?class_id=...   class, active mission, students, live presence
  -> next: aggregated notebook from real student notes
```

## What Makes It Agentic

Emily is not a chatbot in a game. She:

- Chooses the next question and the next step; the student never picks "what to study".
- Asks a clarifying question before explaining anything.
- Writes down how each student reasons and where they stopped, and picks up from there on the next visit.
- Changes explanation style and difficulty from explicit feedback.
- Re-routes the lesson autonomously when a slip points to an earlier gap, and states the reason for every decision.
- Turns her notes into something the teacher can act on — including the first draft of tomorrow's mission.

This fits **The Collaborative Partner** twice: she leads and takes notes for the student, and those notes are what the teacher gets back and builds on.

## Challenges We Faced

Keeping the product to one loop. Every extra room, subject or chart we sketched pulled time away from the thing judges actually evaluate: does the agent visibly lead, ask, note, capture feedback and adapt? We cut five rooms to one desk and a job queue to a single call with a "thinking" pulse. On the teacher side we kept only what closes the loop: create a class, assign a mission, read the notebook, build the next one from it.

Making misconceptions *nameable*. The notebook is only useful if a wrong answer maps to a specific way of thinking. That drove the content design: every wrong option is a deliberate trap tied to a named misconception, and equations are solved move by move so the wrong *move* has a name too.

Being honest about memory. It is easy to draw charts that *look* like an agent remembering. We labelled every dashboard block by its source — live class data, based on class signals, or example — so a teacher (or a judge) always knows what is real.

## What We Learned

The strongest tutoring agent is not the one that generates the most content; it's the one that turns small signals — a chosen reason, a "confusing" tap, a repeated slip — into a decision it can explain. And the explanation matters as much as the decision: a stated *why* is what makes students trust the redirect and teachers trust the notebook.

## What's Next

- Gemini tutor turns with per-student Firestore memory, replacing the deterministic tutor one function at a time.
- Load the teacher's generated mission into the chalkboard (the game plays the built-in Algebra Mission today).
- Aggregate the class notebook from real student answers instead of mission-level signals.
- Signed uploads through the API so broad production traffic cannot abuse the public Uploadcare key.
- Multi-week memory per student across missions; more than three stages per mission.
- Voice for Emily.

## Built With

Suggested Devpost tags:

- Gemini
- Gemini 3.7 Flash
- Google GenAI SDK
- Google Cloud
- Cloud Run
- Firestore
- Cloud Tasks
- Cloud Storage
- Firebase Auth
- Go
- Next.js
- React
- TypeScript
- Three.js
- Node.js
- Education
- AI Agents
- Generative AI
- Game-Based Learning
- Adaptive Learning
- Personalized Learning
- WebGL
- JavaScript
- Serverless

## Try It Out Links

### Hosted Project URL

```txt
https://classgame-web-mzkj6f7g3a-ue.a.run.app/home
```

### Code Repository

```txt
https://github.com/velrino/allthingsagentichackathon
```

### Demo Video Link

TODO: Add public YouTube or Vimeo demo video URL.

Example format:

```txt
https://www.youtube.com/watch?v=<video-id>
```

## Additional Info For Judges

### Sponsor / Special Prizes

Do not select **Startup Excellence** unless submitting through an incorporated organization with a corporate email address.

Recommended:

```txt
No Startup Excellence opt-in.
```

### Submitter Type

Recommended:

```txt
Individual/Hobbyist
```

Use team only if all teammates are added to Devpost and accept the invite before the deadline.

### Submitter Country Of Residence

TODO: Confirm before submission.

Suggested if submitting personally from Brazil:

```txt
Brazil
```

### Category

```txt
The Collaborative Partner
```

### Organization Name

If submitting as an individual:

```txt
N/A
```

### Project Start Date

If this project starts from this planning session:

```txt
08-27-26
```

Confirm this date before submitting. The project must be newly created during the hackathon submission period.

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

Target answer:

```txt
Yes
```

Add setup instructions to the main `README.md` before final submission.

### Hosted Project URL If Available

```txt
https://classgame-web-mzkj6f7g3a-ue.a.run.app/home
```

### Testing Instructions

Current deployed smoke tests:

```bash
curl -I https://classgame-web-mzkj6f7g3a-ue.a.run.app/home
curl https://classgame-api-2057331207.us-east1.run.app/
```

Local web/API smoke test:

```bash
cd apps/api
go run ./cmd/api

cd ../web
npm run dev
```

Open `http://localhost:3000/dashboard` for the teacher side (Google sign-in) or `http://localhost:3000/home` for the student side (mission code + name; the app validates the code, signs in anonymously with Firebase Auth and calls `POST /users/student-session`).

Draft:

```txt
Open the hosted ClassGame URL.

Teacher side:
1. Open `/dashboard`, sign in with Google and create a class (name, subject, grade).
2. Click "New mission" and enter: "Today: solving two-step equations. Several students slipped on fractions." Optionally attach a worksheet. Click "Process with Emily".
3. Review the preview: Gemini generates questions with misconception traps, stages, suggestions and signals. Edit the prompt and process again if you like — each revision is kept on the same mission.
4. Choose the audience (whole class or selected students) and click "Approve and assign to class". Note the six-character mission code.

Student side (a phone works best):
5. Open `/home`, enter the mission code and a name, tap "Start mission", pick a character, walk to the glowing desk and sit down. (The chalkboard plays the built-in Algebra Mission today; loading the generated mission into the game is the next milestone.)
6. On "2x/3 = 4", pick "÷ 3 on both sides" on purpose. Emily asks why; pick "To get rid of the /3 I divided by 3".
7. A note appears pinned under the board. Tap "Confusing" after the explanation: Emily switches to drawings and says why.
8. Emily reopens Fractions for two questions, then returns to the same equation. Answer cleanly to finish the stage.
9. Open Emily's notebook (top right) to see notes, adaptation state and the decision log. Try "That's not how I think" on a note.
10. Close the tab and reopen it: Emily remembers where you were.

Teacher side again:
11. Open the class in `/dashboard`: the student appears with live presence (at the desk, in a review, completed), the class patterns and Emily's suggestions for tomorrow. Click "Build tomorrow's mission" to see the next prompt pre-written from those notes. Aggregating the notebook from real student answers is the next backend milestone.

No paid account is required. Teacher sign-in uses any Google account; students sign in anonymously.
```

### Which Google SDK Did You Use?

Target selection:

```txt
Google GenAI SDK (google-genai)
```

Alternative if the final Go implementation adds ADK later:

```txt
Agent Development Kit (ADK)
```

### Which Google Cloud Services Did You Use?

Target selection:

```txt
Cloud Run
Firestore
Cloud Tasks
Cloud Storage
```

Firebase Auth is used for teacher (Google) and student (anonymous) sign-in. Do not select Pub/Sub, Cloud SQL, GKE, Cloud Scheduler or Memorystore unless actually implemented.

### Architecture Diagram

TODO: Upload `architecture-diagram.png` or `architecture-diagram.pdf`.

Suggested diagram contents:

```txt
Teacher dashboard (Next.js on Cloud Run) — /dashboard, /dashboard/class/{classId}
  -> Firebase Auth (Google)
  -> Uploadcare temporary upload for optional files
  -> Go API on Cloud Run
       POST /teacher-classes
       POST /teacher-classes/{class_id}/missions/preview
         -> orchestrator -> Google GenAI SDK -> Gemini 3.7 Flash structured output
         -> Firestore teacher_classes/{class_id}/missions/{mission_id} (draft revisions)
       POST /teacher-classes/{class_id}/missions/{mission_id}/approve
         -> Firestore published snapshot + mission_codes/{mission_code}
         -> Cloud Tasks -> Cloud Storage (attachments per class / mission / revision)
       GET  /dashboard/overview?class_id=...

Student game (Three.js, Next.js on Cloud Run) — /home
  -> POST /users/student-session/validate (mission code)
  -> Firebase Auth (anonymous) -> POST /users/student-session -> Firestore users/{uid}
  -> POST /users/student-presence every 15 s -> users/{uid}.activity.current_game
  -> deterministic tutor today; next: Gemini tutor turn + Firestore student memory
     (teacher_classes/{class_id}/students/{student_id})
```

### Pre-existing Or Third-party Code And Assets

Disclose on the form:

```txt
- Low Poly ClassRoom 3D model by Mumladze28 (Sketchfab), adapted at load time.
- Chibi avatar set generated for the author's earlier Unshatter project (base mesh, hair and cap licensing in apps/assets/3d/avatars/chibi-band/README.md).
- shadcn/ui components; the dashboard shell layout was adapted from the open-source shadcn-admin template.
- Everything else — game, tutor loop, API, orchestrator, dashboard — was written during the hackathon.
```

### Startup Prize Organization Name

If not applying:

```txt
N/A
```

### Startup Prize Corporate Email

If not applying:

```txt
N/A
```

### Which Google AI Models Did You Use?

Minimum required answer:

```txt
Gemini 3.7 Flash
```

`GENAI_MODEL` defaults to `gemini-3.7-flash` in the API config. If the final deployment uses a different Gemini 3.5+ model, update this field before submission.

Optional bonus models:

```txt
None for MVP
```

Only add Gemma, Veo, or Lyria if actually integrated.

### Optional Bonus Content Link

TODO: Add public blog/video link if created.

The content must include language such as:

```txt
I created this piece of content for the purpose of entering the All Things Agentic Hackathon.
```

### Optional Social Media Post

TODO: Add public social media post link if created.

Suggested post:

```txt
I am building ClassGame for the #AllThingsAgenticHackathon: the optional practice that takes notes for the teacher. A Gemini tutor turns today's lesson into a 3D review mission, asks students why they got things wrong, and hands the teacher a notebook of how the class thinks.
```

## Final Submission Checklist

- [ ] Joined the hackathon on Devpost.
- [ ] Requested Google Cloud credits.
- [ ] Built the project during the submission period.
- [ ] Used Gemini 3.5 or newer.
- [ ] Used Google GenAI SDK or another accepted Google agent framework.
- [ ] Used Cloud Run, Firestore, Cloud Tasks and Cloud Storage.
- [ ] Selected **The Collaborative Partner** category.
- [ ] Added public or judge-accessible code repository.
- [ ] Added reproducible setup instructions to `README.md`.
- [ ] Uploaded architecture diagram.
- [ ] Uploaded public YouTube/Vimeo video under 4 minutes.
- [ ] Video is in English or has English subtitles.
- [ ] Video shows Cloud Run / Google Cloud proof.
- [ ] Hosted demo URL works.
- [ ] Any private repo is shared with `testing@devpost.com` and `cloudhackathons@google.com`.
- [ ] Any teammates accepted their Devpost invites.
- [ ] Pre-existing and third-party code and assets are disclosed (see above).
- [ ] Repo, video, and linked materials are not changed after the deadline until winners are announced.
