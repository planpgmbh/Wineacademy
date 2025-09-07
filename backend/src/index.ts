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

      // Prüfen, ob bereits Seminare existieren. Falls ja, Seed überspringen (idempotent).
      const seminarCount = await strapi.entityService.count('api::seminar.seminar');
      strapi.log.info(`[seed] count seminare: ${seminarCount}`);
      if (seminarCount > 0) {
        strapi.log.info(`[seed] Überspringe: ${seminarCount} Seminare bereits vorhanden`);
        return;
      }

      // 1) Beispiel-Ort anlegen
      strapi.log.info('[seed] Schritt 2: create ort');
      const ort = await strapi.entityService.create('api::ort.ort', {
        data: {
          standort: 'Wine Academy Hamburg',
          typ: 'vorort',
          veranstaltungsort: 'HafenCity Campus',
          strasse: 'Am Sandtorkai 1',
          plz: '20457',
          stadt: 'Hamburg',
          land: 'Deutschland',
          publishedAt: new Date().toISOString(),
        },
      });

      // 2) Beispiel-Seminar anlegen
      const seminarName = 'Einführung in die Weinwelt';
      strapi.log.info('[seed] Schritt 3: create seminar');
      const seminar = await strapi.entityService.create('api::seminar.seminar', {
        data: {
          seminarname: seminarName,
          slug: slugify(seminarName),
          kurzbeschreibung: 'Grundlagen, Rebsorten, Verkostungstechnik – perfekt für Einsteiger.',
          beschreibung:
            'In diesem Seminar vermitteln wir die wichtigsten Basics der Weinwelt: Rebsorten, Anbau, Ausbau und die sensorische Verkostung. Ideal, um sicherer bei Kauf und Genuss zu werden.',
          infos: 'Dauer: 3 Stunden. Wasser und Brot inklusive.',
          standardPreis: 89.0,
          aktiv: true,
          publishedAt: new Date().toISOString(),
        },
      });

      // 3) Beispiel-Termin anlegen (mit Komponententag und Relationen)
      const today = new Date();
      const plus7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const dateStr = plus7.toISOString().slice(0, 10); // YYYY-MM-DD

      strapi.log.info('[seed] Schritt 4: create termin');
      // Lifecycle temporär deaktivieren, Titel direkt setzen
      const seminarTitle = seminar.seminarname;
      const ortTitle = ort.standort || ort.veranstaltungsort || '';
      const directTitel = [seminarTitle, ortTitle, dateStr].filter(Boolean).join(' – ');
      process.env.DISABLE_TITEL_LIFECYCLE = 'true';
      await strapi.entityService.create('api::termin.termin', {
        data: {
          tage: [
            {
              datum: dateStr,
              startzeit: '18:00:00.000',
              endzeit: '21:00:00.000',
            },
          ],
          kapazitaet: 12,
          preis: 89.0,
          planungsstatus: 'geplant',
          titel: directTitel,
          seminar: seminar.id,
          ort: ort.id,
          publishedAt: new Date().toISOString(),
        },
      });
      delete process.env.DISABLE_TITEL_LIFECYCLE;

      strapi.log.info('[seed] Fertig: Ort, Seminar, Termin angelegt');
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
