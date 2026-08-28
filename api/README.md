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
- `REDIS_CA_CERT_PEM` from existing Secret Manager secret `unshatter-api-redis-ca-cert-pem`.

The Firebase service-account JSON is local at:

```txt
/Users/velrino/Downloads/allthingsagentichackatho-ee359-firebase-adminsdk-fbsvc-654d46acf1.json
```

Create/update the Firebase secret after `gcloud auth login`:

```bash
gcloud secrets create allthingsagentichackathon-api-firebase-credentials-json \
  --replication-policy=automatic \
  --data-file=/Users/velrino/Downloads/allthingsagentichackatho-ee359-firebase-adminsdk-fbsvc-654d46acf1.json

# If the secret already exists:
gcloud secrets versions add allthingsagentichackathon-api-firebase-credentials-json \
  --data-file=/Users/velrino/Downloads/allthingsagentichackatho-ee359-firebase-adminsdk-fbsvc-654d46acf1.json
```
