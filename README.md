# Wine Academy Plattform

Diese Codebasis liefert die Wine Academy Hamburg Website: ein Strapi-Backend für Seminar- und Shop-Inhalte sowie ein Next.js-Frontend mit Warenkorb, Checkout (Rechnung & PayPal) und Gutscheinverwaltung. Deployment und Betrieb erfolgen über Docker Compose (Produktion/Staging) hinter Traefik.

## Überblick
- **Backend:** Strapi 5 auf Node 20 mit PostgreSQL 15; liefert ausschließlich öffentliche REST-Endpunkte unter `/api/public/*`.
- **Frontend:** Next.js 15 (App Router, Tailwind 4) konsumiert die Public-API und stellt Seminare, Produkte, Gutschein-Flow und Checkout bereit.
- **Stacks:** Zwei Compose-Stacks (`docker-compose.yml` für Produktion, `docker-compose-staging.yml` für Staging) mit gemeinsamen Traefik-Proxy (`proxy` Netzwerk) und getrennten Datenbank-Volumes.
- **Domänen:** Produktion `https://wineacademymain.plan-p.de`, Staging `https://wineacademy.plan-p.de`.

## Schnellstart für KI-Agenten
1. **Pflichtlektüre:** `AGENTS.md`, `docs/entwicklungsplan.md` sowie die Readmes von Backend und Frontend lesen.
2. **Plan erstellen:** Vor jeder Änderung einen 2–5 Schritte umfassenden Plan formulieren, geplante Kommandos/Tests notieren.
3. **Staging nutzen:** Alle Container-Kommandos mit `docker compose -f docker-compose-staging.yml ...` ausführen.
4. **Tests ausführen:** Nach Änderungen eigenständig die relevanten Tests/Checks laufen lassen (z. B. Puppeteer, Linting) und Ergebnisse protokollieren.
5. **Dokumente aktualisieren:** Bei Workflow-, Infrastruktur- oder Content-Modell-Änderungen den Entwicklungsplan und zugehörige Docs anpassen.

## Verzeichnisstruktur
- `backend/` – Strapi-Projekt inklusive Content-Types, Controller für Public API und Seed-Logik (`backend/README.md`).
- `frontend/` – Next.js-Frontend mit App Router, Warenkorb/Checkout-Komponenten und PayPal-Integration (`frontend/README.md`).
- `docs/` – Infrastruktur- und Projektpläne (`entwicklungsplan.md`, `server-infrastructure.md`).
- `tests/` – Automatisierte End-to-End-Skripte (z. B. `checkout-puppeteer.js`).
- `docker-compose*.yml` – Compose-Stacks für Produktion und Staging.
- `.env.example`, `.env.staging.example` – Vorlagen für Umgebungsvariablen (Backend-, Frontend- und Infrastruktur-Settings).

## Häufig genutzte Kommandos
```bash
# Staging-Stack aktualisieren (Backend & Frontend)
docker compose -f docker-compose-staging.yml up -d --build

# Nur Backend neu starten (z. B. nach Schema-Anpassungen)
docker compose -f docker-compose-staging.yml up -d --force-recreate service_wineacadamy_staging

# Puppeteer-Checkout-Test (setzt PAYPAL_* Variablen voraus)
node tests/checkout-puppeteer.js
```

## Weiterführende Dokumente & Referenzen
- `backend/README.md` – Content-Modelle, Public-Endpoints, Bestell-/PayPal-Workflow, relevante ENV-Variablen.
- `frontend/README.md` – API-Basen, Komponentenstruktur, Checkout-/PayPal-Integration, Frontend-ENV-Variablen.
- `docs/server-infrastructure.md` – Traefik-Routing, Netzwerke, Deploy-Abläufe, Backup-Hinweise.
- `docs/entwicklungsplan.md` – Roadmap, offene Arbeitspakete und Arbeitsprotokoll.
- `AGENTS.md` – Arbeitsprinzipien, Kommunikation und Tooling-Konventionen.

Für Details zum Datenmodell, API-Requests oder Frontend-Flows bitte die jeweiligen Teilprojekt-Readmes heranziehen, um Redundanzen zu vermeiden.
