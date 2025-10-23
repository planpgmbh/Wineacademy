import { factories } from '@strapi/strapi';
import { slugify } from '../../../utils/slugify';

export default factories.createCoreController('api::seminar.seminar', ({ strapi }) => ({
  async publicList(ctx) {
    const seminars = await strapi.db.query('api::seminar.seminar').findMany({
      where: { aktiv: true, publishedAt: { $not: null } },
      select: ['id', 'name', 'slug', 'kurzbeschreibung', 'preis', 'mwst'],
      populate: {
        bild: { select: ['url', 'alternativeText'] },
        kategorien: { select: ['id', 'name', 'slug', 'kurzbeschreibung'] },
      },
      orderBy: { name: 'asc' },
    });

    const result = [] as any[];
    for (const s of seminars) {
      const termineRaw = await strapi.db.query('api::termin.termin').findMany({
        where: { planungsstatus: 'geplant', publishedAt: { $not: null }, seminar: s.id },
        select: ['kapazitaet', 'planungsstatus', 'id', 'starttag'],
        populate: {
          tageMitUhrzeit: { select: ['datum', 'startzeit', 'endzeit'] },
          standort: { select: ['id', 'name', 'typ', 'veranstaltungsort', 'stadt'] },
        },
        orderBy: { id: 'asc' },
      });
      const termine = termineRaw.map((termin) => {
        const standortRaw = (termin as any).standort ?? null;
        const standort = standortRaw
          ? {
              id: standortRaw.id ?? null,
              name: typeof standortRaw.name === 'string' ? standortRaw.name : null,
              typ: typeof standortRaw.typ === 'string' ? standortRaw.typ : null,
              veranstaltungsort:
                typeof standortRaw.veranstaltungsort === 'string' ? standortRaw.veranstaltungsort : null,
              stadt: typeof standortRaw.stadt === 'string' ? standortRaw.stadt : null,
            }
          : null;

        return {
          id: termin.id,
          starttag: termin.starttag ?? null,
          kapazitaet: termin.kapazitaet ?? null,
          planungsstatus: termin.planungsstatus ?? null,
          preis: (s as any).preis ?? null,
          standort,
          tageMitUhrzeit: Array.isArray((termin as any).tageMitUhrzeit) ? (termin as any).tageMitUhrzeit : [],
        };
      });

      const kategorienRaw = Array.isArray((s as any).kategorien) ? (s as any).kategorien : [];
      const kategorien = kategorienRaw
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
            kurzbeschreibung: typeof cat.kurzbeschreibung === 'string' ? cat.kurzbeschreibung : null,
          };
        });

      const fallbackBild = { url: '/favicon.png', alternativeText: 'Weinseminar – Testbild' } as any;
      const sWithBild = { ...(s as any), bild: (s as any).bild ?? fallbackBild };
      result.push({ ...sWithBild, kategorien, termine });
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
