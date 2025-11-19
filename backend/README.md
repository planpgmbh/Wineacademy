# Backend (Strapi 5)

Strapi liefert die Inhalte (Seminare, Termine, Produkte, Gutscheine) und wickelt Bestellungen für die Wine Academy Hamburg ab. Es läuft als Node-20-Service auf PostgreSQL 15 und stellt ausschließlich öffentliche REST-Endpunkte unter `/api/public/*` bereit.

## Setup & Betrieb
- **Service-Namen:** `service_wineacadamy` (Prod) / `service_wineacadamy_staging` (Staging) in den Compose-Dateien.
- **ENV-Variablen:**
  - Strapi-Secrets: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY`.
  - Datenbank: `DATABASE_*`, `POSTGRES_*` (Host `db_wineacadamy` bzw. `db_wineacadamy_staging`).
  - Public URLs: `PUBLIC_URL`, `API_INTERNAL_URL`, optional `ASSETS_INTERNAL_URL`.
  - Frontend-Links: optional `FRONTEND_BASE_URL` (Basis für Kunden-Links), `CUSTOMER_PORTAL_BASE_URL` (Standard: `<FRONTEND_BASE_URL>/konto/bestellungen`), `ADMIN_BASE_URL` (Standard: `<FRONTEND_BASE_URL>/admin`).
  - Zahlungen & Kommunikation: `PAYPAL_*`, `SENDGRID_API_KEY`, `EMAIL_FROM`, optional `EMAIL_REPLY_TO`, `EMAIL_TRANSPORT_ENABLED` (Standard `true`), `SEVDESK_API_TOKEN`.
  - Sonstiges: `VAT_RATE`, `SEED_ON_BOOT`.
  - SevDesk: `SEVDESK_API_TOKEN` (Pflicht), optional `SEVDESK_SYNC_ENABLED` (Standard `true` – `false` deaktiviert alle Syncs), `SEVDESK_API_BASE_URL` (Standard `https://my.sevdesk.de/api/v1`), `SEVDESK_CATEGORY_PRIVATE_ID`, `SEVDESK_CATEGORY_COMPANY_ID`, `SEVDESK_DEFAULT_TIME_TO_PAY_DAYS`, `SEVDESK_DEFAULT_COUNTRY_ID` (Default `1` = Deutschland), `SEVDESK_TAX_RULE_ID`, `SEVDESK_CONTACT_PERSON_ID` (Pflicht für die Factory-API; fällt auf den ersten `SevUser` zurück, sofern abrufbar), `SEVDESK_CHECK_ACCOUNT_ID` (Kontonummer für die Verbuchung bezahlter Rechnungen über `bookAmount`), `SEVDESK_SEND_TYPE` (optional; Standard `VPDF`, mögliche Werte `VPR`, `VP`, `VM`, `VPDF`).
    - Automatischer Zahlungsabgleich: `CRON_ENABLED` (Strapi-Cron aktivieren, Standard `true`), `SEVDESK_PAYMENT_SYNC_ENABLED` (Standard `true`), `SEVDESK_PAYMENT_SYNC_CRON` (Default `*/15 * * * *`), `SEVDESK_PAYMENT_SYNC_BATCH` (Default `25`), optional `SEVDESK_PAYMENT_SYNC_TZ` (Fallback `Europe/Berlin`). Ein optionaler Fallback-Intervall kann über `SEVDESK_PAYMENT_SYNC_FORCE_INTERVAL=true` aktiviert werden (`SEVDESK_PAYMENT_SYNC_INTERVAL_MS` bzw. `_MINUTES` steuern das Intervall), falls Strapis Cron nicht verfügbar ist. Der Job gleicht Zahlungen und Stornos mit SevDesk ab.
  - Download-Links: optional `INVOICE_DOWNLOAD_SECRET` (HMAC-Secret für signierte Rechnungs-/Stornodownloads; fällt sonst auf das erste `APP_KEY` zurück), `ORDER_DOWNLOAD_TOKEN_TTL_SECONDS` (Gültigkeit der Download-Token in Sekunden, Default 14 Tage).
