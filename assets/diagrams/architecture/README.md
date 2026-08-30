# ClassGame architecture diagram

This directory contains the slide-ready production architecture diagram for
ClassGame.

## Files

- `architecture.py` — self-contained Pillow renderer with inline `uv`
  dependencies.
- `architecture.png` — generated 1920×1080 image.

## Regenerate

From this directory:

```bash
uv run architecture.py
```

The renderer uses a fixed manual layout so the labels and cross-layer flows
remain readable on a 16:9 presentation slide.

## What the diagram represents

- `classgame-web`: the student Three.js game and teacher dashboard, both served
  by Next.js on Cloud Run.
- `classgame-api`: the Go/Echo API, custom mission/tutor/learning orchestration,
  safety controls, repositories, and OIDC task handlers on Cloud Run.
- Vertex AI through `google.golang.org/genai`, using Gemini structured outputs.
- Cloud Tasks for learning finalization, paused-attempt watchdogs, and canonical
  attachment copies.
- Redis for distributed generation quotas and service health.
- Firebase Authentication, Firestore, and Cloud Storage for identity, durable
  state, realtime projections, and immutable published attachments.
- Uploadcare for temporary direct browser uploads and PostHog for product
  analytics and exception events.

Arrow colors distinguish synchronous API/data traffic, Gemini reasoning,
background tasks, and realtime/telemetry flows.
