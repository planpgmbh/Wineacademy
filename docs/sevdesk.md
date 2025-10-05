# SevDesk-Integration

Diese Notizen dokumentieren den aktuellen Stand der SevDesk-Anbindung für die Wine Academy.

## Authentifizierung & Basis-URLs
- Basis-Endpunkte: `https://my.sevdesk.de/api/v1` (laut offizieller OpenAPI-Spezifikation). Eine gesonderte REST-v2 wurde von SevDesk noch nicht veröffentlicht.
- Authentifizierung per Header `Authorization: <API_TOKEN>` (32-stellige Hex-Zeichenkette je SevDesk-Benutzer).
- Einige Legacy-Endpunkte akzeptieren den Token zusätzlich als Query-Parameter `?token=<API_TOKEN>`. Wir senden dennoch standardmäßig den Header und hängen den Token für GET-/Factory-Aufrufe zusätzlich an, da SevDesk dies aktuell verlangt.
- Konfigurierbar über ENV:
  - `SEVDESK_ENABLED` – deaktiviert die gesamte Backend-Synchronisation (Kontakte, Rechnungen, Storno).
  - `SEVDESK_API_TOKEN`
  - `SEVDESK_API_BASE_URL` (optional)
  - `SEVDESK_CATEGORY_PRIVATE_ID` / `SEVDESK_CATEGORY_COMPANY_ID`
  - `SEVDESK_DEFAULT_TIME_TO_PAY_DAYS`
  - `SEVDESK_DEFAULT_COUNTRY_ID`
  - `SEVDESK_TAX_RULE_ID`
  - `SEVDESK_CONTACT_PERSON_ID` (SevUser-ID des verantwortlichen Sachbearbeiters)

## Workflow im Checkout
1. **Kontakt synchronisieren:** `POST /Contact`
   - Kategorie 3 („Kunde“) für Privatpersonen, 4 („Partner“) für Firmen (Fallbacks per ENV).
   - Adresse aus Bestelldaten + optional Country-ID (`StaticCountry`).
2. **Kommunikationsweg anlegen:** `POST /CommunicationWay`
   - `type: EMAIL`, `key.id = 2` („Arbeit“) funktioniert zuverlässig; alternative Keys bei Bedarf via `GET /CommunicationWayKey` ermitteln.
3. **Rechnung anlegen:** `POST /Invoice/Factory/createInvoiceByFactory`
   - Pflichtfelder laut Support: siehe [InvoiceAPI-Dokumentation](https://my.sevdesk.de/api/InvoiceAPI/doc.html#operation/createInvoiceByFactory).
   - Wir übergeben u. a. `invoice` (Kontakt, Datum, TaxRule, Adresse, ContactPerson) und `invoicePosSave` (Positionen inkl. Steuer, brutto).
   - `takeDefaultAddress` wird nur gesetzt, wenn keine Rechnungsadresse in der Bestellung vorhanden ist.
4. **Rechnung finalisieren:** `PUT /Invoice/{id}` mit `status: 200`.
5. **Zahlung markieren:** `PUT /Invoice/{id}` mit `status: 200`, `payDate`, `paidAmount`.
6. **Storno:** `PUT /Invoice/{id}` mit `status: 1000`; die Storno-Dokument-ID wird im Feld `sevdeskStornoDocumentId` gespeichert.

## Feature-Toggles
- **SevDesk deaktivieren:** `SEVDESK_ENABLED=false` verhindert sämtliche API-Aufrufe (Kontakt, Rechnung, Storno). Das Backend loggt die Unterdrückung pro Bestellung.
- **E-Mail-Versand deaktivieren:** `EMAIL_TRANSPORT_ENABLED=false` unterbindet SendGrid-Aufrufe (wird bereits von `notification-email.ts` ausgewertet).

## Bekannte Stolperfallen
- **Nummernkreis:** Tritt beim API-Call `Invoice: Correct number abort. Timeout` auf, ist der Rechnungsnummernkreis nicht korrekt initialisiert. Der Support muss den Counter serverseitig zurücksetzen (betrifft auch frisch angelegte Testkonten).
- **ContactPerson:** Das Feld erwartet die SevUser-ID des account-eigenen Benutzers – andernfalls verweigert die API die Rechnung. Wert per `GET /SevUser` ermitteln und in `SEVDESK_CONTACT_PERSON_ID` hinterlegen.
- **TaxRule & Steuertexte:** Ohne gültige `taxRule` (z. B. ID 1 für Standard 19 %) und `taxText` (`"Umsatzsteuer 19%"`) schlägt der Factory-Endpoint fehl.
- **Kommunikationswege:** `key` muss als Objekt (`{ id, objectName: 'CommunicationWayKey' }`) mitgegeben werden. Fehlende oder ungültige Keys erzeugen 500er.

## Aktueller Stand (03.10.2025)
- Kontakte & Kommunikationswege lassen sich automatisiert anlegen.
- Rechnungsanlage schlägt trotz neuem Nummernkreis weiterhin über die API fehl (`Invoice: Correct number abort. Timeout`). Der Support hat bestätigt, dass fehlende Pflichtfelder diese Fehlermeldung verursachen; wir senden inzwischen alle geforderten Felder. Sollte der Fehler weiterhin auftauchen, muss der SevDesk-Support den Nummernkreis explizit prüfen/resetten.
- Solange der Nummernkreis blockiert, greifen auch Finalisierung, Zahlung und Storno noch nicht.

Sobald der Support den Counter repariert und die Factory-Payload akzeptiert wird, sollten die vorbereiteten Schritte ohne weitere Codeänderungen durchlaufen.
