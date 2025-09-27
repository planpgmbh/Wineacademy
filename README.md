# Wine Academy Hamburg – Monorepo (Strapi + Next.js)

Die Wine Academy Hamburg betreibt über dieses Repository eine kombinierte Strapi- und Next.js-Anwendung für Seminarverwaltung, Shop und Checkout (Rechnung & PayPal).

## Stack-Überblick
- **Backend:** Strapi 5 (Node 20) mit PostgreSQL
- **Frontend:** Next.js 15 (App Router), React 19, Tailwind 4
- **Payments & Drittsysteme:** PayPal Checkout, LexOffice, SendGrid
- **Containerisation:** Docker Compose (Dev/Staging/Prod) + Traefik-Routing

## Verzeichnis & Dokumentation
- `backend/README.md` – Datenmodell, Public-API, Admin- & Backend-Flows
- `frontend/README.md` – App-Struktur, API-Anbindung, Checkout-Details
- `docs/Reset_and_filldb.md` – Datenbank zurücksetzen & befüllen
- `docs/server-infrastructure.md` – Traefik, Server-Setup, Deploy-Anleitung

> **Tipp:** Lies zuerst die Root-README (dieses Dokument) und anschließend die README des Teilprojekts, in dem du arbeitest. Für Seeds/Deployments immer in den Docs nachschlagen – dort stehen die verbindlichen Schritte.

## Schnellstart (lokale Entwicklung)
1. `.env` aus Vorlage übernehmen und anpassen
   ```bash
   cp .env.example .env
   ```
2. Docker Desktop als Engine verwenden (`docker context use desktop-linux`).
3. Staging-Stack lokal starten
   ```bash
   docker compose -f docker-compose-staging.yml up -d --build
   ```
4. Zugänge:
   - Strapi Admin: `http://localhost:1337/admin`
   - Frontend: `http://localhost:3000`

**Logs & Neustarts (Staging-Stack)**
```bash
docker compose -f docker-compose-staging.yml logs -f backend|frontend
docker compose -f docker-compose-staging.yml up -d service_wineacadamy_staging   # Backend neu starten
docker compose -f docker-compose-staging.yml up -d web_wineacadamy_staging       # Frontend neu starten
```

**Seeding / Reset**
> Folge strikt `docs/Reset_and_filldb.md`. Automatisches Seeding ist deaktiviert – Daten manuellerstellen.

## Öffentliche API (Frontend <-> Backend)
Das Frontend nutzt ausschließlich die folgenden Public-Endpoints:

- `GET /api/public/seminare`
- `GET /api/public/seminare/:slug`
- `GET /api/public/produkte`
- `GET /api/public/gutscheine/template`
- `POST /api/public/gutscheine/pricing`
- `POST /api/public/bestellungen`
- `GET /api/public/bestellungen/:id`

Preise, Steuern und Gutscheinlogik werden serverseitig verifiziert. Details zum Payload findest du in `backend/README.md`.

## Checkout & Zahlungen
- Rechnungsbestellungen bleiben auf Status `offen`.
- PayPal-Checkout erzeugt Orders mit `custom_id` (Base64-kodierter Warenkorb) und löst nach Capture `POST /api/public/bestellungen` aus.
- Webhook (`POST /api/public/paypal/webhook`) gleicht Captures serverseitig ab und erzeugt ggf. fehlende Gutscheine.
- Konfiguration der Zahlungs-ENV-Variablen siehe `backend/README.md`.

## Deployments & Infrastruktur
- Compose-Äquivalente für Staging/Prod: `docker-compose-staging.yml` bzw. `docker-compose.yml`.
- Server-Setup, Traefik-Labels, CI-GitHub-Actions und ENV-Variablen sind in `docs/server-infrastructure.md` dokumentiert.
- Staging-Domain: `https://wineacademy.plan-p.de`, Production: `https://wineacademymain.plan-p.de`.

## Sandbox-Zugangsdaten
PayPal Sandbox Account (Staging):
```
E-Mail: winetest@personal.example.com
Passwort: u*q7gR%D
```

Bitte Passwörter vertraulich behandeln und nur in Testumgebungen verwenden.
