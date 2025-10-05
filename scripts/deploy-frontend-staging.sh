#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"

echo "[deploy] Starte Staging-Build für das Frontend …"
docker compose -f docker-compose-staging.yml up -d --build web_wineacadamy_staging
