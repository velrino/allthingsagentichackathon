#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REPO_OWNER="${REPO_OWNER:-velrino}"
REPO_NAME="${REPO_NAME:-allthingsagentichackathon}"
BRANCH_PATTERN="${BRANCH_PATTERN:-^master$}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Missing PROJECT_ID and no active gcloud project is configured." >&2
  exit 1
fi

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")"
SERVICE_ACCOUNT="projects/${PROJECT_ID}/serviceAccounts/${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for file in web/infra/cloud-run/production/cloudbuild.yaml api/infra/cloud-run/production/cloudbuild.yaml; do
  if [[ ! -f "${file}" ]]; then
    echo "Run this script from the monorepo root: apps/" >&2
    exit 1
  fi
done

required_web_env=(
  NEXT_PUBLIC_FIREBASE_API_KEY
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  NEXT_PUBLIC_FIREBASE_PROJECT_ID
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  NEXT_PUBLIC_FIREBASE_APP_ID
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
)

if [[ ! -f web/.env.local ]]; then
  echo "Missing web/.env.local. Copy web/.env.example first and fill Firebase values." >&2
  exit 1
fi

set -a
source web/.env.local
set +a

for key in "${required_web_env[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing ${key} in web/.env.local" >&2
    exit 1
  fi
done

if gcloud builds triggers describe classgame-api-main --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "classgame-api-main already exists; skipping."
else
  gcloud builds triggers create github \
    --project="${PROJECT_ID}" \
    --name=classgame-api-main \
    --service-account="${SERVICE_ACCOUNT}" \
    --repo-owner="${REPO_OWNER}" \
    --repo-name="${REPO_NAME}" \
    --branch-pattern="${BRANCH_PATTERN}" \
    --build-config=api/infra/cloud-run/production/cloudbuild.yaml \
    --included-files="api/**" \
    --include-logs-with-status \
    --format="value(name,id)"
fi

if gcloud builds triggers describe classgame-web-main --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "classgame-web-main already exists; skipping."
else
  gcloud builds triggers create github \
    --project="${PROJECT_ID}" \
    --name=classgame-web-main \
    --service-account="${SERVICE_ACCOUNT}" \
    --repo-owner="${REPO_OWNER}" \
    --repo-name="${REPO_NAME}" \
    --branch-pattern="${BRANCH_PATTERN}" \
    --build-config=web/infra/cloud-run/production/cloudbuild.yaml \
    --included-files="web/**" \
    --include-logs-with-status \
    --substitutions="_NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY},_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN},_NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID},_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET},_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID},_NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID},_NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}" \
    --format="value(name,id)"
fi
