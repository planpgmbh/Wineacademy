# Entwicklungsplan Wine Academy

Ziel: Strapi- und Next.js-basierte Buchungs- und Commerce-Plattform für die Wine Academy Hamburg mit stabilen Checkout-Flows (Rechnung & PayPal), Gutscheinverwaltung und betriebssicherem Staging-/Produktivdeployment.

## Verweise & Zuständigkeiten
- README.md – Architekturüberblick, Compose-Kommandos und allgemeine Hinweise.
- backend/README.md – Content-Modelle, Public API, Bestell- und PayPal-Workflow.
- frontend/README.md – Next.js-Routen, Warenkorb-/Checkout-Logik, API-Verbrauch.
- AGENTS.md – Arbeitsregeln und Pflichtlektüre für Agenten/KI.
- docs/backend-arbeitsprotokoll.md – Laufende Backend-Arbeiten & Commit-Verweise.
- docs/server-infrastructure.md – Traefik-Setup, Domains, Deploy-Abläufe.
- docker-compose-staging.yml – Staging-Stack mit Strapi, Next.js und Postgres.
- tests/checkout-puppeteer.js – Puppeteer-E2E für Rechnung/PayPal.
- backend/src/index.ts – Seed-Logik für Demo-Inhalte (gesteuert über SEED_ON_BOOT).

## Getroffene Entscheidungen
- Tech-Stack: Strapi 5 (Node 20, Postgres 15) als Headless CMS + Next.js 15 (App Router) mit Tailwind 4.
- Frontend konsumiert ausschließlich `/api/public/*`-Endpoints; kein direkter Admin-Zugriff aus React-Komponenten.
- Deployment per Docker Compose; getrennte Stacks für Produktion und Staging hinter Traefik (Domains `main.wineacademy.de` / `staging.wineacademy.de`).
- Zahlungsarten: Rechnung als Default, PayPal via Capture + Webhook-Verifikation (Sandbox-Mode bis Go-Live).
- Gutscheine: Ein Template in Strapi, Codes werden nach erfolgreicher Bezahlung serverseitig generiert und Bestellungen zugeordnet.
- Newsletter-Opt-in wird im Kundenstamm (`api::kunde`) persistiert und bei Wiederbestellungen aktualisiert.
- Transaktionale E-Mails laufen über den eigenen SMTP-Mailserver; redaktionelle Inhalte/Layouts werden in Strapi-Templates gepflegt (Draft/Publish, Testversand möglich).
- Strapi hält zentrale Systemeinstellungen (Absenderadresse, Benachrichtigungs-Empfänger) für Kommunikation und Backoffice-Events vor.
- Sensible Credentials (API-Keys) liegen in ENV-Dateien; redaktionell pflegbare Werte (Absendernamen, Empfängerlisten) werden als Single-Type "Einstellungen" in Strapi verwaltet.
- Rechnungsstellung läuft über die SevDesk-API (API-Token), inkl. Kontakte-/Rechnungsanlage und Rückführung der PDFs in das System.
- Landingpages werden über Strapi-Dynamic-Zones gepflegt; Visual-Editing-Workflow (Vercel Preview → Strapi-Feld) ermöglicht redaktionelles Live-Editing.
- Externe APIs (z. B. SevDesk) werden vor Implementierung durch Tests/Prototypen verifiziert; Ergebnisse & Anforderungen werden dokumentiert, bevor produktiver Code entsteht.
- Forced-HTTPS-Middleware im Backend stellt korrekte Proxy-Header sicher (secure Cookies für Admin/REST).
- Seed-Daten (Seminare, Termine, Produkte, Gutscheine) werden über `SEED_ON_BOOT` gesteuert; keine automatischen Resets in Produktion.
- Tests: Puppeteer-Skript deckt Checkout (Rechnung & PayPal) gegen Staging-Domain ab.
- Infrastruktur-Umgebungen teilen sich ein externes `proxy`-Netzwerk; Postgres-Volumes getrennt nach Umgebung.

## Vorgehensweise & Arbeitsschritte

1. Basis & Infrastruktur
- [x] Docker-Compose für Prod/Staging mit getrennten Netzwerken, Volumes und Traefik-Labels.
- [x] `.env`-Templates für beide Umgebungen erstellt und dokumentiert.
- [x] HTTPS-Weiterleitung & Proxy-Konfiguration (force-https, Traefik-Router) umgesetzt.

