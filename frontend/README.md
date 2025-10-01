# Frontend (Next.js 15)

Das Next.js-Frontend liefert die öffentlichen Seiten (Seminare, Shop, Checkout) der Wine Academy Hamburg und spricht ausschließlich die Public-Endpoints des Strapi-Backends an.

## API-Basen & Konfiguration
- SSR (Server-Komponenten): `API_INTERNAL_URL=http://backend:1337`
- CSR (Browser): `NEXT_PUBLIC_API_URL=http://localhost:1337`
- Medien: `mediaUrl()` aus `lib/api.ts`; optional `NEXT_PUBLIC_ASSETS_URL`/`ASSETS_INTERNAL_URL`

`lib/api.ts` kapselt die Trennung zwischen Server- und Browser-Aufrufen (`fetchJSON` setzt `next.revalidate=30`) und nutzt interne bzw. öffentliche Basen samt Medien-URLs. Neue Requests sollten darauf aufsetzen, damit SSR (Container-Netz) und CSR (Browser) konsistent bleiben.

## Ordner & Verantwortlichkeiten
- `app/*` – Routen im App Router (Server-Komponenten + ggf. Client-Komponenten, z. B. `app/seminare/page.tsx`).
- `components/*` – wiederverwendbare UI-Bausteine, Checkout-Formulare, PayPal-Buttons.
- `lib/*` – API-Layer (`api.ts`), State/Hooks (`cart-context.tsx`) und Hilfsfunktionen.
- `public/*` – statische Assets (Icons, Logos, Fonts).

## Staging-Stack
- Frontend immer über `docker compose -f docker-compose-staging.yml up -d web_wineacadamy_staging` neu starten (Logs/Restart-Kommandos siehe Root-README).
- Bei lokalen Anpassungen `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_ASSETS_URL` in `.env.staging.local` setzen, damit Browser-Aufrufe die Staging-Domain nutzen.

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
- `CheckoutClient` (`app/checkout/CheckoutClient.tsx`) mappt Warenkorb + Teilnehmer auf das Payload aus `backend/README.md` (Positionen + Buchungen) und validiert alle Pflichtfelder.
- Nach erfolgreichem `POST /api/public/bestellungen` wird die Bestätigungsansicht mit Bestellnummer angezeigt; Warenkorb wird geleert.

## PayPal (Sandbox)
- ENV: `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (Browser), optional `NEXT_PUBLIC_PAYPAL_CURRENCY` (`EUR`).
- PayPal-Buttons erscheinen nur bei gewählter Zahlungsmethode „PayPal“ und gültigen Pflichtfeldern (AGB/Datenschutz).
- Nach `actions.order.capture()` wird `POST /api/public/bestellungen` mit `paypalCaptureId`/`paypalOrderId` aufgerufen.
- Backend-Webhooks schließen offene Bestellungen automatisch ab (siehe Backend-README).

## Troubleshooting
- Frontend zeigt alte Inhalte → Hard Reload (Cmd/Ctrl+Shift+R) oder `docker compose -f docker-compose-staging.yml up -d web_wineacadamy_staging`.
- SSR-Requests schlagen fehl → `API_INTERNAL_URL` prüfen (`backend` Container muss erreichbar sein).
- Bilder fehlen → Domain in `next.config.ts` ergänzen und `NEXT_PUBLIC_ASSETS_URL` setzen.

## Hinweise für Agenten/KI
- Verwende ausschließlich die oben gelisteten Public-Endpoints.
- Passe Warenkorb-/Checkout-Logik nur mit Blick auf `lib/cart-context.tsx` und die Backend-Validierung an.
- Keine direkten Aufrufe interner Strapi-Services aus React-Komponenten.
