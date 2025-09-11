# Reset and Fill DB – sicher, ohne Secrets im Repo

Ziel: Datenbank gezielt zurücksetzen und deterministisch befüllen, ohne Passwörter/Secrets in Dateien zu hinterlegen. Alle Zugangsdaten werden aus Umgebungsvariablen geladen (z. B. aus `.env.staging` / `.env`).

Wichtig:
- Keine echten Passwörter in Git-Dateien eintragen. Die folgenden Schritte lesen sie zur Laufzeit aus ENV.
- Admin-Requests erfolgen über die Strapi Admin-API (`/admin` bzw. Content‑Manager‑API), nicht die Public‑API.

## 0) Modus wählen und ENV laden

```bash
# dev oder staging setzen
export MODE=staging   # oder: dev

# ENV-Datei laden (shell-kompatible .env-Datei vorausgesetzt)
load_env_file() { [ -f "$1" ] && set -a && . "$1" && set +a; }

if [ "$MODE" = "staging" ]; then
  load_env_file ./.env.staging
  export COMPOSE_FILE=docker-compose-staging.yml
  export API_BASE_EXT="https://wineacademy.plan-p.de"
  export API_BASE_INT="http://wineacademy_backend_staging:1337"
  export DOCKER_NET=proxy
  export DB_CONTAINER=wineacademy_db_staging
else
  load_env_file ./.env
  export COMPOSE_FILE=docker-compose-dev.yml
  export API_BASE_EXT="http://localhost:1337"
  export API_BASE_INT="http://localhost:1337"
  export DOCKER_NET=bridge
  export DB_CONTAINER=wineacademy_db_dev
fi

# Admin-Zugangsdaten aus ENV oder interaktiv abfragen (werden nicht geloggt)
: "${STRAPI_ADMIN_EMAIL:?STRAPI_ADMIN_EMAIL muss gesetzt sein (z. B. per .env.*)}"
if [ -z "$STRAPI_ADMIN_PASSWORD" ]; then
  read -r -s -p "Admin-Passwort eingeben: " STRAPI_ADMIN_PASSWORD; echo
fi

# Services starten
docker compose -f "$COMPOSE_FILE" up -d --build

# Helfer: curl im passenden Netzwerk ausführen
ccurl() {
  if [ "$MODE" = "staging" ]; then
    docker run --rm --network "$DOCKER_NET" curlimages/curl:8.10.1 "$@"
  else
    curl "$@"
  fi
}

with_backoff() {
  local method="$1" url="$2" data="$3" token="$4"; shift 4 || true
  local tries=0 max=8 out code body
  while :; do
    if [ -n "$data" ]; then
      out=$(ccurl -s -w "\n%{http_code}" -X "$method" "$url" \
        -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d "$data")
    else
      out=$(ccurl -s -w "\n%{http_code}" -X "$method" "$url" \
        -H 'Content-Type: application/json' -H "Authorization: Bearer $token")
    fi
    code=$(echo "$out" | tail -n1); body=$(echo "$out" | sed '$d')
    if [ "$code" = 200 ] || [ "$code" = 201 ]; then echo "$body"; return 0; fi
    tries=$((tries+1)); [ $tries -ge $max ] && { echo "$body"; return 1; }
    case "$code" in 429|401) sleep $((tries*2));; *) echo "$body"; return 1;; esac
  done
}

cm_post() { with_backoff POST "$1" "$2" "$3"; }   # url data token
cm_put()  { with_backoff PUT  "$1" "$2" "$3"; }
cm_get()  { with_backoff GET  "$1" ""   "$2"; }

# Admin-Login → Admin-JWT (aus ENV geladene Credentials)
ADMIN_JWT=$(ccurl -sSf -X POST "$API_BASE_INT/admin/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"'"$STRAPI_ADMIN_EMAIL"'","password":"'"$STRAPI_ADMIN_PASSWORD"'"}' | jq -r '.data.token')
test -n "$ADMIN_JWT" && echo "[ok] Admin-Login erfolgreich"
```

## 1) Harte DB-Zurücksetzung (optional)

Nur wenn eine komplett leere DB gewünscht ist. Credentials werden aus ENV genommen (`POSTGRES_*`).

```bash
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$DB_CONTAINER" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
SQL

# Backend neu starten
docker compose -f "$COMPOSE_FILE" up -d backend-staging 2>/dev/null || \
docker compose -f "$COMPOSE_FILE" up -d backend
```

## 2) Inhalte befüllen (Beispiel)

Nachfolgend nur ein Muster. Befüllungen erfolgen über die Content‑Manager‑API. Dabei werden keine Secrets im Skript benötigt.

```bash
# Beispiel: Kategorie anlegen (falls nicht vorhanden)
LIST_URL="$API_BASE_INT/content-manager/collection-types/api::kategorie.kategorie?page=1&pageSize=100"
CREATE_URL="$API_BASE_INT/content-manager/collection-types/api::kategorie.kategorie"

EXISTING=$(cm_get "$LIST_URL" "$ADMIN_JWT")
payload=$(jq -n --arg t "WSET" --arg p "$(date -u +%FT%TZ)" '{titel:$t, publishedAt:$p}')

if [ "$(echo "$EXISTING" | jq -r '.results | map(select(.titel=="WSET")) | length')" = 0 ]; then
  cm_post "$CREATE_URL" "$payload" "$ADMIN_JWT" >/dev/null && echo "[ok] Kategorie WSET"
else
  echo "[skip] Kategorie existiert"
fi
```

Weitere Schritte (Orte, Seminare, Termine) können analog erfolgen. Halte Payloads minimal und veröffentliche via `publishedAt` oder über die Publish‑Action im Admin.

## Hinweise
- Secrets kommen ausschließlich aus ENV (`.env`, `.env.staging`, CI/CD‑Secrets). Diese Datei enthält keine sensiblen Werte.
- Für Staging werden interne Routen genutzt (`API_BASE_INT`), um Rate‑Limits zu vermeiden.
- Prüfe nach dem Befüllen die Public‑Endpoints, z. B.: `curl -s "$API_BASE_EXT/api/public/seminare" | jq '.[0]'`.