- [x] Content-Types für Seminare, Termine, Standorte, Produkte, Gutscheine, Bestellungen, Buchungen, Kunden, Kategorien erstellt.
- [x] Single-Type "Einstellungen" (Kommunikation, Benachrichtigungen) implementiert.
- [x] Öffentliche Controller für Seminar-/Produktlisten, Seminardetail, Gutschein-Template/Pricing, Bestellungen (POST/GET) bereitgestellt.
- [x] PayPal-Webhooks verifizieren Signatur & Betrag; Gutscheincodes werden bei Zahlung generiert.
- [x] Benachrichtigungen (Bestellbestätigung, Zahlungsbestätigung, Rechnung/Gutschein, Backoffice) als Collection-Type mit Layout-/Platzhalter-Feldern aufgesetzt (`backend/src/api/benachrichtigung` + Component `benachrichtigung.platzhalter`).
- [x] Admin-Testversand & Dokumentation der verfügbaren Platzhalter in Strapi/Admin-Handbuch hinterlegt (`/admin/…/test-send`, Anleitung `docs/admin-benachrichtigungen.md`).
- [x] Endpoint-Dokumentation (OpenAPI/Markdown) für Partner & Frontend erweitert (`docs/api-public.md`).

3. E-Mail-Versand (SMTP)
- [x] Externen Maildienst entfernt und Strapi-Mailservice auf SMTP (eigener Mailserver) umgestellt.
- [ ] Variante bewerten: zentraler Mail-Service (API) vs. Direktversand im Backend für Mehrprojekt-Nutzung.
- [ ] SMTP-Konfiguration für Staging/Prod abstimmen (Host, Auth, TLS-Anforderungen) und dokumentieren.

4. SevDesk API-Discovery & Dokumentation
- [x] SevDesk-Spezifikation (Auth, Limits, relevante Endpoints, Datenfelder) analysieren und offene Fragen sammeln.
- [x] Authentifizierung & einfache GET-Requests (z. B. `/contacts`) mit gültigem Token prüfen.
- [x] Erstellung/Update von Privat- und Firmenkontakten samt Dublettenprüfung testen.
- [ ] Anlage einer Rechnung über `/vouchers/invoices` inkl. Positionen, Steuerlogik und Zahlungsziel validieren.
- [ ] Abruf des generierten PDF-Belegs (`/vouchers/invoices/{id}/document`) und Ablage im Filesystem nachvollziehen.
- [ ] Statusabfragen & Zahlungsmarkierung (z. B. `bookingCategory=payment`) oder Storno simulieren, Fehlercodes dokumentieren.
- [x] Storno-Event in SevDesk testen (Stornobeleg, Status-Abgleich).
- [x] Gutscheinrabatte auf SevDesk-Rechnungen verteilen (Sync aktuell ohne Gutscheinpositionen).
- [x] Ergebnisse als Implementierungsleitfaden in `docs/sevdesk.md` dokumentieren (Workflows, Payload-Mapping, Fehlerszenarien).

5. Frontend Grundgerüst
- [x] App Router auf Minimalzustand zurückgesetzt (Tailwind-Defaults, leeres Layout & Page).
- [ ] Brand-Tokens (Farben, Typo, Spacing, Radii) mit Figma-MCP synchronisieren und als Tailwind-Preset erfassen.
- [ ] Navigations- und Footer-Komponenten anhand des neuen Designs rekreieren.
- [ ] Landingpage/Home nach Figma neu aufbauen (Hero, Content-Sektionen, CTA).
- [ ] CMS-Anbindung für Navigation/Footer/Landingpages nach Struktur-Reset wieder integrieren.

6. Warenkorb & Checkout
- [x] Clientseitige Warenkorbverwaltung inkl. Teilnehmerdaten (LocalStorage) umgesetzt.
- [x] Checkout validiert Rechnungs-/Teilnehmerdaten, AGB/Datenschutz und erzeugt Bestellungen.
- [x] PayPal-Buttons mit SDK-Lazy-Load, Validation-Hooks und Capture-Handling integriert.
- [ ] Firmen-Validierungen (z. B. USt-Id-Format, Pflichtfelder) und Fehlertexte nachschärfen.
- [x] SMTP-Mailservice inkl. ENV (`SMTP_*`, `EMAIL_*`) und Logging im Backend verdrahten (Toggle `EMAIL_TRANSPORT_ENABLED` berücksichtigt).
- [x] Versand-Toggle (`EMAIL_TRANSPORT_ENABLED`) über ENV eingeführt und dokumentiert (Staging `.env` aktualisiert).
- [x] Bestellbestätigung nach Checkout mit Template-Renderer auslösen (Kund:innen-Mail).
- [x] Zahlungsbestätigung & Versand von Rechnung/Gutscheinen nach Zahlungseingang (PayPal-Webhook, Rechnungsverbuchung).
- [x] Storno-Event bei Statuswechsel auf `storniert` auslösen (Mail & Stornobeleg vorbereiten).
- [x] Interne Benachrichtigung bei neuen Bestellungen an definierte Backoffice-Empfänger:innen senden.
- [x] SevDesk-API-Client (Token-Auth) im Backend kapseln und Bestell-Payload für Rechnungsanlage vorbereiten.
- [x] SevDesk-Sync-Toggle (`SEVDESK_SYNC_ENABLED`) über ENV eingeführt und dokumentiert (Staging `.env` aktualisiert).

