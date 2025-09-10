### Init‑Prompt (zum Kopieren)

> Du arbeitest NUR am Backend in `backend/`. Lies und befolge zuerst `backend/README.md` (Datenmodell, Public‑APIs, Seeds, Lifecycles, Admin‑Hinweise) und die Root‑`README.md` (Docker Desktop, Compose, Ports/Routing). Starte/prüfe: `docker compose -f ../docker-compose-dev.yml up -d backend`. Nutze die Public‑Endpoints, keine direkten internen Services für das Frontend. Mache einen kurzen Plan (2–5 Schritte) und liste die Befehle/curl‑Tests, die du ausführst, bevor du Änderungen machst. Wenn das Backend aktuell nicht über Docker läuft, starte das Backend. Wenn du eine Änderung am backend vorgenommen hast öffne die seite bei mir im browser. Antworte immer in deutsch.

Ziel:

# Backend (Strapi 5) – Wine Academy

Zweck: Headless‑CMS und API für Seminare, Termine, Buchungen, Orte, Kunden, Gutscheine. Stellt schlanke Public‑Endpoints für das Frontend bereit und verwaltet Admin‑Workflows.

## Stack & Ports
- Strapi 5.23 (Node 20)
- PostgreSQL 15
- Dev‑Port: 1337 (`http://localhost:1337`, Admin: `/admin`)

## Start (Dev)
- Empfohlen über Root‑Compose: `docker compose -f ../docker-compose-dev.yml up -d backend`
- Logs: `docker compose -f ../docker-compose-dev.yml logs -f backend`

## Datenmodell (Kurzüberblick)
- Content‑Types: 
  - Seminar (Name, Slug, Beschreibungen, Bild, Standardpreis, aktiv)
  - Termin (titel, planungsstatus: geplant/ausgebucht/abgesagt, preis, kapazitaet, tage[], seminar, ort)
  - Ort (Standort/Adresse/Typ)
  - Buchung (Kundendaten, anzahl, preise, status)
  - Kunde, Gutschein
- Komponente: `termin.seminartag` (datum, startzeit, endzeit) – Defaultzeiten: 10:00–17:00
- Relationen: Seminar ↔ Termine (1:n), Termin → Ort (n:1), Buchung → Termin/Kunde (n:1)

## Lifecycles
- Termin: afterCreate/afterUpdate → wenn `titel` leer ist, wird er aus „YYYY‑DD‑MM – Seminar – Ort“ gesetzt (Datum aus erstem Seminartag).

## Public API (für das Frontend)
- GET `/api/public/seminare` → aktive, veröffentlichte Seminare mit geplanten Terminen (Tage, Ort, Preise – nur benötigte Felder)
- GET `/api/public/seminare/:slug` → Detail eines Seminars
  - Routen/Controller: `src/api/seminar/routes/public.ts`, `src/api/seminar/controllers/seminar.ts`

Ergänzende Public‑Endpoints (Checkout/Test):
- POST `/api/public/buchungen` → Buchung anlegen (optional mit `paypalCaptureId`)
- POST `/api/public/gutscheine/validate` → Gutschein prüfen und Totale (brutto) berechnen
- GET  `/api/public/buchungen/:id` → Buchung minimal lesen (Status/Summen)

Beispieltests:
```
curl -s http://localhost:1337/api/public/seminare | jq '.[0]'
curl -s http://localhost:1337/api/public/seminare/einfuhrung-in-die-weinwelt | jq
```

## Seeds
- Einmalig befüllen: in Root‑`.env` `SEED=true` (optional `SEED_RESET=true`) setzen und Stack starten.
- Danach wieder auf `false`/entfernen, damit Seeds nicht erneut laufen.

## Umgebungsvariablen (Auszug)
- DB: `DATABASE_*` (Host über Compose gesetzt)
- Admin/Keys: `APP_KEYS`, `JWT_SECRET`, … (in Dev vom `backend/.env` generiert)
- Interne API‑Basis für Frontend‑SSR: `API_INTERNAL_URL` (Root‑`.env`, z. B. `http://backend:1337`)
 - Öffentliche URL/Hosts: `PUBLIC_URL`/Strapi‑URL auf Domain setzen; CORS für Frontend‑Origin (`wineacademymain.plan-p.de` bzw. `wineacademy.plan-p.de`) erlauben

