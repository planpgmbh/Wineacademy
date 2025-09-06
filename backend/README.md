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
 - Öffentliche URL/Hosts: `PUBLIC_URL`/Strapi‑URL auf Domain setzen; CORS für Frontend‑Origin (`wineacademy.de` bzw. `wineacademy.plan-p.de`) erlauben

## Admin‑Hinweise
- Nach Schema‑Änderungen ggf. Content‑Manager → Configure → „Reset to default“, damit neue Felder (z. B. `planungsstatus`) in der Maske sind.
- Feldname `status` vermeiden (Kollision mit internem Publikationsstatus); wir nutzen `planungsstatus`.

## Deployment (kurz)
- Über Root‑Compose + Traefik: `/` → Frontend, `/api` → Backend (StripPrefix). Details siehe Projekt‑README.

## Für Agenten/KI
- Bitte zuerst diese Datei vollständig lesen (Datenmodell, Public‑API, Seeds, Lifecycles) und anschließend die Root‑`README.md` (Docker Desktop, Compose, Ports/Routing).
- Nur Public‑Endpoints erweitern oder konsumieren (`/api/public/seminare`, `/api/public/seminare/:slug`), keine Breaking Changes am Schema ohne View‑Reset‑Hinweis.
- Feld `planungsstatus` statt `status` verwenden.

### Init‑Prompt (zum Kopieren)

> Du arbeitest NUR am Backend in `backend/`. Lies und befolge zuerst `backend/README.md` (Datenmodell, Public‑APIs, Seeds, Lifecycles, Admin‑Hinweise) und die Root‑`README.md` (Docker Desktop, Compose, Ports/Routing). Starte/prüfe: `docker compose -f ../docker-compose-dev.yml up -d backend`. Nutze die Public‑Endpoints, keine direkten internen Services für das Frontend. Mache einen kurzen Plan (2–5 Schritte) und liste die Befehle/curl‑Tests, die du ausführst, bevor du Änderungen machst. Ziel: [hier Ziel einfügen].
