# Öffentliche REST-API (Strapi)

Die Frontend- und Partner-Integrationen greifen ausschließlich auf `/api/public/*` zu. Alle Endpunkte liefern JSON und erfordern keine Authentifizierung, solange Inhalte veröffentlicht sind.

## Übersicht
| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| `GET` | `/api/public/seminare` | Liste aller veröffentlichten Seminare inkl. Termine, Standorte und Preise |
| `GET` | `/api/public/seminare/:slug` | Detailansicht eines Seminars (Texte, Termine, Kategorien) |
| `GET` | `/api/public/produkte` | Aktive Produkte (inkl. `gutschein`-Flag) |
| `GET` | `/api/public/gutscheine/template` | Gutschein-Template (Min/Max-Beträge, Beschreibung, Bild) |
| `POST` | `/api/public/gutscheine/pricing` | Validiert Wunschbetrag, gibt gerundete Werte zurück |
| `POST` | `/api/public/gutscheine/validate` | Prüft Rabatt-/Gutschein-Codes und liefert anwendbaren Betrag |
| `POST` | `/api/public/bestellungen` | Erstellt eine Bestellung (Rechnung oder PayPal-Capture) |
| `GET` | `/api/public/bestellungen/:id` | Gibt Status & Gutscheincodes einer Bestellung aus |
| `POST` | `/api/public/paypal/webhook` | Verarbeitung von PayPal-Webhooks (Signaturprüfung, Status-Update) |

## Endpunkte im Detail

### GET `/api/public/seminare`
- **Query-Parameter:**
  - `kategorie` (optional): Slug der Kategorie zum Filtern
  - `limit`/`offset` (optional): Pagination (Default 50/0)
- **Antwort (gekürzt):**
```json
[
  {
    "name": "WSET Level 1",
    "slug": "wset-level-1",
    "kurzbeschreibung": "Einführung in die Welt des Weins",
    "termine": [
      {
        "id": 12,
        "starttag": "2025-11-05",
        "planungsstatus": "geplant",
        "standort": {
          "name": "Wine Academy Hamburg"
        }
      }
    ]
  }
]
```

### POST `/api/public/bestellungen`
- **Payload (vereinfachtes Beispiel):**
```json
{
  "rechnungstyp": "privat",
  "vorname": "Anna",
  "nachname": "Mustermann",
  "email": "anna@example.com",
  "agbAkzeptiert": true,
  "datenschutzGelesen": true,
  "positionen": [
    {
      "typ": "seminar",
      "terminId": 12,
      "menge": 2
    }
  ],
  "buchungen": [
    {
      "terminId": 12,
      "vorname": "Anna",
      "nachname": "Mustermann"
    },
    {
      "terminId": 12,
      "vorname": "Max",
      "nachname": "Mustermann"
    }
  ]
}
```
- **Antwort:** Enthält ID, Bestellstatus, Summen & ggf. erzeugte Gutscheincodes.
- **Validierung:**
  - Positionen werden gegen Strapi-Content geprüft (Verfügbarkeit, Preise).
  - Bei PayPal muss `paypalOrderId`/`paypalCaptureId` mitgeschickt werden; Strapi verifiziert den Capture.

### GET `/api/public/bestellungen/:id`
- **Antwort:**
```json
{
  "id": 42,
  "status": "bezahlt",
  "zahlungsmethode": "rechnung",
  "totals": {
    "brutto": 249,
    "netto": 209.24,
    "steuer": 39.76,
    "gutschein": 0
  },
  "gutscheine": [
    { "code": "ABCD-EFGH-IJKL-MNOP", "betrag": 50 }
  ]
}
```

### POST `/api/public/gutscheine/pricing`
- **Payload:** `{ "betrag": 87 }`
- **Antwort:** `{ "betrag": 90, "steuerSatz": 19, "summeNetto": 75.63, "summeSteuer": 14.37 }`
- Nutzt interne Rundungslogik gemäß Strapi-Einstellungen.

### POST `/api/public/gutscheine/validate`
- **Payload:**
```json
{
  "code": "WELCOME10",
  "totals": {
    "brutto": 249.0,
    "netto": 209.24,
    "steuer": 39.76
  }
}
```
- **Antwort:**
```json
{
  "code": "WELCOME10",
  "typ": "prozent",
  "amount": 24.9,
  "remaining": 0,
  "name": "WELCOME10",
  "description": "10% Willkommensrabatt"
}
```
- Validiert Aktivität, Limits (Mindestbestellwert, Ablauf, Nutzungsanzahl) sowie Restguthaben und liefert den anwendbaren Rabattbetrag.

Weitere Details zu Feldern und Business-Logik findest Du im Strapi-Code (`src/api/*`) bzw. den entsprechenden Services.
