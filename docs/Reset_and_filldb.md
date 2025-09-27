# Reset & Seed – Wine Academy (Entwurf)

> Achtung: Dieser Ablauf ist noch nicht finalisiert und muss für das neue Warenkorb-Modell erweitert werden. Nachfolgend der aktuelle Stand, damit lokale Tests möglich bleiben.

1. **Stack stoppen & Volumes löschen**
   ```bash
   docker compose -f docker-compose-staging.yml down -v
   ```
2. **Dev-Stack wieder starten**
   ```bash
   docker compose -f docker-compose-staging.yml up -d --build
   ```
3. **Backend-Strapi öffnen** (`http://localhost:1337/admin`) und einen Admin anlegen.
4. **Basisdaten einpflegen** (vorerst manuell, bis das Seed-Script aktualisiert ist):
   - Kategorien, Orte
   - Seminare inklusive Termine & Orte
   - Produkte (mit `istGutschein=true` für den Gutschein-Artikel)
   - Gutschein-Template (Single Entry – freier Betrag)
5. **Testbestellungen ergänzen** (optional):
   - Eine Bestellung mit Seminartermin und Teilnehmern
   - Eine Bestellung mit Produkt
   - Eine Bestellung für Gutschein (Status `bezahlt` → erzeugt Gutscheincode manuell)

> TODO: Das `backend/src/index.ts`-Seed-Script muss auf das neue Schema (Bestellung/Buchung/Produkt/Gutschein) angepasst werden. Bis dahin gelten die manuellen Schritte.
