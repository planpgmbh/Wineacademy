# SendGrid-Leitfaden

Dieser Leitfaden beschreibt, wie der SendGrid-Free-Plan für die Wine Academy konfiguriert, getestet und in Strapi eingebunden wird. Fokus: transaktionale Benachrichtigungen (`/api/public`-Bestellprozess, Admin-Testsendung) über die SendGrid-Mail-API.

## 1. Voraussetzungen & Erstkonfiguration
- Konto: Free-Plan (100 E-Mails/Tag) genügt für Staging, für Produktion ggf. auf Essentials upgraden.
- **Einzelversender verifizieren:** Unter *Settings → Sender Authentication* einen *Single Sender* mit der Absenderadresse aus Strapi (`Einstellungen.fromEmail`) anlegen und verifizieren. Domain-Authentifizierung (DNS) ist optional, verbessert aber Zustellbarkeit.
- **Tracking deaktivieren:** Unter *Tracking* alle Features (Click, Open, Subscription) für Systemmails deaktivieren, damit Links unverändert bleiben.
- **IP Access Management:** Falls gewünscht, IP-Freigaben definieren; für Strapi-Server die öffentliche IP hinterlegen.

## 2. API-Key anlegen
1. *Settings → API Keys → Create API Key*
2. Name: `wineacademy-strapi`
3. Typ: *Restricted Access*
   - `Mail Send` → `Full Access`
   - Optional `Templates` → `Read Access`, falls Templates via API verwaltet werden sollen.
4. Schlüssel sicher ablegen (z. B. in `docker/.env`), anschließend `SENDGRID_API_KEY=` setzen.

## 3. Limits, Zustellbarkeit & Monitoring
- Free-Plan-Limit: 100 E-Mails pro Tag, Rate-Limit 600 Anfragen/min. Bei Überschreitung: HTTP `429 Too Many Requests`.
- Zustellbarkeit verbessern: DKIM/SPF via Domain-Authentifizierung einrichten, Bounce/Spam-Raten unter *Stats* beobachten.
- Logs: *Activity Feed* (7 Tage im Free-Plan). Für längere Historie: Event Webhook aktivieren (nicht aktivieren, solange Infrastruktur fehlt).

## 4. Relevante Endpoints
### `POST /v3/mail/send`
Standard-Endpunkt für transaktionale E-Mails.

```bash
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "personalizations": [
      {
        "to": [{ "email": "kunde@example.com" }],
        "dynamic_template_data": {
          "bestellung": { "bestellnummer": "WA-20251001" }
        }
      }
    ],
    "from": { "email": "noreply@wineacademy.de", "name": "Wine Academy" },
    "reply_to": { "email": "kontakt@wineacademy.de" },
    "template_id": "d-1234567890abcdef1234567890abcdef"
  }'
```

### Dynamische Templates
- In SendGrid unter *Email API → Dynamic Templates* anlegen.
- `{{ }}`-Platzhalter müssen JSON-kompatiblen Keys entsprechen (`bestellung.bestellnummer`).
- Strapi-Feld `sendgridVorlagenId` enthält die Template-ID (`d-...`).

### Sandbox & Suppressions
- Für Test ohne Zustellung: `mail_settings.sandbox_mode` aktivieren (`{"mail_settings": {"sandbox_mode": {"enable": true}}}`) oder in Strapi `EMAIL_TRANSPORT_ENABLED=false` setzen (Transport bleibt deaktiviert, Logs dokumentieren den Skip).
- Suppression-Listen: *Contacts → Suppressions* prüfen, gebouncte Empfänger blockieren weitere Zustellung (HTTP `400` mit `recipient has been suppressed`).

## 5. Fehlerbilder & Debugging
| Status | Ursache | Aktion |
| --- | --- | --- |
| `401 Unauthorized` | API-Key fehlt/falsch | `.env` prüfen, Key neu generieren, Strapi-Neustart |
| `403 Forbidden` | Key ohne `Mail Send`-Rechte | API-Key-Berechtigungen anpassen |
| `403 Forbidden` | Absenderadresse nicht verifiziert | Unter *Sender Authentication* den Single Sender `technik@plan-p.de` bestätigen oder Domain authentifizieren |
| `400 Bad Request` | Pflichtfelder fehlen, ungültige Empfänger, Rate-Limit | JSON validieren, Empfängerliste prüfen, ggf. Verzögerungen einbauen |
| `429 Too Many Requests` | Tageslimit/Ratenlimit erreicht | Mailvolumen senken, Plan upgraden |
| `5xx` | SendGrid-Störung | Retry mit Exponential Backoff, Statusseite prüfen |

Die SendGrid-Response enthält Kopfzeile `X-Message-Id`; Strapi liest diese über `response.headers['x-message-id']` aus und speichert sie für Debugging.

## 6. Integration in Strapi
- `.env`: `SENDGRID_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` (oder über Single-Type `Einstellungen`), `EMAIL_TRANSPORT_ENABLED` (Standard `true`).
- Service: `backend/src/services/notification-email.ts`
  - Initialisierung via `sgMail.setApiKey()` (Fehler, wenn Key fehlt).
  - Unterstützt `templateId` + `dynamicTemplateData` oder klassischen Betreff/HTML/Text-Versand.
- Content-Type: `backend/src/api/benachrichtigung/content-types/benachrichtigung/schema.json`
  - Feld `sendgridVorlagenId`: setzt die Template-ID für Dynamic Templates.
  - Platzhalter & Testdaten werden zu `dynamicTemplateData` gemerged.
- Admin-Testversand: `POST /admin/benachrichtigungen/:id/test-send` liefert `{ messageId, transport: 'sendgrid' }`.

## 7. Testablauf (manuell)
1. (Optional) Basiskonfiguration seed: `docker compose -f docker-compose-staging.yml exec service_wineacadamy_staging node scripts/seed-sendgrid-test.js` legt Absenderdaten & eine Testbenachrichtigung an.
2. `.env` aktualisieren und Strapi-Container neu starten (`docker compose -f docker-compose-staging.yml up -d --force-recreate service_wineacadamy_staging`).
3. Im Strapi-Admin `Benachrichtigungen`-Eintrag wählen, `sendgridVorlagenId` setzen.
4. Testversand mit eigener E-Mail durchführen; Log in SendGrid Activity prüfen (Status `Delivered`). Alternativ: `docker compose -f docker-compose-staging.yml exec service_wineacadamy_staging node scripts/sendgrid-test-send.js` ruft den internen `testSend`-Service auf (nimmt Empfänger aus `SENDGRID_TEST_RECIPIENT` oder default `philipp@plan-p.de`).
5. Fehlerfall prüfen: API-Key temporär verweigern oder ungültige Empfängeradresse verwenden, Fehlermeldung in Admin/Testversand-Response verifizieren.
6. Optional: Sandbox-Mode aktivieren, Response prüfen (`202 Accepted`, keine Zustellung).

## 8. Betriebsaufgaben
- Wöchentlich Activity-Feed/Bounces prüfen.
- Quartalsweise Template-Inhalte gegen Strapi-Platzhalter synchronisieren.
- Plan-Upgrades rechtzeitig budgetieren, sobald Tageslimit > 100 Mails nötig.
- Eventuell Event-Webhooks integrieren, sobald Logging-/Monitoring-Infrastruktur bereitsteht.

## 9. Offene Punkte
- Domain-Authentifizierung vorbereiten (SPF/DKIM-Einträge im DNS der Absenderdomain).
- Automatisierte Integrationstests mit SendGrid-Sandbox (Mock oder gesperrter API-Key) aufsetzen.
