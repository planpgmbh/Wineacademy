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
- **Lokale Sichtprüfung:** In der lokalen Umgebung nach jeder Frontend-Änderung die betroffene Seite mit `open http://localhost:3000` (oder spezifischer Route) im Browser öffnen, um das Ergebnis zu kontrollieren.
- **Build & Sichtprüfung:** Nach jeder Frontend-Änderung das Staging-Frontend via `docker compose -f docker-compose-staging.yml up -d --build web_wineacadamy_staging` neu deployen und danach automatisch ein Browserfenster mit der aktualisierten Seite öffnen, um die sichtbare Änderung zu bestätigen.

## Arbeitsrichtlinien für KI-Agenten (Frontend & Figma)

1) Allgemeines Verhalten
- Ziel: Frontend bildet das Figma-Design 1:1 ab — keine visuellen Eigeninterpretationen.
- Quellenwahrheit: Figma ist single source of truth. Code richtet sich nach Figma, niemals umgekehrt.
- Abweichungen: Zuerst dokumentieren, nicht eigenmächtig korrigieren — außer nach explizitem „go“.
- Keine Annahmen: Vor Änderungen prüfen, ob der Frame eindeutig ist und ob ein Component-Set/Varianten existieren.

2) Figma-Agent (MCP)
- Über MCP oder Figma-API mit der im Ticket genannten Datei (File-Key & Node-ID) verbinden.
- Komponente/Variante verifizieren (veröffentlicht?).
- Offizielle Screenshots relevanter Frames (z. B. `cart_slideout_new`) nach `/artifacts/` exportieren.
- Layout-Eigenschaften wie `padding`, `itemSpacing`, `autoLayout`, `fontSize`, `lineHeight`, `cornerRadius` auslesen.

3) Frontend-Agent (Codex)
- Ausschließlich Figma-Werte (Abstände, Typografie, Farben, Radii, Icon-Maße) übernehmen.
- Keine „Optimierungen“ vornehmen (z. B. geänderte Paddings, andere Fontgrößen, zusätzliche Effekte).
- Strukturelle Anpassungen strikt nach Figma-Aufbau umsetzen (Container-Verschachtelung, Auto-Layout-Logik).

4) Puppeteer-Agent (Visueller Vergleich)
- Screenshot der laufenden Instanz (`http://localhost:3000` oder konfigurierte URL) erzeugen.
- Mit dem Figma-Export per Pixel-Diff vergleichen (Grund-Toleranz 2 %; dynamische Inhalte vorher neutralisieren/Mocken).
- Folgende Dateien speichern: `/artifacts/local.png`, `/artifacts/figma.png`, `/artifacts/overlay.png`, `/artifacts/diff.png`.

6) Standard-Prozess (DoR → DoD)
- Figma-Abgleich (MCP): Frame verifizieren, Screenshot und `/tmp/figma.json` erstellen.
- Implementierung (Codex): Änderungen strikt nach Figma umsetzen.
- Visueller Vergleich (Puppeteer): Screenshots und Pixel-Diff generieren.

7) Stil-Grundsätze
- Figma first. Keine Abweichungen ohne explizite Freigabe.
- Schriftgrößen, Gewichte, Spacings, Farben, Radii sowie Icon-Maße exakt übernehmen.

## Figma MCP in der Frontend-Entwicklung nutzen
Der Model Context Protocol (MCP) Server von Figma liefert KI-Assistenten die passenden Layout-Daten für die Implementierung. Für lokale Arbeiten sind die benötigten Figma-Creds bereits in `.env.local` hinterlegt:

- `FIGMA_ACCESS_TOKEN` – persönlicher Figma-Zugriffstoken (Scope `files:read` genügt).
- `FIGMA_FILE_KEY` – Schlüssel der Design-Datei, aus der Frames gelesen werden.

### Verbindung herstellen

1. **Figma Desktop (lokaler MCP-Server):**
- Der Server läuft anschließend unter `http://127.0.0.1:3845/mcp`.

2. **Gehosteter MCP-Server:** Direkt nutzbar über `https://mcp.figma.com/mcp`. Funktioniert ohne lokale Desktop-App, benötigt aber eine aktive Internetverbindung.

3. **Client anbinden:** In VS Code (Copilot Chat), Cursor oder Claude Code jeweils einen HTTP-MCP-Server hinzufügen. Beispiel für VS Code (`mcp.json`):

```json
{
"servers": {
"figma": {
"type": "http",
"url": "https://mcp.figma.com/mcp"
},
"figma-desktop": {
"type": "http",
"url": "http://127.0.0.1:3845/mcp"
}
}
}

```

### Tokens im Agent verfügbar machen
Damit Agenten die Figma-Datei direkt ansprechen können, die beiden ENV-Variablen in der jeweiligen Tool-Konfiguration referenzieren (z. B. bei Cursor unter *Settings → MCP → Add new global MCP server* als „Custom Headers“ oder „Auth Token“ eintragen). Die Werte bleiben in `.env.local` und werden nicht eingecheckt.

### Verbindung prüfen
```bash
cd frontend
curl -s -H "X-Figma-Token: $FIGMA_ACCESS_TOKEN" \
"https://api.figma.com/v1/files/$FIGMA_FILE_KEY/nodes?ids=0:1" | jq '.'
```
Bei gültiger Konfiguration liefert der Aufruf Metadaten zum Root-Frame. Fehlermeldungen deuten meist auf einen abgelaufenen Access-Token oder eine falsche `FIGMA_FILE_KEY` hin.

### Tip: MCP-Tools im Chat testen
Nach erfolgreicher Anbindung sollten Kommandos wie `#get_code`, `#get_metadata` oder `#get_variable_defs` im jeweiligen Agenten verfügbar sein. Falls die Tools nicht erscheinen, Figma Desktop und den IDE-Agent neu starten.

## Weiterführende Ressourcen
- Root-README für Gesamtüberblick & Compose-Kommandos.
- `backend/README.md` für Payload-Details und Public-API-Spezifikation.
- `docs/entwicklungsplan.md` für Roadmap & Entscheidungen, `docs/frontend-arbeitsprotokoll.md` für offene Frontend-Aufgaben (Landingpage, SEO etc.).