## Admin‑Hinweise
- Nach Schema‑Änderungen ggf. Content‑Manager → Configure → „Reset to default“, damit neue Felder (z. B. `planungsstatus`) in der Maske sind.
- Feldname `status` vermeiden (Kollision mit internem Publikationsstatus); wir nutzen `planungsstatus`.

## Deployment (kurz)
- Über Root‑Compose + Traefik: `/` → Frontend, `/api` → Backend (kein StripPrefix), `/uploads` → Backend, `/admin` → Backend. Details siehe Projekt‑README.

- Server‑URL: Setze `PUBLIC_URL` in der Staging‑ENV auf die öffentliche Basis ohne Pfadprefix, z. B. `https://wineacademy.plan-p.de`. Der Server liest diese URL (config/server.ts) und baut absolute Links korrekt.
- Admin‑URL: Optional `ADMIN_PUBLIC_URL` setzen (Default `/admin`). In Staging bleibt das Admin‑Panel unter `https://wineacademy.plan-p.de/admin` erreichbar.
- CORS: Optional `CORS_ORIGINS` als Liste setzen, z. B. `CORS_ORIGINS=['https://wineacademy.plan-p.de']`. Standard ist `*`.
- Uploads/Routing: Kein StripPrefix. API unter `/api`, Uploads unter `/uploads`. Das Frontend erwartet `NEXT_PUBLIC_ASSETS_URL` ohne `/api`.
- Seeds: Für initiale Demodaten in Staging `SEED=true` (optional `SEED_RESET=true`) setzen, Stack starten, danach wieder deaktivieren, damit Seeds nicht erneut laufen.

## Für Agenten/KI
- Bitte zuerst diese Datei vollständig lesen (Datenmodell, Public‑API, Seeds, Lifecycles) und anschließend die Root‑`README.md` (Docker Desktop, Compose, Ports/Routing).
- Nur Public‑Endpoints erweitern oder konsumieren (`/api/public/seminare`, `/api/public/seminare/:slug`), keine Breaking Changes am Schema ohne View‑Reset‑Hinweis.
- Feld `planungsstatus` statt `status` verwenden.

## Reset & Neuinstallation (kurz)

- Lokal – Komplett zurücksetzen und neu seeden:
  - Hinweis: `down -v` löscht auch das DB-Volume vollständig (frische DB beim nächsten Start)
  - `docker compose -f ../docker-compose-dev.yml down -v`
  - Optional nur DB-Reset (Schema leeren, ohne Container zu löschen):
    - `docker compose -f ../docker-compose-dev.yml exec db_dev psql -U $POSTGRES_USER -d $POSTGRES_DB -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
  - In `.env`: `SEED=true` (optional `SEED_RESET=true`)
  - `docker compose -f ../docker-compose-dev.yml up -d --build backend`
  - Prüfen: `docker compose -f ../docker-compose-dev.yml logs -f backend`
  - Tests: `curl -s http://localhost:1337/api/public/seminare | jq '.[0]'`
  - In `.env`: `SEED=false`/Variablen entfernen, dann: `docker compose -f ../docker-compose-dev.yml up -d backend`

- Staging – Komplett zurücksetzen und neu seeden:
  - Hinweis: `down -v` löscht auch das DB-Volume vollständig (frische DB und Uploads beim nächsten Start)
  - `docker compose -f docker-compose-staging.yml down -v`
  - Optional nur DB-Reset (Schema leeren, ohne Container zu löschen):
    - `docker compose -f docker-compose-staging.yml exec db_staging psql -U $POSTGRES_USER -d $POSTGRES_DB -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
  - In `.env.staging`: `SEED=true` (optional `SEED_RESET=true`), `PUBLIC_URL=https://wineacademy.plan-p.de`
  - `docker compose -f docker-compose-staging.yml up -d --build`
  - Prüfen: `docker compose -f docker-compose-staging.yml logs -f backend-staging`
  - Tests: `curl -s https://wineacademy.plan-p.de/api/public/seminare | jq '.[0]'`
  - In `.env.staging`: `SEED=false`/Variablen entfernen, dann: `docker compose -f docker-compose-staging.yml up -d backend-staging`

## Buchungen (Public‑Endpoint)

