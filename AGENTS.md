# Agenten-Hinweise (gesamtes Repo)

Diese Datei fasst die verbindlichen Regeln für KI-Agenten in diesem Projekt zusammen.

## Pflichtlektüre vor jeder Änderung
- Umgebung: Staging-Stack (`docker-compose-staging.yml`, Domain `https://wineacademy.plan-p.de`).
- **Root-Doku:** `README.md` (Projektüberblick, lokaler Start, Deploy-Hinweise)
- **Teilprojekte:** `backend/README.md` bzw. `frontend/README.md` je nach Arbeitsbereich
- **Weitere Referenzen:**
  - `docs/Reset_and_filldb.md` – Datenbank zurücksetzen/füllen
  - `docs/server-infrastructure.md` – Hosting & Traefik-Setup

## Arbeitsprinzipien
1. Formuliere vor Änderungen einen kurzen Plan (2–5 Schritte) und notiere Befehle/Tests, die du ausführen willst.
2. Arbeite immer auf der Staging-Compose (`docker compose -f docker-compose-staging.yml ...`). Für produktive Deploys wird `docker-compose.yml` genutzt. Kein direktes Arbeiten außerhalb der erlaubten Services.
3. Halte Änderungen klein und zielgerichtet. Keine Refactorings ohne expliziten Auftrag.
4. Bevorzugte Werkzeuge: `rg` für Suchen, `npm`/`yarn` nicht ohne Bedarf, Tests nur sofern relevant und möglich.
5. Stimme dich an bestehende Formatierungen (Prettier/Tailwind/ESLint) ab; keine bewussten Stilbrüche.

## Technische Leitplanken
- Frontend konsumiert ausschließlich die Public-API-Endpunkte:
  - `GET /api/public/seminare`
  - `GET /api/public/seminare/:slug`
  - `GET /api/public/produkte`
  - `GET /api/public/gutscheine/template`
  - `POST /api/public/gutscheine/pricing`
  - `POST /api/public/bestellungen`
  - `GET /api/public/bestellungen/:id`
- Naming-Konventionen: `planungsstatus` statt `status`; Termin → Ort/Seminar (n:1), Seminar ↔ Termine (1:n).
- Keine internen Strapi-Services aus dem Frontend ansprechen und keine Admin-Endpunkte im Public-Code verwenden.
- PayPal-Integrationen nur über die vorhandenen Hooks (Capture → `POST /api/public/bestellungen`, Webhook).

## Daten & Seeding
- Seed/Reset ausschließlich nach `docs/Reset_and_filldb.md`. Kein automatisches Seeding aktivieren oder improvisieren.
- Bei Datenmanipulationen immer prüfen, ob Staging-/Prod-Volumes betroffen sind.

## Kommunikation
- Antworte auf Deutsch.
- Melde unerwartete Zustände (z. B. fremde Änderungen, fehlende Zugänge) sofort und stoppe Arbeiten, bis geklärt.

Vielen Dank!
