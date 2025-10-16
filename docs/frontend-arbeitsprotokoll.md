# Frontend-Arbeitsprotokoll

- 2025-10-16 – Navbar lädt Navigation aus Strapi (`getNavigation`), Submenüs für Desktop/Mobil inkl. Dropdown/Accordion umgesetzt, Fallback-Navigation hinterlegt und Cart-Badge über Custom-Event/LocalStorage angebunden; `npm run build` erfolgreich (bekannte DaisyUI-`@property`-Warnung). – Commit: n/a
- 2025-10-15 – Standalone-Build repariert, indem die leere `next.config.mjs` (überschrieb `next.config.ts`) entfernt wurde; `npm run build` wieder erfolgreich. – Commit: n/a
- 2025-10-15 – `.dockerignore` im Frontend ergänzt (u. a. `node_modules`, `.next`), damit Docker-Builds nicht mehr lokale Artefakte kopieren; Next-Binary wieder ausführbar gemacht und `npm run build` erfolgreich getestet. – Commit: n/a
- 2025-10-15 – Tailwind/DaisyUI Build-Check (`npm run build`, `npx @tailwindcss/cli`) erfolgreich, DaisyUI GitMCP in `.vscode/mcp.json` ergänzt; Build warnte einmalig vor `@property`-At-Regel aus DaisyUI (informativ). – Commit: 25d5906
- 2025-10-15 – DaisyUI-Navbar mit Wine-Academy-Logo, Dropdown-Menü und Icon-Leiste (Mail, Instagram, LinkedIn, Warenkorb mit Badge-Platzhalter) implementiert; WineAcademy-Theme in DaisyUI registriert/aktiviert und Warenkorb-Drawer via DaisyUI aufgebaut (Header/Footer nach Screenshot, Platzhalterinhalt). Header/Footerschatten ergänzt. `npm run build` erfolgreich. – Commit: 4bdd129

- 2025-10-12 – Frontend vollständig geleert (Tailwind-Config, Global Styles, Layout/Page auf Basiszustand reduziert), Entwicklungsplan aktualisiert, `npm run lint` erfolgreich. – Commit: bebb749
- 2025-10-10 – Delete-Icon im Cart-Slideout vergrößert, paddingfrei in Titel-/Preiszeile positioniert und Abstände auf Figma „cart_slideout_new“ ausgerichtet; `npm run lint` erfolgreich. – Commit: b7e249c
- 2025-10-10 – Arbeitsrichtlinien für KI-Agenten im Frontend-README aktualisiert (Figma-Workflow konsolidiert). – Commit: n/a
- 2025-10-10 – Trash-Icon im Warenkorb durch neues Asset aus `public/icons` ersetzt, Icons verkleinert und Entfernen-Button absolut mit Pufferfläche positioniert; `npm run lint` erfolgreich. – Commit: n/a
- 2025-10-10 – Cart-Slideout-Styling (Header, Typografie, Mengensteuerung, Gutschein-Variante) an Figma „cart_slideout_new“ angenähert; `npm run lint`, `node tests/cart-slideout-screenshot.mjs`, `node tests/cart-compare.mjs` ausgeführt. – Commit: n/a
- 2025-10-10 – Headerhöhe, Quantity-Control-Kreise und Delete-Icon exakt nach Figma korrigiert; Screenshots/Diff aktualisiert (`node tests/cart-slideout-screenshot.mjs`, `node tests/cart-compare.mjs`, `npm run lint`). – Commit: n/a
- 2025-10-10 – Menge-Controls ohne Lücke und Bootstrap-Icon „trash3“ integriert, erneute Screenshots & Lint (`node tests/cart-slideout-screenshot.mjs`, `node tests/cart-compare.mjs`, `npm run lint`). – Commit: n/a
- 2025-10-10 – Slideout mit sanfter Translate-Animation versehen und Bootstrap-Icon per `fillRule` korrigiert; aktuelle Screenshots & Lint erstellt (`node tests/cart-slideout-screenshot.mjs`, `node tests/cart-compare.mjs`, `npm run lint`). – Commit: n/a
- 2025-10-10 – Figma-Vorlage „cart_slideout_new“ via Puppeteer-Screenshot (localhost) und Figma-Export gegengeprüft; Diffs in `artifacts/` abgelegt und Analyse dokumentiert (`node tests/cart-slideout-screenshot.mjs`, `node tests/cart-compare.mjs`). – Commit: n/a
- 2025-10-09 – Platzhalter-Inhalte im CartProvider an Figma-Frame „cart_slideout_new“ angepasst, um das neue Warenkorb-Design vorzubereiten. – Commit: n/a
- 2025-10-09 – Cart-Slideout per MCP-Figma-Vorlage „cart_slideout_new“ vollständig neu aufgebaut (Header, Karten, Summenbereich, Controls) und mit `npm run lint` geprüft. – Commit: n/a
- 2025-10-09 – Warenkorb-Slideout geleert, bestehende Inhalte entfernt und Platzhalter-Struktur vorbereitet; `npm run lint` erfolgreich. – Commit: n/a
- 2025-10-09 – Warenkorb-Slideout anhand des Figma-Frames „warenkorb_slideout“ komplett neu umgesetzt (Header, Kartenlayout, Footer) und `npm run lint` erfolgreich ausgeführt. – Commit: n/a
- 2025-10-09 – Warenkorb-Slideout vollständig geleert, damit der Neuaufbau von Grund auf erfolgen kann; `npm run lint` erfolgreich. – Commit: n/a

