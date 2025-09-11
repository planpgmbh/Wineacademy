# Agenten‑Hinweise (gesamtes Repo)

Diese Datei gibt KI‑Agenten verbindliche Hinweise für Arbeiten in diesem Projekt. Bitte befolge sie bei allen Änderungen.

- Lese zuerst die passenden READMEs:
  - Root: `README.md` (Docker Desktop, Compose, Ports/Routing)
  - Backend: `backend/README.md` (Datenmodell, Public‑APIs, Lifecycles, Admin‑Hinweise)
- Führe Seeding/Reset grundsätzlich nach `docs/Reset_and_filldb.md` aus. Wenn ein Mensch „Seed starten“ oder „DB resetten“ schreibt, öffne `docs/Reset_and_filldb.md` und folge der Anleitung.
- Halte dich an die Public‑APIs des Backends:
  - `GET /api/public/seminare`
  - `GET /api/public/seminare/:slug`
  - sowie die ergänzenden Public‑Endpoints in `backend/README.md`.
- Keine internen Services des Backends direkt vom Frontend aus ansprechen.
- Naming/Model‑Konventionen: `planungsstatus` statt `status`; Termin → Ort/Seminar (n:1), Seminar ↔ Termine (1:n).
- Änderungen minimal und fokussiert halten; keine ungebetenen Refactorings.

Vielen Dank!
