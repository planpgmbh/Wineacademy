# SevDesk-Integration – Leitfaden für Entwickler

Dieser Leitfaden beschreibt die wichtigsten Aspekte der SevDesk-Anbindung im Backend. Er fasst den aktuellen Workflow, notwendige ENV-Variablen sowie bekannte Stolperfallen zusammen.

## 1. Grundlagen & ENV-Variablen
- `SEVDESK_API_TOKEN` – API-Token des Accounts (32-stellig, Hex). **Muss gesetzt sein.**
- `SEVDESK_SYNC_ENABLED` – `false` deaktiviert sämtliche SevDesk-Aufrufe (Default `true`).
- `SEVDESK_CONTACT_PERSON_ID` – ID des `SevUser`, der als Kontaktperson auf Rechnungen erscheint. Ohne gültige ID verweigert die Factory-API die Rechnungsanlage.
- `SEVDESK_CHECK_ACCOUNT_ID` – ID des Bank-/Kassenkontos, auf das Zahlungen verbucht werden (für `bookAmount`).
- `SEVDESK_SEND_TYPE` – Übergabe für `/Invoice/{id}/sendBy` (`VPDF` | `VM` | `VP` | `VPR`). Standard ist `VPDF`.
- `SEVDESK_INVOICE_PREFIX` – Präfix der Rechnungs-/Bestellnummern (Default `WA`). Der Shop erzeugt laufende Nummern pro Jahr (`<PREFIX>-<Jahr><laufende Nummer>`).
- Optionale Defaults: `SEVDESK_DEFAULT_TIME_TO_PAY_DAYS`, `SEVDESK_DEFAULT_COUNTRY_ID` (intern nutzen wir `1` = Deutschland), `SEVDESK_TAX_RULE_ID`, `SEVDESK_API_BASE_URL`.

### IDs ermitteln
Mit gültigem Token lassen sich Kontaktpersonen und Konten bequem per API auslesen:

```bash
# SevUser (Kontaktpersonen)
curl -s "https://my.sevdesk.de/api/v1/SevUser?token=$SEVDESK_API_TOKEN" | jq '.objects[] | {id, fullname, email}'

# Konten (CheckAccount)
curl -s "https://my.sevdesk.de/api/v1/CheckAccount?token=$SEVDESK_API_TOKEN" | jq '.objects[] | {id, name}'
```

## 2. Ablauf bei Bestellungen
1. **Kontakt & Kommunikation**
   - `saveContact` wird mit Kategorie, Adresse etc. aufgerufen (Update, falls `sevdeskContactId` existiert).
   - `createCommunicationWay` legt den primären E-Mail-Kanal an (`CommunicationWayKey` = 2 / `MAIN`). Konflikte (409/422) werden abgefangen.

2. **Rechnung via Factory**
   - `createInvoiceByFactory` nutzt `/Invoice/Factory/saveInvoice`.
   - Pflichtfelder: `contact`, `contactPerson`, `invoiceDate` (`dd.mm.yyyy`), `invoiceNumber`, `deliveryDate`, `taxRule`, `taxType`, Adresse, `mapAll`.
   - Positionen werden vollständig in `invoicePosSave` übertragen; Bruttopreis wird in Netto + Steuer (`price`, `priceGross`, `priceTax`) aufgeteilt.
   - Die Rechnungsnummer wird vor jeder Bestellung aus SevDesk ermittelt: Wir durchsuchen alle Rechnungen mit dem konfigurierten Präfix und dem aktuellen Jahr (`<PREFIX>-<YYYY><NNNN>`). Falls für dieses Jahr keine Nummer existiert, starten wir mit `<PREFIX>-<YYYY>0001`.

3. **Versand markieren**
   - Direkt im Anschluss ruft das Backend `markInvoiceSent` (`/Invoice/{id}/sendBy`) auf. Standard ist `VPDF`, kann via `SEVDESK_SEND_TYPE` überschrieben werden.

4. **Zahlungsbuchung**
   - Bei Status `bezahlt` wird `markInvoicePaid` aufgerufen und über `/Invoice/{id}/bookAmount` der Betrag auf `SEVDESK_CHECK_ACCOUNT_ID` gebucht.
   - Wichtig: SevDesk akzeptiert Buchungen nur für finalisierte Rechnungen (`status` ≥ 200). Der `sendBy`-Call stellt das sicher.

5. **PDF/Document-ID**
   - Nach der Anlage wird `/Invoice/{id}?embed=document` geladen, um die Dokument-ID im Strapi-Datensatz zu speichern (für anschließenden Download).

6. **Storno**
   - Bei Statuswechsel auf `storniert` ruft der Lifecycle `cancelInvoice` (`/Invoice/{id}/cancelInvoice`) auf und speichert ggf. die Storno-Dokument-ID.

## 3. Fehlerbilder & Troubleshooting
- **401 „Authentication required“** – Token fehlt/ist falsch. Prüfen, ob in der Umgebung wirklich das aktuelle Token geladen wird.
- **„ContactPerson ID …“ oder 422 bei `saveInvoice`** – `SEVDESK_CONTACT_PERSON_ID` fehlt oder verweist auf einen gelöschten Benutzer. Wert prüfen.
- **„Invoice: Correct number abort. Timeout“** – tritt auf, wenn eine Rechnungsnummer bereits existiert. Derzeit verhindern wir das mit unserem WA-Präfix.
- **„A draft can not be paid“ bei `bookAmount`** – die Rechnung wurde noch nicht finalisiert. Sicherstellen, dass `markInvoiceSent` ohne Fehler durchläuft.
- **Rate-Limit (429) oder 503** – die Requests besitzen automatisches Retry (max. 3 Versuche, exponentieller Delay). Bei dauerhaften Fehlern im Log prüfen.

## 4. Offene Aufgaben / TODOs
- Automatischer PDF-Download & Ablage prüfen (momentan wird nur die Dokument-ID gespeichert).
- Bei Bedarf weitere Sendetypen offizieller dokumentieren bzw. im Admin konfigurierbar machen.

## 5. Manuelle Aktionen / Hinweise
- **IDs prüfen:** Bei Änderungen in SevDesk (z. B. Konto gelöscht) müssen die ENV-Werte aktualisiert werden.
- **Logs:** `service_wineacadamy_staging`-Logs zeigen detaillierte JSON-Fehler (`SevDesk-Request fehlgeschlagen ...`). `exceptionUUID` für den Support notieren.
- **Staging-Tests:** Vor Deploys mindestens eine Testbestellung anlegen, in SevDesk prüfen (Rechnung → versendet → bezahlt), anschließend Testrechnung stornieren und Bestelldatensatz löschen.

Mit diesem Dokument sollten neue Entwickler schnell nachvollziehen können, wie der aktuelle Stand funktioniert und welche Voraussetzungen erfüllt sein müssen.
