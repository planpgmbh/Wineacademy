# Backend (Strapi 5)

Strapi liefert die Inhalte (Seminare, Termine, Produkte, Gutscheine) und wickelt Bestellungen für die Wine Academy Hamburg ab. Es läuft als Node-20-Service auf PostgreSQL 15 und stellt ausschließlich öffentliche REST-Endpunkte unter `/api/public/*` bereit.

## Setup & Betrieb
- **Service-Namen:** `service_wineacadamy` (Prod) / `service_wineacadamy_staging` (Staging) in den Compose-Dateien.
- **ENV-Variablen:**
  - Strapi-Secrets: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY`.
  - Datenbank: `DATABASE_*`, `POSTGRES_*` (Host `db_wineacadamy` bzw. `db_wineacadamy_staging`).
  - Public URLs: `PUBLIC_URL`, `API_INTERNAL_URL`, optional `ASSETS_INTERNAL_URL`.
  - Zahlungen & Kommunikation: `PAYPAL_*`, `SENDGRID_API_KEY`, `EMAIL_FROM`, optional `EMAIL_REPLY_TO`, `SEVDESK_API_TOKEN`.
  - Sonstiges: `VAT_RATE`, `ORDER_NUMBER_PREFIX`, `SEED_ON_BOOT`.
- **Container neu starten:** Bei Schema- oder Plugin-Änderungen Strapi mit `docker compose -f docker-compose-staging.yml up -d --force-recreate service_wineacadamy_staging` neu aufsetzen.
- **Seeds:** `backend/src/index.ts` erzeugt Demo-Daten, wenn `SEED_ON_BOOT=true` gesetzt ist (nicht in Produktion aktivieren).

## Content-Modell (Kurzfassung)
- **Seminar:** Stammdaten, Texte, Preise, Relations zu Kategorien & Terminen.
- **Termin:** Datum(e) (`termin.seminartag`), `planungsstatus`, Relation zu Seminar & Standort.
- **Standort:** Veranstaltungsort (Adresse, Typ).
- **Produkt:** Shop-Artikel (optional `gutschein`-Flag).
- **Bestellung:** Rechnungs-/Zahlungsdaten, Positionen, Summen, Status (`offen|bezahlt|storniert`).
- **Buchung:** Teilnehmer eines Seminartermins; referenziert Termin & Bestellung.
- **Gutschein:** Templates & generierte Codes inkl. Betrag/Einsatzstatus.
- **Kategorie/Kunde:** Klassifizierung der Seminare bzw. CRM-Einträge inkl. Newsletter-Opt-in.
- **Einstellung:** Single-Type für Kommunikations-Defaults (Absendername/-adresse, Reply-To, Benachrichtigungsempfänger) mit ENV-Fallback (`EMAIL_FROM`, `EMAIL_REPLY_TO`).

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
- Strapi validiert Positionen (Seminar/Produkt/Gutschein), berechnet Netto/Brutto/Steuer und prüft Terminverfügbarkeit.
- `buchungen` müssen pro Termin die Menge der Seminar-Position widerspiegeln; fehlende Teilnehmerdaten führen zu `400`.
- PayPal-Zahlungen: `paypalCaptureId`/`paypalOrderId` mitliefern. Capture wird per REST verifiziert (Betrag, Währung, Status `COMPLETED`).
- Webhook (`/api/public/paypal/webhook`) validiert Signatur (`PAYPAL_WEBHOOK_ID`), markiert Bestellungen als `bezahlt` und erzeugt fehlende Gutscheincodes.
- Bei Statuswechsel auf `storniert` soll ein Event ausgelöst werden, das Storno-E-Mails und ggf. Stornobelege versendet.
- Service `src/services/settings.ts` liest die Einstellungen und kombiniert sie mit ENV-Fallbacks für Mail-Transport.
- Newsletter-Opt-in wird auf Kundenebene gespeichert bzw. aktualisiert, sobald `newsletterOptIn=true` übermittelt wird.

## Entwicklung & Qualitätssicherung
- **Tests:** E2E-Checkout über `node tests/checkout-puppeteer.js` (setzt laufenden Staging-Stack und PayPal-Sandbox-Zugangsdaten voraus).
- **Codeänderungen:** Bei Anpassungen an Content-Types immer `schema.json` prüfen und ggf. Admin-Oberfläche testen.
- **Middleware:** `backend/src/middlewares/force-https.ts` sorgt für korrekte HTTPS-Erkennung hinter Traefik.
- **Troubleshooting:** Logs via `docker compose -f docker-compose-staging.yml logs -f service_wineacadamy_staging`; DB-Verbindungen mit `psql` prüfen, falls Migrationen fehlschlagen.

## Weiterführende Ressourcen
- Root-README für Gesamtüberblick & Compose-Kommandos.
- `docs/server-infrastructure.md` für Traefik, Netzwerke und Backup-Hinweise.
- `docs/entwicklungsplan.md` für Roadmap und offene Backend-Aufgaben.
