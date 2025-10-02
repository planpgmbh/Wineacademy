# Entwicklungsplan Wine Academy

Ziel: Strapi- und Next.js-basierte Buchungs- und Commerce-Plattform für die Wine Academy Hamburg mit stabilen Checkout-Flows (Rechnung & PayPal), Gutscheinverwaltung und betriebssicherem Staging-/Produktivdeployment.

## Verweise & Zuständigkeiten
- README.md – Architekturüberblick, Compose-Kommandos und allgemeine Hinweise.
- backend/README.md – Content-Modelle, Public API, Bestell- und PayPal-Workflow.
- frontend/README.md – Next.js-Routen, Warenkorb-/Checkout-Logik, API-Verbrauch.
- AGENTS.md – Arbeitsregeln und Pflichtlektüre für Agenten/KI.
- docs/server-infrastructure.md – Traefik-Setup, Domains, Deploy-Abläufe.
- docker-compose-staging.yml – Staging-Stack mit Strapi, Next.js und Postgres.
- tests/checkout-puppeteer.js – Puppeteer-E2E für Rechnung/PayPal.
- backend/src/index.ts – Seed-Logik für Demo-Inhalte (gesteuert über SEED_ON_BOOT).

## Getroffene Entscheidungen
- Tech-Stack: Strapi 5 (Node 20, Postgres 15) als Headless CMS + Next.js 15 (App Router) mit Tailwind 4.
- Frontend konsumiert ausschließlich `/api/public/*`-Endpoints; kein direkter Admin-Zugriff aus React-Komponenten.
- Deployment per Docker Compose; getrennte Stacks für Produktion und Staging hinter Traefik (Domains `wineacademymain.plan-p.de` / `wineacademy.plan-p.de`).
- Zahlungsarten: Rechnung als Default, PayPal via Capture + Webhook-Verifikation (Sandbox-Mode bis Go-Live).
- Gutscheine: Ein Template in Strapi, Codes werden nach erfolgreicher Bezahlung serverseitig generiert und Bestellungen zugeordnet.
- Newsletter-Opt-in wird im Kundenstamm (`api::kunde`) persistiert und bei Wiederbestellungen aktualisiert.
- SendGrid versendet transaktionale E-Mails; redaktionelle Inhalte/Layouts werden in Strapi-Templates gepflegt (Draft/Publish, Testversand möglich).
- Rechnungsstellung läuft über die LexOffice-API (API-Token), inkl. Kontakte-/Rechnungsanlage und Rückführung der PDFs in das System.
- Landingpages werden über Strapi-Dynamic-Zones gepflegt; Visual-Editing-Workflow (Vercel Preview → Strapi-Feld) ermöglicht redaktionelles Live-Editing.
- Externe APIs (z. B. SendGrid, LexOffice) werden vor Implementierung durch Tests/Prototypen verifiziert; Ergebnisse & Anforderungen werden dokumentiert, bevor produktiver Code entsteht.
- Forced-HTTPS-Middleware im Backend stellt korrekte Proxy-Header sicher (secure Cookies für Admin/REST).
- Seed-Daten (Seminare, Termine, Produkte, Gutscheine) werden über `SEED_ON_BOOT` gesteuert; keine automatischen Resets in Produktion.
- Tests: Puppeteer-Skript deckt Checkout (Rechnung & PayPal) gegen Staging-Domain ab.
- Infrastruktur-Umgebungen teilen sich ein externes `proxy`-Netzwerk; Postgres-Volumes getrennt nach Umgebung.

## Vorgehensweise & Arbeitsschritte

1. Basis & Infrastruktur
- [x] Docker-Compose für Prod/Staging mit getrennten Netzwerken, Volumes und Traefik-Labels.
- [x] `.env`-Templates für beide Umgebungen erstellt und dokumentiert.
- [x] HTTPS-Weiterleitung & Proxy-Konfiguration (force-https, Traefik-Router) umgesetzt.
- [ ] Automatisierten Backup-Plan (DB + Uploads) inklusive Dokumentation ausarbeiten.

2. Content-Model & Public API (Strapi)
- [x] Content-Types für Seminare, Termine, Standorte, Produkte, Gutscheine, Bestellungen, Buchungen, Kunden, Kategorien erstellt.
- [x] Öffentliche Controller für Seminar-/Produktlisten, Seminardetail, Gutschein-Template/Pricing, Bestellungen (POST/GET) bereitgestellt.
- [x] PayPal-Webhooks verifizieren Signatur & Betrag; Gutscheincodes werden bei Zahlung generiert.
- [ ] Benachrichtigungs-Templates (Bestellbestätigung, Zahlungsbestätigung, Rechnung/Gutschein, Backoffice) als Collection-Type mit Layout-/Token-Feldern aufsetzen.
- [ ] Admin-Testversand & Dokumentation der verfügbaren Platzhalter in Strapi/Admin-Handbuch hinterlegen.
- [ ] Endpoint-Dokumentation (OpenAPI/Markdown) für Partner & Frontend erweitern.

