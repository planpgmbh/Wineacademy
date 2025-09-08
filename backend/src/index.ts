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

    // Gemeinsame Definition der Seed-Bilder
    const seedImageDefs = [
      { name: 'seed-wine-red.png',   url: 'https://placehold.co/800x533/7f0015/ffffff?text=Red+Wine' },
      { name: 'seed-wine-rose.png',  url: 'https://placehold.co/800x533/ff8da1/4a0010?text=Ros%C3%A9' },
      { name: 'seed-wine-white.png', url: 'https://placehold.co/800x533/f0e68c/4a3b00?text=White+Wine' },
      { name: 'seed-wine-bubbles.png', url: 'https://placehold.co/800x533/f7e7a9/3b2c00?text=Champagne' },
      { name: 'seed-wine-tasting.png', url: 'https://placehold.co/800x533/5a0011/ffffff?text=Tasting' },
    ] as const;

    // Hilfsfunktion: 5 Testbilder sicherstellen (PNG von placehold.co) und Upload-Einträge liefern
    const ensureSeedImages = async () => {
      try {
        // Vor dem (Neu-)Upload: Bestehende Seed-DB-Einträge entfernen
        try {
          await strapi.db.query('plugin::upload.file').deleteMany({
            where: { name: { $in: seedImageDefs.map((d) => d.name) } },
          });
        } catch (e) {
          strapi.log.warn(`[seed] Konnte bestehende Seed-Uploads nicht löschen: ${e instanceof Error ? e.message : String(e)}`);
        }
        // Bereits vorhandene Dateien finden
        let existing = await strapi.db.query('plugin::upload.file').findMany({
          where: { name: { $in: seedImageDefs.map((d) => d.name) } },
          select: ['id', 'name', 'url', 'alternativeText'],
        });
        // Prüfen, ob die referenzierten Dateien wirklich auf der Platte existieren –
        // falls nicht, die DB-Einträge löschen, damit wir korrekt neu hochladen.
        try {
          const { access } = await import('node:fs/promises');
          const { join } = await import('node:path');
          const missingIds: number[] = [];
          for (const f of existing as any[]) {
            const relPath = (f.url || '').replace(/^\/+/, '');
            const absPath = join(process.cwd(), 'public', relPath.replace(/^public\//, ''));
            try {
              await access(absPath);
            } catch {
              missingIds.push(f.id);
            }
          }
          if (missingIds.length) {
            await strapi.db.query('plugin::upload.file').deleteMany({ where: { id: { $in: missingIds } } });
            existing = await strapi.db.query('plugin::upload.file').findMany({
              where: { name: { $in: seedImageDefs.map((d) => d.name) } },
              select: ['id', 'name', 'url', 'alternativeText'],
            });
          }
        } catch (e) {
          strapi.log.warn(`[seed] Prüfen/Entfernen fehlender Upload-Dateien fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
        }
        const existingNames = new Set(existing.map((f: any) => f.name));

        const uploadService = strapi.service('plugin::upload.upload');
        const created: any[] = [];

        for (const def of seedImageDefs) {
          if (existingNames.has(def.name)) continue;
          try {
            const res = await fetch(def.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buffer = Buffer.from(await res.arrayBuffer());
            // Buffer auf temporäre Datei schreiben und per Upload-Service hochladen
            const { mkdtemp, writeFile } = await import('node:fs/promises');
            const { tmpdir } = await import('node:os');
            const { join } = await import('node:path');
            const dir = await mkdtemp(join(tmpdir(), 'seedimg-'));
            const tmpPath = join(dir, def.name);
            await writeFile(tmpPath, buffer);
            // Strapi v5 erwartet Felder wie bei koa-body: filepath, originalFilename, mimetype, size
            // Korrekte Datei-Keys für den Upload-Service
            const files = {
              filepath: tmpPath,
              originalFilename: def.name,
              mimetype: 'image/png',
              size: buffer.length,
            } as any;
            const data = {
              fileInfo: {
                name: def.name,
                alternativeText: 'Weinseminar – Testbild',
                caption: 'Testbild (Seed)',
              },
            } as any;
            const uploaded = await uploadService.upload({ data, files: [files] });
            if (Array.isArray(uploaded)) created.push(...uploaded);
          } catch (e) {
            strapi.log.warn(`[seed] Bild-Upload fehlgeschlagen für ${def.name}: ${e}`);
          }
        }

        // Alle (existierende + neu erstellte) zurückgeben
        const all = await strapi.db.query('plugin::upload.file').findMany({
          where: { name: { $in: seedImageDefs.map((d) => d.name) } },
          select: ['id', 'name', 'url', 'alternativeText'],
          orderBy: { name: 'asc' },
        });
        strapi.log.info(`[seed] Verfügbare Testbilder: ${all.length}`);
        return all;
      } catch (err) {
        strapi.log.warn(`[seed] ensureSeedImages Fehler: ${err instanceof Error ? err.message : String(err)}`);
        return [];
      }
    };

    const runSeed = async () => {
      strapi.log.info('[seed] Starte Seed...');
      strapi.log.info('[seed] Schritt 1: count seminare');

      // Prüfen, wie viele Seminare existieren.
      const seminarCount = await strapi.entityService.count('api::seminar.seminar');
      strapi.log.info(`[seed] count seminare: ${seminarCount}`);
      
      // Testbilder sicherstellen (PNG)
      const seedImages = await ensureSeedImages();

      if (seminarCount > 0) {
        // Wenn bereits Seminare vorhanden sind: fehlende Bilder ergänzen und dann beenden.
        const seminareExisting = await strapi.db.query('api::seminar.seminar').findMany({
          where: { publishedAt: { $not: null } },
          select: ['id', 'seminarname'],
          populate: { bild: { select: ['id'] } },
          orderBy: { id: 'asc' },
        });
        let idx = 0;
        for (const s of seminareExisting) {
          const hasBild = (s as any).bild?.id;
          if (!hasBild && seedImages.length) {
            const img = seedImages[idx % seedImages.length];
            await strapi.entityService.update('api::seminar.seminar', (s as any).id, {
              data: { bild: (img as any).id },
            });
            idx++;
          }
        }
        strapi.log.info('[seed] Bestehende Seminare: fehlende Bilder ergänzt');
        return;
      }

      // 1) Mehrere Orte anlegen
      strapi.log.info('[seed] Schritt 2: create orte');
      const ortPayloads = [
        {
          standort: 'Wine Academy Hamburg',
          typ: 'vorort',
          veranstaltungsort: 'HafenCity Campus',
          strasse: 'Am Sandtorkai 1',
          plz: '20457',
          stadt: 'Hamburg',
          land: 'Deutschland',
        },
        {
          standort: 'Weinschule Berlin',
          typ: 'vorort',
          veranstaltungsort: 'Prenzlauer Berg Atelier',
          strasse: 'Kastanienallee 25',
          plz: '10435',
          stadt: 'Berlin',
          land: 'Deutschland',
        },
        {
          standort: 'Online via Zoom',
          typ: 'online',
          veranstaltungsort: 'Zoom-Meeting',
          stadt: 'Remote',
          land: 'Deutschland',
        },
        {
          standort: 'München Vinothek',
          typ: 'vorort',
          veranstaltungsort: 'Altstadt Seminarraum',
          strasse: 'Weinstr. 7',
          plz: '80333',
          stadt: 'München',
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

      // 2) Mehrere Seminare anlegen
      strapi.log.info('[seed] Schritt 3: create seminare');
      const seminarPayloads = [
        {
          seminarname: 'Einführung in die Weinwelt',
          kurzbeschreibung: 'Grundlagen, Rebsorten, Verkostungstechnik – perfekt für Einsteiger.',
          beschreibung:
            'Basics der Weinwelt: Rebsorten, Anbau, Ausbau und sensorische Verkostung. Ideal, um sicherer bei Kauf und Genuss zu werden.',
          infos: 'Dauer: 3 Stunden. Wasser und Brot inklusive.',
          standardPreis: 89.0,
          aktiv: true,
        },
        {
          seminarname: 'Italien intensiv',
          kurzbeschreibung: 'Von Südtirol bis Sizilien – terroirgeprägt und vielfältig.',
          beschreibung:
            'Regionen, Rebsorten und Stile Italiens. Vergleichende Verkostung klassischer Vertreter inkl. DOC/DOCG-System.',
          infos: 'Dauer: 4 Stunden. Snackteller inklusive.',
          standardPreis: 119.0,
          aktiv: true,
        },
        {
          seminarname: 'Frankreich Grand Crus',
          kurzbeschreibung: 'Bordeaux, Burgund, Rhône – große Namen, große Weine.',
          beschreibung:
            'Vertiefung in klassische französische Regionen. Stilistik, Klassifikationen und Lagerpotential.',
          infos: 'Dauer: 4 Stunden. Premiumflight, limitierte Plätze.',
          standardPreis: 149.0,
          aktiv: true,
        },
        {
          seminarname: 'Sensorik & Foodpairing',
          kurzbeschreibung: 'Aromenlehre, Säure/Süße-Spiel und passende Speisen.',
          beschreibung:
            'Praxisnahe Sensorik-Übungen und Kombinationen mit Speisen. Erkennen, beschreiben, kombinieren.',
          infos: 'Dauer: 3,5 Stunden. Häppchen und Wasser inklusive.',
          standardPreis: 129.0,
          aktiv: true,
        },
        {
          seminarname: 'Sekt & Champagner',
          kurzbeschreibung: 'Traditionsverfahren, Dosage, Stile – prickelnde Übersicht.',
          beschreibung:
            'Herstellungsverfahren, Rebsorten und Qualitätsstufen von Schaumwein. Fokus auf traditionelle Methode.',
          infos: 'Dauer: 2,5 Stunden. Brot & Wasser inklusive.',
          standardPreis: 99.0,
          aktiv: true,
        },
        {
          seminarname: 'Wein & Käse',
          kurzbeschreibung: 'Harmonie und Kontrast – die besten Kombinationen.',
          beschreibung:
            'Geführte Verkostung verschiedener Käsetypen mit passenden Weinen. Theorie + Praxis.',
          infos: 'Dauer: 3 Stunden. Käsevariation inklusive.',
          standardPreis: 109.0,
          aktiv: true,
        },
      ];
      const seminare: any[] = [];
      for (const s of seminarPayloads) {
        // passendes Bild rotieren
        const img = seedImages.length ? seedImages[seminare.length % seedImages.length] : null;
        const created = await strapi.entityService.create('api::seminar.seminar', {
          data: {
            ...s,
            slug: slugify(s.seminarname),
            ...(img ? { bild: (img as any).id } : {}),
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

      strapi.log.info(`[seed] Fertig: ${orte.length} Orte, ${seminare.length} Seminare, ${termCount} Termine angelegt`);
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
        // Zusätzlich: Seed-Uploads entfernen (DB-Einträge)
        try {
          await strapi.db.query('plugin::upload.file').deleteMany({
            where: { name: { $in: seedImageDefs.map((d) => d.name) } },
          });
        } catch (e) {
          strapi.log.warn(`[seed] Upload-Reset Warnung: ${e instanceof Error ? e.message : String(e)}`);
        }
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
