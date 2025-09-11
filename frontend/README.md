Frontend (Next.js) – Wine Academy

Zweck: Öffentliche Seiten für Seminare (Liste/Detail) sowie ein TEST‑Checkout‑Flow für die PayPal‑Sandbox. Das aktuelle Checkout‑UI ist bewusst minimal und wird später ersetzt. Diese Datei beschreibt, wie der PayPal‑Checkout im Test funktioniert und welche ENV/Flows zu beachten sind.

### Init‑Prompt (zum Kopieren)

Aufgabe:

Deine Rolle: Du arbeitest NUR am Frontend in `frontend/`. Lies und befolge zuerst `frontend/README.md` (Start/HMR, API‑Basen SSR/CSR, Seiten, Bilder, Troubleshooting) und die Root‑`README.md` (Docker Desktop, Compose, Ports). Starte/prüfe: `docker compose -f ../docker-compose-dev.yml up -d frontend` oder `docker compose -f ../docker-compose-stageing.yml up -d frontend`. Verwende SSR‑Basis `API_INTERNAL_URL=http://backend:1337` und CSR‑Basis `NEXT_PUBLIC_API_URL=http://localhost:1337`. Bilder baue mit `mediaUrl()` (ohne `/api`). Nutze nur Public‑Endpoints (`/api/public/seminare`, `/api/public/seminare/:slug`). Mache einen kurzen Plan (2–5 Schritte) und liste die Befehle, die du ausführst, bevor du Änderungen machst. Wenn du gemacht hast, möchte ich, dass du mir ein Browserfenster öffnest, wo man direkt die Enderung im Frontend sehen kann. Immer in Deutsch antworten. 

## Stack & Ports
- Next.js 15 (App Router), React 19, Tailwind 4
- Dev‑Port: 3000 → `http://localhost:3000`

## Start (Dev)
- Über Root‑Compose: `docker compose -f ../docker-compose-dev.yml up -d frontend` oder docker compose -f ../docker-compose-stageing.yml up -d frontend
- Der Ordner `frontend/` ist in den Container gemountet; `next dev` läuft mit Hot Reload. Änderungen sind ohne Image‑Rebuild sichtbar.

## API‑Konfiguration
- Serverseitig (SSR): `API_INTERNAL_URL=http://backend:1337`
- Im Browser (CSR): `NEXT_PUBLIC_API_URL=http://localhost:1337`
- Endpoints (vom Backend bereitgestellt):
  - Liste: `GET /api/public/seminare`
  - Detail: `GET /api/public/seminare/:slug`
  - Buchung anlegen: `POST /api/public/buchungen`
  - Gutscheincode prüfen: `POST /api/public/gutscheine/validate`
  - Buchung minimal lesen (für Erfolg/QA): `GET /api/public/buchungen/:id`
- Client: `lib/api.ts` wählt automatisch die richtige Basis (SSR/CSR) und hängt `/api` an.
  - Bilder/Assets: `lib/api.ts` baut Medien‑URLs über die API‑Basis ohne `/api`‑Suffix.
    - Optional konfigurierbar per `NEXT_PUBLIC_ASSETS_URL` (Browser) und `ASSETS_INTERNAL_URL` (SSR)

## Seiten
- `/seminare` – Karten: Name, Kurzbeschreibung, „ab Preis“, nächster Termin, Ort, CTA „Details“
- `/seminare/[slug]` – Detail mit Hero‑Bild, Beschreibungen und Buchungs‑Sidebar (Termin/Ort/Teilnehmer)
- `/checkout` – TEST‑Checkout mit 5 Schritten:
  1) Rechnungsadresse (privat/firma)
  2) Teilnehmende (Liste, +/−)
  3) Bestellübersicht (nummerierte Teilnehmendenliste, AGB + Datenschutz, Button „Jetzt bezahlen“)
  4) Bezahlen (PayPal‑Buttons sichtbar; Klick blockt ohne AGB/Formular)
  5) Bezahlung erfolgreich (Buchungsnummer + Betrag)

Aufruf: `/checkout?slug=<slug>&terminId=<id>&anzahl=<n>` – die Query wird bei Schrittwechsel fortgeschrieben.

Hinweis: UI ist nur für Sandbox‑Tests gedacht und wird später ersetzt.

<!-- Temporäre Testseite `/buchung-test` entfernt -->

## Bilder
- `next.config.ts` erlaubt Medien von localhost:1337 und `wineacademymain.plan-p.de`/`wineacademy.plan-p.de` (für Strapi‑Uploads).
 - Für neue Domains (z. B. weitere Staging/Preview) in `images.remotePatterns` ergänzen.
 - Setze je Umgebung:
   - Browser: `NEXT_PUBLIC_ASSETS_URL` (z. B. `https://wineacademymain.plan-p.de`)
   - SSR: `ASSETS_INTERNAL_URL` (z. B. `http://backend:1337`)

## Styling
- Tailwind 4; globaler Hintergrund in `app/globals.css` fest auf hell gesetzt.

## Build/Rebuild (selten nötig)
- Dev genügt: `up -d frontend`
- Falls Dockerfile/Build geändert: 
  `docker compose -f ../docker-compose-dev.yml build --no-cache frontend && docker compose -f ../docker-compose-dev.yml up -d frontend` oder docker compose -f ../docker-compose-stageing.yml up -d frontend
- Logs: `docker compose -f ../docker-compose-dev.yml logs -f frontend`

## PayPal Checkout (Sandbox)
- Public Client‑ID: `NEXT_PUBLIC_PAYPAL_CLIENT_ID` muss gesetzt sein (sie ist öffentlich; kein Geheimnis).
- Backend‑ENV: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=sandbox`, `PAYPAL_WEBHOOK_ID` (empfohlen).
- Buttons erscheinen in Schritt 4 immer; AGB/Formular werden beim Klick geprüft.
- Client nutzt same‑origin `/api/...` für Requests (robust gegen Basis‑URL‑Fehler).
- `custom_id` in der Order wird intern als `<slug>|<terminId>|<anzahl>` gesetzt.
- Rabatt: bei gültigem Gutschein werden Gesamtbetrag/Expected‑Capture serverseitig rabattiert.

## Troubleshooting
- Alte Anzeige → Browser Hard‑Reload (Cmd/Ctrl+Shift+R). Bei Image‑Betrieb: Rebuild wie oben.
- SSR 500 → `API_INTERNAL_URL` prüfen (Container‑Name `backend:1337`).
- Bild fehlt → Seminar hat kein Bild oder Domain nicht freigeschaltet (siehe `next.config.ts`).
- Checkout/PayPal: Falls Buttons fehlen → Hard‑Reload, Private Window, Ad‑Blocker prüfen. Client‑ID prüfen.
- 404/HTML nach Zahlung → Requests müssen auf `/api/...` gehen (im Code umgesetzt). 

## Für Agenten/KI
- Nur Public‑Endpoints (`/api/public/...`) konsumieren.
- SSR/CSR‑Basen nicht mischen (siehe `lib/api.ts`).
- Termin‑Feld heißt `planungsstatus` (nicht `status`).
- Dieses Checkout‑UI ist Test‑only. Bei einer Neuentwicklung unbedingt beibehalten:
  - Same‑origin `/api` für Browser‑Calls
  - `custom_id` mit `<slug>|<terminId>|<anzahl>`
  - Nach PayPal‑Capture immer serverseitig buchen (Capture verifizieren, `status='bezahlt'`).
