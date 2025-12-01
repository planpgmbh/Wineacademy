# Projekt-Agent Regeln

Diese Regeln gelten sowohl auf dem Server (Staging/Live) als auch lokal. Zu Beginn jeder Session muss die aktuelle Umgebung geklärt und laut benannt werden (User fragen, `pwd`, Docker-Status oder Marker-Datei prüfen). Nutze dafür bevorzugt eine lokale Marker-Datei wie `.environment` (`local`, `staging`, `live`), sofern vorhanden. Erst nach eindeutiger Zuordnung fortfahren und die passenden Hinweise beachten.

- **README einlesen:** Lies zu Beginn jeder Session `README.md` und berücksichtige alle dortigen Informationen.
- **Bereichsspezifische Readmes:** Bei Backend-Arbeiten vor dem Plan `backend/README.md`, bei Frontend-Arbeiten `frontend/README.md` querlesen und relevante Hinweise einplanen.
- **Sprache:** Antworte immer auf Deutsch.
- **Planung vor Umsetzung:** Vor jeder größeren Änderung einen kurzen Plan (2–5 Schritte) formulieren, im Plan-Tool erfassen und nach jedem Schritt aktualisieren; Freigabe abwarten.
- **Kleine CSS-Änderungen:** Minimal-invasive Style-Fixes (z. B. Abstände/Farben) direkt umsetzen und kurz notieren; keine ausgefeilte Erklärung oder Vorab-Freigabe nötig.
- **Modell-Empfehlung:** Direkt nach dem Plan (und nach jedem Plan-Update) kurz begründen, ob Codex Low, Medium oder High am besten passt.
- **Teste:** Nach Implementierungen die relevanten Tests/Linting ausführen und Ergebnisse nennen.
- **Commit-Protokoll (Backend & Frontend):** Commit-Log ist die zentrale Dokumentation. Jeder Commit enthält einen kurzen deutschen Titel und einen aussagekräftigen Body mit: Ziel/Vorhaben, Versuchen incl. Fehlversuchen, ggf. Fehlermeldungen/Logs, finaler Lösung oder Erkenntnis, Tests/Checks, offene Punkte. Keine neuen Einträge mehr in `docs/backend-arbeitsprotokoll.md` (nur Historie).
- **Commits:** Nur auf ausdrückliche Anweisung committen. Direkt nach jedem Commit sofort `git push origin staging`; Commit-Body wie oben beschrieben formulieren.
- **Git Reset nur nach Rückfrage:** Befehle wie `git reset` oder andere globale Rollbacks dürfen erst nach expliziter Nachfrage und Zustimmung ausgeführt werden (z. B. „Zum Wiederherstellen würde ich `git reset` nutzen – ist das ok?“).
- **Datenbank Reset:** Wenn „dbreset“ o. ä. gefordert wird, Datenbank löschen und Seeds neu einspielen.
- **Server-Infrastruktur:** Für Compose-/Traefik-/Hosting-Fragen `docs/server-infrastructure.md` heranziehen.
- **Liveserver:** Arbeitest du direkt auf dem Server, jede Änderung besonders vorsichtig durchführen und unnötige Eingriffe vermeiden.
- **Lokale Entwicklung:** `.env.local` eigenständig pflegen, niemals Secrets einchecken. Wenn du lokale Frontend-Tests gegen Staging ausführst, löst du reale Staging-Prozesse (SevDesk, Mailversand, PayPal) aus und räumst Testdaten anschließend auf.
- **Benachrichtige mich per Telegramm:** Immer wenn du etwas abgeschlossen hast oder auf Feedback wartest, sende sofort eine Telegram-Nachricht. Der Token liegt als `TELEGRAMMBOT` in `frontend/.env.local` oder `.env.staging`, zum Beispiel:

  ```bash
  TELEGRAM_TOKEN=$(awk -F= '/^TELEGRAMMBOT=/{print $2}' frontend/.env.local)
  curl -X POST https://chatbot.plan-p.de/notify \
    -H "Content-Type: application/json" \
    -H "X-Notify-Token: ${TELEGRAM_TOKEN}" \
    -d '{"message":"Hier steht die Nachricht."}'
  ```

  Den Nachrichtentext jeweils passend zum erledigten Schritt anpassen.
