# Wine Academy Hamburg – Monorepo (Strapi + Next.js)

Eine professionelle Kurs- und Buchungsplattform für die Wine Academy Hamburg.

## Überblick

- Backend: Strapi 4.x (Node.js), Datenbank: PostgreSQL 15
- Frontend: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- Zahlungen: Stripe Checkout
- Rechnungen: LexOffice API (automatisch nach erfolgreicher Zahlung)
- E-Mail: SendGrid
- Prod-Routing: Traefik (bestehendes `proxy` Netzwerk), `/` → Frontend, `/api` → Backend

## Entscheidungen

- Datenbank: PostgreSQL (empfohlen und gewählt)
- E-Mail Provider: SendGrid
- Domain & Routing: Traefik über bestehendes externes `proxy` Netzwerk
- Mehrsprachigkeit: Start mit Deutsch (EN ggf. später)
- Gutscheine: vorerst Einmalnutzung (einfaches Regelwerk)

## Zielarchitektur

- Strapi (Port 1337) + Postgres im internen DB-Netz
- Next.js (Port 3000) im Proxy-Netz, Traefik leitet Host → Frontend
- Traefik leitet `PathPrefix(/api)` → Backend und entfernt `/api` vor Weiterleitung

## Ordnerstruktur

```
.
├── backend/            # Strapi-App (noch zu initialisieren)
│   └── Dockerfile
├── frontend/           # Next.js-App (noch zu initialisieren)
│   └── Dockerfile
├── docker-compose-dev.yml
├── docker-compose.yml
├── .env.example
└── README.md
```

## Lokale Entwicklung

1) `.env` aus Vorlage erstellen und anpassen:

```
cp .env.example .env
```

Wichtig: Strapi-Secrets (APP_KEYS, ADMIN_JWT_SECRET, …) in `.env` leer lassen, damit die generierten Werte aus `backend/.env` genutzt werden.

2) Services starten (erstes Mal mit Build):

```
docker compose -f docker-compose-dev.yml up -d --build
```

3) URLs:

- Strapi Admin: `http://localhost:1337/admin`
- Next.js: `http://localhost:3000`

Hinweis: In Dev nutzt das Frontend standardmäßig `NEXT_PUBLIC_API_URL=http://localhost:1337`.

Erstanmeldung Strapi:
- Beim ersten Aufruf von `/admin` wirst du aufgefordert, einen Admin‑Account anzulegen (E‑Mail + Passwort frei wählbar). Es gibt keine Default‑Zugangsdaten.

Troubleshooting:
- Backend startet nicht: prüfe, dass `.env` keine Strapi‑Secrets setzt (sie kommen aus `backend/.env`).
- DB erreichbar: `docker compose -f docker-compose-dev.yml logs db_dev` (warte auf "database system is ready to accept connections").
- Backend Logs: `docker compose -f docker-compose-dev.yml logs -f backend`.

## Produktion (mit Traefik)

Voraussetzungen: Externes Traefik-Netz `proxy` existiert (z. B. auf dem Host bereits angelegt) und eine Domain (z. B. `wineacademy.de`). Passe die Labels in `docker-compose.yml` bei Bedarf an.

Start:

```
docker compose up -d --build
```

Routing (Traefik Labels in `docker-compose.yml`):

- Frontend: `Host(wineacademy.de)` → Port 3000
- Backend: `Host(wineacademy.de) && PathPrefix(/api)` → Port 1337 (mit StripPrefix `/api`)

## Staging (wineacademy.plan-p.de)

- Datei: `docker-compose-staging.yml`
- Domain: `wineacademy.plan-p.de` (Traefik auf externem `proxy`‑Netz)
- Eigene DB und Volume (`db_staging`, `db_staging_data`)

Start:

```
cp .env.staging.example .env.staging
docker compose -f docker-compose-staging.yml up -d --build
```

Routing (Traefik Labels in `docker-compose-staging.yml`):

- Frontend: `Host(wineacademy.plan-p.de)` → Port 3000
- Backend: `Host(wineacademy.plan-p.de) && PathPrefix(/api)` → Port 1337 (StripPrefix `/api`)

## Umgebungsvariablen (Auszug)