- **Container neu starten:** Bei Schema- oder Plugin-Änderungen Strapi mit `docker compose -f docker-compose-staging.yml up -d --force-recreate service_wineacadamy_staging` neu aufsetzen.
- **Seeds:** `backend/src/index.ts` erzeugt Demo-Daten, wenn `SEED_ON_BOOT=true` gesetzt ist (nicht in Produktion aktivieren).
- **Cronjobs:** `config/cron.ts` (Taskdefinition in `config/cron-tasks.ts`) aktiviert den Job `sevdesk-payment-sync` (alle 15 Minuten per Default). Der Job prüft offene Rechnungsbestellungen (`zahlungsmethode=rechnung`) gegen SevDesk und setzt Bestellungen automatisch auf „bezahlt“, sobald SevDesk die Rechnung als beglichen führt. Über `SEVDESK_PAYMENT_SYNC_*` lassen sich Intervall & Batchgröße konfigurieren.
- **SevDesk-Statussync:** Strapi legt bei jeder Bestellung eine Rechnung in SevDesk an. Ändert sich der Status in SevDesk (z. B. „offen“ → „bezahlt“ oder es wird eine Stornorechnung angelegt), erkennt der `sevdesk-payment-sync`-Cron (oder der optionale Intervall-Fallback) diese Änderung und setzt die Bestellung in Strapi entsprechend auf „bezahlt“ oder „storniert“ – inklusive Versand der passenden Mail (Zahlungsbestätigung bzw. Storno). Damit bleiben beide Systeme synchron, selbst wenn Buchhaltungsschritte direkt in SevDesk passieren.

## Content-Modell (Kurzfassung)
- **Seminar:** Stammdaten, Texte, Preise, Relations zu Kategorien & Terminen, Bookingbox-Komponente (`bookingbox` mit `topline`, `headline`, `body`), optionales Hero-Hintergrundbild (`hintergrundbild`) sowie wiederholbare Tabs (`seminarinhalte` mit Titel & Richtext-Inhalt).
- **Termin:** Datum(e) (`termin.seminartag`), `planungsstatus`, Relation zu Seminar & Standort.
- **Standort:** Veranstaltungsort (Adresse, Typ).
- **Produkt:** Shop-Artikel (optional `gutschein`-Flag).
- **Bestellung:** Rechnungs-/Zahlungsdaten, Positionen, Summen, Status (`offen|bezahlt|storniert`); Gutscheinpositionen speichern Versanddetails (Vor- & Nachname der beschenkten Person, Versandart, optionale Versandkosten und Nachricht).
- **Buchung:** Teilnehmer eines Seminartermins; referenziert Termin & Bestellung.
- **Gutschein:** Generierte Codes inkl. Betrag/Einsatzstatus (Rabatt-/Wertgutscheine); `versandDetails` bewahrt Empfänger- und Versandinformationen inklusive hinterlegter Versandkosten. Sobald eine Bestellung auf „bezahlt“ wechselt, erzeugt Strapi für alle Gutschein-Positionen automatisch neue Codes. Präsentations-/Bookingbox-Felder sowie `versandkosten` (für postalische Gutscheine) liegen im Single-Type `gutscheineinstellung`.
- **Kategorie/Kunde:** Klassifizierung der Seminare bzw. CRM-Einträge inkl. Newsletter-Opt-in.
- **Einstellung:** Single-Type für Kommunikations-Defaults (Absendername/-adresse, Antwort-Adresse, Benachrichtigungsempfänger) mit ENV-Fallback (`EMAIL_FROM`, `EMAIL_REPLY_TO`).
- **Benachrichtigungen:** Collection-Type für transaktionale E-Mail-Layouts inkl. Platzhalterdokumentation und Testdaten.
- **Landingpage:** Collection-Type für frei gestaltbare Seiten (Homepage, Kategorien etc.) mit Dynamic-Zone-Bausteinen (Hero, Karten, Textblock, Icon-Grid).

Namenskonvention: Für Terminstatus `planungsstatus` verwenden und Relationen laut Schema (`schema.json`) pflegen.

