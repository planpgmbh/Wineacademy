# Projekt-Agent Regeln

Diese Regeln gelten sowohl auf dem Server (Staging/Live) als auch lokal. Zu Beginn jeder Session muss die aktuelle Umgebung geklärt und laut benannt werden (User fragen, `pwd`, Docker-Status oder Marker-Datei prüfen). Nutze dafür bevorzugt eine lokale Marker-Datei wie `.environment` (`local`, `staging`, `live`), sofern vorhanden. Erst nach eindeutiger Zuordnung fortfahren und die passenden Hinweise beachten.

- **README einlesen:** Lies zu Beginn jeder Session `README.md` und berücksichtige alle dortigen Informationen.
- **Bereichsspezifische Readmes:** Bei Backend-Arbeiten vor dem Plan `backend/README.md`, bei Frontend-Arbeiten `frontend/README.md` querlesen und relevante Hinweise einplanen.
- **Sprache:** Antworte immer auf Deutsch.
- **Planung vor Umsetzung:** Vor jeder größeren Änderung einen kurzen Plan (2–5 Schritte) formulieren und Freigabe abwarten.
- **Teste:** Nach Implementierungen die relevanten Tests/Linting ausführen und Ergebnisse nennen.
- **Arbeitsprotokolle:** Fortschritt, geplante Arbeiten und Commit-IDs im passenden Bereichslog (`docs/backend-arbeitsprotokoll.md` bzw. `docs/frontend-arbeitsprotokoll.md`) dokumentieren und den Entwicklungsplan aktuell halten.
- **Commits:** Nur auf ausdrückliche Anweisung committen/pushen (z. B. Befehl „commit“). Danach `git push origin staging` und Commit-ID im jeweiligen Arbeitsprotokoll vermerken.
- **Datenbank Reset:** Wenn „dbreset“ o. ä. gefordert wird, Datenbank löschen und Seeds neu einspielen.
- **Commit-Nachricht:** Auf Deutsch, kurz und beschreibend.
- **Server-Infrastruktur:** Für Compose-/Traefik-/Hosting-Fragen `docs/server-infrastructure.md` heranziehen.
- **Liveserver:** Arbeitest du direkt auf dem Server, jede Änderung besonders vorsichtig durchführen und unnötige Eingriffe vermeiden.
- **Lokale Entwicklung:** `.env.local` eigenständig pflegen, niemals Secrets einchecken. Wenn du lokale Frontend-Tests gegen Staging ausführst, löst du reale Staging-Prozesse (SevDesk, SendGrid, PayPal) aus und räumst Testdaten anschließend auf.
