# Content-Migration: WineAcademy.de → Strapi/Next.js

Stand: 26.10.2025

## Aktueller Status
- `scripts/crawl_wineacademy.py` lädt alle in `artifacts/crawl/url-seed-list.txt` hinterlegten URLs, speichert Roh-HTML, Assets und strukturierte Daten (Content, Navigation, SEO).
- Artefakt-Verzeichnis:
  - `artifacts/crawl/raw-html/*.html` – vollständige Seitenkopien.
  - `artifacts/crawl/assets/<host>/<pfad>` – heruntergeladene Medien, Fonts, Skripte, Stylesheets.
  - `artifacts/crawl/structured/content.json` – Kernstruktur pro Seite (Metadaten, JSON-LD, Inhalte, Assets, interne/externe Links).
  - `artifacts/crawl/structured/navigation.json` – Breadcrumb-Informationen je URL.
  - `artifacts/crawl/structured/seo.json` – Titel, Sprache, Meta-Tags pro URL.
- Vollständiger Lauf (26.10.2025): 93 Inhalte verarbeitet, 253 Assets lokal gespiegelt; Stichprobe (Startseite, Reben Talk) zeigt vollständige Meta-/Breadcrumb-Daten.
- Transformationsskript `scripts/transform_wineacademy.py` erstellt erste Product-Exports (`artifacts/crawl/structured/strapi/products.json`), inkl. Meta Description, Canonical, Breadcrumbs, JSON-LD-Angebot und Asset-Mapping.
- Transform-Skript exportiert nun auch statische Seiten (`artifacts/crawl/structured/strapi/pages.json`) mit HTML-Sektionen, Breadcrumbs und SEO-Daten.
- Strapi erhält neue SEO-Komponente `seo.meta` (Titel, Description, Canonical, Robots, OG-Bild) in Seminaren, Produkten, Kategorien und Landingpages; damit landen WP-Metadaten künftig strukturiert im CMS.
- `scripts/build_asset_manifest.py` erzeugt ein Hash-basiertes Asset-Manifest (`artifacts/crawl/structured/strapi/assets.json`) als Basis für Upload-Skripte.
- Import-Helfer `scripts/import_wineacademy.py` generiert Strapi-Payloads für Seminare (inkl. Tabs/SEO) und unterstützt Dry-Runs sowie spätere API-Imports.

## Nächste Schritte Import (Strapi)
1. **Content-Typ-Mapping definieren:**  
   - `product`/`buchung` → bestehende Strapi-Collection „Seminar/Produkt“.  
   - `page` → CMS Seiten (ggf. neuer Content-Type für statische Seiten + Rich-Text/Sections).  
   - `calendar`, `system` → entscheiden ob separate Collections oder Nur-Dokumentation.
2. **Transformations-Skript bauen (`scripts/transform_wineacademy.py`):**  
   - Liest `content.json`, mappt Felder auf Strapi-Strukturen (inkl. SEO, Assets, Navigation).  
   - Bereinigt HTML (z.B. Tabellen, CTA-Blöcke) und strukturiert Inhalte in Sections.  
   - Erstellt Import-Payloads (JSON/CSV) für Strapi oder direktes Seed-Skript.

### Anforderungen Transformations-Skript
- **Input:**  
  - `artifacts/crawl/structured/content.json`, `seo.json`, `navigation.json`, Asset-Verzeichnis.  
- **Ausgabe (erste Ausbaustufe):**  
  - `artifacts/crawl/structured/strapi/products.json` – Seminare/Produkte inkl. Preis, Beschreibungen, Assets, Navigation.  
  - `artifacts/crawl/structured/strapi/pages.json` – Statische Seiten mit Hero/Sections/SEO.  
  - `artifacts/crawl/structured/strapi/relations.json` – Zuordnung Kategorien ↔ Produkte, Breadcrumbs, interne Verlinkungen.  
  - `artifacts/crawl/structured/strapi/assets.json` – Mapping URL → lokaler Pfad → geplanter Strapi-Upload (Hash, Dateiname).  
