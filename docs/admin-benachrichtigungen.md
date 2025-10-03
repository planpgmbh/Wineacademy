# Benachrichtigungen & Testversand

Dieser Leitfaden beschreibt, wie transaktionale E-Mails in Strapi verwaltet und getestet werden.

## Content-Type „Benachrichtigungen“
- **Pflichtfelder:** `Titel`, `Anwendungsfall` (Enum) und `Betreff` müssen gesetzt sein.
- **Layout:** Wähle `default`, `rechnung` oder `backoffice`, um das HTML-Grundgerüst zu bestimmen.
- **HTML/Text-Inhalt:** `HTML-Inhalt` und optional `Text-Inhalt` unterstützen Platzhalter wie `{{kunde.vorname}}` und werden beim Versand ersetzt.
- **Vorschauzeile:** Der kurze Text hinter dem Betreff hilft, im Posteingang zusätzliche Infos zu zeigen.
- **Platzhalter-Dokumentation:** Über die Component `Platzhalter` pflegst du Schlüssel, Beschreibung und Beispielwerte; Beispiele landen automatisch im Testversand.
- **Testdaten:** Im Feld `Testdaten (JSON)` kannst du verschachtelte Objekte oder Arrays hinterlegen (z. B. `{ "kundin": { "vorname": "Anna" } }`). Die Daten werden mit den Platzhalter-Beispielen zusammengeführt; Request-Daten haben Priorität.
- **SendGrid-Vorlage:** Mit `SendGrid-Vorlagen-ID` wird stattdessen das dynamische SendGrid-Template genutzt, Strapi-Inhalte dienen dann nur zur Dokumentation.

### Empfohlene Platzhalter je Anwendungsfall
| Anwendungsfall | Zweck | Empfohlene Platzhalter |
| --- | --- | --- |
| `bestellbestaetigung` | Kundenmail direkt nach Checkout | `kunde.vorname`, `bestellung.bestellnummer`, `bestellung.summeBrutto`, `bestellung.positionen[]`, `links.kundencenter` |
| `zahlungsbestaetigung` | Versand nach Zahlungseingang | `kunde.vorname`, `bestellung.bestellnummer`, `bestellung.zahlungsdatum`, `gutscheine[]` |
| `rechnung_gutschein` | Mail mit PDF-Rechnung/Gutscheinen | `kunde.vorname`, `bestellung.bestellnummer`, `anhang.rechnungUrl`, `anhang.gutscheine[]` |
| `backoffice_benachrichtigung` | Interne Info bei neuen Orders | `bestellung.bestellnummer`, `bestellung.summeBrutto`, `bestellung.rechnungstyp`, `bestellung.status`, `links.adminOrder` |

> **Hinweis:** Für Arrays (`positionen[]`) empfiehlt sich ein JSON in `Testdaten (JSON)`, z. B. `{"bestellung": {"positionen": [{"titel": "Masterclass Sensorik", "menge": 2}]}}`.

## Admin-Testversand

### Voraussetzungen
1. **SendGrid-API-Key** (`SENDGRID_API_KEY`) und Absender-Einstellungen (`EMAIL_FROM`, optional `EMAIL_REPLY_TO`) müssen gesetzt sein.
2. Strapi-Admin-Nutzer*in mit Berechtigung „Benachrichtigungen“.

### Endpoint
```
POST /admin/benachrichtigungen/:id/test-send
Content-Type: application/json
Authorization: Bearer <Admin-Token>
```

**Payload-Beispiel:**
```json
{
  "email": "anna@example.com",
  "platzhalter": {
    "kunde.vorname": "Anna",
    "bestellung.bestellnummer": "WA-000123"
  }
}
```

- `email` ist Pflicht und bestimmt die Empfängeradresse.
- `platzhalter` überschreiben Beispielwerte (Component `Platzhalter`) und `Testdaten (JSON)`.
- Antwort enthält `{ "ok": true, "messageId": "<SendGrid-ID>", "transport": "sendgrid" }`.

### Durchführung im Browser
1. Im Strapi-Admin eine API-Token mit Zugriff auf den Collection-Type erzeugen (`Einstellungen → API Tokens → Create new` → Scope: `Benachrichtigungen` & `Custom` → Route `POST /admin/benachrichtigungen/:id/test-send`).
2. ID des Templates aus der Detailansicht kopieren (URL oder Feld `id`).
3. Mit einem Tool wie Hoppscotch, Thunder Client oder `curl` den Request absetzen.

### Fehlerbehebung
- **Fehlender API-Key:** Rückmeldung `SENDGRID_API_KEY ist nicht gesetzt` → `.env` prüfen und Strapi neu starten.
- **Absender nicht konfiguriert:** Stelle sicher, dass im Single-Type `Einstellungen` eine Absenderadresse gepflegt ist oder `EMAIL_FROM` gesetzt wurde.
- **Platzhalter unbekannt:** Nicht gepflegte Platzhalter werden als leere Zeichenkette ersetzt; im Zweifel die Component `Platzhalter` ergänzen.

## Änderungsverlauf
- 2025-10-02 – Content-Type & Service implementiert, Testversand-Endpunkt ergänzt (Commit: n/a).
