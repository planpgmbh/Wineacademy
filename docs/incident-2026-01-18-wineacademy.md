# Sicherheitsvorfall 2026-01-18 (Wine Academy)

## Kurzfassung
Am 2026-01-18 wurde ein Sicherheitsvorfall rund um die Wine Academy Plattform festgestellt.
In Logs des Containers `web_wineacadamy` tauchten Shell-Ausfuehrungen auf und es wurde
eine PHP-Webshell (`ids.php`) unter `/app/public` gefunden. Der Angreifer versuchte,
Container-Credentials ueber die AWS Metadata URL (`169.254.170.2`) abzurufen.
Der Host zeigte zeitgleich OOM-Killer Eintraege (siehe Screenshot im Incident-Ordner);
ein direkter Zusammenhang ist plausibel, aber nicht bewiesen.

Ziel dieses Dokuments: Die beobachteten Fakten, die vermutete Schwachstelle und die
umgesetzten Gegenmassnahmen festhalten, damit kuenftige Arbeiten dies beruecksichtigen.

## Betroffene Komponenten
- Container: `web_wineacadamy` (Next.js) und indirekt `service_wineacadamy` (Strapi).
- Pfad: `/app/public` (Webshell wurde dort abgelegt).
- Logs/Artefakte:
  - `incident-wineacadamy-20260118-234842/web_wineacadamy.log.suspicious.txt`
  - `incident-wineacadamy-20260118-234842/artifacts/app-public/ids.php`

## Indikatoren (IOCs)
- Webshell-Datei: `ids.php`
  - Inhalt (Kurz):
    - `system($_GET['cmd'])` fuer Command-Execution.
    - Upload-Funktion fuer weitere Dateien.
- Logzeilen mit Command-Ausfuehrung im Web-Container:
  - `/bin/sh: curl: not found` (2026-01-01/02)
  - `wget -qO- "http://169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI"` (2026-01-09)

## Zeitlinie (bekannt/geschaetzt)
- 2026-01-01/02: Erste Spuren von Shell-Ausfuehrung im Web-Container (`curl`-Aufruf).
- 2026-01-09: Versuch, AWS Container Credentials auszulesen (Metadata-URL).
- 2026-01-18: Ausfall/Instabilitaet am Host (OOM-Killer; Screenshot im Incident-Ordner,
  keine absolute Uhrzeit im Artefakt dokumentiert).
- 2026-01-19: Analyse, Hardening und Monitoring-Aktualisierung.

## Vermutete Ursache (nicht abschliessend)
- Der genaue Eintrittspunkt ist nicht eindeutig nachweisbar.
- Die Indikatoren sprechen fuer eine Command-Injection oder eine Schwachstelle in einem
  oeffentlich erreichbaren Endpoint.
- In der Codebasis war der Landingpage-Slug zuvor unvalidiert und ungefiltert in API-Pfade
  uebernommen; das wurde spaeter gehaertet.
- Der Container war vor dem Hardening schreibbar, wodurch das Ablegen von `ids.php` in
  `/app/public` moeglich war.

## Moegliche Eintrittswege (Hypothesen)
- Kompromittierte Strapi-Admin-Zugangsdaten (Inhalte/Uploads/Tokens aenderbar, aber keine
  automatische Server-Code-Ausfuehrung).
- Verwundbare Abhaengigkeit/Plugin (Strapi/Editor/Preview-Endpunkt).
- Eingabe-Handling (z. B. Slug/Preview) ohne ausreichende Validierung.
- Zu weit gefasste Schreibrechte im Container (Ablage von Webshells).

## Auswirkungen
- Moegliche Code-Ausfuehrung innerhalb des Web-Containers.
- Versuch der Credential-Exfiltration (AWS Metadata URL).
- Kein belastbarer Nachweis fuer Datenabfluss; keine dauerhafte Malware im aktuellen Stand
  gefunden (Stand der letzten Checks).

## Gegenmassnahmen (umgesetzt)
- Docker-Hardening in `docker-compose.yml` und `docker-compose-staging.yml`:
  - `read_only: true`, `no-new-privileges`, `cap_drop: ALL`, `tmpfs` fuer schreibbare Pfade.
- Input-Validation:
  - Slug-Validierung und -Encoding in
    - `frontend/app/(landing)/[slug]/page.tsx`
    - `frontend/lib/landing-transformers.ts`
    - `frontend/app/preview/route.ts`
  - Backend-Validation in `backend/src/api/landingpage/controllers/landingpage.ts`.
- Monitoring:
  - Traefik Access Logs in `services/traefik/traefik.yaml`.
  - Rotation via `/etc/logrotate.d/traefik-access`.

## Was wurde nicht geaendert
- Keine Secrets/Token-Rotation (nur empfohlen).
- Keine forensische Vollanalyse der gesamten Loghistorie.
- Keine umfassende Bereinigung/Neuinitialisierung der Datenbank.

## Aktueller Status (Checks)
- Keine verdaechtigen Prozesse in den Wineacadamy-Containern.
- Keine `.php`/`.phtml`/`.phar` Dateien in `/app/public/uploads`.
- In den aktuellen Traefik-Logs keine auffaelligen Request-Pfade mit typischen
  Command-Injection-Mustern.

## Empfehlungen fuer die Zukunft
- Regelmaessige Updates fuer Strapi/Next und alle Abhaengigkeiten.
- Rate-Limits/WAF-Regeln fuer oeffentliche Endpoints (insb. Preview/Slug).
- Secrets rotieren, wenn es Anzeichen fuer Exfiltration gibt.
- Automatisierte IOC-Suche (z. B. Webshell-Signaturen in Uploads).
- Alerts fuer Muster wie `cmd=`, `/bin/sh`, `wget`, `curl`, `base64`.

## Lessons Learned / Checkliste
- Container-Dateisysteme standardmaessig read-only, nur benoetigte Pfade freigeben.
- Eingaben streng validieren (Slug/Preview) und Pfade immer URL-encoden.
- Admin-Zugaenge absichern (2FA, IP-Whitelist, Logging, Token-Rotation).
- Monitoring frueh aktivieren (Access-Logs + Alerts).

## Offene Punkte
- Exakte Eintrittsstelle des Angriffs bleibt unbestaetigt.
- Optional: forensische Analyse der betroffenen Zeitraeume mit vollstaendigen
  Access-/App-Logs.
