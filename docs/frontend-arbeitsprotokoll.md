# Frontend-Arbeitsprotokoll

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
