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

2) Services starten (erstes Mal mit Build):

```
docker compose -f docker-compose-dev.yml up -d --build
```

3) URLs:

- Strapi Admin: `http://localhost:1337/admin`
- Next.js: `http://localhost:3000`

Hinweis: In Dev nutzt das Frontend standardmäßig `NEXT_PUBLIC_API_URL=http://localhost:1337`.

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
