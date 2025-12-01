import { nowIso } from './helpers';

type SeminarDocument = {
  id: number;
  documentId: string;
  name: string;
  kapazitaet?: number | null;
};

type Standort = {
  id: number;
  name: string | null;
};

function formatDate(daysFromToday: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

async function fetchPublishedSeminars(strapi: any): Promise<SeminarDocument[]> {
  const items = await strapi.documents('api::seminar.seminar').findMany({
    status: 'published',
    fields: ['id', 'documentId', 'name', 'kapazitaet'],
  });
  return Array.isArray(items) ? items.filter((item) => item?.documentId) : [];
}

async function fetchPublishedStandorte(strapi: any): Promise<Standort[]> {
  const items = await strapi.db
    .query('api::standort.standort')
    .findMany({ where: { publishedAt: { $not: null } }, select: ['id', 'name'] });
  return Array.isArray(items) ? items : [];
}

export async function seedTermine(strapi: any, log: (msg: string) => void) {
  log('Termine werden neu aufgebaut');

  await strapi.db.query('api::termin.termin').deleteMany({ where: {} });

  const seminars = await fetchPublishedSeminars(strapi);
  const standorte = await fetchPublishedStandorte(strapi);
  if (seminars.length === 0) {
    log('Keine veröffentlichten Seminare gefunden – Termine übersprungen.');
    return;
  }

  const fallbackStandortId = standorte[0]?.id ?? null;
  let createdCount = 0;

  for (const [index, seminar] of seminars.entries()) {
    const baseCapacity =
      seminar.kapazitaet != null && Number.isFinite(Number(seminar.kapazitaet))
        ? Number(seminar.kapazitaet)
        : 30;
    for (let i = 0; i < 3; i += 1) {
      const starttag = formatDate(30 * (i + 1) + index);
      const standort = standorte[(index + i) % Math.max(standorte.length, 1)];
      await strapi.entityService.create('api::termin.termin', {
        data: {
          starttag,
          kapazitaet: baseCapacity,
          planungsstatus: 'geplant',
          publishedAt: nowIso(),
          seminar: seminar.id,
          standort: standort?.id ?? fallbackStandortId,
          tageMitUhrzeit: [
            {
              datum: starttag,
              startzeit: '10:00:00',
              endzeit: '17:00:00',
            },
          ],
        },
      });
      createdCount += 1;
    }
  }

  log(`Termine neu angelegt: ${createdCount}`);
}
