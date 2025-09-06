Frontend (Next.js) – Wine Academy

Zweck: Öffentliche Seiten für Seminare (Liste/Detail) und künftig Buchungs‑Flow. Liest Daten aus der Strapi‑Public‑API.

## Stack & Ports
- Next.js 15 (App Router), React 19, Tailwind 4
- Dev‑Port: 3000 → `http://localhost:3000`

## Start (Dev)
- Über Root‑Compose: `docker compose -f ../docker-compose-dev.yml up -d frontend`
- Der Ordner `frontend/` ist in den Container gemountet; `next dev` läuft mit Hot Reload. Änderungen sind ohne Image‑Rebuild sichtbar.

## API‑Konfiguration
- Serverseitig (SSR): `API_INTERNAL_URL=http://backend:1337`
- Im Browser (CSR): `NEXT_PUBLIC_API_URL=http://localhost:1337`
- Endpoints (vom Backend bereitgestellt):
  - Liste: `GET /api/public/seminare`
  - Detail: `GET /api/public/seminare/:slug`
- Client: `lib/api.ts` wählt automatisch die richtige Basis (SSR/CSR) und hängt `/api` an.
  - Bilder/Assets: `lib/api.ts` baut Medien‑URLs über die API‑Basis ohne `/api`‑Suffix.
    - Optional konfigurierbar per `NEXT_PUBLIC_ASSETS_URL` (Browser) und `ASSETS_INTERNAL_URL` (SSR)

## Seiten
- `/seminare` – Karten: Name, Kurzbeschreibung, „ab Preis“, nächster Termin, Ort, CTA „Details“
- `/seminare/[slug]` – Hero‑Bild, Titel, Kurzbeschreibung, Beschreibung/Infos, rechts Buchungs‑Sidebar:
  - Dropdown „Wunschtermin wählen“ (Terminauswahl)
  - Preis (Terminpreis oder Standardpreis)
  - Kapazität
  - CTA „Zur Buchung“ (Stub)

## Bilder
- `next.config.ts` erlaubt Medien von localhost:1337 und `wineacademy.de`/`wineacademy.plan-p.de` (für Strapi‑Uploads).
 - Für neue Domains (z. B. weitere Staging/Preview) in `images.remotePatterns` ergänzen.
 - Setze je Umgebung:
   - Browser: `NEXT_PUBLIC_ASSETS_URL` (z. B. `https://wineacademy.de`)
   - SSR: `ASSETS_INTERNAL_URL` (z. B. `http://backend:1337`)

## Styling
- Tailwind 4; globaler Hintergrund in `app/globals.css` fest auf hell gesetzt.

## Build/Rebuild (selten nötig)
- Dev genügt: `up -d frontend`
- Falls Dockerfile/Build geändert: 
  `docker compose -f ../docker-compose-dev.yml build --no-cache frontend && docker compose -f ../docker-compose-dev.yml up -d frontend`
- Logs: `docker compose -f ../docker-compose-dev.yml logs -f frontend`

## Troubleshooting
- Alte Anzeige → Browser Hard‑Reload (Cmd/Ctrl+Shift+R). Bei Image‑Betrieb: Rebuild wie oben.
- SSR 500 → `API_INTERNAL_URL` prüfen (Container‑Name `backend:1337`).
- Bild fehlt → Seminar hat kein Bild oder Domain nicht freigeschaltet (siehe `next.config.ts`).

## Für Agenten/KI
- Nur Public‑Endpoints (`/api/public/...`) konsumieren.
- SSR/CSR‑Basen nicht mischen (siehe `lib/api.ts`).
- Termin‑Feld heißt `planungsstatus` (nicht `status`).

### Init‑Prompt (zum Kopieren)

> Du arbeitest NUR am Frontend in `frontend/`. Lies und befolge zuerst `frontend/README.md` (Start/HMR, API‑Basen SSR/CSR, Seiten, Bilder, Troubleshooting) und die Root‑`README.md` (Docker Desktop, Compose, Ports). Starte/prüfe: `docker compose -f ../docker-compose-dev.yml up -d frontend`. Verwende SSR‑Basis `API_INTERNAL_URL=http://backend:1337` und CSR‑Basis `NEXT_PUBLIC_API_URL=http://localhost:1337`. Bilder baue mit `mediaUrl()` (ohne `/api`). Nutze nur Public‑Endpoints (`/api/public/seminare`, `/api/public/seminare/:slug`). Mache einen kurzen Plan (2–5 Schritte) und liste die Befehle, die du ausführst, bevor du Änderungen machst. Ziel: [hier Ziel einfügen].