## Öffentliche Endpunkte
| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/public/seminare` | Liste aktiver Seminare inkl. geplante Termine & Orte |
| `GET` | `/api/public/seminare/:slug` | Seminardetail (Texte, Termine, Preise) |
| `GET` | `/api/public/produkte` | Aktive Produkte inkl. Gutschein-Flag |
| `GET` | `/api/public/gutscheine/template` | Gutschein-Template (Min/Max, Beschreibung, Bild) |
| `POST` | `/api/public/gutscheine/pricing` | Wunschbetrag validieren/runden |
| `POST` | `/api/public/bestellungen` | Bestellung anlegen (Rechnung oder PayPal-Capture) |
| `GET` | `/api/public/bestellungen/:id` | Bestellstatus + Gutschein-Codes |
| `POST` | `/api/public/paypal/webhook` | PayPal-Webhooks zur Nachverarbeitung |

### Beispiel: Rechnungskauf eines Produkts
```bash
curl -s -X POST http://localhost:1337/api/public/bestellungen \
  -H 'Content-Type: application/json' \
  -d '{
    "rechnungstyp": "privat",
    "vorname": "Test",
    "nachname": "User",
    "email": "test@example.com",
    "agbAkzeptiert": true,
    "datenschutzGelesen": true,
    "positionen": [
      {
        "typ": "produkt",
        "produktId": 1,
        "menge": 1,
        "einzelpreisBrutto": 59.5,
        "steuerSatz": 19
      }
    ],
    "buchungen": []
  }'
