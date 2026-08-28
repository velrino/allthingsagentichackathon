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

## What exists today (frontend, mocked agent)

Everything below runs in `apps/web` with no backend. The agent is a deterministic mock behind the exact interface the real one will implement.

- **3D classroom** (Three.js, low-poly GLB). The merged mesh is split into connected islands at load time, the room shell is stretched 2× and the furniture spread apart so it's walkable; the whiteboard is recoloured to match the lesson board (`scene/classroom-layout.ts`).
- **Third-person camera**: drag to orbit, returns behind the avatar while walking, slides along walls instead of clipping.
- **Collision** with walls and furniture; joystick on phones, WASD + mouse on desktop; tap the glowing desk to walk to it.
- **Characters**: six chibi avatars (from Unshatter's chibi-band set). The student picks one from the top bar; **Emily** is the teacher, standing at the whiteboard.
- **One desk**: the student sits at the desk in front of the teacher's; the whole mission happens there.
- **Chalkboard lesson UI** (Bully: Scholarship Edition style, no timer): multiple choice for fractions, "pick the next move" for equations, the *why* card, step/visual explanations (fraction bars, equation chains), feedback pills, decision card with its *why*.
- **Emily's notebook**: notes (type, skill, evidence, count) with "That's not how I think", adaptation state, decision log, reset.
- **Persistent memory** in `localStorage` (mirrors the Firestore document): close the tab, come back, *"Welcome back — last time you were on Fractions."*
- **Demo content**: the Algebra Mission — Fractions → Simple equations → Two-step equations, 12 questions whose wrong options are tagged with named misconceptions (`content/algebra-mission.ts`). This becomes the few-shot example for generated missions.

Also started: `apps/api`, a Go API skeleton in the same style as Unshatter, with Echo, config validation, Firebase Admin/Firestore connection, shared Redis connection and `GET /` health checks.

Not built yet: teacher form, mission generation, Gemini 3.5+ tutor turns, class notebook, dashboard login, deploy.

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
  api/   Go — mission generation and the tutor agent (Gemini 3.5+ via Genkit Go), Firestore
```

- **Gemini 3.5 or newer** does two jobs, both with **structured output** (JSON schemas already defined by the frontend types):
  1. `generateMission(teacherInput) → Mission` — stages, questions, wrong options tagged with misconceptions, "why" reasons, explanations (steps + visual).
  2. `tutorTurn(memory, lesson, event) → { note, explanationStyle, decision, why }` — replaces `agent/mock-tutor.ts` one function at a time.
- **Firestore** is the only database. Student memory, missions, notes and decisions live there. Firebase project: `allthingsagentichackatho-ee359`.
- **Cloud Run** hosts `classgame-web` and `classgame-api`.
- **Cut from the MVP** (on purpose): Redis / job queue / orchestrator, multiple rooms, login, grades, deadlines, a teacher dashboard beyond one page. A Gemini 3.5+ call with a 1–3 s "Emily is thinking…" pulse is enough; the queue added risk and nothing a judge can see.

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
```

The class notebook is a read over `missions/{code}/students/*`: notes grouped by misconception, counts, who needed a review, what Emily changed.

### API

```txt
GET  /healthz
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

**Day 2 — make Emily real**
- `apps/api` skeleton (Go, Cloud Run Dockerfile, `/healthz`).
- `POST /missions`: Gemini 3.5+ structured output from teacher text; the Algebra Mission as few-shot; Firestore write.
- `POST …/turn`: replace `decideAfterFeedback`, `noteFromReasoning`, `buildWhyOptions` with Gemini 3.5+; keep the reducer.
- Frontend: fetch mission by code; student memory to Firestore instead of `localStorage`.

**Day 3 — close the loop with the teacher**
- Teacher page `/teach`: one form (topic, what you noticed) → mission code.
- Student entry `/join`: code + character.
- Teacher page `/teach/{code}`: the class notebook.
- Deploy both services to Cloud Run; verify Firestore in the console.

**Day 4 — submission**
- Demo video (< 4 min), architecture diagram, Devpost text, README testing instructions.
- Polish only if the video is already recordable: completion celebration, sounds, Emily gestures.

## Demo script

1. **Teacher** opens `/teach`, types: *"Today: solving two-step equations. Several students slipped on fractions."* → Emily generates the mission, shows the code `K7PQ`.
2. **Student** opens the game on a phone, enters `K7PQ`, picks a character, walks to the desk, sits.
3. Gets `2x/3 = 4` wrong by dividing by 3. Emily asks why; the student picks *"To get rid of the /3 I divided by 3."*
4. A note appears pinned under the board. Emily explains; the student taps **confusing** → Emily switches to drawing.
5. Emily: *"That slip wasn't algebra — it was fractions."* Two fraction questions, then back to the same equation. Solved.
6. **Teacher** opens `/teach/K7PQ`: the class notebook — *"3 students divide instead of multiply to clear a denominator"*, who got a review, what Emily changed and why.
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
  api/                      Go API skeleton with Firebase, Redis and GET / health check
```

## Credits

- **Low Poly ClassRoom** by **Mumladze28** — [Sketchfab](https://sketchfab.com/3d-models/low-poly-classroom-8b1bf103c90349d981c9c2ae1c0596e5), [ArtStation](https://www.artstation.com/artwork/N5dg5q).
- **Chibi band avatars** — generated set from the Unshatter project; base mesh, hair and cap licensing in `apps/assets/3d/avatars/chibi-band/README.md`.
- Board interaction inspired by the classroom minigames in *Bully: Scholarship Edition* (minus the timer).

## Short pitch

**ClassGame turns tonight's review into a game the teacher can read tomorrow. Emily, a Gemini 3.5+ tutor, builds the mission from what the teacher taught, leads each student through it, asks why they got things wrong, writes down how they think, and adapts — then hands the teacher the notebook.**
