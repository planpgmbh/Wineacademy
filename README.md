# Wine Academy Hamburg – Monorepo (Strapi + Next.js)

Eine professionelle Kurs- und Buchungsplattform für die Wine Academy Hamburg.

## Projektzusammenfassung

Die Plattform bildet Seminare/Kurse mit Terminen ab, ermöglicht Buchungen inkl. Online‑Zahlung und generiert Dokumente/Benachrichtigungen automatisch. Kernbausteine:

- Inhalte & Daten: Strapi 5 (Seminare, Termine, Orte, Buchungen, Kunden, Gutscheine); Komponente „Seminartag“ (Datum, Start-/Endzeit)
- Frontend: Next.js (App Router, Tailwind); Seiten für Liste/Detail + TEST‑Checkout (PayPal‑Sandbox)
- Payments & Docs: PayPal (Checkout/Webhook; serverseitige Capture‑Prüfung + Webhook mit Signatur/Betrag/Währung), LexOffice (Rechnungen), SendGrid (E‑Mails)
- Betrieb: Docker/Compose in Dev/Prod/Staging; Traefik routet `/` → Frontend und `/api` → Backend

Für Agenten/KI: Das Backend stellt schlanke Public‑APIs bereit (`/api/public/seminare`, `/api/public/seminare/:slug`, `POST /api/public/buchungen`). `anzahl` wird serverseitig strikt aus `teilnehmer.length` abgeleitet; Preise/MwSt werden im Backend berechnet (einige Seminare ohne MwSt). PayPal‑Captures werden serverseitig verifiziert; der Webhook prüft Signatur + Betrag/Währung.
Zusätzlich vorhanden: `POST /api/public/gutscheine/validate` (Rabatte) und `GET /api/public/buchungen/:id` (QA‑Lesen, minimal).

## Überblick

- Backend: Strapi 5.x (Node.js), Datenbank: PostgreSQL 15
- Frontend: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4
- Zahlungen: PayPal Checkout
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
- Traefik leitet `PathPrefix(/api)` → Backend (kein StripPrefix)

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

### Docker Desktop (wichtig)

- Verwende für dieses Projekt Docker Desktop als Engine/Kontext. Parallele Engines (z. B. Colima) führen zu doppelten Stacks und unterschiedlichen Datenständen auf denselben Ports.
- Prüfen/setzen des Kontexts:
  - `docker context ls`
  - `docker context use desktop-linux`
- Falls Colima aktiv ist: `colima stop`

### Start/Stop – Kurzbefehle

- Start Dev‑Stack: `docker compose -f docker-compose-dev.yml up -d`
- Stoppen: `docker compose -f docker-compose-dev.yml down`
- Stoppen inkl. Volumes (DB leeren): `docker compose -f docker-compose-dev.yml down -v`

### Teil‑Services neu bauen (nur bei Bedarf)

- Frontend: `docker compose -f docker-compose-dev.yml build --no-cache frontend && docker compose -f docker-compose-dev.yml up -d frontend`
- Backend:  `docker compose -f docker-compose-dev.yml build --no-cache backend  && docker compose -f docker-compose-dev.yml up -d backend`

## Development Workflow (empfohlen)

- Starten (Dev): `docker compose -f docker-compose-dev.yml up -d`
  - Frontend läuft im Dev‑Modus (Hot Reload), Code ist bind‑gemountet
  - Backend (Strapi) im Develop‑Modus mit Auto‑Reload

- Änderungen am Frontend: Browser‑Reload genügt; kein Rebuild nötig
  - Bei unerwarteter Anzeige: Hard‑Reload (Cmd/Ctrl+Shift+R) oder privates Fenster

- Images nur bei Bedarf neu bauen (Dockerfile/Build‑Änderungen):
  - Frontend: `docker compose -f docker-compose-dev.yml build --no-cache frontend && docker compose -f docker-compose-dev.yml up -d frontend`
  - Backend:  `docker compose -f docker-compose-dev.yml build --no-cache backend  && docker compose -f docker-compose-dev.yml up -d backend`

- Seeding & Reset:
  - Bitte `docs/SEEDING.md` folgen (Schritt‑für‑Schritt: Kategorien → Orte → Seminare → Termine mit Verknüpfungen).

- API‑Basis im Frontend:
  - SSR: `API_INTERNAL_URL=http://backend:1337`
  - Browser: `NEXT_PUBLIC_API_URL=http://localhost:1337`