3. SendGrid API-Discovery & Dokumentation
- [ ] SendGrid-Spezifikation (Auth, Limits, relevante Endpoints) analysieren und offene Fragen sammeln.
- [ ] Transaktionale E-Mail über `/mail/send` mit Sandbox/Suppressions testen (erfolgreiche Response, Zustellung prüfen).
- [ ] Versand mit Template-Data (Dynamic Templates) und Fehlerfall (ungültiger API-Key/Empfänger) verifizieren.
- [ ] Ergebnisse als Implementierungsleitfaden in `docs/sendgrid.md` dokumentieren (Workflows, Payload-Mapping, Fehlerszenarien).

4. LexOffice API-Discovery & Dokumentation
- [ ] LexOffice-Spezifikation (Auth, Limits, relevante Endpoints, Datenfelder) analysieren und offene Fragen sammeln.
- [ ] Authentifizierung & einfache GET-Requests (z. B. `/contacts`) mit gültigem Token prüfen.
- [ ] Erstellung/Update von Privat- und Firmenkontakten samt Dublettenprüfung testen.
- [ ] Anlage einer Rechnung über `/vouchers/invoices` inkl. Positionen, Steuerlogik und Zahlungsziel validieren.
- [ ] Abruf des generierten PDF-Belegs (`/vouchers/invoices/{id}/document`) und Ablage im Filesystem nachvollziehen.
- [ ] Statusabfragen & Zahlungsmarkierung (z. B. `bookingCategory=payment`) oder Storno simulieren, Fehlercodes dokumentieren.
- [ ] Ergebnisse als Implementierungsleitfaden in `docs/lexoffice.md` dokumentieren (Workflows, Payload-Mapping, Fehlerszenarien).

5. Frontend Grundgerüst
- [x] App Router mit Navigation, CartProvider und CartSidebar implementiert.
- [x] Seiten für Seminare (Liste/Detail mit Terminwahl), Produkte und Gutscheinbetrag aufgebaut.
- [ ] Landingpage/Home austauschen (zzt. Next.js-Placeholder) inklusive Markenauftritt & CTA.
- [ ] Footer, SEO-Metadaten und rechtliche Seiten (Impressum/Datenschutz) ergänzen.
- [ ] Landingpages via Dynamic-Zone-Komponentenbibliothek modellieren; Visual-Editing-Preview (Vercel → Strapi Edit-Link) implementieren (Backlog).

6. Warenkorb & Checkout
- [x] Clientseitige Warenkorbverwaltung inkl. Teilnehmerdaten (LocalStorage) umgesetzt.
- [x] Checkout validiert Rechnungs-/Teilnehmerdaten, AGB/Datenschutz und erzeugt Bestellungen.
- [x] PayPal-Buttons mit SDK-Lazy-Load, Validation-Hooks und Capture-Handling integriert.
- [ ] Firmen-Validierungen (z. B. USt-Id-Format, Pflichtfelder) und Fehlertexte nachschärfen.
- [ ] SendGrid-Service inkl. ENV (`SENDGRID_API_KEY`, Absenderdaten) und Logging im Backend verdrahten (gemäß `docs/sendgrid.md`).
- [ ] Versand-Toggle (`EMAIL_TRANSPORT_ENABLED` o. ä.) über ENV einführen und in allen Umgebungen dokumentieren.
- [ ] Bestellbestätigung nach Checkout mit Template-Renderer auslösen (Kund:innen-Mail).
- [ ] Zahlungsbestätigung & Versand von Rechnung/Gutscheinen nach Zahlungseingang (PayPal-Webhook, Rechnungsverbuchung).
- [ ] Interne Benachrichtigung bei neuen Bestellungen an definierte Backoffice-Empfänger:innen senden.
- [ ] LexOffice-API-Client (Token-Auth) im Backend kapseln und Bestell-Payload für Rechnungsanlage vorbereiten.

7. Backoffice & Automatisierung
- [x] Kundenverknüpfung/Newsletter-Opt-in beim Bestell-Write-Through im Backend umgesetzt.
- [ ] LexOffice-Anbindung vervollständigen (ENV `LEXOFFICE_API_TOKEN`, Sandbox/Prod-Konfiguration, Secrets-Handling) gemäß `docs/lexoffice.md`.
- [ ] Kontakte (Privat/Firma) aus Bestelldaten in LexOffice synchronisieren bzw. wiederverwenden.
- [ ] Rechnungen/Belege via `vouchers/invoices` erzeugen, PDF abrufen und in Strapi/Storage verlinken.
- [ ] Webhook- oder Polling-Strategie für Zahlungsstatus/Storno etablieren und Fehler-Retry dokumentieren.
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

## Arbeitsprotokoll
- 2025-10-02 – Entwicklungsplan erstellt, bisherige Architektur erfasst und nächste Arbeitsschritte priorisiert. – Commit: n/a
- 2025-10-02 – SendGrid-E-Mail-Konzept abgestimmt; Template-Struktur und Umsetzungsschritte im Plan ergänzt. – Commit: n/a
- 2025-10-02 – LexOffice-API recherchiert und Integrationsschritte (Kontakt-/Rechnungsanlage, PDFs, Status-Rücklauf) in den Plan aufgenommen. – Commit: n/a
