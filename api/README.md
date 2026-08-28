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
- Firebase Admin connects to project `allthingsagentichackatho-ee359`.
- Firestore is the durable database.
- Redis uses the same Secret Manager value as Unshatter for now.

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