- Troubleshooting:
  - Alte Anzeige → Hard‑Reload, ggf. Frontend neu bauen/starten
  - Admin‑Maske nach Schema‑Änderung → Content Manager „Configure“ → „Reset to default“
  - Ports belegt → `lsof -i :1337` (oder `:3000`) prüfen
  - Logs: `docker compose -f docker-compose-dev.yml logs -f frontend|backend`

## Datenmodell (Kurzüberblick)

- Content‑Types: Seminar, Termin (Planungsstatus, Preis, Kapazität), Ort, Buchung, Kunde, Gutschein
- Komponente: `termin.seminartag` (Datum, Startzeit, Endzeit) – Defaultzeiten 10:00–17:00
- Relationen: Seminar ↔ Termine (1:n), Termin → Ort (n:1), Buchung → Termin/Kunde (n:1)
- Termin‑Titel: Wird bei leerem Titel automatisch als „YYYY‑DD‑MM – Seminar – Ort“ gesetzt

## Öffentliche API (für das Frontend)

- Liste: `GET /api/public/seminare` → aktive, veröffentlichte Seminare inkl. geplanter Termine
- Detail: `GET /api/public/seminare/:slug` → Seminar mit Terminen (Tage, Ort, Preis)

Hinweis: In Dev nutzt das Frontend `API_INTERNAL_URL` (SSR) und `NEXT_PUBLIC_API_URL` (CSR). Produktrouting via Traefik siehe unten.

## Produktion (mit Traefik)

Voraussetzungen: Externes Traefik-Netz `proxy` existiert (z. B. auf dem Host bereits angelegt) und eine Domain (z. B. `wineacademymain.plan-p.de`). Passe die Labels in `docker-compose.yml` bei Bedarf an.

Start:

```
docker compose up -d --build
```

Routing (Traefik Labels in `docker-compose.yml`):

- Frontend: `Host(wineacademymain.plan-p.de)` → Port 3000
- Backend API: `Host(wineacademymain.plan-p.de) && PathPrefix(/api)` → Port 1337 (kein StripPrefix)
- Backend Uploads: `Host(wineacademymain.plan-p.de) && PathPrefix(/uploads)` → Port 1337
- Strapi Admin: `Host(wineacademymain.plan-p.de) && PathPrefix(/admin)` → Port 1337
- Admin/Plugin‑APIs: `PathPrefix(/content-manager|/content-type-builder|/i18n|/users-permissions|/email|/upload|/users)` → Port 1337

Staging/Live‑Checklist (ergänzend):
- Domains: `wineacademymain.plan-p.de` (Prod), `wineacademy.plan-p.de` (Staging) in Traefik‑Labels hinterlegt und DNS zeigt auf Server
- Frontend‑ENV:
  - Prod: `NEXT_PUBLIC_API_URL=https://wineacademymain.plan-p.de/api`, `NEXT_PUBLIC_ASSETS_URL=https://wineacademymain.plan-p.de`
  - Staging: `NEXT_PUBLIC_API_URL=https://wineacademy.plan-p.de/api`, `NEXT_PUBLIC_ASSETS_URL=https://wineacademy.plan-p.de`
- Backend‑ENV:
  - Prod: `API_INTERNAL_URL=http://backend:1337`
  - Staging: `API_INTERNAL_URL=http://backend-staging:1337`
- Strapi CORS/Hostname: `PUBLIC_URL` bzw. Strapi‑URL auf Domain setzen; CORS/Permissions erlauben die Frontend‑Origin
- Next/Image: `frontend/next.config.ts` enthält Domains (`wineacademymain.plan-p.de`, `wineacademy.plan-p.de`) – bei neuen Domains ergänzen
- Payments: PayPal `PAYPAL_MODE=sandbox` (Staging) / `live` (Prod), passende Webhook‑IDs
- E‑Mail & LexOffice: Staging‑Keys getrennt von Prod nutzen

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
- Backend API: `Host(wineacademy.plan-p.de) && PathPrefix(/api)` → Port 1337 (kein StripPrefix)
- Backend Uploads: `Host(wineacademy.plan-p.de) && PathPrefix(/uploads)` → Port 1337
- Strapi Admin: `Host(wineacademy.plan-p.de) && PathPrefix(/admin)` → Port 1337
- Admin/Plugin‑APIs: `PathPrefix(/content-manager|/content-type-builder|/i18n|/users-permissions|/email|/upload|/users)` → Port 1337

