# Frontend (Next.js 15)

Das Next.js-Frontend stellt die öffentliche Website der Wine Academy Hamburg bereit: Seminare, Produktshop, Gutschein-Flow, Warenkorb und Checkout (Rechnung & PayPal). Es konsumiert ausschließlich die Public-Endpoints des Strapi-Backends.

## Setup & ENV
- **Framework:** Next.js 15 (App Router) mit React 19 und Tailwind 4.
- **Server vs. Client:** SSR-Aufrufe nutzen `API_INTERNAL_URL` (Container-Netz), CSR-Aufrufe `NEXT_PUBLIC_API_URL`.
- **Relevante Variablen:**
  - `NEXT_PUBLIC_API_URL` – Öffentliche Basis inkl. `/api` (z. B. `https://wineacademy.plan-p.de/api`).
  - `API_INTERNAL_URL` – Interne Basis ohne Traefik (z. B. `http://backend:1337`).
  - `NEXT_PUBLIC_ASSETS_URL` / `ASSETS_INTERNAL_URL` – Medienbasis ohne `/api`.
  - `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, optional `NEXT_PUBLIC_PAYPAL_CURRENCY`.
  - Entwicklungsdefaults in `.env.example`, Staging-Werte in `.env.staging.example`.

## Struktur & Verantwortlichkeiten
- `app/` – App Router-Routen (`page.tsx`, `layout.tsx`, dynamische Seminarseiten, Checkout etc.).
- `components/` – Wiederverwendbare UI-Bausteine (Cart, PayPal, Gutscheinformular).
- `lib/` – API-Wrapper (`api.ts`), Cart-Context, Utilities.
- `public/` – Statische Ressourcen.
- `styles`/`globals.css` – Tailwind-Konfiguration.

## API-Nutzung
Alle Datenabrufe laufen über `lib/api.ts`:
- `SERVER_BASE`/`CLIENT_BASE` trennen SSR/CSR.
- `fetchJSON` setzt `next.revalidate=30` für SSR.
- `mediaUrl()` liefert korrekte Medienpfade (interne vs. öffentliche Basis).

## Seiten & Flows
- `/` – Landingpage (derzeit Next.js-Placeholder; für Go-Live ersetzen).
- `/seminare` & `/seminare/[slug]` – Seminarliste, Detail mit Terminwahl (`BookingSidebar`).
- `/produkte` – Produktgrid (`ProductGrid`).
- `/gutschein` – Freier Gutscheinbetrag (`GutscheinForm`).
- `/checkout` – Checkout (`CheckoutClient`), erzeugt Payload entsprechend Backend-README.
- Globale Navigation + Warenkorb: `layout.tsx`, `CartProvider`, `CartSidebar`, `CartToggle`.

## Warenkorb & Checkout
- Zustand in `CartProvider` (LocalStorage-Persistenz); Seminare erzwingen Teilnehmerfelder.
- `CheckoutClient` validiert Rechnungs-/Teilnehmerdaten, AGB/Datenschutz, Newsletter-Opt-in.
- Bestellung wird via `postBestellung()` an `/api/public/bestellungen` geschickt.
- PayPal: `components/payments/PayPalButtons.tsx` lädt SDK on-demand, prüft Validierung und meldet `captureId`/`orderId` zurück.
- Erfolgreiche Bestellungen leeren den Warenkorb und zeigen Bestellnummer an.

## Entwicklung & Qualitätssicherung
- **Start/Staging:** `docker compose -f docker-compose-staging.yml up -d web_wineacadamy_staging`.
- **Tests:** Puppeteer-Checkout (`node tests/checkout-puppeteer.js`) deckt Invoice/PayPal ab.
- **Linting:** `npm run lint` (ESLint + Next.js-Konfiguration).
- **Styling:** Tailwind 4; bestehende Utility-Nutzung übernehmen, keine manuellen Reset-Overwrites.
- **PayPal Sandbox:** Für lokale Tests `NEXT_PUBLIC_PAYPAL_CLIENT_ID` setzen und Checkout gegen Staging-Backend laufen lassen.

## Weiterführende Ressourcen
- Root-README für Gesamtüberblick & Compose-Kommandos.
- `backend/README.md` für Payload-Details und Public-API-Spezifikation.
- `docs/entwicklungsplan.md` für offene Frontend-Aufgaben (Landingpage, SEO etc.).