- Strapi: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`
- DB (Postgres): `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_*`
- Next.js: `NEXT_PUBLIC_API_URL` (Prod: `https://wineacademy.de/api`)
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- SendGrid: `SENDGRID_API_KEY`, `EMAIL_FROM`
- LexOffice: `LEXOFFICE_API_TOKEN`

Weitere Details in `.env.example`.

## Nächste Schritte

- Strapi-Projekt in `backend/` initialisieren (Content-Types: Course, Session, Booking, Voucher, Customer)
- Next.js in `frontend/` initialisieren (App Router, Basis-Seiten)
- Stripe Checkout + Webhook-Endpoint im Backend
- LexOffice-Integration (Rechnung nach Zahlung + E-Mail-Versand)
- SendGrid-Mailtemplates (Registrierung, Buchung, Zahlung, Rechnung)

## Server Infrastructure (Live & Staging)

Dieser Abschnitt fasst die für Deployment relevanten Infrastruktur-Infos zusammen (Traefik, Netzwerke, Domains, Secrets, Commands).

- Voraussetzungen:
  - Traefik v3 läuft bereits am Server und ist mit externem Docker-Netz `proxy` verbunden.
  - EntryPoint heißt `websecure`, CertResolver `http-resolver` (falls abweichend, Labels in Compose anpassen).
  - DNS zeigt auf den Server: `wineacademy.de`, `wineacademy.plan-p.de` (Ports 80/443 offen).

- Netzwerke & Routing:
  - Extern: `proxy` (Traefik-facing). Intern: `db` (Prod), `db_staging` (Staging).
  - Prod-Routing (siehe `docker-compose.yml` Labels):
    - `Host(wineacademy.de)` → Frontend (Port 3000)
    - `Host(wineacademy.de) && PathPrefix(/api)` → Backend (Port 1337) mit StripPrefix `/api`
  - Staging-Routing (siehe `docker-compose-staging.yml` Labels):
    - `Host(wineacademy.plan-p.de)` → Frontend (Port 3000)
    - `Host(wineacademy.plan-p.de) && PathPrefix(/api)` → Backend (Port 1337) mit StripPrefix `/api`

- Verzeichnisstruktur am Server (Beispiel):
  - `/etc/docker/projects/wineacadamy/` enthält dieses Repo (Compose-Dateien, Dockerfiles, Code).

- Wichtige Umgebungsvariablen:
  - Frontend-Port ist in allen Compose-Dateien explizit auf `PORT=3000` gesetzt, damit Strapi-`PORT=1337` das Frontend nicht beeinflusst.
  - Prod `.env`: `POSTGRES_*`, `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY`, `SENDGRID_API_KEY`, `EMAIL_FROM`, `LEXOFFICE_API_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_API_URL=https://wineacademy.de/api`, `API_INTERNAL_URL=http://backend:1337`.
  - Staging `.env.staging`: analoge Variablen mit Staging-Werten und `NEXT_PUBLIC_API_URL=https://wineacademy.plan-p.de/api`, `API_INTERNAL_URL=http://backend-staging:1337`.

- Deploy-Befehle:
  - Staging: `cp .env.staging.example .env.staging && docker compose -f docker-compose-staging.yml up -d --build`
  - Produktion: `cp .env.example .env` (mit Prod-Secrets füllen) und `docker compose up -d --build`

- Health & Logs:
  - Strapi Admin: auch direkt über `/admin` erreichbar (z. B. Prod: `https://wineacademy.de/admin`, Staging: `https://wineacademy.plan-p.de/admin`).
  - Logs: `docker compose [-f <compose>] logs -f backend|frontend|db*`

- Backups (Postgres):
  - Beispiel Dump: `docker exec <db-container> pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql`

Weitere Details: `docs/server-infrastructure.md`

Hinweise:
- Im lokalen Dev ist `backend` ohne Auto-Reload konfiguriert (ruhige Admin-UI). Für HMR kann in `docker-compose-dev.yml` der Command wieder auf `npm run develop` gestellt werden.
- Traefik-Labelnamen (`websecure`, `http-resolver`) bitte mit eurer Traefik-Konfiguration abgleichen und ggf. in den Compose-Dateien anpassen.