7. Backoffice & Automatisierung
- [x] Kundenverknüpfung/Newsletter-Opt-in beim Bestell-Write-Through im Backend umgesetzt.
- [x] SevDesk-Anbindung vervollständigen (ENV `SEVDESK_API_TOKEN`, Sandbox/Prod-Konfiguration, Secrets-Handling) gemäß `docs/sevdesk.md`.
- [x] Kontakte (Privat/Firma) aus Bestelldaten in SevDesk synchronisieren bzw. wiederverwenden.
- [ ] Rechnungen/Belege via `vouchers/invoices` erzeugen, PDF abrufen und in Strapi/Storage verlinken.
- [x] Strapi-Systemeinstellungen für Absenderadresse und Antwort-E-Mail dokumentieren und im Admin pflegen (Single-Type "Einstellungen").
- [x] ENV-Fallbacks für sensible Mail-Credentials (z. B. API-Key, Default-Absender) dokumentieren und in allen Umgebungen pflegen.
- [x] Benachrichtigungs-Empfänger (z. B. "Neue Bestellung") in Strapi konfigurierbar machen und dokumentieren.
- [ ] Webhook- oder Polling-Strategie für Zahlungsstatus/Storno etablieren und Fehler-Retry dokumentieren.
- [x] Storno-Benachrichtigungen (Mail, Stornobeleg) über zentrales Event bei Statuswechsel auf `storniert` auslösen.
- [ ] Strapi-Admin konfigurieren (Collection-Ansichten, Rollen/Rechte, Default-Filter).
- [ ] Prozess-Doku für Inhalte/Termine (inkl. Media-Upload) erstellen.

8. Testing & Qualitätssicherung
- [x] Puppeteer-End-to-End-Testskript für Rechnung & PayPal vorhanden.
- [ ] CI-Integration des Puppeteer-Skripts (z. B. GitHub Actions mit Secrets) aufsetzen.
- [ ] Backend-Integrationstests für `bestellung`/`gutschein`-Flows hinzufügen.
- [ ] Frontend-Lint/Format-Setup (ESLint, Prettier/Tailwind) und Konsistenz-Checks aktivieren.

9. Deployment & Monitoring
- [x] Traefik-Routing (Host + PathPrefix) für API, Admin & Uploads definiert.
- [ ] Automatisierte Build/Deploy-Pipeline etablieren (Branch → Staging → Prod).
- [ ] Monitoring/Alerting (Container-Health, PayPal-Webhook-Fehler, Strapi-Logs) konfigurieren.
- [ ] Uptime/Smoke-Checks (curl/Playwright) nach Deploys automatisieren.

10. Content & Marketing Enablement
- [ ] Finales Content-Set (Texte, Bilder, Terminlisten) in Strapi pflegen.
- [ ] Tracking/Analytics (Matomo/GTM) definieren und technisch integrieren.
- [ ] Newsletter-/CRM-Flows (Double-Opt-in, Segmentierung) klären und implementieren.
- [ ] Dokumentation zur Datenpflege & Kampagnenplanung abstimmen.

## Abnahmekriterien (MVP)
- Öffentliche Endpunkte liefern veröffentlichte Seminare, Produkte und Gutschein-Konfiguration konsistent für SSR/CSR.
- Checkout erstellt Bestellungen mit korrekten Summen, Teilnehmern, Newsletter-Opt-ins und (bei PayPal) verifizierten Captures.
- Bezahlt markierte Orders erzeugen Gutscheincodes und stellen sie über `/public/bestellungen/:id` bereit.
- Puppeteer-End-to-End-Szenarien für Rechnung und PayPal laufen gegen Staging erfolgreich durch.
- Staging-/Produktiv-Stacks sind über Traefik erreichbar; Deploy-Anleitung und Fehlerbehandlung sind dokumentiert.

## Arbeitsprotokolle
Die laufenden Arbeitsnotizen liegen im Backend-Protokoll `docs/backend-arbeitsprotokoll.md`.
