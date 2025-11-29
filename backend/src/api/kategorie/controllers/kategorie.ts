import { factories } from '@strapi/strapi';
import { slugify } from '../../../utils/slugify';

const FALLBACK_IMAGE = { url: '/favicon.png', alternativeText: 'Kategorie – Platzhalterbild' } as const;

export default factories.createCoreController('api::kategorie.kategorie', ({ strapi }) => ({
  async publicList(ctx) {
    const kategorien = await strapi.db.query('api::kategorie.kategorie').findMany({
      where: { publishedAt: { $not: null } },
      select: ['id', 'name', 'slug', 'kurzbeschreibung'],
      populate: { seo: true },
      orderBy: { name: 'asc' },
    });

    ctx.body = kategorien.map((kategorie: any) => {
      const name = typeof kategorie.name === 'string' ? kategorie.name : '';
      const resolvedSlug = typeof kategorie.slug === 'string' && kategorie.slug.trim().length > 0 ? kategorie.slug : slugify(name);
      const seo = (kategorie as any).seo ?? {};
      return {
        id: kategorie.id,
        name,
        slug: resolvedSlug,
        kurzbeschreibung: typeof kategorie.kurzbeschreibung === 'string' ? kategorie.kurzbeschreibung : null,
        seoTitle: typeof seo === 'object' ? seo.title ?? null : null,
        seoDescription: typeof seo === 'object' ? seo.description ?? null : null,
        seo,
      };
    });
  },

  async publicDetail(ctx) {
    const { slug } = ctx.params;

    if (typeof slug !== 'string' || slug.trim().length === 0) {
      return ctx.badRequest('Slug erforderlich');
    }

    const requestedSlug = slugify(slug.trim());

    const category = await strapi.db.query('api::kategorie.kategorie').findOne({
      where: {
        publishedAt: { $not: null },
        slug: requestedSlug,
      },
      select: ['id', 'name', 'slug', 'kurzbeschreibung'],
      populate: {
        seo: true,
        abschnitte: {
          on: {
            'landing.hero': {
              populate: {
                button: true,
                bildergalerie: { populate: { bilder: true } },
                video: { populate: { video: true, hintergrundbild: true } },
              },
            },
            'landing.bildergalerie': { populate: { bilder: true } },
            'landing.card-grid': {
              populate: {
                karten: {
                  populate: {
                    backgroundImage: true,
                    button: true,
                    seminarfinderKategorie: { fields: ['id', 'name', 'slug'] },
                  },
                },
              },
            },
            'landing.columns': {
              populate: {
                spalten: true,
              },
            },
            'landing.trennlinie': true,
            'landing.seminar-liste': {
              populate: {
                seminarkategorie: {
                  fields: ['id', 'name', 'slug', 'kurzbeschreibung'],
                },
              },
            },
            'landing.tabs': {
              populate: {
                reiter: true,
              },
            },
            'landing.seminar-finder': {
              populate: {
                standardKategorie: {
                  fields: ['id', 'name', 'slug'],
                },
                sichtbareFilter: {
                  fields: ['id', 'name', 'slug'],
                },
              },
            },
            'landing.seminar-produkt-karten': {
              populate: {
                seminarkategorie: {
                  fields: ['id', 'name', 'slug', 'kurzbeschreibung'],
                },
                produkte: {
                  fields: ['id', 'name', 'slug', 'kurzbeschreibung'],
                  populate: {
                    bild: true,
                  },
                },
              },
            },
          },
        },
        seminare: {
          select: ['id', 'name', 'slug', 'kurzbeschreibung', 'preis', 'mwst'],
          populate: {
            bild: { select: ['url', 'alternativeText'] },
            hintergrundbild: { select: ['url', 'alternativeText'] },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      return ctx.notFound('Kategorie nicht gefunden');
    }

    const kurzbeschreibung = typeof category.kurzbeschreibung === 'string' ? category.kurzbeschreibung : null;
    const seo = (category as any).seo ?? {};

    const seminare = Array.isArray((category as any).seminare)
      ? ((category as any).seminare as any[]).map((seminar) => ({
          id: seminar.id,
          name: seminar.name,
          slug: seminar.slug,
          kurzbeschreibung: seminar.kurzbeschreibung ?? null,
          preis: seminar.preis ?? null,
          mwst: typeof seminar.mwst === 'boolean' ? seminar.mwst : null,
          bild: seminar.bild ?? FALLBACK_IMAGE,
          hintergrundbild: seminar.hintergrundbild ?? FALLBACK_IMAGE,
        }))
      : [];

    ctx.body = {
      id: category.id,
      name: category.name,
      slug: category.slug ?? requestedSlug,
      kurzbeschreibung,
      seoTitle: typeof seo === 'object' ? seo.title ?? null : null,
      seoDescription: typeof seo === 'object' ? seo.description ?? null : null,
      seo,
      abschnitte: Array.isArray((category as any).abschnitte) ? (category as any).abschnitte : [],
      seminare,
    };
  },
}));
