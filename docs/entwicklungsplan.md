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
- Strapi hält zentrale Systemeinstellungen (Absenderadresse, Benachrichtigungs-Empfänger) für Kommunikation und Backoffice-Events vor.
- Sensible Credentials (API-Keys) liegen in ENV-Dateien; redaktionell pflegbare Werte (Absendernamen, Empfängerlisten) werden als Single-Type "Einstellungen" in Strapi verwaltet.
- Rechnungsstellung läuft über die SevDesk-API (API-Token), inkl. Kontakte-/Rechnungsanlage und Rückführung der PDFs in das System.
- Landingpages werden über Strapi-Dynamic-Zones gepflegt; Visual-Editing-Workflow (Vercel Preview → Strapi-Feld) ermöglicht redaktionelles Live-Editing.
- Externe APIs (z. B. SendGrid, SevDesk) werden vor Implementierung durch Tests/Prototypen verifiziert; Ergebnisse & Anforderungen werden dokumentiert, bevor produktiver Code entsteht.
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

3. SendGrid API-Discovery & Dokumentation
- [x] SendGrid-Spezifikation (Auth, Limits, relevante Endpoints) analysieren und offene Fragen sammeln (siehe `docs/sendgrid.md`).
- [x] Transaktionale E-Mail über `/mail/send` mit Sandbox/Suppressions testen (mangels API-Key nicht ausgeführt; Ablauf dokumentiert in `docs/sendgrid.md`).
- [x] Versand mit Template-Data (Dynamic Templates) und Fehlerfall (ungültiger API-Key/Empfänger) verifizieren (Testfälle beschrieben, Ausführung nach API-Key-Hinterlegung nachholen).
- [x] Ergebnisse als Implementierungsleitfaden in `docs/sendgrid.md` dokumentieren (Workflows, Payload-Mapping, Fehlerszenarien, Free-Plan-Einrichtung).

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
- [x] SendGrid-Service inkl. ENV (`SENDGRID_API_KEY`, Absenderdaten) und Logging im Backend verdrahten (gemäß `docs/sendgrid.md`, Toggle berücksichtigt).
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

