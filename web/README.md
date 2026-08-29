# ClassGame Web

Mobile-first Next.js, React, TypeScript, Tailwind and Three.js frontend for **ClassGame** — the 3D classroom where **Mia**, the **Multimodal Intelligence Agent**, runs the review mission. See [`../README.md`](../README.md) for the product plan.

## Development

```bash
npm install          # also syncs the Draco decoder into public/vendor/draco
npm run dev
```

Open [http://localhost:3000/home](http://localhost:3000/home).

## Firebase

The app has a Firebase client foundation in `src/shared/firebase/client.ts`.

- Local config lives in `.env.local` and is ignored by git.
- Required deploy envs are listed in `.env.example`.
- Firestore project: `allthingsagentichackatho-ee359`.
- `/home` validates the teacher-issued six-digit `mission_code` before creating an anonymous Firebase session on a student-only Firebase app. After that it posts `mission_code` and `student_name` to `POST /users/student-session`.
- While the game tab is visible, it posts the current subject, stage, and status to `POST /users/student-presence` every 15 seconds. Presence failures never block gameplay.
- `/dashboard` and `/dashboard/classes` require Google sign-in. Teachers can manage classes, create and approve mission previews, inspect learning analytics, and see the 10 most recently active players. Dashboard data refreshes in the background every 8 seconds.
- Current lesson state still uses `localStorage`; Firestore now receives the student user record that the teacher dashboard lists.
- Returning students are matched by Firebase anonymous UID on the same browser/device. A teacher-issued `student_code` is the planned next step for cross-device identity.

## Uploadcare

The teacher mission builder supports optional file attachments.

- `NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY` is safe to expose and is required for direct browser uploads.
- The Uploadcare secret key must stay out of frontend code, screenshots and git. Move it to Secret Manager only when the API adds signed upload generation.
- Current MVP limit: 5 files, 20 MB each.

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Deploy To Google Cloud Run

The web app is deployed as a standalone Next.js container. Run these commands from the monorepo root, `apps/`, not from `apps/web/`.

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

gcloud artifacts repositories create classgame \
  --repository-format=docker \
  --location=us-east1 \
  --description="ClassGame containers"

set -a
source web/.env.local
set +a

gcloud builds submit \
  --config web/infra/cloud-run/production/cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY",_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",_NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID",_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",_NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID",_NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",_NEXT_PUBLIC_CLASSGAME_API_BASE_URL="${NEXT_PUBLIC_CLASSGAME_API_BASE_URL:-https://classgame-api-2057331207.us-east1.run.app}",_NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY="$NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY" \
  .
```

If the Artifact Registry repository already exists, skip the `create` command.

### GitHub deploy trigger

The production trigger watches only `web/**` in the monorepo:

- Trigger name: `classgame-web-main`
- Repository: `velrino/allthingsagentichackathon`
- Branch: `master`
- Build config: `web/infra/cloud-run/production/cloudbuild.yaml`

There is no test runner yet. The lesson reducer is pure and was exercised with a scripted walkthrough (sit → wrong → why → explain → feedback → decision → redirect → review → mission complete); wire that into a test runner before the API lands.

## Controls

| | Phone | Desktop |
|---|---|---|
| Walk | drag the lower part of the screen (floating joystick) | WASD, Shift to run |
| Look | swipe the room | drag |
| Go to the desk | tap the glowing ring | click it |
| Sit / stand | **Sit down** / **Stand up** buttons | same |

Stick directions are read against the camera as it was when you pressed, and the camera swings back behind the avatar while you walk — so holding a direction never spins you.

Dev-only: `__classgameDebug()` in the browser console returns `{ cameraYaw, avatarYaw, inputYaw, dragging, x, z }`.

## Current scope

- Route `/home`: the game.
- Route `/login`: Google sign-in for teachers.
- Route `/dashboard`: teacher overview with reusable analytics, Mia suggestions, student metrics, and live recent-player presence.
- Route `/dashboard/classes`: responsive class table, class creation/edit dialog, and mission builder dialog with optional Uploadcare files and an approve/publish flow.
- 3D classroom (GLB) laid out at load time: shell stretched 2×, furniture spread apart, whiteboard recoloured, colliders derived from the geometry.
- Third-person camera with orbit, wall pull-in and wall escape.
- Six chibi characters; the student picks one from the top bar, and the teacher Emily stays at the whiteboard.
- One desk. The whole Algebra Mission (Fractions → Simple equations → Two-step equations) happens seated there.
- Chalkboard lesson loop, Mia's notebook, feedback, decisions with a stated *why*.
- Student memory persisted in `localStorage` (`classgame.student.v1`), same shape as the planned Firestore document.

Everything Mia "decides" today comes from `src/modules/game/agent/mock-tutor.ts`. That file is the boundary the Go/Gemini 3.5+ API replaces.

## Structure

```txt
src/backend/api/                 API client, endpoints, request/response types
src/modules/dashboard/           teacher auth, dashboard, classes, analytics, dialogs
src/modules/game/
  agent/mock-tutor.ts          decisions, notes, "why" options — swap for the API
  avatars/                     presets, localStorage choice, GLB loader, rig animation
  components/
    game-canvas.tsx            Three.js loop: movement, collision, camera, avatars
    game-hud.tsx               mission chip, character menu, notebook button, Mia's line, CTA
    chalkboard.tsx             the lesson: question / why / explain / feedback / decision
    tutor-notebook.tsx         notes, adaptation state, decision log
    avatar-picker.tsx          character menu
    movement-pad.tsx           floating joystick (writes to a ref, never re-renders)
  content/algebra-mission.ts   demo mission: questions, traps, misconceptions, explanations
  controls/                    keyboard, orbit drag
  scene/
    classroom-layout.ts        mesh → islands → shell/props → stretched room + colliders
    create-classroom.ts        room, seat, Emily, lights, spawn
    camera-rig.ts              follow camera and seated shot
  state/
    session-reducer.ts         the lesson loop (pure)
    student-memory.ts          memory model + localStorage
    use-game-session.ts        React glue: hydration, thinking pause, directive ref
  student-session/             blocking anonymous auth, student modal, presence heartbeat
  types/                       shared types
  pages/game-page.tsx
src/shared/firebase/client.ts    Firebase app/auth/firestore client
```

## Assets

- `public/models/classroom/` — Low Poly ClassRoom (see credits).
- `public/assets/avatars/chibi-band/` — avatar GLB (Draco), portraits, manifest. Sources and build notes: `../assets/3d/avatars/chibi-band/`.
- `public/vendor/draco/` — decoder copied from the `three` package by `npm run sync:draco-decoder`.

## Next (see the plan)

- Load the mission by code from the API instead of `content/algebra-mission.ts`.
- Replace `mock-tutor.ts` calls with `POST /missions/{code}/students/{id}/turn` backed by Gemini 3.5+.
- Move `student-memory.ts` persistence from `localStorage` to Firestore (through the API).
- Aggregate real student attempts into the class notebook and make `/home` load the active mission by class code.
- Add signed Uploadcare uploads through the API before opening file uploads to broad public traffic.

## Credits

- **Low Poly ClassRoom** by **Mumladze28** — [Sketchfab](https://sketchfab.com/3d-models/low-poly-classroom-8b1bf103c90349d981c9c2ae1c0596e5), [ArtStation](https://www.artstation.com/artwork/N5dg5q).
- **Chibi band avatars** from the Unshatter project — licensing in `../assets/3d/avatars/chibi-band/README.md`.
