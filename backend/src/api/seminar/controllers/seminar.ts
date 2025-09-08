import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::seminar.seminar', ({ strapi }) => ({
  async publicList(ctx) {
    const seminars = await strapi.db.query('api::seminar.seminar').findMany({
      where: { aktiv: true, publishedAt: { $not: null } },
      select: ['id', 'seminarname', 'slug', 'kurzbeschreibung', 'standardPreis'],
      populate: { bild: { select: ['url', 'alternativeText'] } },
      orderBy: { seminarname: 'asc' },
    });

    const result = [] as any[];
    for (const s of seminars) {
      const termine = await strapi.db.query('api::termin.termin').findMany({
        where: { planungsstatus: 'geplant', publishedAt: { $not: null }, seminar: s.id },
        select: ['kapazitaet', 'preis', 'planungsstatus', 'id'],
        populate: {
          tage: { select: ['datum', 'startzeit', 'endzeit'] },
          ort: { select: ['standort', 'typ', 'veranstaltungsort', 'stadt'] },
        },
        orderBy: { id: 'asc' },
      });
      const fallbackBild = { url: '/favicon.png', alternativeText: 'Weinseminar – Testbild' } as any;
      const sWithBild = { ...(s as any), bild: (s as any).bild ?? fallbackBild };
      result.push({ ...sWithBild, termine });
    }

    ctx.body = result;
  },

  async publicDetail(ctx) {
    const { slug } = ctx.params;
    const items = await strapi.db.query('api::seminar.seminar').findMany({
      where: { aktiv: true, publishedAt: { $not: null }, slug },
      select: [
        'id',
        'seminarname',
        'slug',
        'kurzbeschreibung',
        'beschreibung',
        'infos',
        'standardPreis',
      ],
      populate: { bild: { select: ['url', 'alternativeText'] } },
      limit: 1,
    });

    const seminar = Array.isArray(items) ? items[0] : items;
    if (!seminar) return ctx.notFound('Seminar nicht gefunden');
    const termine = await strapi.db.query('api::termin.termin').findMany({
      where: { planungsstatus: 'geplant', publishedAt: { $not: null }, seminar: seminar.id },
      select: ['kapazitaet', 'preis', 'planungsstatus', 'id'],
      populate: {
        tage: { select: ['datum', 'startzeit', 'endzeit'] },
        ort: { select: ['standort', 'typ', 'veranstaltungsort', 'stadt'] },
      },
      orderBy: { id: 'asc' },
    });
    const fallbackBild = { url: '/favicon.png', alternativeText: 'Weinseminar – Testbild' } as any;
    const withBild = { ...(seminar as any), bild: (seminar as any).bild ?? fallbackBild };
    ctx.body = { ...withBild, termine };
  },
}));