### CI/CD – Automatisches Staging-Deploy

- Workflow: `.github/workflows/staging-deploy.yml`
- Trigger: Push auf Branch `staging` (oder manuell via Workflow Dispatch)
- Voraussetzungen (GitHub Secrets im Repo):
  - `SSH_HOST` – Hostname/IP des Staging-Servers
  - `SSH_USER` – SSH-User (mit Rechten im Projektpfad und Docker)
  - `SSH_PRIVATE_KEY` – Private SSH Key (PEM, ohne Passphrase)
  - Optional: `SSH_PORT` – Port (Default 22)
- Verhalten: Server verbindet sich per SSH, führt `git fetch` + `git reset --hard origin/staging` im Projektverzeichnis `/etc/docker/projects/wineacadamy` aus und startet `docker compose -f docker-compose-staging.yml up -d --build`. Anschließend Health-Checks gegen Admin und Public-API.
  
Zusatz:
- Staging `.env.staging` sollte `NEXT_PUBLIC_ASSETS_URL=https://wineacademy.plan-p.de` und `NEXT_PUBLIC_API_URL=https://wineacademy.plan-p.de/api` enthalten.

### CI/CD – Automatisches Production-Deploy

- Workflow: `.github/workflows/production-deploy.yml`
- Trigger: Push auf Branch `main` (oder manuell via Workflow Dispatch)
- Voraussetzungen (GitHub Secrets im Repo):
  - `SSH_HOST` – Hostname/IP des Produktions-Servers
  - `SSH_USER` – SSH-User (mit Rechten im Projektpfad und Docker)
  - `SSH_PRIVATE_KEY` – Private SSH Key (PEM, ohne Passphrase)
  - Optional: `SSH_PORT` – Port (Default 22)
  - Optional: `PRODUCTION_BASE_URL` – Basis-URL für Health-Checks (Default `https://wineacademymain.plan-p.de`)
- Verhalten: Server verbindet sich per SSH, führt `git fetch` + `git reset --hard origin/main` im Projektverzeichnis `/etc/docker/projects/wineacadamy` aus und startet `docker compose up -d --build`. Anschließend Health-Checks gegen Admin und Public-API.

## Umgebungsvariablen (Auszug)

- Strapi: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`
- DB (Postgres): `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_*`
- Next.js: `NEXT_PUBLIC_API_URL` (Prod: `https://wineacademymain.plan-p.de/api`)
- PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_MODE` (sandbox|live), `PAYPAL_WEBHOOK_ID`, `PAYPAL_CURRENCY` (z. B. `EUR`)
- SendGrid: `SENDGRID_API_KEY`, `EMAIL_FROM`
- LexOffice: `LEXOFFICE_API_TOKEN`

Weitere Details in `.env.example`.

## Hinweise zum TEST‑Checkout (PayPal Sandbox)

- Dieses Frontend‑Checkout ist ein Testdesign und wird später ersetzt. Für Entwickler wichtig:
  - Browser nutzt same‑origin `/api/...` für Calls (robust gegenüber falsch gesetzten Basen).
  - PayPal `custom_id` wird als `<slug>|<terminId>|<anzahl>` gesetzt.
  - Abschluss nur serverseitig: Nach `actions.order.capture()` wird `POST /api/public/buchungen` mit `paypalCaptureId` aufgerufen; das Backend verifiziert die Capture (EUR, Betrag inkl. Rabatt).
  - Gutscheine: `POST /api/public/gutscheine/validate` für Vorschau; in der Buchung wird Rabatt berücksichtigt.
  - Webhook: `POST /api/public/paypal/webhook` (Signaturprüfung). Registrierung in der PayPal‑App (gleiche Client‑ID) empfohlen; `PAYPAL_WEBHOOK_ID` muss passen.
- ENV (Staging/Prod):
  - Backend: `PAYPAL_MODE=sandbox|live`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`.
  - Frontend: `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (öffentlich; entspricht der App‑Client‑ID).

## Nächste Schritte

- LexOffice‑Rechnung und SendGrid‑E‑Mails nach Zahlung (Prod‑Flows)
- CORS‑Härtung (nur erlaubte Origins)
- Idempotenz‑Guard (Capture‑ID nur einmal buchen)

## Server Infrastructure (Live & Staging)

Dieser Abschnitt fasst die für Deployment relevanten Infrastruktur-Infos zusammen (Traefik, Netzwerke, Domains, Secrets, Commands).

- Voraussetzungen:
  - Traefik v3 läuft bereits am Server und ist mit externem Docker-Netz `proxy` verbunden.
  - EntryPoint heißt `websecure`, CertResolver `http-resolver` (falls abweichend, Labels in Compose anpassen).
  - DNS zeigt auf den Server: `wineacademymain.plan-p.de`, `wineacademy.plan-p.de` (Ports 80/443 offen).

- Netzwerke & Routing:
  - Extern: `proxy` (Traefik-facing). Intern: `db` (Prod), `db_staging` (Staging).
  - Prod-Routing (siehe `docker-compose.yml` Labels):
    - `Host(wineacademymain.plan-p.de)` → Frontend (Port 3000)
    - `Host(wineacademymain.plan-p.de) && PathPrefix(/api)` → Backend (Port 1337) mit StripPrefix `/api`
  - Staging-Routing (siehe `docker-compose-staging.yml` Labels):
    - `Host(wineacademy.plan-p.de)` → Frontend (Port 3000)
    - `Host(wineacademy.plan-p.de) && PathPrefix(/api)` → Backend (Port 1337) mit StripPrefix `/api`

- Verzeichnisstruktur am Server (Beispiel):
  - `/etc/docker/projects/wineacadamy/` enthält dieses Repo (Compose-Dateien, Dockerfiles, Code).

- Wichtige Umgebungsvariablen:
  - Frontend-Port ist in allen Compose-Dateien explizit auf `PORT=3000` gesetzt, damit Strapi-`PORT=1337` das Frontend nicht beeinflusst.
  - Prod `.env`: `POSTGRES_*`, `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY`, `SENDGRID_API_KEY`, `EMAIL_FROM`, `LEXOFFICE_API_TOKEN`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_CURRENCY`, `NEXT_PUBLIC_API_URL=https://wineacademymain.plan-p.de/api`, `API_INTERNAL_URL=http://backend:1337`.
  - Staging `.env.staging`: analoge Variablen mit Staging-Werten und `NEXT_PUBLIC_API_URL=https://wineacademy.plan-p.de/api`, `API_INTERNAL_URL=http://backend-staging:1337`.