```

## Bestell- & PayPal-Workflow

### Architektur der Public-Bestellung
- Controller `src/api/bestellung/controllers/bestellung.ts` ist schlank gehalten und delegiert an Hilfsmodule.
- Gutschein-Validierung & Betragsberechnung: `src/api/bestellung/utils/gutschein.ts`.
- PayPal-Capture-Prüfung: `src/api/bestellung/utils/paypal.ts`.
- SevDesk-Sync (Kontakt, Rechnung, Dokument): `src/api/bestellung/services/sevdesk-order.ts`.
- Benachrichtigungen & Platzhalter: `src/api/bestellung/utils/notifications.ts`.
- Link-/Dateinamen-Helfer: `src/api/bestellung/utils/order-links.ts`.
- Neue Logik bitte als Helper/Service ergänzen statt direkt im Controller.
- Strapi validiert Positionen (Seminar/Produkt/Gutschein), berechnet Netto/Brutto/Steuer und prüft Terminverfügbarkeit.
- `buchungen` müssen pro Termin die Menge der Seminar-Position widerspiegeln; fehlende Teilnehmerdaten führen zu `400`.
- PayPal-Zahlungen: `paypalCaptureId`/`paypalOrderId` mitliefern. Capture wird per REST verifiziert (Betrag, Währung, Status `COMPLETED`).
- Webhook (`/api/public/paypal/webhook`) validiert Signatur (`PAYPAL_WEBHOOK_ID`), markiert Bestellungen als `bezahlt` und erzeugt fehlende Gutscheincodes.
- Bei Statuswechsel auf `storniert` soll ein Event ausgelöst werden, das Storno-E-Mails und ggf. Stornobelege versendet.
- Service `src/services/settings.ts` liest die Einstellungen und kombiniert sie mit ENV-Fallbacks für Mail-Transport.
- Newsletter-Opt-in wird auf Kundenebene gespeichert bzw. aktualisiert, sobald `newsletterOptIn=true` übermittelt wird.

## SevDesk-Service
- Der Service `src/services/sevdesk.ts` kapselt die SevDesk-REST-API (Token-Auth, Retries bei 429/503).
- Exporte u. a.: `saveContact`, `createCommunicationWay`, `createInvoiceDraft`, `createInvoicePosition`, `updateInvoiceStatus`, `markInvoicePaid`, `fetchInvoiceWithDocument`, `downloadDocument`.
- `SEVDESK_API_TOKEN` muss im Backend-ENV hinterlegt sein; optional `SEVDESK_SYNC_ENABLED=false` deaktiviert die komplette Synchronisation (auch Storni). Zusätzlich `SEVDESK_API_BASE_URL` für Sandbox/Staging.
- Rückgaben enthalten das SevDesk-JSON; Fehler werden als `SevDeskError` (mit Status/Details) geworfen.
- Der öffentliche Checkout erzeugt nach erfolgreicher Bestellung automatisch SevDesk-Kontakte und Rechnungen (Rechnung finalisiert, bei Status `bezahlt` sofort markiert); Gutscheinrabatte werden pro Steuersatz als Rabattpositionen abgebildet.
- Statuswechsel auf `storniert` stoßen automatisch das Stornieren der SevDesk-Rechnung an und merken sich die (optionale) Storno-Dokument-ID.

## Benachrichtigungen & Testversand
- **Content-Type:** `Benachrichtigungen` verwaltet jede Systemmail (z. B. Bestellbestätigung, Zahlungsbestätigung, Backoffice-Info). Pflichtfelder: `Titel`, `Anwendungsfall`, `Betreff`.
- **Platzhalter:** Über die Component `benachrichtigung.platzhalter` dokumentierst du Schlüssel, Beschreibung und Beispielwerte. `Testdaten (JSON)` ergänzt komplexe Strukturen (z. B. Arrays) und wird mit den Platzhalter-Beispielen zusammengeführt.
- **Layouts:** Das Feld `layout` (Default/Rechnung/Backoffice) bestimmt das HTML-Grundgerüst, `bodyHtml`/`bodyText` verwenden Platzhalter wie `{{kunde.vorname}}`.
- **Admin-Testversand:** `POST /admin/benachrichtigungen/:id/test-send` (authentifizierte Admin-Session) löst einen Einzelversand über den konfigurierten SMTP-Server aus. Payload:
  ```json
  { "email": "ziel@example.com", "platzhalter": { "bestellung.bestellnummer": "WA-20251001" } }
  ```
  Übergebene Platzhalter überschreiben `Testdaten (JSON)` und Beispielwerte. Antwort enthält `messageId` des SMTP-Transports.
- **Service:** Implementiert in `src/api/benachrichtigung/services/benachrichtigung.ts`, Versand via `src/services/notification-email.ts` (SMTP über lokalen Mailserver). Einstellungen/Absender stammen aus `src/services/settings.ts` + Strapi-Single-Type "Einstellungen".
- **Transport-Toggle:** `EMAIL_TRANSPORT_ENABLED=false` deaktiviert den Versand (Strapi loggt die unterdrückte Mail und liefert `202` zurück); ideal für lokale/Preview-Umgebungen.
- **SMTP-ENV:** `SMTP_HOST`, optional `SMTP_PORT` (Default 587), `SMTP_USER`/`SMTP_PASS` für Auth, `SMTP_SECURE` (Default `false`, Port 465 → `true`), `SMTP_REQUIRE_TLS` (Default `false`), `SMTP_ALLOW_SELF_SIGNED` (Default `false`). Absender/Reply-To wie bisher über `EMAIL_FROM`/`EMAIL_REPLY_TO` oder den Single-Type.

## Entwicklung & Qualitätssicherung
- **Tests:** E2E-Checkout über `node tests/checkout-puppeteer.js` (setzt laufenden Staging-Stack und PayPal-Sandbox-Zugangsdaten voraus).
- **Codeänderungen:** Bei Anpassungen an Content-Types immer `schema.json` prüfen und ggf. Admin-Oberfläche testen.
- **Middleware:** `backend/src/middlewares/force-https.ts` sorgt für korrekte HTTPS-Erkennung hinter Traefik.
- **Troubleshooting:** Logs via `docker compose -f docker-compose-staging.yml logs -f service_wineacadamy_staging`; DB-Verbindungen mit `psql` prüfen, falls Migrationen fehlschlagen.
- **Build & Sichtprüfung:** Nach jeder Backend-Änderung `docker compose -f docker-compose-staging.yml up -d --build --force-recreate service_wineacadamy_staging` ausführen und anschließend das Strapi-Admin unter `https://wineacademy.plan-p.de/admin` im Browser öffnen, um die Anpassungen zu kontrollieren (z. B. Content-Types, Felder, Texte).

## Weiterführende Ressourcen
- Root-README für Gesamtüberblick & Compose-Kommandos.
- `docs/server-infrastructure.md` für Traefik, Netzwerke und Backup-Hinweise.
- `docs/entwicklungsplan.md` für Roadmap und Entscheidungen; `docs/backend-arbeitsprotokoll.md` für laufende Backend-Aufgaben & Commit-Notizen.
