import { factories } from '@strapi/strapi';

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export default factories.createCoreController('api::seminar.seminar', ({ strapi }) => ({
  async publicList(ctx) {
    const seminars = await strapi.db.query('api::seminar.seminar').findMany({
      where: { aktiv: true, publishedAt: { $not: null } },
      select: ['id', 'name', 'slug', 'kurzbeschreibung', 'preis', 'mwst'],
      populate: { bild: { select: ['url', 'alternativeText'] } },
      orderBy: { name: 'asc' },
    });

    const result = [] as any[];
    for (const s of seminars) {
      const termineRaw = await strapi.db.query('api::termin.termin').findMany({
        where: { planungsstatus: 'geplant', publishedAt: { $not: null }, seminar: s.id },
        select: ['kapazitaet', 'planungsstatus', 'id', 'starttag'],
        populate: {
          tageMitUhrzeit: { select: ['datum', 'startzeit', 'endzeit'] },
          standort: { select: ['name', 'typ', 'veranstaltungsort', 'stadt'] },
        },
        orderBy: { id: 'asc' },
      });
      const termine = termineRaw.map((t) => ({ ...t, preis: (s as any).preis }));
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
        'name',
        'slug',
        'kurzbeschreibung',
        'beschreibung',
        'infos',
        'preis',
        'mwst',
        'bookingbox_topline',
        'bookingbox_headline',
        'bookingbox_body',
      ],
      populate: {
        bild: { select: ['url', 'alternativeText'] },
        hintergrundbild: { select: ['url', 'alternativeText'] },
        seminarinhalte: true,
        kategorien: {
          select: ['id', 'name', 'slug'],
        },
      },
      limit: 1,
    });

    const seminar = Array.isArray(items) ? items[0] : items;
    if (!seminar) return ctx.notFound('Seminar nicht gefunden');
    const termineRaw = await strapi.db.query('api::termin.termin').findMany({
      where: { planungsstatus: 'geplant', publishedAt: { $not: null }, seminar: seminar.id },
      select: ['kapazitaet', 'planungsstatus', 'id', 'starttag'],
      populate: {
        tageMitUhrzeit: { select: ['datum', 'startzeit', 'endzeit'] },
        standort: { select: ['name', 'typ', 'veranstaltungsort', 'stadt'] },
      },
      orderBy: { id: 'asc' },
    });
    const termine = termineRaw.map((t) => ({ ...t, preis: (seminar as any).preis }));
    const fallbackBild = { url: '/favicon.png', alternativeText: 'Weinseminar – Testbild' } as any;
    const fallbackHeroBild = fallbackBild;
    const rawCategories = Array.isArray((seminar as any).kategorien) ? (seminar as any).kategorien : [];
    const kategorien = rawCategories
      .filter((cat) => typeof cat?.name === 'string' && cat.name.trim().length > 0)
      .map((cat) => {
        const name = cat.name.trim();
        const slug =
          typeof cat?.slug === 'string' && cat.slug.trim().length > 0
            ? cat.slug.trim()
            : slugify(name);
        return {
          id: cat.id,
          name,
          slug,
        };
      });

    const withBildern = {
      ...(seminar as any),
      bild: (seminar as any).bild ?? fallbackBild,
      hintergrundbild: (seminar as any).hintergrundbild ?? fallbackHeroBild,
      seminarinhalte: (seminar as any).seminarinhalte ?? [],
      kategorien,
    };
    ctx.body = { ...withBildern, termine };
  },
}));