- Deploy-Befehle:
  - Staging: `cp .env.staging.example .env.staging && docker compose -f docker-compose-staging.yml up -d --build`
  - Produktion: `cp .env.example .env` (mit Prod-Secrets füllen) und `docker compose up -d --build`

- Health & Logs:
  - Strapi Admin: auch direkt über `/admin` erreichbar (z. B. Prod: `https://wineacademymain.plan-p.de/admin`, Staging: `https://wineacademy.plan-p.de/admin`).
  - Logs: `docker compose [-f <compose>] logs -f backend|frontend|db*`

- Backups (Postgres):
  - Beispiel Dump: `docker exec <db-container> pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql`

Weitere Details: `docs/server-infrastructure.md`

Hinweise:
- Im lokalen Dev läuft `backend` im Develop‑Modus (Auto‑Reload). Für eine ruhigere Admin‑UI kann alternativ `npm run start` genutzt werden.
- Traefik-Labelnamen (`websecure`, `http-resolver`) bitte mit eurer Traefik‑Konfiguration abgleichen und ggf. in den Compose‑Dateien anpassen.

## Weitere Doku

- Frontend: `frontend/README.md` – Start/HMR, API‑Basen (SSR/CSR), Seiten, Bilder, Troubleshooting, Hinweise für Agenten/KI
- Backend: `backend/README.md` – Datenmodell, Public‑APIs, Lifecycles, Admin‑Hinweise, Logs (Seeding/Reset: `docs/Reset_and_filldb.md`)

### Für Agenten/KI – Init‑Snippet (zum Kopieren)

Aufgabe:

Deine Rolle: Lies und befolge zuerst diese Root‑`README.md` (Docker Desktop, Compose, Ports/Routing) und die README im relevanten Teilprojekt (`frontend/README.md` oder `backend/README.md`). Verwende Docker Desktop (Kontext `desktop-linux`). Starte über `docker compose -f docker-compose-dev.yml up -d <service>`. Nenne vor Änderungen einen kurzen Plan (2–5 Schritte) und die Befehle/Tests, die du ausführst. Halte dich an die Public‑APIs und die in den READMEs beschriebenen Konventionen (z. B. `planungsstatus`, API‑Basen SSR/CSR, `mediaUrl()` für Bilder) Antworte immer in Deutsch.