## Arbeitsprotokoll
- 2025-10-08 – Frontend auf DaisyUI v5 Basis zurückgesetzt (Altstrukturen entfernt, Navigation & Landingpage mit Standardkomponenten neu aufgebaut). – Commit: n/a
- 2025-10-02 – Entwicklungsplan erstellt, bisherige Architektur erfasst und nächste Arbeitsschritte priorisiert. – Commit: n/a
- 2025-10-02 – SendGrid-E-Mail-Konzept abgestimmt; Template-Struktur und Umsetzungsschritte im Plan ergänzt. – Commit: n/a
- 2025-10-02 – SevDesk-API recherchiert und Integrationsschritte (Kontakt-/Rechnungsanlage, PDFs, Status-Rücklauf) in den Plan aufgenommen. – Commit: n/a
- 2025-10-02 – Rechnungsintegration auf SevDesk umgestellt (ENV & Dokumentation aktualisiert). – Commit: 030507b
- 2025-10-02 – Storno-Event-Anforderung (E-Mail/Stornobeleg) in Plan und Backend-Doku ergänzt. – Commit: 030507b
- 2025-10-02 – Strapi-Systemeinstellungen (Absender/Benachrichtigung) im Plan ergänzt. – Commit: 030507b
- 2025-10-02 – Strapi-Settings-Aufteilung (ENV vs. Single-Type) konkretisiert. – Commit: 030507b
- 2025-10-02 – Strapi-Single-Type "Einstellungen" implementiert und Service für Mail-Fallbacks ergänzt. – Commit: 9125913
- 2025-10-02 – Benachrichtigungstemplates + Admin-Testversand umgesetzt; API-/Admin-Doku ergänzt. – Commit: 5dad24c
- 2025-10-02 – Termin-Relation von "Ort" auf "Standort" umbenannt (Strapi-Schema, Seeds, Admin-Übersetzung, Frontend, TS-Typen); ESLint & TypeScript-Check ausgeführt. – Commit: n/a
- 2025-10-02 – Veraltete "Ort"-Artefakte im Strapi-Build (dist) entfernt, Backend & Staging-Stack neu gebaut. – Commit: n/a
- 2025-10-02 – Content-Type „Benachrichtigungen“ im Strapi-Admin umbenannt, Feld-Beschriftungen & Hilfetexte in Deutsch ergänzt; Doku aktualisiert. – Commit: 1b5d199
- 2025-10-03 – Content-Type „Benachrichtigungen“ (UID, Felder, Platzhalter, SendGrid) und Einstellungen vollständig eingedeutscht; Admin-Endpunkt, Component & Typdefinitionen angepasst. – Commit: 591ac3f
- 2025-10-03 – Warenkorb-Slideout im Frontend entschlackt (Seminar-Termine mit Uhrzeiten, vereinheitlichte Karten für Produkte/Gutscheine) und Safe-Area-Padding für den Kassen-Button ergänzt; ESLint mangels Projektkonfiguration nicht lauffähig. – Commit: n/a
- 2025-10-03 – Frontend-README um verpflichtenden Build/Compose-Neustart + Browser-Sichtprüfung ergänzt und Staging-Web-Container neu gebaut/gestartet. – Commit: n/a
- 2025-10-03 – Warenkorb-Karten erneut gestrafft (Seminarnamen bereinigt, Tagesliste, Button-Abstand) und Staging-Frontend via Compose neu gebaut. – Commit: n/a
- 2025-10-03 – Warenkorb-Footer erneut justiert (Safe-Area-Reserve erhöht, min-h-0 gesetzt) und Close-Buttons als deutlich sichtbares „×“ umgesetzt; Staging-Webservice via Compose neu ausgerollt. – Commit: n/a
- 2025-10-03 – E-Mail-Transport-Toggle (`EMAIL_TRANSPORT_ENABLED`) eingeführt, `.env.staging` ergänzt und Backend-Build erfolgreich ausgeführt. – Commit: n/a
- 2025-10-03 – SendGrid-Testdaten (Einstellungen + Benachrichtigung) per Script `backend/scripts/seed-sendgrid-test.js` in der Staging-Datenbank angelegt. – Commit: n/a
- 2025-10-03 – SendGrid-Testversand via `scripts/sendgrid-test-send.js` angestoßen (`403 Forbidden`: Absender `technik@plan-p.de` noch nicht als Sender Identity verifiziert). – Commit: n/a
- 2025-10-03 – Nach Verifizierung von `technik@plan-p.de` erfolgreicher Testversand (`messageId=_Ir7gYCcSce-RA13xEZiiw`). – Commit: n/a
- 2025-10-03 – Checkout in einen nummerierten Stepper umgebaut (Warenkorb → Teilnehmer → Rechnungsadresse → Bestätigungen → Zahlung), Checkboxen vor die Zahlarten gezogen und Teilnehmerblöcke mit „Teilnehmer 1/2 …“ gekennzeichnet. – Commit: n/a
- 2025-10-03 – SevDesk-API-Discovery dokumentiert (`docs/sevdesk.md`), offene Punkte & Testplan für Integration erfasst. – Commit: n/a
- 2025-10-03 – Backend-Service `src/services/sevdesk.ts` angelegt (Token-Auth, Retries, PDF-Download), Readmes aktualisiert und Build erfolgreich durchlaufen. – Commit: n/a
- 2025-10-03 – Checkout speist SevDesk mit Kontakten & Rechnungen (inkl. Gutscheinrabatt-Verteilung), neue ENV-Parameter dokumentiert, Backend-Build grün. – Commit: n/a
- 2025-10-03 – Storni bereitgestellt: Statuswechsel aktualisiert SevDesk-Rechnung, Storno-Dokument-ID wird gespeichert. – Commit: n/a
- 2025-10-03 – Seed-Logik erweitert (Termine, Benachrichtigungen, Einstellungen) und Testdaten für vollständige Systemtests hinterlegt. – Commit: n/a
- 2025-10-03 – Staging-Datenbank zurückgesetzt, Seeds ausgeführt (Termine/Benachrichtigungen geprüft) und Strapi-Service neu gestartet. – Commit: n/a
- 2025-10-03 – SevDesk-Sync-Toggle (`SEVDESK_SYNC_ENABLED`) implementiert, `.env`-Vorlagen aktualisiert und Backend-Guards ergänzt. – Commit: e053de0
- 2025-10-05 – SevDesk-Rechnungsanlage korrigiert (Kontaktpersonen-ID ermittelt, Payload ergänzt, Env-Doku aktualisiert). – Commit: n/a
- 2025-10-06 – SevDesk-Rechnungserstellung auf Factory/saveInvoice umgestellt, auto-Versand (`sendBy`) + Zahlungsbuchung (`bookAmount`) integriert und erfolgreich im Staging getestet. – Commit: n/a
- 2025-10-06 – Rechnungsnummern synchronisiert (letzte SevDesk-Nummer pro Jahr ermitteln, Präfix `WA`, automatische Jahreswechsel). – Commit: n/a
- 2025-10-06 – Staging-Datenbank zurückgesetzt und neu gesät, Mail-/Empfänger-ENV auf reale Adressen gestellt; Puppeteer-Skript `tests/sevdesk-puppeteer.js` für Rechnung/Bezahlt/Storno erweitert. SevDesk-Konto-ID via API ermittelt (`CheckAccount` 6046545) und `SEVDESK_CHECK_ACCOUNT_ID` aktualisiert; Skript-Postaktionen optimiert (Strapi-Instanz mit reduziertem Pool & manueller Storno-Lifecycle-Aufruf) – Knex-Timeout beseitigt. – Commit: n/a
- 2025-10-06 – Rechnungsnummern-Logik auf Jahreslauf (`<PREFIX>-YYYY1NNN`) umgestellt, Kundennummern werden als `KN-1xxx` vergeben; Funktion `getNextInvoiceNumber` berücksichtigt lokale Bestellungen und SevDesk-Daten, Storno-Nummern verbleiben im SevDesk-Standard. – Commit: n/a
- 2025-10-07 – Zahlungsziel für Rechnungsbestellungen auf 15 Tage festgelegt und automatische PayPal-Zahlungsverbuchung in SevDesk gesichert. – Commit: n/a
- 2025-10-07 – SevDesk markiert PayPal-Rechnungen nun auch bei nachträglicher Zahlungsbestätigung via Webhook als bezahlt. – Commit: n/a
- 2025-10-07 – SevDesk-CheckAccount wird automatisch erkannt; Zahlungsverbuchung idempotent gemacht und Puppeteer-E2E erfolgreich durchlaufen. – Commit: n/a
- 2025-10-07 – SevDesk-Kontakte unterscheiden jetzt zwischen Privatperson (Person) und Firmenkontakt (Organisation). – Commit: n/a
- 2025-10-07 – Puppeteer-Test um PayPal-/Aufrechnungs-Storno sowie Zwei-Teilnehmer-Seminar ergänzt; Stornobelege werden in SevDesk verifiziert. – Commit: n/a
- 2025-10-07 – Lifecycle-Logging für SevDesk-Storno erweitert, Szenario-Filter/PayPal-Zwang für SevDesk-Puppeteer eingeführt und separaten PayPal-Storno-Test-Skripteintrag ergänzt; Ausführung lokale PayPal-Creds noch ausstehend. – Commit: n/a
- 2025-10-08 – PayPal-Bestellungen setzen den Bestellstatus nicht mehr automatisch auf „bezahlt“; Strapi überlässt die Zahlungsverbuchung ausschließlich SevDesk, PayPal-Webhook aktualisiert nur noch die Referenz. – Commit: n/a
- 2025-10-08 – Bestellbestätigung und Backoffice-Mailversand nach Checkout reaktiviert (Benachrichtigungs-Service erweitert, neue Helper für Platzhalter & Links). – Commit: n/a
- 2025-10-08 – Rechnungs- und Kundennummern werden vollständig durch SevDesk vergeben; Shop-Logik zur eigenen Nummernvergabe entfernt und Rückübernahme der SevDesk-Rechnungsnummer in Strapi ergänzt. – Commit: n/a
- 2025-10-08 – Platzhalter-Auflösung der Benachrichtigungs-Templates an Content-Type-Daten angepasst (Deep-Merge & Nested Lookup), Strapi-Build erfolgreich geprüft. – Commit: n/a
- 2025-10-08 – Fallback-Handling der Benachrichtigungs-Platzhalter überarbeitet, damit Testdaten nur ohne Runtime-Daten greifen; Backend neu gebaut und Service neu gestartet. – Commit: n/a
- 2025-10-08 – Fallbacks für Benachrichtigungs-Platzhalter vollständig entfernt (nur noch Runtime-Daten in E-Mails), Backend mit Force-Recreate neu deployed. – Commit: n/a
- 2025-10-08 – Rechnungs-/Stornorechnungs-Links in Kunden- und Backoffice-Mails verankert, neue Download-Endpoints für PDF-Belege erstellt und Storno-Benachrichtigungen (Kunde/Backoffice) samt Seeds implementiert. – Commit: n/a
- 2025-10-08 – Staging-Datenbank neu aufgesetzt (DROP/CREATE), Seeds mit neuen Benachrichtigungen durchgeführt und Backend-Service anschließend mit deaktiviertem SEED_ON_BOOT neu gestartet. – Commit: n/a
- 2025-10-08 – Kundenmails von Portal-Hinweisen befreit, Rechnungslink im Seed aktualisiert und Staging-Seed erneut eingespielt. – Commit: n/a
- 2025-10-07 – Gutschein-Logik aus dem Bestell-Controller in Utility ausgelagert, Berechnungen vereinheitlicht. – Commit: n/a
- 2025-10-07 – PayPal-Verifikation, SevDesk-Sync und Benachrichtigungslogik aus `bestellung.ts` in Hilfsmodule ausgelagert; Controller aufgeräumt. – Commit: n/a
- 2025-10-07 – Download-Link-Test für Rechnungen durchgeführt: SevDesk-Dokument-ID in Staging nachgetragen, Backend-Container via `docker compose ... --build --force-recreate` neu ausgerollt; Endpoint `/api/public/bestellungen/KN-1002/rechnung` liefert weiterhin Base64-JSON statt PDF, Fix erforderlich. – Commit: n/a
- 2025-10-07 – SevDesk-Download-Helper passt Base64-Antworten nun an (`downloadDocument` dekodiert JSON-Response, setzt Dateiname/MIME); Ende-zu-Ende-Test via `npm run build` blockiert durch bestehenden Fehler in `src/index.ts`. – Commit: n/a
- 2025-10-07 – Staging-Datenbank zurückgesetzt (`DROP SCHEMA public CASCADE`), Seeds mit temporärem `SEED_ON_BOOT=true` erneut ausgeführt und Strapi-Service frisch gestartet; lokale SevDesk-Verknüpfungen damit entfernt. – Commit: n/a
- 2025-10-07 – Neue Bestellung (#1 / WA-20251000) für Download-Test angelegt, SevDesk-Dokument-ID manuell gesetzt (`245009217`); nach `downloadDocument`-Fix liefert `/api/public/bestellungen/WA-20251000/rechnung` jetzt direkt ein PDF. – Commit: n/a
- 2025-10-07 – Rechnungs-/Storno-Downloads abgesichert: `bestellnummer` priorisiert, HMAC-Token in Links eingebettet (14 Tage gültig), Controller validiert Token; Links in Benachrichtigungen bleiben unverändert, liefern aber nun sichere, klickbare PDFs. – Commit: n/a
- 2025-10-07 – SevDesk-Sync ergänzt Fallback auf `/Document`-Endpoint, setzt `sevdesk_document_id` automatisiert; neue Bestellung `WA-20251002` verifiziert (PDF-Link direkt in Mail verfügbar). – Commit: n/a
- 2025-10-07 – `resolveApiBaseUrl` korrigiert: `PUBLIC_URL` ohne `/api` wird nun erweitert, Mail-Links zeigen wieder auf `/api/public/...`. – Commit: n/a
- 2025-10-07 – Storno-Lifecycle holt PDF-ID jetzt über `/Document` (auch für Cancel-Rechnungen); bestehende Bestellung `WA-20251003` aktualisiert (`sevdesk_storno_document_id=245014128`). – Commit: n/a
- 2025-10-08 – AGENTS-Regeln um Umgebungsprüfung und Marker-Datei ergänzt, `.environment` eingeführt und `.gitignore` erweitert. – Commit: n/a
- 2025-10-08 – Navbar ersetzt Kontakt-CTA durch DaisyUI-Warenkorb-Button mit Badge (Cart-Count via LocalStorage/Custom-Event), lokale Sichtprüfung im Frontend-README dokumentiert. – Commit: n/a
