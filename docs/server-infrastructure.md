# Server Infrastructure – Live & Staging (Traefik/Docker)

Diese Seite beschreibt die produktive/staging Infrastruktur für Wine Academy Hamburg und ergänzt die Kurzfassung in README.md.

## Überblick

- Host: Linux (Debian/Ubuntu)
- Container: Docker, Orchestrierung via docker-compose
- Reverse Proxy: Traefik v3.x (TLS via Let's Encrypt)
- Domains:
  - Produktion: `wineacademy.de`
  - Staging: `wineacademy.plan-p.de`
- Basis-Pfad (Server): `/etc/docker/projects/wineacadamy`

## Netzwerke

- Externes Proxy-Netz: `proxy` (Traefik-facing Services)
- Interne Netze:
  - Prod: `db`
  - Staging: `db_staging`

Komposition:
- Frontend hängt am `proxy` Netz, Backend am `proxy` und internen DB-Netz.

## Traefik-Routing

- Produktion (`docker-compose.yml`):
  - Frontend: `Host(wineacademy.de)` → Service-Port 3000
  - Backend: `Host(wineacademy.de) && PathPrefix(/api)` → Service-Port 1337, Middleware StripPrefix `/api`
- Staging (`docker-compose-staging.yml`):
  - Frontend: `Host(wineacademy.plan-p.de)` → Service-Port 3000
  - Backend: `Host(wineacademy.plan-p.de) && PathPrefix(/api)` → Service-Port 1337, StripPrefix `/api`

Hinweis: EntryPoint-Name (`websecure`) und CertResolver (`http-resolver` vs. `letsencrypt`) müssen zu eurer Traefik-Config passen. Bei Abweichung Labels anpassen.

## Umgebungsvariablen je Umgebung

Gemeinsam:
- Postgres: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- Strapi: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY`
- E-Mail: `SENDGRID_API_KEY`, `EMAIL_FROM`
- LexOffice: `LEXOFFICE_API_TOKEN`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Frontend intern: `API_INTERNAL_URL` (`http://backend:1337` bzw. `http://backend-staging:1337`)

Produktion (`.env`):
- `NEXT_PUBLIC_API_URL=https://wineacademy.de/api`
- DB-Host intern: `DATABASE_HOST=db`

Staging (`.env.staging`):
- `NEXT_PUBLIC_API_URL=https://wineacademy.plan-p.de/api`
- DB-Host intern: `DATABASE_HOST=db_staging`

Frontend-Port-Fix: In allen Compose-Dateien ist `PORT=3000` für das Frontend explizit gesetzt, damit Strapi-`PORT=1337` das Frontend nicht beeinflusst.

## Deploy-Ablauf

Vorbereitung (einmalig pro Umgebung):
- `.env` mit Prod-Secrets bzw. `.env.staging` mit Staging-Secrets befüllen.
- Sicherstellen, dass das externe Netzwerk `proxy` existiert und Traefik daran hängt.

Staging:
```bash
cd /etc/docker/projects/wineacadamy
cp .env.staging.example .env.staging  # falls noch nicht vorhanden, dann befüllen
docker compose -f docker-compose-staging.yml up -d --build
```

Produktion:
```bash
cd /etc/docker/projects/wineacadamy
cp .env.example .env  # befüllen
docker compose up -d --build
```

Überprüfung:
- Frontend Prod: https://wineacademy.de
- Backend Prod: https://wineacademy.de/api
- Admin Prod: https://wineacademy.de/admin
- Frontend Staging: https://wineacademy.plan-p.de
- Backend Staging: https://wineacademy.plan-p.de/api
- Admin Staging: https://wineacademy.plan-p.de/admin

Logs & Status:
```bash
docker compose [-f docker-compose-staging.yml] ps
docker compose [-f docker-compose-staging.yml] logs -f backend
docker compose [-f docker-compose-staging.yml] logs -f frontend
docker compose [-f docker-compose-staging.yml] logs db*
```

## Backups

- Datenbank (Beispiel):
```bash
docker exec <db-container> pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql
```
- Compose/Projekt: regelmäßiges Backup des Pfades `/etc/docker/projects/wineacadamy` (z. B. via Duplicati).

## Tipps & Troubleshooting

- Admin-UI Reloads vermeiden: In Dev nutzen wir `strapi start` ohne HMR; für Prod/Staging sowieso `start`.
- Traefik-Resolver/EntryPoint passen nicht? Labels in `docker-compose*.yml` an eure Namen anpassen.
- Zertifikate: Traefik-Logs prüfen und DNS/HTTP-Challenge je nach Setup sicherstellen.
