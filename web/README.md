# ClassGame Web

Mobile-first Next.js, React, TypeScript, Tailwind and Three.js frontend for **ClassGame** — the 3D classroom where **Emily**, the AI tutor, runs the review mission. See [`../README.md`](../README.md) for the product plan.

## Development

```bash
npm install          # also syncs the Draco decoder into public/vendor/draco
npm run dev
```

Open [http://localhost:3000/home](http://localhost:3000/home).

## Firebase

The app has a Firebase client foundation in `src/modules/firebase/client.ts`.

- Local config lives in `.env.local` and is ignored by git.
- Required deploy envs are listed in `.env.example`.
- Firestore project: `allthingsagentichackatho-ee359`.
- Current game state still uses `localStorage`; Firestore will be wired when `/teach`, `/join`, mission codes and student IDs are added.

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Deploy To Google Cloud Run

The web app is deployed as a standalone Next.js container.

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

gcloud artifacts repositories create classgame \
  --repository-format=docker \
  --location=us-east1 \
  --description="ClassGame containers"

set -a
source .env.local
set +a

gcloud builds submit \
  --config infra/cloud-run/production/cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY",_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",_NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID",_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",_NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID",_NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID" \
  .
```

If the Artifact Registry repository already exists, skip the `create` command.

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

## Current scope (frontend-only, mocked agent)

- Route `/home`: the game.
- 3D classroom (GLB) laid out at load time: shell stretched 2×, furniture spread apart, whiteboard recoloured, colliders derived from the geometry.
- Third-person camera with orbit, wall pull-in and wall escape.
- Six chibi characters; the student picks one from the top bar, Emily teaches from the whiteboard.
- One desk. The whole Algebra Mission (Fractions → Simple equations → Two-step equations) happens seated there.
- Chalkboard lesson loop, Emily's notebook, feedback, decisions with a stated *why*.
- Student memory persisted in `localStorage` (`classgame.student.v1`), same shape as the planned Firestore document.

Everything Emily "decides" today comes from `src/modules/game/agent/mock-tutor.ts`. That file is the boundary the Go/Gemini 3.5+ API replaces.

## Structure

```txt
src/modules/game/
  agent/mock-tutor.ts          decisions, notes, "why" options — swap for the API
  avatars/                     presets, localStorage choice, GLB loader, rig animation
  components/
    game-canvas.tsx            Three.js loop: movement, collision, camera, avatars
    game-hud.tsx               mission chip, character menu, notebook button, Emily's line, CTA
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
  types/                       shared types
  pages/game-page.tsx
```

## Assets

- `public/models/classroom/` — Low Poly ClassRoom (see credits).
- `public/assets/avatars/chibi-band/` — avatar GLB (Draco), portraits, manifest. Sources and build notes: `../assets/3d/avatars/chibi-band/`.
- `public/vendor/draco/` — decoder copied from the `three` package by `npm run sync:draco-decoder`.

## Next (see the plan)

- Load the mission by code from the API instead of `content/algebra-mission.ts`.
- Replace `mock-tutor.ts` calls with `POST /missions/{code}/students/{id}/turn` backed by Gemini 3.5+.
- Move `student-memory.ts` persistence from `localStorage` to Firestore (through the API).
- Routes `/teach` (mission form), `/join` (code + character), `/teach/{code}` (class notebook).

## Credits

- **Low Poly ClassRoom** by **Mumladze28** — [Sketchfab](https://sketchfab.com/3d-models/low-poly-classroom-8b1bf103c90349d981c9c2ae1c0596e5), [ArtStation](https://www.artstation.com/artwork/N5dg5q).
- **Chibi band avatars** from the Unshatter project — licensing in `../assets/3d/avatars/chibi-band/README.md`.