- Route: `POST /api/public/buchungen` (auth: false)
- Pflichtfelder:
  - `terminId` (Integer; muss auf einen geplanten, veröffentlichten Termin zeigen)
  - `rechnungstyp` (`privat` | `firma`)
  - `vorname`, `nachname`, `email`
  - `teilnehmer`: Array von Personen (Pflicht: `vorname`, `nachname`; optional: `email`, `geburtstag`, `wsetCandidateNumber`, `besondereBeduerfnisse`)
  - `agbAkzeptiert`: boolean
- Firmenfelder (nur bei `rechnungstyp=firma` erforderlich): `firmenname`, `rechnungsEmail`, `strasse`, `plz`, `stadt`, `land`
- Abgeleitete Felder:
  - `anzahl` wird serverseitig strikt aus `teilnehmer.length` berechnet (eingehende `anzahl` wird ignoriert).
  - Preise/MwSt werden serverseitig berechnet; Client darf keine Preisfelder setzen. Grundlage ist der Terminpreis.
    - Hinweis: Es gibt Seminare ohne MwSt. (`mitMwst=false`). Die Steuerlogik (Satz/Brutto/Netto) wird im Backend bestimmt.
- PayPal (optional):
  - `paypalCaptureId`: Wenn vorhanden, wird die Capture serverseitig verifiziert (Status=COMPLETED, `currency_code='EUR'`, Betrag = Terminpreis × `anzahl` abzüglich Rabatt). Nur dann wird `status='bezahlt'` gesetzt und `zahlungsmethode='paypal'` gespeichert.
  - `paypalOrderId`: Alternativ kann eine Order‑ID übergeben werden. Die Order wird serverseitig gelesen; `custom_id` sollte `"<slug>|<terminId>|<anzahl>"` enthalten, um Termin/Anzahl sicher zuzuordnen. Die Buchung bleibt ohne Capture vorerst `status='offen'` und wird durch Webhook bestätigt.

Beispiel (Privat, 1 TN, ohne PayPal):
```
curl -s -X POST http://localhost:1337/api/public/buchungen \
  -H 'Content-Type: application/json' \
  -d '{
    "terminId": 49,
    "rechnungstyp": "privat",
    "vorname": "Max",
    "nachname": "Muster",
    "email": "max@example.com",
    "teilnehmer": [ { "vorname": "Max", "nachname": "Muster" } ],
    "agbAkzeptiert": true
  }'
```

## PayPal Checkout & Webhook

- Webhook‑Route: `POST /api/public/paypal/webhook` (auth: false)
- Verifikation: Signatur via `v1/notifications/verify-webhook-signature` (ENV `PAYPAL_WEBHOOK_ID`). Nicht verifizierte Events werden ignoriert (200, `verified=false`).
- Verarbeitung `PAYMENT.CAPTURE.COMPLETED`:
  - Ermittelt `captureId` aus `resource`.
  - Sucht Buchung per `zahlungsreferenz`/`paypalCaptureId`.
  - Betrag/Währung werden gegen die Buchung geprüft (`EUR`, Betrag==Gesamtsumme inkl. Rabatt). Nur dann `status='bezahlt'`, `zahlungsmethode='paypal'`.

Hinweise für Integration/Robustheit:
- Browser erstellt eine Order und führt `actions.order.capture()` aus; der Abschluss erfolgt IMMER serverseitig über `POST /api/public/buchungen` mit `paypalCaptureId`.
- Für Fallbacks (Tab geschlossen, Netzwerk) Webhook auf die App registrieren (gleiche Client‑ID wie im Checkout) und `PAYPAL_WEBHOOK_ID` setzen.
- Idempotenz empfohlen: Capture‑ID (`zahlungsreferenz`) nur einmal verbuchen (Unique‑Constraint/Guard).

Frontend/Checkout‑Hinweise (falls wieder aktiviert):
- PayPal‑Order sollte `custom_id` setzen: `"<slug>|<terminId>|<anzahl>"`.
- `return_url`/`cancel_url` mit allen Query‑Parametern setzen, damit bei Redirect (z. B. „Guthaben“) Termin/Anzahl erhalten bleiben.
- Nach Rückkehr kann mit `paypalOrderId` + gesichertem Draft ein serverseitiger Abschluss ausgelöst werden.

ENV‑Variablen (z. B. in `.env` oder Compose):

```
PAYPAL_MODE=sandbox            # oder live
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
```

Test (ohne Signaturprüfung):

```
curl -s -X POST http://localhost:1337/webhooks/paypal \
  -H 'Content-Type: application/json' \
  -d '{"event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"id":"WH-TEST-12345"}}'
```
