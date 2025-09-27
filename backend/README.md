# Backend (Strapi 5)

Das Strapi-Backend stellt alle Inhalte (Seminare, Termine, Produkte) und Checkout-Flows für die Wine Academy Hamburg bereit. Es läuft als Node 20 Service mit PostgreSQL 15 und versorgt das Next.js-Frontend ausschließlich über Public-Endpoints.

## Dokumentation & Referenzen
- Root-Übersicht: `../README.md`
- Seeding/Reset: `../docs/Reset_and_filldb.md`
- Infrastruktur & Deploy: `../docs/server-infrastructure.md`
- Frontend-Integration: `../frontend/README.md`

## Lokaler Start
```bash
docker compose -f ../docker-compose-staging.yml up -d service_wineacadamy_staging
# Logs
docker compose -f ../docker-compose-staging.yml logs -f service_wineacadamy_staging
```
Strapi Admin erreichst du auf `http://localhost:1337/admin` (erster Start → eigenen Admin anlegen).

## Datenmodell (Kurzfassung)
- **Seminar** – Stammdaten, Texte, Bild, Standardpreis, Relation zu Kategorien & Terminen
- **Termin** – Datum(e) (`termin.seminartag`), Preis, `planungsstatus`, Relation zu Seminar & Ort
- **Ort** – Veranstaltungsort (Adresse, Typ)
- **Bestellung** – Rechnungs-/Zahlungsdaten, Warenkorb-Positionen, Summen, Status (`offen|bezahlt|storniert`), Relation zu Kunde, Buchungen, Gutscheinen
- **Buchung** – Teilnehmer eines Seminartermins inkl. Preis/MwSt, verweist auf Termin & Bestellung
- **Produkt** – Shop-Artikel (inkl. Flag `istGutschein` für Gutschein-Template)
- **Gutschein** – Template oder generierter Code (Betrag, Bestellung, Einlöse-Status)

Namenskonvention: Verwende `planungsstatus` statt `status`, und halte Relationen gemäß oben beschriebenem Modell.

## Public API
| Endpoint | Zweck |
| --- | --- |
| `GET /api/public/seminare` | Liste aktiver Seminare inkl. geplanter Termine |
| `GET /api/public/seminare/:slug` | Seminardetail (Texte, Termine, Preise) |
| `GET /api/public/produkte` | Aktive Shop-Produkte (inkl. evtl. Gutschein-Template) |
| `GET /api/public/gutscheine/template` | Konfiguration für Gutschein-Betrag (Min/Max, Beschreibung) |
| `POST /api/public/gutscheine/pricing` | Wunschbetrag validieren und runden |
| `POST /api/public/bestellungen` | Bestellung anlegen (Rechnung oder PayPal-Capture) |
| `GET /api/public/bestellungen/:id` | Minimalstatus einer Bestellung (Summen, Codes) |

**Beispiel (Produkt-Bestellung via Rechnung):**
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
- Seminare/Produkte/Gutscheine werden im Payload als Positionen übergeben; der Server berechnet Netto/Brutto/Steuern und prüft verfügbare Termine/Produkte.
- `buchungen` müssen je Seminartermin die gleiche Anzahl an Teilnehmern wie die Position enthalten.
- Bei PayPal wird optional `paypalCaptureId` und `paypalOrderId` übergeben. Erfolgreiche Capture ⇒ Status `bezahlt`, `zahlungsmethode='paypal'`, Gutscheincodes werden generiert.
- Webhook (`POST /api/public/paypal/webhook`) prüft Signatur (`PAYPAL_WEBHOOK_ID`), verifiziert Betrag/Währung und schließt offene Bestellungen nach.

ENV-Variablen (Auszug): `APP_KEYS`, `JWT_SECRET`, `API_INTERNAL_URL`, `PUBLIC_URL`, `PAYPAL_*`, `CORS_ORIGINS`. Siehe `.env.example` bzw. Compose-Dateien.

## Datenpflege & Admin
- Seed/Reset **immer** nach `../docs/Reset_and_filldb.md`.
- Nach Schemaänderungen Content Manager → *Configure* → “Reset to default”, damit neue Felder sichtbar werden.
- Keine manuellen Änderungen in `types/generated/*` – sie werden von Strapi generiert.

## Hinweise für Agenten/KI
- Folge zusätzlich `../AGENTS.md`.
- Arbeite ausschließlich über die Public-Endpoints (siehe Tabelle oben).
- Verwende Docker Compose-Kommandos aus dem Projekt-Root.
- Änderungen klein halten; vor Commits Tests/Builds nur bei Bedarf.
