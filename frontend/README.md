# Frontend (Next.js 15)

Das Next.js-Frontend liefert die öffentlichen Seiten (Seminare, Shop, Checkout) der Wine Academy Hamburg und spricht ausschließlich die Public-Endpoints des Strapi-Backends an.

## Dokumentation & Referenzen
- Root-Übersicht: `../README.md`
- Backend-API: `../backend/README.md`
- Seeding/Reset: `../docs/Reset_and_filldb.md`
- Infrastruktur & Deploy: `../docs/server-infrastructure.md`

## Lokaler Start
```bash
docker compose -f ../docker-compose-staging.yml up -d web_wineacadamy_staging
# Logs
docker compose -f ../docker-compose-staging.yml logs -f web_wineacadamy_staging
```
Der Code ist bind-gemountet, `next dev` sorgt für Hot Reload.

## API-Basen & Konfiguration
- SSR (Server-Komponenten): `API_INTERNAL_URL=http://backend:1337`
- CSR (Browser): `NEXT_PUBLIC_API_URL=http://localhost:1337`
- Medien: `mediaUrl()` aus `lib/api.ts`; optional `NEXT_PUBLIC_ASSETS_URL`/`ASSETS_INTERNAL_URL`

Genutzte Public-Endpoints:
- `GET /api/public/seminare`
- `GET /api/public/seminare/:slug`
- `GET /api/public/produkte`
- `GET /api/public/gutscheine/template`
- `POST /api/public/gutscheine/pricing`
- `POST /api/public/bestellungen`
- `GET /api/public/bestellungen/:id`

## Seiten & Features
- `/` – Landing / Hero (Platzhalter)
- `/seminare` & `/seminare/[slug]` – Liste + Detail mit Terminwahl und „In den Warenkorb“ (Cart Sidebar)
- `/produkte` – Produktgrid (Shop-Artikel)
- `/gutschein` – Freier Gutscheinbetrag inkl. Validierung
- `/checkout` – Warenkorbzusammenfassung, Teilnehmerdaten, Rechnungsadresse, Zahlungsauswahl
- Globale Navigation mit `CartProvider` (Overlay-Sidebar)

## Warenkorb & Checkout
- Zustand liegt im `CartProvider` (`frontend/lib/cart-context.tsx`) und wird clientseitig persistiert.
- Seminare erzeugen pro Platz verpflichtende Teilnehmerfelder.
- Nach erfolgreichem `POST /api/public/bestellungen` wird die Bestätigungsansicht mit Bestellnummer angezeigt; Warenkorb wird geleert.

## PayPal (Sandbox)
- ENV: `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (Browser), optional `NEXT_PUBLIC_PAYPAL_CURRENCY` (`EUR`).
- PayPal-Buttons erscheinen nur bei gewählter Zahlungsmethode „PayPal“ und gültigen Pflichtfeldern (AGB/Datenschutz).
- Nach `actions.order.capture()` wird `POST /api/public/bestellungen` mit `paypalCaptureId`/`paypalOrderId` aufgerufen.
- Backend-Webhooks schließen offene Bestellungen automatisch ab (siehe Backend-README).

## Troubleshooting
- Frontend zeigt alte Inhalte → Hard Reload (Cmd/Ctrl+Shift+R) oder `docker compose ... up -d frontend`.
- SSR-Requests schlagen fehl → `API_INTERNAL_URL` prüfen (`backend` Container muss erreichbar sein).
- Bilder fehlen → Domain in `next.config.ts` ergänzen und `NEXT_PUBLIC_ASSETS_URL` setzen.
- PayPal-Buttons fehlen → Client-ID/ENV prüfen, ggf. Browser-Extensions deaktivieren.

## Hinweise für Agenten/KI
- Folge zusätzlich `../AGENTS.md`.
- Verwende ausschließlich die oben gelisteten Public-Endpoints.
- Passe Warenkorb-/Checkout-Logik nur mit Blick auf `lib/cart-context.tsx` und die Backend-Validierung an.
- Keine direkten Aufrufe interner Strapi-Services aus React-Komponenten.