- **Normalisierung:**  
  - HTML-Sanitizing (Whitespace, WordPress-spezifische Klassen entfernen).  
  - Zerlegung von Tabellen/Listen in strukturierte Blöcke (Langfristziel).  
  - Extraktion von Preis-/Termin-Informationen aus JSON-LD (Offers/Event).  
- **CLI-Optionen:**  
  - `--type (products|pages|all)`  
  - `--output-dir` für alternative Ausgabe  
  - `--dry-run` zur reinen Statistik-Ausgabe.  
- **Validierung:**  
  - Basis-Schema (z.B. JSON Schema) gegen Strapi-Modelle.  
  - Reports zu fehlenden Pflichtfeldern (Titel, Slug, Meta Description, Bilder).  
- **Weiteres:**  
  - Option, identische Inhalte per Hash zu deduplizieren.  
  - Mapping-Datei für manuelle Korrekturen (z.B. slug overrides).
3. **Asset-Upload vorbereiten:**  
   - Lokale Dateien aus `artifacts/crawl/assets` gegen Strapi Upload-Endpunkte spiegeln.  
   - Duplicate-Check via Hash/SHA1, Zuordnung zu Content-Einträgen speichern.
4. **Seed-/Migrationslauf:**  
   - Strapi CLI/Custom Script, das Entities anlegt, Relationen setzt (Kategorien ↔ Produkte).  
   - SEO-Felder (`seoTitle`, `seoDescription`, OpenGraph) auffüllen.  
   - Breadcrumb-Daten in Navigation/Collections übernehmen.
5. **Validierung:**  
   - Stichproben (Vergleich Roh-HTML vs. Strapi-Render).  
   - Sicherstellen, dass Frontend-API die neuen Daten liefert (ggf. Preview-Route).

## Frontend-Anpassungen
1. **Content-Bezug entkoppeln:** `frontend/app/page.tsx` & verwandte Komponenten so umbauen, dass Inhalte aus der Strapi-API (oder JSON-Fallback) geladen werden.  
2. **SEO/Metadaten:** Head-Komponenten auf die Einträge aus `seo.json` bzw. Strapi Feldern umstellen.  
3. **Navigation/Breadcrumbs:** Navigation aus `navigation.json`/Strapi generieren, manuelle Hardcodierungen entfernen.
4. **Fallback-Strategie:** Während der Migration JSON-Artefakte optional als statische Quelle nutzen (z.B. temporäre `lib/content-loader.ts`), bis Strapi-Seeds produktionsreif sind.

## Offene Fragen / ToDos
- Login-/Checkout-Routen benötigen gesonderte Behandlung (keine Migration, aber dokumentieren).
- Englische Varianten (URLs mit `/en/`) gesondert prüfen: eigener Content-Type oder Sprachfeld?
- Umgang mit Formularen (Contact Form 7, Newsletter): Migration oder Ablösung?
- Rate-Limits beobachten; ggf. `scripts/crawl_wineacademy.py` um Wartezeiten/Retry ergänzen.

## Umsetzungsempfehlung
1. Vollständigen Crawl ohne Limit durchführen (`python3 scripts/crawl_wineacademy.py`).  
2. Transformationsskript ausführen (`python3 scripts/transform_wineacademy.py --type all`) und Ergebnisse prüfen (`products.json`, `pages.json`).  
3. Optionales Asset-Manifest generieren (`python3 scripts/build_asset_manifest.py`).  
4. Testimporte mit `python3 scripts/import_wineacademy.py --type seminars --dry-run` durchführen, anschließend Strapi-API-Import konfigurieren.  
5. Frontend Schritt für Schritt auf API-/JSON-Quellen umstellen.  
6. Nach erfolgreichem Import DB-Snapshot als Seed-Basis sichern (für Reset-Szenarien).  
7. Regelmäßige Aktualisierung (Delta-Crawl) in den Projektprozess integrieren.
- **Offene Ausbaustufen (Transform):**  
  - Termin- und Veranstaltungsdaten aus JSON-LD `Event`-Blöcken für Kalender/Slots übernehmen.  
  - Inhaltssektionen weiter segmentieren (Hero, FAQ, CTA).  
  - Kategorien/Taxonomien aus Breadcrumbs und internen Links ableiten.  
  - Landingpage-Dynamic-Zonen auf Strapi-Komponenten mappen.
