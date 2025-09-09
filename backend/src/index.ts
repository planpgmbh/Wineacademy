// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi } /* : { strapi: Core.Strapi } */) {
    // Deutsch: Dieser Block wird beim Starten der Strapi-App ausgeführt ("bootstrap").
    // Flags aus der Umgebung lesen:
    // - SEED=true: Testdaten anlegen (idempotent)
    // - SEED_RESET=true: vorhandene Testdaten löschen und anschließend neu anlegen
    const shouldSeed = process.env.SEED === 'true';
    const shouldReset = process.env.SEED_RESET === 'true';

    // Hilfsfunktion: Testdaten anlegen (Ort, Seminar, Termin)
    const slugify = (input: string) => {
      const map: Record<string, string> = { 'ß': 'ss' };
      const replaced = input.replace(/[ß]/g, (m) => map[m] || m);
      const noDiacritics = replaced.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return noDiacritics
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
    };

    const runSeed = async () => {
      strapi.log.info('[seed] Starte Seed...');
      strapi.log.info('[seed] Schritt 1: count seminare');

      // Prüfen, wie viele Seminare existieren.
      const seminarCount = await strapi.entityService.count('api::seminar.seminar');
      strapi.log.info(`[seed] count seminare: ${seminarCount}`);
      if (seminarCount > 0) {
        strapi.log.info('[seed] Daten vorhanden – kein erneuter Seed erforderlich');
        return;
      }

      // 1) Gewünschte Orte anlegen: Hamburg, Mannheim, Online
      strapi.log.info('[seed] Schritt 2: create orte');
      const ortPayloads = [
        {
          standort: 'Hamburg',
          typ: 'vorort',
          veranstaltungsort: 'Wine Academy Hamburg',
          stadt: 'Hamburg',
          land: 'Deutschland',
        },
        {
          standort: 'Mannheim',
          typ: 'vorort',
          veranstaltungsort: 'Wine Academy Mannheim',
          stadt: 'Mannheim',
          land: 'Deutschland',
        },
        {
          standort: 'Online',
          typ: 'online',
          veranstaltungsort: 'Online via Zoom',
          stadt: 'Remote',
          land: 'Deutschland',
        },
      ];
      const orte: any[] = [];
      for (const o of ortPayloads) {
        const created = await strapi.entityService.create('api::ort.ort', {
          data: { ...o, publishedAt: new Date().toISOString() },
        });
        orte.push(created);
      }

      // 2) Seminare gemäß Vorgabe anlegen (WSET, Masterclasses, Bourgogne, Sensorik)
      strapi.log.info('[seed] Schritt 3: create seminare');
      const seminarPayloads = [
        {
          seminarname: 'WSET® Level 1 Weine',
          kurzbeschreibung:
            'Ideal für Einsteiger:innen ohne Vorkenntnisse. Grundlagen zu Weinbau, Weintypen, Lagerung und Service.',
          beschreibung:
            'Entdecke die Schlüsselaspekte des Weinbaus, lerne die Hauptweintypen kennen und vertiefe dein Verständnis für Weinbereitung, Lagerung und Service.',
          infos:
            'Lernziele: Verständnis für Phasen beim Weinbau und Weinbereitung, relevante Weinstile, Grundlagen Lagerung und Service.\n' +
            'Prüfung: Multiple-Choice (30 Fragen, 45 Minuten), Zertifikat digital auf Deutsch.\n' +
            'Was ist enthalten: Schulungsunterlagen (PDF), Verkostung von 9 Weinen, Prüfungsgebühr, Zertifizierte E-Mail Signatur.',
          standardPreis: 350.0,
          aktiv: true,
        },
        {
          seminarname: 'WSET® Level 2 Weine',
          kurzbeschreibung:
            'Fundierter Einblick in Rebsorten, Weinstile und Anbauregionen. Verkostung nach WSET-SAT.',
          beschreibung:
            'Fundierter Einblick in die Welt des Weines: „Was steht auf dem Etikett“ – Einführung in Rebsorten, Weinstile und die wichtigsten Anbauregionen (20+ Rebsorten, 70+ Anbaugebiete).',
          infos:
            'Lernziele: Systematische Verkostung, Umweltfaktoren, Weinbereitung, Kenntnis der wichtigsten Rebsorten und Qualitätsfaktoren weltweit.\n' +
            'Prüfung: Multiple-Choice (50 Fragen, 60 Minuten), WSET Zertifikat auf Deutsch.\n' +
            'Was ist enthalten: Deutsche Schulungsunterlagen, Verkostung von 30 Weinen, Prüfungsgebühr, Zertifikat.',
          standardPreis: 950.0,
          aktiv: true,
        },
        {
          seminarname: 'WSET® Level 3 Weine',
          kurzbeschreibung:
            'Vertiefender Kurs für Fortgeschrittene. Stil, Qualität, Preis – Verkostung mit Analyse (SAT).',
          beschreibung:
            'Tiefergehendes Wissen zu den wichtigsten Weinen der Welt, deren wirtschaftlicher Bedeutung sowie Faktoren für Stil, Qualität und Preis. Umfangreiche Verkostung mit Analyse von Stil, Qualität, Trinkreife.',
          infos:
            'Lernziele: Umgang mit Produktwissen, Beratung zum Wein, professionelle Auswahl, Kompetenz für internationale Geschäftsbeziehungen.\n' +
            'Prüfung: Multiple-Choice + offene Fragen, Blindverkostung von 2 Weinen.\n' +
            'Was ist enthalten: Schulungsunterlagen, Verkostung von 80 Weinen, Prüfungsgebühr, Zertifikat.',
          standardPreis: 1850.0,
          aktiv: true,
        },
        {
          seminarname: 'Assistant Sommelier (inkl. WSET® Level 2 Weine)',
          kurzbeschreibung:
            'Intensive Weiterbildung für Gastronomie, Handel, Tourismus und Liebhaber inkl. WSET 2.',
          beschreibung:
            'Kombination aus WSET Level 2 und Assistant Sommelier Ausbildung. Vertiefung von Rebsortenkunde, Service & Präsentation, VDP und Kommunikation – auf Wunsch mit betrieblicher Anpassung.',
          infos:
            'Lernziele: Weinland Deutschland, Rebsortenkunde, VDP, Service & Präsentation, Kommunikationsfähigkeiten.\n' +
            'Prüfung: Multiple-Choice WSET 2 (60 Minuten), praktische Prüfungen, Zertifikate.\n' +
            'Was ist enthalten: Studienpaket, Verkostung von 45 Weinen, Zertifikate, Getränke zu den Seminaren.',
          standardPreis: 1650.0,
          aktiv: true,
        },
        {
          seminarname: 'Masterclass Champagne: Essentials',
          kurzbeschreibung:
            'Eintägige Masterclass zu Herstellung, Stilistik, Terroir und Anwendungen von Champagner.',
          beschreibung:
            'Fokus auf die Herstellung, Lagerung, Stilistik und Terroir von Champagner. Vielseitige Verkostung und Blindprobe inkl. praktischer Anwendungen (Glas, Temperatur etc.).',
          infos:
            'Lernziele: Verständnis von Terroir, Assemblage, Autolyse, Hausstile, Anwendung zu Speisen und festlichen Anlässen.\n' +
            'Prüfung: Abschluss noch am selben Tag, Zertifikat.\n' +
            'Was ist enthalten: Unterlagen, Verkostung von 12+ Weinen, Blindverkostung, Zertifikat.',
          standardPreis: 320.0,
          aktiv: true,
        },
        {
          seminarname: 'Masterclass Sake',
          kurzbeschreibung:
            'Einführung in Sake: Herstellung, Reissorten, Stile, Service und Food-Pairing.',
          beschreibung:
            'Tradition und Kultur aus Japan: Einführung in Sake, Herstellung, Reissorten, Produktionsschritte, Sake-Kategorien und Stile, Service und Food-Pairing.',
          infos:
            'Lernziele: Strukturierte Verkostung, Verständnis von Kanji, Lagerung & Service, Kompetenz für Pairing.\n' +
            'Prüfung: Abschluss am Kurstag, Zertifikat.\n' +
            'Was ist enthalten: Unterlagen, Verkostung von 8 Sake, Zertifikat.',
          standardPreis: 249.0,
          aktiv: true,
        },
        {
          seminarname: 'Bourgogne – der Überblick',
          kurzbeschreibung:
            'Region, Klassifikation, Rebsorten und Stilistik – mit Verkostung weiß, rot und Crémant.',
          beschreibung:
            'Überblick zu Geografie, Klassifizierung, Geschichte, Rebsorten und Stilistik der Bourgogne. Vergleich von Weiß-/Rotweinen und Crémant de Bourgogne als Champagner-Alternative.',
          infos:
            'Lernziele: Einordnung der Bourgogne-Region, Rebsorten, Appellation, Genuss & Sensorik mit Fokus auf Chardonnay und Pinot Noir.\n' +
            'Prüfung: Abschlusszertifikat am Tag.\n' +
            'Was ist enthalten: Verkostung von 12 Weinen, Zertifikat.',
          standardPreis: 190.0,
          aktiv: true,
        },
        {
          seminarname: 'Sensorik: Essentials',
          kurzbeschreibung:
            'Eintägiger Kurs zum Schärfen der Sinne: Vokabular, strukturierte Verkostung und Blindprobe.',
          beschreibung:
            'Einführung mit Entwicklung unserer Sinneswahrnehmung, Sensibilisierung, strukturierte Verkostung, Vokabular, Blindverkostung zur Qualitätsbeurteilung.',
          infos:
            'Lernziele: Sehen, Hören, Riechen, Schmecken, Fühlen; professionelle Beschreibung und Bewertung.\n' +
            'Prüfung: Abschlusstest am Kurstag, Zertifikat.\n' +
            'Was ist enthalten: Unterlagen, Verkostung von 12 Weinen, Zertifikat.',
          standardPreis: 265.0,
          aktiv: true,
        },
      ];
      const seminare: any[] = [];
      for (const s of seminarPayloads) {
        const created = await strapi.entityService.create('api::seminar.seminar', {
          data: {
            ...s,
            slug: slugify(s.seminarname),
            publishedAt: new Date().toISOString(),
          },
        });
        seminare.push(created);
      }

      // 3) Pro Seminar mehrere Termine in verschiedenen Orten und Daten anlegen
      strapi.log.info('[seed] Schritt 4: create termine');
      const today = new Date();
      const oneDay = 24 * 60 * 60 * 1000;

      const makeDate = (offsetDays: number) => {
        const d = new Date(today.getTime() + offsetDays * oneDay);
        return d.toISOString().slice(0, 10);
      };

      const pickOrtId = (idx: number) => orte[idx % orte.length].id;

      let termCount = 0;
      for (let i = 0; i < seminare.length; i++) {
        const sem = seminare[i];

        // Für Abwechslung: je Seminar 2–3 Termine, einige eintägig, einige zweitägig
        const termineForSem = [
          {
            tage: [
              { datum: makeDate(7 + i * 3), startzeit: '18:00:00.000', endzeit: '21:00:00.000' },
            ],
            kapazitaet: 12 + (i % 3) * 6,
            preis: sem.standardPreis,
            ort: pickOrtId(i),
          },
          {
            tage: [
              { datum: makeDate(14 + i * 4), startzeit: '18:30:00.000', endzeit: '21:30:00.000' },
              // Zweiter Tag für jedes zweite Seminar
              ...(i % 2 === 0
                ? [{ datum: makeDate(15 + i * 4), startzeit: '10:00:00.000', endzeit: '14:00:00.000' }]
                : []),
            ],
            kapazitaet: 16 + (i % 2) * 4,
            preis: Math.round((Number(sem.standardPreis) * 1.05 + Number.EPSILON) * 100) / 100,
            ort: pickOrtId(i + 1),
          },
          // Dritter Termin nur für manche Seminare
          ...(i % 3 === 0
            ? [
                {
                  tage: [
                    { datum: makeDate(28 + i * 2), startzeit: '11:00:00.000', endzeit: '16:00:00.000' },
                  ],
                  kapazitaet: 10,
                  preis: Math.round((Number(sem.standardPreis) * 0.95 + Number.EPSILON) * 100) / 100,
                  ort: pickOrtId(i + 2),
                },
              ]
            : []),
        ];

        for (const t of termineForSem) {
          await strapi.entityService.create('api::termin.termin', {
            data: {
              tage: t.tage,
              kapazitaet: t.kapazitaet,
              preis: t.preis,
              planungsstatus: 'geplant',
              // Titel leer lassen → Lifecycle setzt automatisch „YYYY-DD-MM – Seminar – Ort“
              titel: '',
              seminar: sem.id,
              ort: t.ort,
              publishedAt: new Date().toISOString(),
            },
          });
          termCount++;
        }
      }

      // 4) Drei Rabattcodes anlegen
      strapi.log.info('[seed] Schritt 5: create gutscheine');
      const voucherPayloads = [
        {
          code: 'WILLKOMMEN10',
          typ: 'prozent',
          wert: 10,
          maxNutzung: 1,
          aktiv: true,
          bemerkung: '10% Willkommensrabatt – Einmalnutzung',
        },
        {
          code: 'EARLYBIRD50',
          typ: 'betrag',
          wert: 50,
          maxNutzung: 1,
          aktiv: true,
          bemerkung: '50 € Frühbucher – Einmalnutzung',
        },
        {
          code: 'SOMMER15',
          typ: 'prozent',
          wert: 15,
          maxNutzung: 1,
          aktiv: true,
          bemerkung: 'Sommeraktion 15% – Einmalnutzung',
        },
      ];
      let voucherCount = 0;
      for (const v of voucherPayloads) {
        await strapi.entityService.create('api::gutschein.gutschein', { data: v });
        voucherCount++;
      }

      strapi.log.info(
        `[seed] Fertig: ${orte.length} Orte, ${seminare.length} Seminare, ${termCount} Termine, ${voucherCount} Gutscheine angelegt`
      );
    };

    // Reset: Datensätze in korrekter Reihenfolge löschen (Kind → Eltern)
    if (shouldReset) {
      strapi.log.warn('[seed] RESET aktiviert: lösche vorhandene Daten...');
      try {
        // Reihenfolge: Buchungen → Termine → Seminare → Orte → Kunden → Gutscheine
        await strapi.db.query('api::buchung.buchung').deleteMany({ where: {} });
        await strapi.db.query('api::termin.termin').deleteMany({ where: {} });
        await strapi.db.query('api::seminar.seminar').deleteMany({ where: {} });
        await strapi.db.query('api::ort.ort').deleteMany({ where: {} });
        await strapi.db.query('api::kunde.kunde').deleteMany({ where: {} });
        await strapi.db.query('api::gutschein.gutschein').deleteMany({ where: {} });
        strapi.log.warn('[seed] RESET abgeschlossen');
      } catch (err) {
        strapi.log.error(`[seed] RESET Fehler: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Seeding ausführen, wenn SEED=true oder SEED_RESET=true gesetzt ist
    if (shouldSeed || shouldReset) {
      await runSeed();
    } else {
      strapi.log.info('[bootstrap] Seed/Reset nicht aktiviert');
    }
  },
};