- 2025-10-09 – Eigenes Frontend-Arbeitsprotokoll angelegt und Referenzen in README/Plan aktualisiert. – Commit: n/a
- 2025-10-08 – Landingpage-Renderer im App Router aufgebaut; Dynamic-Zone-Komponenten (Hero, Karten-Grid, Textblock, Icon-Grid) konsumieren die neuen Strapi-Daten unter `/landing/:slug`. – Commit: n/a
- 2025-10-08 – Warenkorb-Slideout im Frontend neu aufgebaut (CartProvider, Slideout mit Seminartagen, Summenberechnung, Button „Jetzt bezahlen“) und an LocalStorage/Cart-Events angebunden; ESLint erfolgreich ausgeführt. – Commit: 976e26c
- 2025-10-08 – Frontend auf DaisyUI v5 Basis zurückgesetzt (Altstrukturen entfernt, Navigation & Landingpage mit Standardkomponenten neu aufgebaut). – Commit: n/a
- 2025-10-02 – Termin-Relation von "Ort" auf "Standort" im Frontend nachgezogen (Queries, Komponenten, TS-Typen); ESLint & TypeScript-Check ausgeführt. – Commit: n/a
- 2025-10-03 – Warenkorb-Slideout im Frontend entschlackt (Seminar-Termine mit Uhrzeiten, vereinheitlichte Karten für Produkte/Gutscheine) und Safe-Area-Padding für den Kassen-Button ergänzt; ESLint mangels Projektkonfiguration nicht lauffähig. – Commit: n/a
- 2025-10-03 – Frontend-README um verpflichtenden Build/Compose-Neustart + Browser-Sichtprüfung ergänzt und Staging-Web-Container neu gebaut/gestartet. – Commit: n/a
- 2025-10-03 – Warenkorb-Karten erneut gestrafft (Seminarnamen bereinigt, Tagesliste, Button-Abstand) und Staging-Frontend via Compose neu gebaut. – Commit: n/a
- 2025-10-03 – Warenkorb-Footer erneut justiert (Safe-Area-Reserve erhöht, min-h-0 gesetzt) und Close-Buttons als deutlich sichtbares „×“ umgesetzt; Staging-Webservice via Compose neu ausgerollt. – Commit: n/a
- 2025-10-03 – Checkout in einen nummerierten Stepper umgebaut (Warenkorb → Teilnehmer → Rechnungsadresse → Bestätigungen → Zahlung), Checkboxen vor die Zahlarten gezogen und Teilnehmerblöcke mit „Teilnehmer 1/2 …“ gekennzeichnet. – Commit: n/a
- 2025-10-08 – Navbar ersetzt Kontakt-CTA durch DaisyUI-Warenkorb-Button mit Badge (Cart-Count via LocalStorage/Custom-Event), lokale Sichtprüfung im Frontend-README dokumentiert. – Commit: n/a
- 2025-10-08 – Figma-Navigation übernommen: Neue Navbar-Komponente mit Hauptmenü, Social-Links (Instagram, Facebook, Mail) und Warenkorb-Badge implementiert; layout.tsx bereinigt und Linting lokal erfolgreich ausgeführt. – Commit: n/a
- 2025-10-08 – CMS-Navigation/Footer ins Frontend integriert: Fetch-Helper, dynamische Navbar mit Untermenüs sowie Footer-Rendering inklusive Medienauflösung, `npm run lint` erfolgreich. – Commit: n/a
- 2025-10-08 – Navigation/Footer-Fetch auf „no-store“ umgestellt, Layout auf `revalidate = 0` gesetzt und Staging-Frontend neu gebaut, damit CMS-Daten sofort erscheinen. – Commit: n/a
