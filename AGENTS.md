## Pflichtlektüre vor jeder Änderung
> Dieses Agenten-Dokument ergänzt die Informationen aus `README.md`, `backend/README.md` und `frontend/README.md`; lies die Dateien im Zusammenspiel.
- Umgebung: Staging-Stack (`docker-compose-staging.yml`, Domain `https://wineacademy.plan-p.de`).
- **README einlesen:** Lies zu Beginn jeder Session `README.md` und berücksichtige die dortigen Informationen.
- **Teilprojekte:** `backend/README.md` bzw. `frontend/README.md` je nach Arbeitsbereich
- **Weitere Referenzen:**
  - `docs/Reset_and_filldb.md` – Datenbank zurücksetzen/füllen
  - `docs/server-infrastructure.md` – Hosting & Traefik-Setup

## Arbeitsprinzipien
1. Formuliere vor Änderungen einen kurzen Plan (2–5 Schritte) und notiere Befehle/Tests, die du ausführen willst.
2. Arbeite immer auf der Staging-Compose (`docker compose -f docker-compose-staging.yml ...`). Für produktive Deploys wird `docker-compose.yml` genutzt. Kein direktes Arbeiten außerhalb der erlaubten Services.
3. Nachdem du programmiert hast, möchte ich dass du eigenständig durchtest ist ob die änderung oder die ergänzung funktioniert.
4. Halte Änderungen klein und zielgerichtet. Keine Refactorings ohne expliziten Auftrag.
5. Stimme dich an bestehende Formatierungen (Prettier/Tailwind/ESLint) ab; keine bewussten Stilbrüche.
6. Teste jede Änderung die du machst immer selber

## Kommunikation
- Antworte auf Deutsch.
- Melde unerwartete Zustände (z. B. fremde Änderungen, fehlende Zugänge) sofort und stoppe Arbeiten, bis geklärt.
